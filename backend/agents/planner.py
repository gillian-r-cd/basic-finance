"""
planner.py - Plan generation (one-shot LLM call wrapped in SSE stream).
Main function: generate_plan_stream(db, learner_id, intent) -> SSE response.
Uses llm_client for LLM calls, context_assembly for prompt building,
  output_parser for JSON extraction.
Design ref: MVP2 section 2 (unified LLM layer).
"""
import json
import uuid
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from agents.llm_client import call_llm
from agents.output_parser import parse_json_response
from agents.context_assembly import assemble_planner_context
from models.domain import Plan, Learner, Artifact


async def generate_plan_stream(db: Session, learner_id: str, intent: str):
    """
    1. Ensure learner exists.
    2. Assemble planner context (with profile + trajectory injection).
    3. Call LLM via shared client (non-streaming).
    4. Parse JSON via unified parser.
    5. Save to DB.
    6. Yield SSE events.
    """
    learner = db.query(Learner).filter(Learner.id == learner_id).first()
    if not learner:
        learner = Learner(id=learner_id)
        db.add(learner)
        db.commit()

    plan_id = str(uuid.uuid4())
    messages = assemble_planner_context(db, learner_id, intent)

    async def generate():
        yield {
            "event": "thinking",
            "data": json.dumps({"stage": "analyzing_intent",
                                "message": "Analyzing your learning intent..."}),
        }

        try:
            yield {
                "event": "thinking",
                "data": json.dumps({"stage": "selecting_foundation",
                                    "message": "Structuring mental model "
                                               "and knowledge foundation..."}),
            }

            raw_response = await call_llm(messages, stream=False)
            plan_dict = parse_json_response(raw_response)

            plan_dict.setdefault("domain", "general")
            plan_dict.setdefault("goal", {})
            plan_dict.setdefault("mental_model", {})
            plan_dict.setdefault("knowledge_map", None)
            plan_dict.setdefault("path", [])
            plan_dict.setdefault("rationale", "Generated based on your intent.")

            db_plan = Plan(
                id=plan_id,
                learner_id=learner_id,
                intent=intent,
                goal=plan_dict["goal"],
                mental_model=plan_dict["mental_model"],
                path=plan_dict["path"],
                rationale=plan_dict["rationale"],
                domain=plan_dict["domain"],
                knowledge_map=plan_dict["knowledge_map"],
                status="active",
            )
            db.add(db_plan)

            db_artifact = Artifact(
                id=str(uuid.uuid4()),
                plan_id=plan_id,
                type="plan",
                content=plan_dict,
                rationale=plan_dict["rationale"],
                visibility="learner_visible",
            )
            db.add(db_artifact)
            db.commit()

            yield {
                "event": "plan_ready",
                "data": json.dumps({
                    "plan_id": plan_id,
                    "domain": plan_dict["domain"],
                    "goal": plan_dict["goal"],
                    "mental_model": plan_dict["mental_model"],
                    "knowledge_map": plan_dict["knowledge_map"],
                    "path": plan_dict["path"],
                    "rationale": plan_dict["rationale"],
                }),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"detail": str(e)}),
            }

    return EventSourceResponse(generate())
