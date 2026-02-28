# 学习体系 MVP 方案

> 本文档是《AI 时代的学习体系设计》的工程落地方案。从第一性原理出发，确定 MVP 的范围、架构和实现路径。

---

## 一、MVP 的第一性原理：验证什么假设

MVP 需要回答一个核心问题：

> **一个让学习者看到"系统是如何为我做决策的"的学习系统，是否比"直接和 ChatGPT 对话学习"产生更好的学习效果？**

这个假设的底层逻辑：ChatGPT 能解释任何知识，但它缺少四样东西——而这四样东西恰好是本体系的全部差异化价值：

| # | 差异化能力 | ChatGPT 缺什么 | 溯源 |
|---|-----------|---------------|------|
| 1 | **结构化规划 + 可见理由** | 不会主动规划学习路径，也不会说明"为什么教这个" | 3.1, 11.2 |
| 2 | **心智模型架构 + 地基选择** | 不会显式选择第一性原理作为教学地基 | 1.3, 3.2 |
| 3 | **多层次理解验证** | 无法系统性地检验理解深度，容易制造流利度错觉 | 6.1, 6.2 |
| 4 | **可见的决策轨迹** | 学习者无法审视系统对自己的判断 | 11.2, 10.5 |

**MVP 的范围：在一个具体领域（金融投资入门），让这四项能力可运行、可体验、可评估。**

---

## 二、MVP 范围裁剪

### 2.1 保留（核心价值环节）

| 管线步骤 | MVP 中的实现形式 |
|---------|---------------|
| 1. 目标锚定 | Agent 将学习者的模糊意图翻译为结构化目标，呈现给学习者确认 |
| 2. 前置诊断 | 2-3 轮对话探测当前知识水平，生成初始学习者画像 |
| 3. 心智模型 + 地基 | Agent 选择心智模型结构和第一性原理基底，向学习者展示理由 |
| 4. 图谱规划 + 剪枝 | 生成学习路径，标注每个单元的内容角色（核心/承重/韧性），展示剪枝理由 |
| 6. 学习体验交付 | 对话式教学 + 预制交互组件（图表、模拟器），由 Agent 选择并参数化 |
| 8. 理解验证 | 每个单元结束后进行多层次验证（解释、预测、异常识别、边界意识） |
| 可见性 | 路径理由、学习者画像、评估推理过程——随时可查 |

### 2.2 简化（MVP 中降低复杂度）

| 完整体系中的能力 | MVP 简化方式 |
|---------------|------------|
| 5. 工具推演与生成 | 使用预制组件目录，Agent 从中选择，不即时生成新工具 |
| 7. 动态保障（脚手架/褪除） | 内置在 Teacher Agent 的提示词中，不独立为模块 |
| 9. 迁移验证 | 在最后一个单元中做一次跨场景练习，不做完整的远迁移验证 |
| 螺旋回路 | 记录认知轨迹数据，但不实现自动重访触发（留待后续迭代） |
| 10.1 双环内环 | 每次会话结束后提取学习者特征更新画像，不做复杂行为分析 |

### 2.3 推迟（MVP 不做）

