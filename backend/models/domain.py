from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Learner(Base):
    __tablename__ = "learners"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=func.now())
    profile = Column(JSON, default={})

    plans = relationship("Plan", back_populates="learner")
    trajectories = relationship("Trajectory", back_populates="learner")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True, index=True)
    learner_id = Column(String, ForeignKey("learners.id"))
    intent = Column(String)
    goal = Column(JSON)
    mental_model = Column(JSON)
    path = Column(JSON)
    rationale = Column(String)
    domain = Column(String, nullable=True)
    knowledge_map = Column(JSON, nullable=True)
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=func.now())

    learner = relationship("Learner", back_populates="plans")
    sessions = relationship("Session", back_populates="plan")
    artifacts = relationship("Artifact", back_populates="plan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("plans.id"))
    unit_id = Column(String)
    phase = Column(String)
    status = Column(String, default="active")
    verification_state = Column(JSON, nullable=True)  # tracks layer progress during verification
    created_at = Column(DateTime, default=func.now())

    plan = relationship("Plan", back_populates="sessions")
    messages = relationship("Message", back_populates="session")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    role = Column(String)
    content = Column(String)
    message_type = Column(String, default="text")
    component_spec = Column(JSON, nullable=True)
    phase = Column(String, nullable=True)  # "teaching" or "verification", set when message is created
    created_at = Column(DateTime, default=func.now())

    session = relationship("Session", back_populates="messages")


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("plans.id"))
    session_id = Column(String, nullable=True)
    type = Column(String)
    content = Column(JSON)
    rationale = Column(String)
    visibility = Column(String, default="learner_visible")
    created_at = Column(DateTime, default=func.now())

    plan = relationship("Plan", back_populates="artifacts")


class Trajectory(Base):
    __tablename__ = "trajectory"

    id = Column(String, primary_key=True, index=True)
    learner_id = Column(String, ForeignKey("learners.id"))
    concept = Column(String)
    understanding = Column(String)
    depth_level = Column(Integer)
    source_session_id = Column(String)
    created_at = Column(DateTime, default=func.now())

    learner = relationship("Learner", back_populates="trajectories")


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String, primary_key=True, index=True)
    role = Column(String, unique=True)
    content = Column(String)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

