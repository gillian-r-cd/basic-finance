"""
context_assembly.py - Per-role context assembly for LLM calls.
Main functions:
  assemble_context(db, session_id, user_message) -> dict: Session-based assembly
    for Teacher/Verifier (and future Diagnostician). Returns role, phase, messages.
  assemble_planner_context(db, learner_id, intent) -> list[dict]: Planner-specific
    assembly. Returns messages list with system prompt (enriched with profile/trajectory)
    and user message (intent + JSON schema).
Each role gets a different subset of information injected into its system prompt:
  - Planner: learner profile + mastered concepts (NEW in MVP2 Phase 0)
  - Teacher: unit objectives + knowledge_type + component catalog + learner profile + full history
  - Verifier: verification_state + unit criteria + mental model + learner profile
              + only verification-phase assistant messages (Teacher content excluded via message.phase)
Token budget: system prompt and current user message are always kept;
  oldest history messages are dropped first when budget is exceeded.
Design ref: MVP2 section 2, MVP section 5.1, design doc section 10.3.
"""
import json
import os
from sqlalchemy.orm import Session
from models.domain import Session as DBSession, Plan, Learner, Message, Trajectory
from agents.prompts import get_prompt
from components.catalog import get_catalog_for_prompt

# Token budget: conservative estimate. Most models support 8k-128k.
# We use char_count / 3 as a rough token estimate (works for mixed CJK + ASCII).
MAX_CONTEXT_TOKENS = int(os.environ.get("MAX_CONTEXT_TOKENS", "6000"))


