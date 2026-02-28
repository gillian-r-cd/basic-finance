from pydantic import BaseModel
from typing import Optional, List, Dict
from enum import Enum

class BloomLevel(str, Enum):
    remember = "remember"
    understand = "understand"
    apply = "apply"
    analyze = "analyze"
    evaluate = "evaluate"
    create = "create"

class ContentRole(str, Enum):
    core = "core"              # 核心结构
    supporting = "supporting"  # 承重支撑
    resilience = "resilience"  # 韧性增强

class KnowledgeType(str, Enum):
    causal = "causal"          # 因果/动力学
    structural = "structural"  # 结构/分类
    procedural = "procedural"  # 过程/程序
    conceptual = "conceptual"  # 原理/概念
    methodological = "methodological"  # 方法论/框架

class MessageType(str, Enum):
    text = "text"
    interactive = "interactive"
    quiz = "quiz"
    scenario = "scenario"
    verification = "verification"
    decision = "decision"      # 系统决策说明（可见制品）

class Goal(BaseModel):
    description: str
    boundary: str
    success_criteria: List[str]
    bloom_level: BloomLevel

class MentalModel(BaseModel):
    name: str
    foundation: str
    foundation_type: str       # "hard" / "soft" / "hard+soft"
    foundation_boundary: str
    core_nodes: List[str]
    supporting_nodes: List[str]
    resilience_nodes: List[str]

class LearningUnit(BaseModel):
    unit_id: str
    topic: str
    content_role: ContentRole
    knowledge_type: KnowledgeType
    representation: str
    objectives: List[str]
    verification_criteria: List[str]
    anchors: List[str] = []

class KnowledgeMapNode(BaseModel):
    id: str
    label: str
    status: str  # "on_path" | "excluded" | "contextual"
    brief: str
    exclusion_reason: Optional[str] = None

class KnowledgeMapEdge(BaseModel):
    from_node: str  # "from" in JSON, aliased because "from" is a Python keyword
    to_node: str    # "to" in JSON
    relation: str   # "enables" | "motivates" | "supports" | "contrasts"

    class Config:
        populate_by_name = True

class KnowledgeMap(BaseModel):
    nodes: List[KnowledgeMapNode]
    edges: List[KnowledgeMapEdge]

class LearningPlan(BaseModel):
    domain: str = "general"
    goal: Goal
    mental_model: MentalModel
    knowledge_map: Optional[KnowledgeMap] = None
    path: List[LearningUnit]
    rationale: str

class ComponentSpec(BaseModel):
    component: str
    props: dict
    instruction: str

class AgentMessage(BaseModel):
    content: str
    message_type: MessageType
    component_spec: Optional[ComponentSpec] = None

class VerificationResult(BaseModel):
    levels_checked: List[str]
    gaps_found: List[str]
    depth_estimate: int        # 1-5
    feedback: str
    recommendation: str        # "proceed" / "revisit" / "deepen"

class LearnerProfile(BaseModel):
    knowledge_level: Dict[str, str]
    cognitive_preferences: List[str]
    identified_obstacles: List[str]
    strengths: List[str]

class PlanCreateRequest(BaseModel):
    learner_id: str
    intent: str

class SessionCreateRequest(BaseModel):
    plan_id: str
    unit_id: str

