"""
session.py - Session router.
Endpoints: GET /{id}, GET /{id}/details (session + plan + unit + history + artifacts),
           POST / (create session), POST /{id}/messages (send message via orchestrator).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession
from database import get_db
from pydantic import BaseModel
from models.schemas import SessionCreateRequest
from models.domain import Session, Plan, Learner, Message, Artifact  # noqa: F811
import uuid
import sys
import os

# Add agents directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'agents'))
from orchestrator import orchestrate_message

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

class MessageInput(BaseModel):
    content: str

@router.get("/{session_id}")
def get_session(session_id: str, db: DbSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/{session_id}/details")
def get_session_details(session_id: str, db: DbSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    plan = db.query(Plan).filter(Plan.id == session.plan_id).first()
    learner = db.query(Learner).filter(Learner.id == plan.learner_id).first() if plan else None
    
    # Get all messages
    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.created_at.asc()).all()
    
    # Find current unit details
    current_unit = None
    if plan and plan.path:
        for unit in plan.path:
            if str(unit.get("unit_id")) == str(session.unit_id):
                current_unit = unit
                break
                
    # Get artifacts for this session
    artifacts = db.query(Artifact).filter(Artifact.session_id == session_id).order_by(Artifact.created_at.asc()).all()

    return {
        "session": session,
        "plan": plan,
        "learner": learner,
        "current_unit": current_unit,
        "history": messages,
        "artifacts": artifacts
    }

@router.post("/")
def create_session(request: SessionCreateRequest, db: DbSession = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == request.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    learner = db.query(Learner).filter(Learner.id == plan.learner_id).first() if plan else None
    profile_empty = (not learner
                     or not learner.profile
                     or not isinstance(learner.profile, dict)
                     or not learner.profile)
    initial_phase = "diagnosis" if profile_empty else "teaching"

    session_id = str(uuid.uuid4())
    new_session = Session(
        id=session_id,
        plan_id=request.plan_id,
        unit_id=request.unit_id,
        phase=initial_phase,
        status="active"
    )
    db.add(new_session)
    db.commit()

    return {"session_id": session_id, "phase": initial_phase}

@router.post("/{session_id}/messages")
async def send_message(session_id: str, message: MessageInput, db: DbSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please start a new session from the plan review page.")
    return await orchestrate_message(db, session_id, message.content)