def _estimate_tokens(text: str) -> int:
    """Rough token count: len / 3 works for mixed CJK + ASCII content."""
    return max(1, len(text) // 3)


def _trim_history_to_budget(system_msg: dict, history_msgs: list[dict], user_msg: dict, budget: int) -> list[dict]:
    """Drop oldest history messages until total tokens fit within budget.
    System message and current user message are always kept.
    """
    system_tokens = _estimate_tokens(system_msg["content"])
    user_tokens = _estimate_tokens(user_msg["content"])
    reserved = system_tokens + user_tokens
    remaining = budget - reserved
    if remaining <= 0:
        return [system_msg, user_msg]

    # Walk history from newest to oldest, accumulate until budget is hit
    kept = []
    running = 0
    for msg in reversed(history_msgs):
        msg_tokens = _estimate_tokens(msg["content"])
        if running + msg_tokens > remaining:
            break
        kept.append(msg)
        running += msg_tokens
    kept.reverse()
    return [system_msg] + kept + [user_msg]


def _find_current_unit(plan, unit_id: str) -> dict:
    """Find the unit dict from plan.path that matches unit_id."""
    if not plan or not plan.path:
        return {}
    for u in plan.path:
        if str(u.get("unit_id")) == str(unit_id):
            return u
    return {}


def _get_mastered_concepts(db: Session, learner_id: str) -> list[dict]:
    """Get concepts the learner has previously mastered from the Trajectory table."""
    if not learner_id:
        return []
    trajs = db.query(Trajectory).filter(Trajectory.learner_id == learner_id).order_by(Trajectory.created_at.asc()).all()
    return [{"concept": t.concept, "depth": t.depth_level} for t in trajs]


def _format_mastered_concepts(mastered: list[dict]) -> str:
    """Format mastered concepts as a context block for injection into system prompt."""
    if not mastered:
        return ""
    lines = ["\n--- PREVIOUSLY MASTERED CONCEPTS ---"]
    for m in mastered:
        lines.append(f"  - {m['concept']} (depth: {m['depth']}/5)")
    lines.append("The learner already understands these. Build on them, don't re-teach.")
    return "\n".join(lines)


def _build_diagnostician_context(system_prompt: str, plan, learner) -> str:
    """Assemble Diagnostician system prompt with plan's core concepts for probing."""
    parts = [system_prompt]

    if plan and plan.path:
        parts.append("\n--- PLAN CORE CONCEPTS TO PROBE ---")
        for u in plan.path:
            topic = u.get("topic", "")
            objectives = u.get("objectives", [])
            parts.append(f"  - {topic}: {', '.join(objectives[:2])}")

    if plan and plan.mental_model:
        mm = plan.mental_model
        parts.append(f"\n--- MENTAL MODEL ---")
        parts.append(f"Foundation: {mm.get('foundation', 'N/A')}")
        core = mm.get("core_nodes", [])
        if core:
            parts.append(f"Core concepts to assess: {', '.join(core)}")

    if learner and learner.profile and isinstance(learner.profile, dict) and learner.profile:
        parts.append(f"\n--- EXISTING PROFILE (if any) ---\n{json.dumps(learner.profile, ensure_ascii=False)}")

    return "\n".join(parts)


def _build_profile_updater_context(system_prompt: str, learner, session_messages: list) -> str:
    """Assemble ProfileUpdater system prompt with session conversation and existing profile."""
    parts = [system_prompt]

    if learner and learner.profile and isinstance(learner.profile, dict) and learner.profile:
        parts.append(f"\n--- EXISTING PROFILE (merge with this) ---\n{json.dumps(learner.profile, ensure_ascii=False)}")

    if session_messages:
        parts.append("\n--- SESSION CONVERSATION ---")
        for msg in session_messages:
            role_label = "Learner" if msg.get("role") == "user" else "Teacher/Verifier"
            parts.append(f"[{role_label}]: {msg.get('content', '')[:500]}")

    return "\n".join(parts)


def _build_planner_context(system_prompt: str, learner, mastered: list[dict] | None = None) -> str:
    """Assemble Planner system prompt with learner profile and mastered concepts.
    Unlike Teacher/Verifier, Planner has no session history or unit context.
    It uses profile and trajectory to adapt plan generation for returning learners.
    """
    parts = [system_prompt]

    mc_block = _format_mastered_concepts(mastered or [])
    if mc_block:
        parts.append(mc_block)

    if learner and learner.profile and isinstance(learner.profile, dict) and learner.profile:
        parts.append(f"\n--- LEARNER PROFILE ---\n{json.dumps(learner.profile, ensure_ascii=False)}")

    return "\n".join(parts)


def assemble_planner_context(db: Session, learner_id: str, intent: str) -> list[dict]:
    """
    Assemble LLM messages for Planner role. Returns a messages list
    ready for call_llm(). Planner-specific: no session, no history.
    Injects learner profile and mastered concepts into system prompt.
    The intent + JSON schema goes into the user message.
    """
    base_prompt = get_prompt(db, "planner")

    learner = db.query(Learner).filter(Learner.id == learner_id).first() if learner_id else None
    mastered = _get_mastered_concepts(db, learner_id) if learner_id else []

    system_content = _build_planner_context(base_prompt, learner, mastered)

    user_content = f"The learner's intent is: \"{intent}\""

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]