- Generative UI（即时生成全新 UI 组件）
- 多领域支持（MVP 只做金融投资入门）
- 知识图谱的动态延展/收缩（路径在规划阶段确定，学习过程中不变）
- 多模态内容生成（语音、视频）
- 用户注册/认证系统（MVP 使用本地会话）

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│                                                         │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────┐ │
│  │   Home   │ │  PlanReview  │ │  Learn   │ │Profile │ │
│  │  输入意图  │ │ 查看路径+理由 │ │ 对话+交互 │ │ 画像   │ │
│  └──────────┘ └──────────────┘ └──────────┘ └────────┘ │
│                        │                                │
│          REST API + Server-Sent Events (SSE)            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    Backend (FastAPI)                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Agent Orchestrator                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │ Planner  │ │ Teacher  │ │    Verifier      │ │    │
│  │  │  Role    │ │  Role    │ │     Role         │ │    │
│  │  └────┬─────┘ └────┬─────┘ └───────┬──────────┘ │    │
│  │       │            │               │             │    │
│  │  ┌────┴────────────┴───────────────┴──────┐      │    │
│  │  │         Context Assembly Layer          │      │    │
│  │  │  每个角色有独立的上下文组装规则             │      │    │
│  │  └────────────────┬───────────────────────┘      │    │
│  └───────────────────┼──────────────────────────────┘    │
│                      │                                   │
│  ┌───────────────────┴───────────────────────────┐      │
│  │                Storage (SQLite)                │      │
│  │  learners │ plans │ sessions │ messages │       │      │
│  │  artifacts │ trajectory                        │      │
│  └───────────────────────────────────────────────┘      │
│                      │                                   │
│                OpenAI API (LLM)                          │
└─────────────────────────────────────────────────────────┘
```

### 3.1 核心设计决策

**单 Agent，多角色。** 不使用多个独立 Agent，而是一个 Agent 在不同环节切换角色。角色决定两件事：系统提示词（定义行为）和上下文组装规则（定义输入）。

理由：MVP 阶段，Agent 之间的协调成本远高于角色切换的成本。单 Agent 保持状态连贯，避免上下文在 Agent 间传递时的信息损耗。

**Agent 思考过程可见。** Agent 在真正回复前，通过流式传输返回思考过程（内部打草稿）。在 UI 层面，使用类似折叠面板（Accordion）的交互展示"思考过程"，让学习者看到系统内部推理逻辑。

理由：提升系统透明度，增强用户对系统决策过程的信任，符合 11.2 可见性原则。

**提示词后台动态可调。** 所有系统提示词（Planner, Teacher, Verifier）均存储在数据库中，而非硬编码在代码里。提供后台管理接口实现随时修改与热生效。

理由：MVP 阶段需要频繁基于测试结果调整对话策略，后台可调能极大提升迭代效率。

**预制组件目录，Agent 选择 + 参数化。** Agent 不生成 UI 代码，而是从一个预制的组件目录中选择合适的组件，并指定参数。前端根据组件规格渲染。

理由：这是 10.4（契约扩展）的 MVP 实现——组件目录就是契约，新组件按接口实现后即可被 Agent 使用。

**每步生成制品，标注可见性。** 每个 Agent 决策都生成一个 artifact，标注为 `learner_visible` 或 `system_only`。前端只展示 `learner_visible` 的制品。

理由：这是 10.5（可回溯制品）和 11.3（可见性边界）的直接实现。

---

## 四、数据模型

### 4.1 数据库表结构

```sql
-- 学习者
CREATE TABLE learners (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 学习者画像（learner_visible）
    profile JSON DEFAULT '{}'
    -- profile 结构:
    -- {
    --   "knowledge_level": { "topic": "level" },
    --   "cognitive_preferences": ["visual", "analogical"],
    --   "identified_obstacles": ["..."],
    --   "strengths": ["..."]
    -- }
);

