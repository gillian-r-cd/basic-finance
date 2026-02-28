"""
learner.py - Learner router.
Endpoints: GET / (list), GET /{id} (detail), GET /{id}/profile,
           PATCH /{id}/profile (update profile), GET /{id}/trajectory.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import get_db
from models.domain import Learner, Trajectory
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/learners", tags=["learners"])


class ProfileUpdate(BaseModel):
    knowledge_level: Optional[dict] = None
    cognitive_preferences: Optional[list] = None
    identified_obstacles: Optional[list] = None
    strengths: Optional[list] = None


@router.get("/")
def get_learners(db: Session = Depends(get_db)):
    learners = db.query(Learner).all()
    return [{"id": l.id, "created_at": l.created_at,
             "has_profile": bool(l.profile and isinstance(l.profile, dict) and l.profile)}
            for l in learners]


@router.get("/{learner_id}")
def get_learner(learner_id: str, db: Session = Depends(get_db)):
    learner = db.query(Learner).filter(Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    return {"id": learner.id, "created_at": learner.created_at,
            "profile": learner.profile}


@router.get("/{learner_id}/profile")
def get_profile(learner_id: str, db: Session = Depends(get_db)):
    learner = db.query(Learner).filter(Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    return {"learner_id": learner.id, "profile": learner.profile or {}}


@router.patch("/{learner_id}/profile")
def update_profile(learner_id: str, update: ProfileUpdate,
                   db: Session = Depends(get_db)):
    learner = db.query(Learner).filter(Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    existing = learner.profile if isinstance(learner.profile, dict) else {}

    if update.knowledge_level is not None:
        kl = existing.get("knowledge_level", {})
        kl.update(update.knowledge_level)
        existing["knowledge_level"] = kl
    if update.cognitive_preferences is not None:
        existing["cognitive_preferences"] = update.cognitive_preferences
    if update.identified_obstacles is not None:
        existing["identified_obstacles"] = update.identified_obstacles
    if update.strengths is not None:
        existing["strengths"] = update.strengths

    learner.profile = existing
    flag_modified(learner, "profile")
    db.commit()

    return {"learner_id": learner.id, "profile": learner.profile}


@router.get("/{learner_id}/trajectory")
def get_trajectory(learner_id: str, db: Session = Depends(get_db)):
    learner = db.query(Learner).filter(Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    trajectories = (
        db.query(Trajectory)
        .filter(Trajectory.learner_id == learner_id)
        .order_by(Trajectory.created_at.asc())
        .all()
    )
    return [{"id": t.id, "concept": t.concept, "understanding": t.understanding,
             "depth_level": t.depth_level, "source_session_id": t.source_session_id,
             "created_at": t.created_at} for t in trajectories]