def _build_teacher_context(system_prompt: str, plan, learner, unit: dict, mastered: list[dict] | None = None) -> str:
    """Assemble Teacher system prompt with unit-specific info and component catalog."""
    parts = [system_prompt]

    # Previously mastered concepts (cross-session memory)
    mc_block = _format_mastered_concepts(mastered or [])
    if mc_block:
        parts.append(mc_block)

    # Current unit details
    if unit:
        parts.append("\n--- CURRENT UNIT ---")
        parts.append(f"Topic: {unit.get('topic', 'N/A')}")
        parts.append(f"Content Role: {unit.get('content_role', 'N/A')}")
        parts.append(f"Knowledge Type: {unit.get('knowledge_type', 'N/A')}")
        objectives = unit.get("objectives", [])
        if objectives:
            parts.append("Learning Objectives (you MUST cover these):")
            for i, obj in enumerate(objectives, 1):
                parts.append(f"  {i}. {obj}")
        verification = unit.get("verification_criteria", [])
        if verification:
            parts.append("Verification Criteria (the learner will be tested on these after your teaching):")
            for i, vc in enumerate(verification, 1):
                parts.append(f"  {i}. {vc}")
        anchors = unit.get("anchors", [])
        if anchors:
            parts.append("TRUTH ANCHORS (verifiable facts/formulas grounding this unit - teach around these):")
            for i, a in enumerate(anchors, 1):
                parts.append(f"  {i}. {a}")

    # Mental model foundation_type for soft-base awareness
    if plan and plan.mental_model:
        ft = plan.mental_model.get("foundation_type", "")
        if "soft" in ft:
            fb = plan.mental_model.get("foundation_boundary", "")
            parts.append(f"\n[SOFT FOUNDATION WARNING] This plan uses a soft/mixed foundation. "
                         f"You MUST name the model, state its boundary ({fb}), and mention alternatives.")

    # Component catalog (filtered by domain + unit topic to save tokens)
    unit_topic = unit.get("topic", "")
    plan_domain = plan.domain if plan and plan.domain else ""
    parts.append(f"\n--- COMPONENT CATALOG ---\n{get_catalog_for_prompt(unit_topic, plan_domain)}")

    # Mental model context (summary level)
    if plan and plan.mental_model:
        mm = plan.mental_model
        parts.append("\n--- MENTAL MODEL (context) ---")
        parts.append(f"Name: {mm.get('name', 'N/A')}")
        parts.append(f"Foundation: {mm.get('foundation', 'N/A')}")
        core = mm.get("core_nodes", [])
        if core:
            parts.append(f"Core Nodes: {', '.join(core)}")

    # Learner profile
    if learner and learner.profile and isinstance(learner.profile, dict) and learner.profile:
        parts.append(f"\n--- LEARNER PROFILE ---\n{json.dumps(learner.profile, ensure_ascii=False)}")

    return "\n".join(parts)


def _build_verifier_context(system_prompt: str, plan, learner, unit: dict,
                            verification_state: dict | None = None,
                            mastered: list[dict] | None = None) -> str:
    """Assemble Verifier system prompt with verification criteria, mental model,
    and structured layer progress state.
    Design ref: MVP section 5.1 - Verifier context EXCLUDES teacher's teaching content
    to prevent self-verification bias.
    """
    parts = [system_prompt]

    # Previously mastered concepts (cross-session memory)
    mc_block = _format_mastered_concepts(mastered or [])
    if mc_block:
        parts.append(mc_block)

    # Inject structured verification state (critical for layer tracking)
    if verification_state:
        current_layer = verification_state.get("current_layer", 1)
        layers = verification_state.get("layers", {})
        layer_names = {1: "Explanation (Feynman)", 2: "Prediction", 3: "Anomaly Detection", 4: "Boundary Awareness"}
        parts.append("\n--- VERIFICATION PROGRESS (authoritative, trust this over conversation history) ---")
        for ln in range(1, 5):
            status = layers.get(str(ln), "pending")
            marker = "→ CURRENT" if ln == current_layer and status == "in_progress" else status.upper()
            parts.append(f"  Layer {ln} ({layer_names[ln]}): {marker}")
        passed_count = sum(1 for v in layers.values() if v == "passed")
        parts.append(f"Layers passed so far: {passed_count}/4")
        parts.append(f"You are currently testing Layer {current_layer}. Do NOT ask about other layers until this one is resolved.")
        if passed_count >= 3:
            parts.append("The learner has passed 3+ layers. If their current answer is also satisfactory, you may issue [UNIT_PASSED: score=N].")
    else:
        parts.append("\n--- VERIFICATION PROGRESS ---")
        parts.append("No state found. Start from Layer 1.")

    # Verification criteria for current unit
    if unit:
        parts.append("\n--- CURRENT UNIT ---")
        parts.append(f"Topic: {unit.get('topic', 'N/A')}")
        verification = unit.get("verification_criteria", [])
        if verification:
            parts.append("Verification Criteria (test ALL of these):")
            for i, vc in enumerate(verification, 1):
                parts.append(f"  {i}. {vc}")
        objectives = unit.get("objectives", [])
        if objectives:
            parts.append("The learner was expected to learn:")
            for i, obj in enumerate(objectives, 1):
                parts.append(f"  {i}. {obj}")
        anchors = unit.get("anchors", [])
        if anchors:
            parts.append("TRUTH ANCHORS (use these to cross-validate the learner's answers):")
            for i, a in enumerate(anchors, 1):
                parts.append(f"  {i}. {a}")

    # Mental model foundation
    if plan and plan.mental_model:
        mm = plan.mental_model
        parts.append("\n--- MENTAL MODEL ---")
        parts.append(f"Foundation: {mm.get('foundation', 'N/A')}")
        parts.append(f"Foundation Boundary: {mm.get('foundation_boundary', 'N/A')}")
        core = mm.get("core_nodes", [])
        if core:
            parts.append(f"Core Nodes: {', '.join(core)}")

    # Learner profile
    if learner and learner.profile and isinstance(learner.profile, dict) and learner.profile:
        parts.append(f"\n--- LEARNER PROFILE ---\n{json.dumps(learner.profile, ensure_ascii=False)}")

    return "\n".join(parts)


