"""
orchestrator.py - Agent Orchestrator Loop (session-based conversation).
Main function: orchestrate_message (SSE streaming with role switching,
  phase transitions, layer tracking, trajectory, artifact generation).
Key invariants:
  - User message saved to DB AFTER context assembly (prevents duplication).
  - Every Message is tagged with current session phase for downstream filtering.
  - LLM calls go through agents/llm_client.py (shared singleton).
  - Output parsing goes through agents/output_parser.py (unified parsing).
Design ref: MVP2 section 2 (unified LLM layer).
"""
import asyncio
import json
import uuid
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from agents.context_assembly import assemble_context
from agents.llm_client import call_llm
from agents.output_parser import extract_markers, parse_json_response
from agents.prompts import get_prompt
from models.domain import Message, Session as DbSessionModel, Trajectory, Plan, Artifact, Learner


def _build_artifact_rationale(role: str, unit_topic: str,
                              component_spec: dict | None,
                              phase_transition: str | None) -> str:
    """Build a substantive rationale string for the artifact."""
    parts = []
    if role == "teacher":
        if unit_topic:
            parts.append(f"Teaching unit: {unit_topic}.")
        if component_spec:
            parts.append(f"Selected interactive component "
                         f"'{component_spec.get('component')}' "
                         f"to support hands-on exploration.")
        else:
            parts.append("Text-only response (no component matched current topic).")
        if phase_transition == "verification":
            parts.append("Judged learner ready for verification; "
                         "transitioning to Verifier role.")
    elif role == "verifier":
        if unit_topic:
            parts.append(f"Verifying understanding of: {unit_topic}.")
        if phase_transition == "teaching":
            parts.append("Learner passed verification; advancing to next unit.")
    else:
        parts.append(f"Role: {role}.")
    return " ".join(parts) if parts else f"Agent decision as {role}."


def _handle_phase_transition(db: Session, session_id: str):
    """Initialize verification state when transitioning to verification phase."""
    db_session = db.query(DbSessionModel).filter(
        DbSessionModel.id == session_id
    ).first()
    if db_session:
        db_session.phase = "verification"
        db_session.verification_state = {
            "current_layer": 1,
            "layers": {"1": "in_progress", "2": "pending",
                       "3": "pending", "4": "pending"},
        }
        db.commit()


def _handle_layer_passed(db: Session, session_id: str, passed_layer: int):
    """Update verification_state when a layer is passed."""
    db_session = db.query(DbSessionModel).filter(
        DbSessionModel.id == session_id
    ).first()
    if not db_session or not db_session.verification_state:
        return
    vs = dict(db_session.verification_state)
    layers = dict(vs.get("layers", {}))
    layers[str(passed_layer)] = "passed"
    next_layer = None
    for layer_num in range(1, 5):
        if layers.get(str(layer_num)) == "pending":
            next_layer = layer_num
            break
    if next_layer:
        layers[str(next_layer)] = "in_progress"
        vs["current_layer"] = next_layer
    else:
        vs["current_layer"] = passed_layer
    vs["layers"] = layers
    db_session.verification_state = vs
    flag_modified(db_session, "verification_state")
    db.commit()
    print(f"[VERIFIER] Layer {passed_layer} passed. State: {vs}")


def _handle_unit_passed(db: Session, session_id: str, score: int) -> tuple[str | None, str | None]:
    """Handle unit completion: save trajectory, advance to next unit.
    If this is the last unit, mark session as completed.
    Returns (phase_transition, unit_changed) for SSE response.
    """
    db_session = db.query(DbSessionModel).filter(
        DbSessionModel.id == session_id
    ).first()
    if not db_session:
        return None, None

    plan = db.query(Plan).filter(Plan.id == db_session.plan_id).first()
    phase_transition = None
    unit_changed = None

    current_unit_topic = "Unknown"
    if plan and plan.path:
        for u in plan.path:
            if str(u.get("unit_id")) == str(db_session.unit_id):
                current_unit_topic = u.get("topic", "Unknown")
                break

    traj = Trajectory(
        id=str(uuid.uuid4()),
        learner_id=plan.learner_id if plan else "unknown",
        concept=current_unit_topic,
        understanding="Verified by Agent",
        depth_level=score,
        source_session_id=session_id,
    )
    db.add(traj)

    if plan and plan.path:
        current_idx = -1
        for i, u in enumerate(plan.path):
            if str(u.get("unit_id")) == str(db_session.unit_id):
                current_idx = i
                break
        if current_idx != -1 and current_idx + 1 < len(plan.path):
            next_unit = plan.path[current_idx + 1]
            db_session.unit_id = next_unit.get("unit_id")
            db_session.phase = "teaching"
            db_session.verification_state = None
            phase_transition = "teaching"
            unit_changed = db_session.unit_id
        elif current_idx != -1:
            # Last unit passed — mark session as completed
            db_session.status = "completed"
            db_session.verification_state = None
            print(f"[ORCHESTRATOR] Session {session_id} completed (all units passed)")

    db.commit()
    return phase_transition, unit_changed