-- 学习计划
CREATE TABLE plans (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    intent TEXT,                    -- 学习者原始意图
    goal JSON,                     -- 结构化目标
    -- goal 结构:
    -- {
    --   "description": "...",
    --   "boundary": "不学什么",
    --   "success_criteria": ["..."],
    --   "bloom_level": "apply"
    -- }
    mental_model JSON,             -- 心智模型架构
    -- mental_model 结构:
    -- {
    --   "name": "个人投资决策模型",
    --   "foundation": "复利的数学结构 + 风险溢价",
    --   "foundation_type": "hard+soft",
    --   "foundation_boundary": "不覆盖衍生品定价...",
    --   "core_nodes": ["复利", "风险与收益", "分散化"],
    --   "supporting_nodes": ["通货膨胀", "损失厌恶"],
    --   "resilience_nodes": ["市场有效性假说的边界"]
    -- }
    path JSON,                     -- 学习路径（有序单元列表）
    -- path 结构:
    -- [{
    --   "unit_id": "u1",
    --   "topic": "复利：时间的杠杆",
    --   "content_role": "core",
    --   "knowledge_type": "causal",
    --   "representation": "interactive_chart",
    --   "objectives": ["理解复利的指数增长本质", "能预测参数变化的影响方向"],
    --   "verification_criteria": ["能用自己的话解释为什么复利是指数而非线性", "能识别出违反复利逻辑的投资承诺"]
    -- }]
    rationale TEXT,                 -- 路径选择理由（learner_visible）
    status TEXT DEFAULT 'draft',   -- draft / active / completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会话
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    plan_id TEXT REFERENCES plans(id),
    unit_id TEXT,                   -- 当前学习单元
    phase TEXT,                    -- diagnosis / teaching / verification
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    role TEXT,                     -- user / assistant / system
    content TEXT,                  -- 文本内容
    message_type TEXT DEFAULT 'text',
    -- message_type: text / interactive / quiz / scenario / verification / decision
    component_spec JSON,           -- 交互组件规格（仅 interactive 类型）
    -- component_spec 结构:
    -- {
    --   "component": "CompoundInterestChart",
    --   "props": { "initialPrincipal": 10000, "rateRange": [0.01, 0.15] },
    --   "instruction": "拖动利率滑块，观察 30 年后的差异"
    -- }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 制品（系统决策记录）
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    plan_id TEXT REFERENCES plans(id),
    session_id TEXT,               -- 可选，关联到具体会话
    type TEXT,
    -- type: plan / diagnosis / profile_update / teaching_decision /
    --       verification / transfer_exercise
    content JSON,                  -- 制品内容
    rationale TEXT,                -- 决策理由
    visibility TEXT DEFAULT 'learner_visible',
    -- visibility: learner_visible / system_only
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 认知轨迹
CREATE TABLE trajectory (
    id TEXT PRIMARY KEY,
    learner_id TEXT REFERENCES learners(id),
    concept TEXT,                  -- 概念名
    understanding TEXT,            -- 学习者当时的理解描述
    depth_level INTEGER,           -- 1-5 深度估计
    source_session_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统提示词管理
CREATE TABLE prompts (
    id TEXT PRIMARY KEY,
    role TEXT UNIQUE,              -- planner / diagnostician / teacher / verifier
    content TEXT,                  -- 提示词模板
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 核心 Pydantic 模型

```python
from pydantic import BaseModel
from typing import Optional
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
    success_criteria: list[str]
    bloom_level: BloomLevel

class MentalModel(BaseModel):
    name: str
    foundation: str
    foundation_type: str       # "hard" / "soft" / "hard+soft"
    foundation_boundary: str
    core_nodes: list[str]
    supporting_nodes: list[str]
    resilience_nodes: list[str]

class LearningUnit(BaseModel):
    unit_id: str
    topic: str
    content_role: ContentRole
    knowledge_type: KnowledgeType
    representation: str
    objectives: list[str]
    verification_criteria: list[str]

class LearningPlan(BaseModel):
    goal: Goal
    mental_model: MentalModel
    path: list[LearningUnit]
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
    levels_checked: list[str]
    gaps_found: list[str]
    depth_estimate: int        # 1-5
    feedback: str
    recommendation: str        # "proceed" / "revisit" / "deepen"

class LearnerProfile(BaseModel):
    knowledge_level: dict[str, str]
    cognitive_preferences: list[str]
    identified_obstacles: list[str]
    strengths: list[str]
```

---

## 五、Agent 设计

### 5.1 角色定义与上下文组装

Agent 有三个角色，每个角色有独立的系统提示词和上下文组装规则：

```
┌─────────────────────────────────────────────────────────┐
│                  Agent Orchestrator                       │
│                                                         │
│  当前角色由 session.phase 决定：                          │
│    plan 创建时 → Planner                                 │
│    diagnosis   → Diagnostician (Planner 角色的子模式)      │
│    teaching    → Teacher                                 │
│    verification → Verifier                               │
│                                                         │
│  每次 LLM 调用前，Context Assembly 按角色规则组装输入：     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Planner 的上下文组装：                             │    │
│  │  ✓ 学习者意图（原文）                              │    │
│  │  ✓ 学习者画像（如有）                              │    │
│  │  ✓ 领域知识提示（金融投资的核心知识结构）              │    │
│  │  ✗ 历史会话细节（不需要）                           │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Teacher 的上下文组装：                             │    │
│  │  ✓ 当前单元规格（objectives, knowledge_type 等）    │    │
│  │  ✓ 学习者画像（偏好、障碍点）                       │    │
│  │  ✓ 当前会话的最近 N 条消息                         │    │
│  │  ✓ 可用组件目录（名称 + 适用场景 + 参数说明）         │    │
│  │  ✗ 其他单元的教学历史（不需要）                      │    │
│  │  ✗ 计划的完整知识图谱（不需要）                      │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Verifier 的上下文组装：                            │    │
│  │  ✓ 当前单元的 verification_criteria                │    │
│  │  ✓ 心智模型规格（核心节点、地基）                    │    │
│  │  ✓ 本次教学会话中学习者的全部回答                     │    │
│  │  ✓ 学习者画像                                     │    │
│  │  ✗ Agent 的教学内容（避免自我验证偏差）               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Agent 主循环

```python
# 伪代码：Agent Orchestrator 主循环

async def handle_message(session_id: str, user_message: str):
    session = get_session(session_id)
    plan = get_plan(session.plan_id)
    profile = get_learner_profile(plan.learner_id)
    
    # 1. 确定当前角色
    role = determine_role(session.phase)
    
    # 2. 上下文组装（10.3）
    context = assemble_context(
        role=role,
        session=session,
        plan=plan,
        profile=profile,
        user_message=user_message
    )
    
    # 3. LLM 调用
    llm_response = await call_llm(context)
    
    # 4. 解析响应为结构化输出
    parsed = parse_response(llm_response, role)
    
    # 5. 生成制品（10.5）
    artifact = create_artifact(
        type=role,
        content=parsed.artifact_content,
        rationale=parsed.rationale,
        visibility=determine_visibility(role, parsed)
    )
    save_artifact(artifact)
    
    # 6. 更新学习者画像（10.1 内环）
    if parsed.profile_insights:
        update_profile(plan.learner_id, parsed.profile_insights)
        save_artifact(create_artifact(
            type="profile_update",
            content=parsed.profile_insights,
            rationale="基于本次交互观察到的学习者特征变化",
            visibility="learner_visible"
        ))
    
    # 7. 判断是否需要切换阶段
    if parsed.phase_transition:
        update_session_phase(session_id, parsed.phase_transition)
    
    # 8. 返回（双粒度：10.2）
    #    - 存储系统侧粒度（artifact）
    #    - 返回学习者侧粒度（parsed.learner_message）
    return AgentMessage(
        content=parsed.learner_message,
        message_type=parsed.message_type,
        component_spec=parsed.component_spec
    )
```

### 5.3 组件目录（10.4 契约）

MVP 预制以下交互组件，Agent 通过 JSON 规格调用：

| 组件名 | 适用知识类型 | 参数 | 用途 |
|-------|-----------|------|-----|
| `CompoundInterestChart` | causal | principal, rate_range, years_range | 复利可视化，滑块调参 |
| `RiskReturnScatter` | causal | assets_data | 风险-收益散点图 |
| `AssetAllocationPie` | structural | allocations, editable | 资产配置饼图，可拖拽调整 |
| `InflationTimeline` | causal | initial_value, inflation_rates, years | 通胀侵蚀购买力可视化 |
| `ConceptMap` | structural | nodes, edges, highlight | 概念关系图 |
| `MultipleChoice` | any | question, options, correct, explanation | 选择题 |
| `FreeResponse` | any | question, evaluation_criteria | 开放问答 |
| `ScenarioCard` | methodological | scenario, question, context | 情境决策练习 |

组件接口契约（TypeScript）：

```typescript
interface InteractiveComponent {
  name: string;
  applicableKnowledgeTypes: KnowledgeType[];
  propsSchema: JSONSchema;           // Agent 需要提供的参数
  emitsEvents: string[];             // 组件向后端发送的事件
  description: string;               // 供 Agent 理解何时使用
}
```

新增组件只需：实现 React 组件 + 在目录中注册 + Agent 的可用组件列表自动更新。

---

## 六、API 设计

### 6.1 端点列表

```
POST   /api/learners                    创建学习者
GET    /api/learners/:id/profile        获取学习者画像（learner_visible）
PATCH  /api/learners/:id/profile        学习者修正画像

POST   /api/plans                       提交学习意图，生成计划
GET    /api/plans/:id                   获取计划详情（含理由）
POST   /api/plans/:id/accept            学习者确认计划，进入学习

POST   /api/sessions                    创建学习会话（关联 plan + unit）
POST   /api/sessions/:id/messages       发送消息，获取 Agent 响应（SSE 流式）
GET    /api/sessions/:id/history        获取会话历史

GET    /api/plans/:id/artifacts         获取该计划的所有可见制品
GET    /api/learners/:id/trajectory     获取认知轨迹

GET    /api/admin/prompts               获取所有系统提示词
PUT    /api/admin/prompts/:role         更新指定角色的系统提示词
```

### 6.2 关键流程：创建计划

```
POST /api/plans
Body: { "learner_id": "...", "intent": "我想学习个人投资理财入门" }

Response (SSE stream):
  event: thinking
  data: {"stage": "analyzing_intent", "message": "正在分析你的学习意图..."}

  event: thinking
  data: {"stage": "selecting_foundation", "message": "正在选择知识地基..."}

  event: plan_ready
  data: {
    "plan_id": "...",
    "goal": { ... },
    "mental_model": { ... },
    "path": [ ... ],
    "rationale": "我为你选择了这条路径，因为..."
  }
```

### 6.3 关键流程：学习对话

```
POST /api/sessions/:id/messages
Body: { "content": "我不太理解复利和单利的区别" }

Response (SSE stream):
  event: message
  data: {
    "content": "好问题。我用一个比喻来说明...",
    "message_type": "text"
  }

  event: message
  data: {
    "content": "现在用这个工具亲手感受一下差异：",
    "message_type": "interactive",
    "component_spec": {
      "component": "CompoundInterestChart",
      "props": { "initialPrincipal": 10000, "rateRange": [0.01, 0.12], "yearsRange": [1, 40] },
      "instruction": "先把年限拉到 5 年，比较 5% 和 10% 的差异。再拉到 30 年，看看同样的差异被时间放大了多少倍。"
    }
  }

  event: artifact
  data: {
    "type": "teaching_decision",
    "rationale": "学习者提出了复利与单利的区分问题。这是核心结构节点，采用类比+交互可视化的方式建构因果认知。",
    "visibility": "learner_visible"
  }
```

---

## 七、前端架构

### 7.1 页面结构

```
/                         → Home         输入学习意图
/plan/:planId             → PlanReview   查看计划、心智模型、路径、理由
/learn/:planId/:unitId    → LearnSession 学习主界面
/profile/:learnerId       → Profile      学习者画像（可查看、可修正）
/trajectory/:learnerId    → Trajectory   认知轨迹时间线
```

### 7.2 学习主界面布局（LearnSession）

```
┌──────────────────────────────────────────────────────────┐
│  Header: 当前单元名称 + 进度（3/7）+ 内容角色标签（核心）   │
├────────────┬─────────────────────────┬───────────────────┤
│            │                         │                   │
│  左侧栏     │     主区域（对话流）       │    右侧栏          │
│  200px     │                         │    280px          │
│            │  ┌───────────────────┐  │                   │
│  学习路径    │  │ 文本消息           │  │  制品流            │
│  (当前高亮)  │  ├───────────────────┤  │  (learner_visible │
│            │  │ 交互组件            │  │   artifacts)      │
│  学习者画像  │  │ (Chart/Quiz/...)   │  │                   │
│  (摘要)     │  ├───────────────────┤  │  每个制品显示：     │
│            │  │ 验证反馈            │  │  - 类型图标         │
│  当前单元    │  ├───────────────────┤  │  - 摘要            │
│  目标       │  │ ...               │  │  - 展开看理由       │
│            │  └───────────────────┘  │                   │
│            │                         │                   │
│            │  ┌───────────────────┐  │                   │
│            │  │ 输入框             │  │                   │
│            │  └───────────────────┘  │                   │
├────────────┴─────────────────────────┴───────────────────┤
│  Footer: [查看完整画像] [查看认知轨迹] [返回计划总览]        │
└──────────────────────────────────────────────────────────┘
```

### 7.3 消息渲染

对话流中的每条消息根据 `message_type` 渲染为不同组件：

```typescript
// MessageRenderer.tsx
function MessageRenderer({ message }: { message: AgentMessage }) {
  switch (message.message_type) {
    case 'text':
      return <TextBubble content={message.content} />;
    case 'interactive':
      return (
        <div>
          <TextBubble content={message.content} />
          <InteractiveComponent spec={message.component_spec!} />
        </div>
      );
    case 'quiz':
      return <QuizComponent spec={message.component_spec!} />;
    case 'verification':
      return <VerificationCard content={message.content} />;
    case 'decision':
      return <DecisionArtifact content={message.content} />;
    default:
      return <TextBubble content={message.content} />;
  }
}

// InteractiveComponent.tsx — 根据组件名从目录中查找并渲染
function InteractiveComponent({ spec }: { spec: ComponentSpec }) {
  const Component = ComponentRegistry[spec.component];
  if (!Component) return <FallbackMessage />;
  return (
    <div>
      <Component {...spec.props} />
      <p className="text-sm text-gray-500 mt-2">{spec.instruction}</p>
    </div>
  );
}
```

### 7.4 组件目录注册

```typescript
// ComponentRegistry.ts
import { CompoundInterestChart } from './CompoundInterest';
import { RiskReturnScatter } from './RiskReturn';
import { AssetAllocationPie } from './AssetAllocation';
import { InflationTimeline } from './InflationTimeline';
import { ConceptMap } from './ConceptMap';
import { MultipleChoice } from './MultipleChoice';
import { FreeResponse } from './FreeResponse';
import { ScenarioCard } from './ScenarioCard';

export const ComponentRegistry: Record<string, React.ComponentType<any>> = {
  CompoundInterestChart,
  RiskReturnScatter,
  AssetAllocationPie,
  InflationTimeline,
  ConceptMap,
  MultipleChoice,
  FreeResponse,
  ScenarioCard,
};
```

---

## 八、项目结构

```
vibe_projects/202603_basic_finance/
├── AI时代的学习体系设计.md          # 理论框架
├── MVP方案.md                     # 本文档
│
├── backend/
│   ├── requirements.txt
│   ├── main.py                    # FastAPI 入口，CORS，路由挂载
│   ├── config.py                  # 配置（API key, 模型名, DB 路径）
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py        # Agent 主循环，角色切换
│   │   ├── roles.py               # 角色定义：Planner, Teacher, Verifier
│   │   ├── prompts.py             # 每个角色的系统提示词
│   │   └── context_assembly.py    # 每个角色的上下文组装逻辑
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # Pydantic 模型（上文第四章）
│   │
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── database.py            # SQLite 连接与初始化
│   │   ├── learner_repo.py        # 学习者 CRUD
│   │   ├── plan_repo.py           # 计划 CRUD
│   │   ├── session_repo.py        # 会话与消息 CRUD
│   │   └── artifact_repo.py       # 制品与轨迹 CRUD
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── learner.py             # /api/learners 路由
│   │   ├── plan.py                # /api/plans 路由
│   │   ├── session.py             # /api/sessions 路由
│   │   └── artifact.py            # /api/artifacts, /api/trajectory 路由
│   │
│   └── components/
│       └── catalog.py             # 组件目录定义（名称、适用场景、参数 schema）
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx               # React 入口
│       ├── App.tsx                # 路由定义
│       │
│       ├── api/
│       │   └── client.ts          # API 客户端 + SSE 处理
│       │
│       ├── stores/
│       │   └── appStore.ts        # Zustand 状态管理
│       │
│       ├── types/
│       │   └── index.ts           # 共享类型定义（与后端 schema 对齐）
│       │
│       ├── pages/
│       │   ├── Home.tsx           # 学习意图输入
│       │   ├── PlanReview.tsx     # 计划审阅（路径 + 理由 + 心智模型）
│       │   ├── LearnSession.tsx   # 学习主界面
│       │   ├── Profile.tsx        # 学习者画像
│       │   └── Trajectory.tsx     # 认知轨迹
│       │
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatInterface.tsx    # 对话容器 + 输入框
│       │   │   ├── MessageBubble.tsx    # 文本消息气泡
│       │   │   └── MessageRenderer.tsx  # 按类型分发渲染
│       │   │
│       │   ├── interactive/
│       │   │   ├── ComponentRegistry.ts  # 组件目录注册表
│       │   │   ├── CompoundInterest.tsx  # 复利可视化
│       │   │   ├── RiskReturn.tsx        # 风险-收益散点
│       │   │   ├── AssetAllocation.tsx   # 资产配置
│       │   │   ├── InflationTimeline.tsx # 通胀侵蚀
│       │   │   └── ConceptMap.tsx        # 概念关系图
│       │   │
│       │   ├── verification/
│       │   │   ├── MultipleChoice.tsx
│       │   │   ├── FreeResponse.tsx
│       │   │   └── ScenarioCard.tsx
│       │   │
│       │   ├── visibility/
│       │   │   ├── PlanRationale.tsx      # 路径理由卡片
│       │   │   ├── LearnerProfileCard.tsx # 画像摘要
│       │   │   ├── ArtifactFeed.tsx       # 制品流（右侧栏）
│       │   │   └── TrajectoryTimeline.tsx # 认知轨迹时间线
│       │   │
│       │   └── layout/
│       │       ├── Sidebar.tsx
│       │       └── Header.tsx
│       │
│       └── styles/
│           └── index.css          # Tailwind 入口
```

---

## 九、技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| **后端框架** | Python + FastAPI | LLM 生态最成熟，异步原生支持，Pydantic 数据验证 |
| **LLM** | OpenAI SDK | 统一接口协议，**配置 BaseURL 与 Key 以完全兼容火山引擎（Volcengine）大模型**，降低 Token 成本并保障国内访问速度。 |
| **数据库** | SQLite + JSON 列 | 零基础设施，单文件部署，MVP 够用 |
| **前端框架** | React + Vite + TypeScript | 已有项目基础，生态成熟 |
| **样式** | Tailwind CSS | 已有配置，快速原型 |
| **图表** | Recharts | 已在项目中使用，声明式 API |
| **状态管理** | Zustand | 轻量，TypeScript 友好 |
| **流式响应** | Server-Sent Events (SSE) | 比 WebSocket 简单，单向流式足够 |

---

## 十、实现优先级

### Phase 1：核心环路可运行

目标：一个完整的 "意图 → 计划 → 教一个单元 → 验证" 环路可跑通。

1. 后端骨架：FastAPI + SQLite + 基本 CRUD
2. Agent Orchestrator：单角色切换 + 上下文组装
3. Planner 角色：意图 → 计划 JSON
4. Teacher 角色：教学对话（纯文本，不含交互组件）
5. Verifier 角色：单元验证 + 反馈
6. 前端骨架：Home → PlanReview → LearnSession（纯对话）
7. 制品存储与展示：右侧栏显示 learner_visible 制品

### Phase 2：交互能力 + 可见性

目标：教学体验从纯文本升级为富交互，可见性完整。

1. 组件目录 + 注册表
2. 实现 4-5 个核心交互组件（CompoundInterest, RiskReturn, AssetAllocation, MultipleChoice, FreeResponse）
3. Teacher 角色更新：能选择组件并生成 component_spec
4. 学习者画像页面 + 画像修正 API
5. 认知轨迹数据采集与展示
6. SSE 流式响应

### Phase 3：完整金融课程 + 打磨

目标：完整的金融投资入门课程可从头学到尾。

1. 完善系统提示词中的金融领域知识
2. 补全所有交互组件
3. 迁移练习（最后单元的跨场景运用）
4. 端到端体验打磨

---

## 十一、关键风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| LLM 输出不稳定，生成的计划结构不一致 | 后端解析失败 | 严格的 JSON schema 约束 + 重试机制 + 回退默认值 |
| 验证环节 LLM 自我验证偏差 | 低估流利度错觉 | Verifier 的上下文组装刻意排除 Teacher 的教学内容，只看学习者的原始回答 |
| 对话过长导致上下文超限 | 教学质量下降 | 会话分段（每个单元一个会话），上下文组装时只取最近 N 条 + 摘要 |
| 交互组件参数不合法 | 前端渲染崩溃 | 组件层面做 props 校验 + fallback UI |

---

> **本方案的设计原则与理论框架文档完全对齐：** 每个架构决策都可追溯到《AI 时代的学习体系设计》中的具体原理或工程原则。这本身就是 10.5（每步留下可回溯的制品）的一个实践。