def assemble_context(db: Session, session_id: str, user_message: str) -> dict:
    """
    Assemble the LLM context messages based on current session phase.
    Returns: {"role": str, "messages": list[dict]}
    """
    db_session = db.query(DBSession).filter(DBSession.id == session_id).first()

    if not db_session:
        return {
            "role": "teacher",
            "phase": "teaching",
            "messages": [
                {"role": "system", "content": get_prompt(db, "teacher")},
                {"role": "user", "content": user_message},
            ],
        }

    plan = db.query(Plan).filter(Plan.id == db_session.plan_id).first() if db_session.plan_id else None
    learner = db.query(Learner).filter(Learner.id == plan.learner_id).first() if plan else None

    phase = db_session.phase or "teaching"
    role_map = {
        "diagnosis": "diagnostician",
        "teaching": "teacher",
        "verification": "verifier",
    }
    role = role_map.get(phase, "teacher")
    base_prompt = get_prompt(db, role)

    # Find current unit from plan path
    unit = _find_current_unit(plan, db_session.unit_id) if db_session.unit_id else {}

    # Get previously mastered concepts for cross-session memory
    learner_id = plan.learner_id if plan else None
    mastered = _get_mastered_concepts(db, learner_id) if learner_id else []

    # Count user turns in current phase (for state machine hardening)
    phase_turn_count = (
        db.query(Message)
        .filter(Message.session_id == session_id, Message.role == "user", Message.phase == phase)
        .count()
    )

    # Build role-specific system prompt
    if role == "diagnostician":
        system_content = _build_diagnostician_context(base_prompt, plan, learner)
    elif role == "teacher":
        system_content = _build_teacher_context(base_prompt, plan, learner, unit, mastered)
        if phase_turn_count >= 8:
            system_content += (
                f"\n\n--- SYSTEM NOTICE ---\n"
                f"You have been teaching for {phase_turn_count} turns. "
                f"Consider whether the learner is ready for verification. "
                f"If they can explain the core concepts, transition to verification."
            )
    elif role == "verifier":
        verification_state = db_session.verification_state if db_session.verification_state else None
        system_content = _build_verifier_context(base_prompt, plan, learner, unit, verification_state, mastered)
    else:
        system_content = base_prompt

    messages = [{"role": "system", "content": system_content}]

    # Fetch conversation history
    history = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .limit(20)
        .all()
    )

    if role == "verifier":
        # For Verifier: include all user messages, but only assistant messages
        # from the verification phase (filter by message.phase field).
        # This prevents self-verification bias: Verifier never sees Teacher's explanations.
        for msg in history:
            if msg.role == "user":
                messages.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant" and msg.phase == "verification":
                messages.append({"role": "assistant", "content": msg.content})
    else:
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})

    user_msg = {"role": "user", "content": user_message}

    # Token budget: keep system prompt + current user message, trim oldest history
    system_msg = messages[0]  # always the system prompt
    history_msgs = messages[1:]  # everything after system prompt
    trimmed = _trim_history_to_budget(system_msg, history_msgs, user_msg, MAX_CONTEXT_TOKENS)

    return {
        "role": role,
        "phase": phase,
        "messages": trimmed,
        "unit_topic": unit.get("topic", ""),
        "unit_knowledge_type": unit.get("knowledge_type", ""),
        "phase_turn_count": phase_turn_count,
    }