def _handle_diagnosis_complete(db: Session, session_id: str, diagnosis_result: dict | None):
    """Process [DIAGNOSIS_COMPLETE]: save profile to learner, transition to teaching."""
    db_session = db.query(DbSessionModel).filter(
        DbSessionModel.id == session_id
    ).first()
    if not db_session:
        return
    plan = db.query(Plan).filter(Plan.id == db_session.plan_id).first()
    if plan:
        learner = db.query(Learner).filter(Learner.id == plan.learner_id).first()
        if learner and diagnosis_result:
            existing = learner.profile if isinstance(learner.profile, dict) else {}
            merged_kl = {**existing.get("knowledge_level", {}),
                         **diagnosis_result.get("knowledge_level", {})}
            merged = {
                "knowledge_level": merged_kl,
                "cognitive_preferences": diagnosis_result.get("cognitive_preferences",
                                                              existing.get("cognitive_preferences", [])),
                "identified_obstacles": diagnosis_result.get("identified_obstacles",
                                                             existing.get("identified_obstacles", [])),
                "strengths": diagnosis_result.get("strengths",
                                                  existing.get("strengths", [])),
            }
            learner.profile = merged
            flag_modified(learner, "profile")
            print(f"[ORCHESTRATOR] Learner profile updated from diagnosis: "
                  f"{list(merged_kl.keys())}")

    db_session.phase = "teaching"
    db.commit()
    print(f"[ORCHESTRATOR] Diagnosis complete for session {session_id}. "
          f"Transitioned to teaching.")


def _handle_diagnosis_cutoff(db: Session, session_id: str, turn_count: int) -> bool:
    """Force phase transition from diagnosis to teaching after 3 turns.
    Returns True if cutoff was triggered.
    """
    if turn_count < 3:
        return False
    db_session = db.query(DbSessionModel).filter(
        DbSessionModel.id == session_id
    ).first()
    if db_session and db_session.phase == "diagnosis":
        db_session.phase = "teaching"
        db.commit()
        print(f"[ORCHESTRATOR] Diagnosis hard cutoff at turn {turn_count}. "
              f"Forcing transition to teaching.")
        return True
    return False


async def _update_profile_from_session(db: Session, session_id: str):
    """Background task: call profile_updater LLM to update learner profile after unit completion."""
    try:
        db_session = db.query(DbSessionModel).filter(
            DbSessionModel.id == session_id
        ).first()
        if not db_session:
            return
        plan = db.query(Plan).filter(Plan.id == db_session.plan_id).first()
        if not plan:
            return
        learner = db.query(Learner).filter(Learner.id == plan.learner_id).first()
        if not learner:
            return

        messages_db = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.created_at.asc())
            .all()
        )
        conversation = [{"role": m.role, "content": m.content} for m in messages_db]

        from agents.context_assembly import _build_profile_updater_context
        system_prompt = get_prompt(db, "profile_updater")
        system_content = _build_profile_updater_context(system_prompt, learner, conversation)

        llm_messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": "Analyze the conversation above and output the updated profile JSON."},
        ]

        raw = await call_llm(llm_messages, stream=False)
        profile_data = parse_json_response(raw)

        if profile_data:
            existing = learner.profile if isinstance(learner.profile, dict) else {}
            merged_kl = {**existing.get("knowledge_level", {}),
                         **profile_data.get("knowledge_level", {})}
            merged = {
                "knowledge_level": merged_kl,
                "cognitive_preferences": profile_data.get(
                    "cognitive_preferences",
                    existing.get("cognitive_preferences", [])),
                "identified_obstacles": profile_data.get(
                    "identified_obstacles",
                    existing.get("identified_obstacles", [])),
                "strengths": profile_data.get(
                    "strengths", existing.get("strengths", [])),
            }
            learner.profile = merged
            flag_modified(learner, "profile")
            db.commit()
            print(f"[PROFILE_UPDATER] Profile updated for learner {learner.id}: "
                  f"{list(merged_kl.keys())}")
        else:
            print(f"[PROFILE_UPDATER] Failed to parse profile update for session {session_id}")
    except Exception as e:
        print(f"[PROFILE_UPDATER] Error updating profile: {e}")


