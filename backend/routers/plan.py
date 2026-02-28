from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.schemas import PlanCreateRequest
from models.domain import Plan
import sys
import os

# Add agents directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'agents'))
from planner import generate_plan_stream

router = APIRouter(prefix="/api/plans", tags=["plans"])

@router.get("/{plan_id}")
def get_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if plan:
        return {
            "plan_id": plan.id,
            "domain": plan.domain,
            "goal": plan.goal,
            "mental_model": plan.mental_model,
            "knowledge_map": plan.knowledge_map,
            "path": plan.path,
            "rationale": plan.rationale,
        }
    return {"error": "Plan not found"}

@router.post("/")
async def create_plan(request: PlanCreateRequest, db: Session = Depends(get_db)):
    return await generate_plan_stream(db, request.learner_id, request.intent)