async def orchestrate_message(db: Session, session_id: str, user_message: str):
    """
    Agent Orchestrator Loop:
    1. Assemble context (per-role)
    2. Call LLM via shared client (streaming)
    3. Parse markers via unified parser
    4. Handle state transitions
    5. Persist messages + artifacts
    6. Yield SSE events
    """
    context = assemble_context(db, session_id, user_message)
    current_phase = context["phase"]
    phase_turn_count = context.get("phase_turn_count", 0)

    # Diagnosis hard cutoff: force to teaching after 3 turns
    if current_phase == "diagnosis":
        cutoff = _handle_diagnosis_cutoff(db, session_id, phase_turn_count)
        if cutoff:
            context = assemble_context(db, session_id, user_message)
            current_phase = context["phase"]

    user_msg_db = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role="user",
        content=user_message,
        phase=current_phase,
    )
    db.add(user_msg_db)
    db.commit()

    messages = context["messages"]
    current_role = context["role"]

    async def generate():
        yield {
            "event": "thinking",
            "data": json.dumps({"stage": "analyzing",
                                "message": f"[{current_role}] Analyzing your input..."}),
        }

        try:
            response = await call_llm(messages, stream=True)

            content_accumulated = ""
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    text_chunk = chunk.choices[0].delta.content
                    content_accumulated += text_chunk
                    yield {
                        "event": "message_chunk",
                        "data": json.dumps({"chunk": text_chunk}),
                    }

            # --- Unified marker extraction ---
            final_content, markers = extract_markers(content_accumulated)

            message_type = "text"
            component_spec = markers.get("component_spec")
            if component_spec:
                message_type = "interactive"

            phase_transition = markers.get("phase_transition")
            unit_changed = None

            # --- State machine: handle markers ---
            if markers.get("diagnosis_complete"):
                _handle_diagnosis_complete(
                    db, session_id, markers.get("diagnosis_result"))
                phase_transition = "teaching"

            if phase_transition == "verification":
                _handle_phase_transition(db, session_id)

            if "layer_passed" in markers:
                _handle_layer_passed(db, session_id, markers["layer_passed"])

            if "unit_passed" in markers:
                pt, uc = _handle_unit_passed(db, session_id, markers["unit_passed"])
                if pt:
                    phase_transition = pt
                if uc:
                    unit_changed = uc
                asyncio.create_task(_update_profile_from_session(db, session_id))

            yield {
                "event": "message_complete",
                "data": json.dumps({
                    "full_content": final_content,
                    "message_type": message_type,
                    "component_spec": component_spec,
                    "phase_transition": phase_transition,
                    "unit_changed": unit_changed,
                }),
            }

            # Persist assistant message
            db_sess_now = db.query(DbSessionModel).filter(
                DbSessionModel.id == session_id
            ).first()
            save_phase = db_sess_now.phase if db_sess_now else current_phase
            asst_msg_db = Message(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role="assistant",
                content=final_content,
                message_type=message_type,
                component_spec=component_spec,
                phase=save_phase,
            )
            db.add(asst_msg_db)
            db.commit()

            # Persist artifact
            artifact_rationale = _build_artifact_rationale(
                current_role, context.get("unit_topic", ""),
                component_spec, phase_transition,
            )
            artifact_type = f"{current_role}_decision"
            db_sess_for_art = db.query(DbSessionModel).filter(
                DbSessionModel.id == session_id
            ).first()
            plan_id_for_art = (db_sess_for_art.plan_id
                               if db_sess_for_art else None)
            db_artifact = Artifact(
                id=str(uuid.uuid4()),
                plan_id=plan_id_for_art,
                session_id=session_id,
                type=artifact_type,
                content={"component_spec": component_spec,
                         "phase_transition": phase_transition},
                rationale=artifact_rationale,
                visibility="learner_visible",
            )
            db.add(db_artifact)
            db.commit()

            yield {
                "event": "artifact",
                "data": json.dumps({
                    "type": artifact_type,
                    "rationale": artifact_rationale,
                    "visibility": "learner_visible",
                }),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"detail": str(e)}),
            }

    return EventSourceResponse(generate())
