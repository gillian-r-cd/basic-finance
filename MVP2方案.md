# 学习体系 MVP2 方案

> 本文档接续 MVP 方案，基于当前实现状态（见 progress.md Iteration 0-6），解决三个架构级命题（信息可靠性、通用性、知识网络可见性），补全 MVP 遗留项（前置诊断、画像、内环、轨迹），并修复 Agent 架构的基础设施割裂。
>
> 所有设计决策均可追溯至《AI 时代的学习体系设计》中的具体原理。

---

## 零、MVP2 要回答的核心问题

MVP 验证了："一个可见决策过程的学习系统"能否跑通完整的 意图→计划→教学→验证 闭环。答案是肯定的。

MVP2 要回答的后续问题：

| # | 问题 | 溯源 |
|---|------|------|
| 1 | 系统输出的信息如何保障可靠？ | 1.3（知识建立在最坚固的模型上）、6.1（流利度错觉） |
| 2 | 框架如何从金融扩展到任意领域？ | 1.1-1.5（五条原理无一领域特定）、4.2（认知手段本质稳定） |
| 3 | 学习者如何看到知识网络的全貌？ | 1.2（知识结构是网状的）、3.4（"知道自己不知道什么"）、11.2（可见性原则） |

同时补全 MVP 遗留项和架构债务：

| # | 遗留项 | 溯源 |
|---|--------|------|
| 4 | Agent 基础设施割裂（Planner 与 Orchestrator 两条独立 LLM 链路） | 10.3（每一个 LLM 调用点都有显式上下文组装）、8.1（AI 是单一编排者） |
| 5 | 前置诊断（探测学习者起点） | 步骤 2、MVP 2.1 |
| 6 | 学习者画像展示与修正 | 11.2（学习者有权审视系统对自己的判断） |
| 7 | 内环画像更新（从对话中提取特征） | 10.1（双环学习结构） |
| 8 | 认知轨迹可视化 | 1.4（螺旋深化可见）、11.2 |
| 9 | Orchestrator 状态机无兜底 | 10.4（行为通过边界约束） |

---

## 一、当前 Agent 架构的问题诊断

在规划所有业务功能之前，必须先看清当前架构的真实状态。

### 1.1 基础设施割裂

当前存在两条完全独立的 LLM 调用链路：

```
链路 1: planner.py
  自己的 AsyncOpenAI 实例
  自己拼上下文（在 user message 中硬编码 JSON schema）
  自己解析 JSON（strip markdown blocks + json.loads）
  自己写 artifact

链路 2: orchestrator.py
  自己的 AsyncOpenAI 实例
  通过 context_assembly.py 组装上下文
  自己解析标记（正则匹配 [COMPONENT_SPEC]、[LAYER_PASSED] 等）
  自己写 artifact
```

五件相同的事做了两遍，用两套不同的实现。这导致：

- **Planner 不读 Profile 和 Trajectory。** 它不走 context_assembly，没有上下文注入机制。对老用户和新用户一视同仁。
- **新增角色的成本过高。** MVP2 要加 Diagnostician 和 ProfileUpdater，如果继续这种模式，就是再复制两条链路。
- **违反原理 10.3。** "系统中**每一个** LLM 调用点，都配有一个显式的上下文组装环节。" Planner 当前违反这条。

### 1.2 Planner 的 Prompt 极弱

Planner 当前的 system prompt 只有一句话：`"You are a financial learning Planner. You translate user intent into structured learning goals and plans. Provide clear rationale."`

真正的规划逻辑全靠 user message 中硬编码的 JSON schema 来约束。LLM 不知道"如何做目标锚定"、"如何选第一性原理基底"、"如何做内容角色标注"——它只知道要填什么字段。这是整个系统最薄弱的环节：计划的质量决定后续所有教学和验证的上限。

### 1.3 Orchestrator 状态机被动

角色切换完全由 LLM 输出的文本标记驱动。LLM 不输出 `[PHASE_TRANSITION]`，就永远不从 Teacher 切到 Verifier。没有任何兜底机制。

### 1.4 问题之间的依赖关系

```
基础设施割裂（1.1）
    │
    ├─ 阻碍 Planner 读取 Profile/Trajectory
    ├─ 阻碍新角色（Diagnostician、ProfileUpdater）的低成本添加
    └─ 阻碍统一的输出解析和 artifact 生成

Planner Prompt 极弱（1.2）
    │
    ├─ 阻碍 knowledge_map 生成（知识网络可见性）
    ├─ 阻碍 anchors 生成（信息可靠性）
    ├─ 阻碍 domain 识别（通用性）
    └─ 阻碍计划整体质量

Orchestrator 状态机被动（1.3）
    │
    └─ 阻碍诊断阶段的轮次控制
```

**结论：基础设施修复（1.1）是所有后续工作的前提。Planner 重写（1.2）是所有业务功能的前提。状态机加固（1.3）是诊断等新流程的前提。三者必须先于功能开发。**

---

## 二、LLM 调用层统一

### 2.1 设计原则

> 溯源：10.3（每一个 LLM 调用点都有显式上下文组装）、8.1（AI 是单一编排者）

对 LLM 而言，如同 `database.py` + `get_db()` 是数据库的统一调用入口一样，系统需要一个 LLM 的统一调用入口。所有角色（Planner、Teacher、Verifier、Diagnostician、ProfileUpdater）都通过这个入口调用 LLM，不再各自创建 client、各自拼 prompt、各自解析输出。

### 2.2 架构

新建 `backend/agents/llm_client.py`——LLM 的统一调用入口：

```
任何 LLM 调用需求
    │
    ▼
llm_client.py: call_llm(role, input_text, db, session_id?, stream?)
    │
    ├─ Step 1: 共享的 AsyncOpenAI 单例
    │    不再由 planner.py 和 orchestrator.py 各创建一个
    │
    ├─ Step 2: get_prompt(db, role)
    │    已有机制，不变
    │
    ├─ Step 3: context_assembly.build(role, db, session_id, input_text)
    │    Planner 终于接入 context_assembly
    │    每个 role 有自己的 builder 函数
    │
    ├─ Step 4: client.chat.completions.create(messages, stream=stream)
    │    stream 模式返回 AsyncGenerator
    │    非 stream 模式返回完整文本
    │
    ├─ Step 5: parse_output(raw_text, role)
    │    统一的输出解析层
    │    Planner: JSON 全文解析（多策略：直接解析 → code block 提取 → json_repair）
    │    Teacher: 标记提取（COMPONENT_SPEC, PHASE_TRANSITION）
    │    Verifier: 标记提取（LAYER_PASSED, UNIT_PASSED）
    │    Diagnostician: 标记提取（DIAGNOSIS_COMPLETE）+ JSON 部分解析
    │    ProfileUpdater: JSON 全文解析
    │
    └─ 返回: LLMResult(content, parsed_markers, parsed_json, raw)
```

### 2.3 角色配置表

每个角色不再是一段独立的代码，而是一组配置：

| 配置项 | Planner | Diagnostician | Teacher | Verifier | ProfileUpdater |
|-------|---------|---------------|---------|----------|----------------|
| prompt key | `"planner"` | `"diagnostician"` | `"teacher"` | `"verifier"` | `"profile_updater"` |
| context builder | `_build_planner_context` | `_build_diagnostician_context` | `_build_teacher_context` | `_build_verifier_context` | `_build_profile_updater_context` |
| stream | 否 | 是 | 是 | 是 | 否 |
| 需要识别的标记 | 无（纯 JSON） | `DIAGNOSIS_COMPLETE` | `COMPONENT_SPEC`, `PHASE_TRANSITION` | `LAYER_PASSED`, `UNIT_PASSED` | 无（纯 JSON） |
| artifact type | `plan` | `diagnosis` | `teacher_decision` | `verifier_decision` | `profile_update` |

### 2.4 改动影响

| 文件 | 变化 |
|------|------|
| 新建 `agents/llm_client.py` | 共享 AsyncOpenAI 单例 + `call_llm()` 函数 + 统一输出解析 |
| `agents/context_assembly.py` | 新增 `_build_planner_context()`；`assemble_context()` 支持 planner 角色 |
| `agents/orchestrator.py` | 删除自有 `AsyncOpenAI` 实例和 JSON 解析逻辑，改为调 `llm_client.call_llm()`；保留状态机逻辑（phase transition、layer tracking、unit advancement） |
| `agents/planner.py` | 删除自有 `AsyncOpenAI` 实例和 JSON 解析逻辑，改为调 `llm_client.call_llm()`；保留 plan 入库和 SSE 流程控制 |
| 删除 | orchestrator.py 和 planner.py 中各自的 `client = AsyncOpenAI(...)` |

### 2.5 Planner 接入 context_assembly 后能读到什么

当前 Planner 只读到用户意图。接入后：

| 注入内容 | 来源 | 作用 |
|---------|------|------|
| Learner Profile | `learners.profile` JSON | Planner 知道学习者已有知识水平，路径规划可以跳过已掌握的内容 |
| Mastered Concepts | `trajectory` 表 | Planner 知道学习者之前学过什么，避免重复规划 |
| 已有 Plan 摘要（如有） | `plans` 表 | 学习者二次生成计划时，Planner 能看到之前的计划和完成情况 |

这些注入在 `_build_planner_context()` 中实现，结构与已有的 `_build_teacher_context()` 一致。

### 2.6 不做什么

| 不做 | 原因 |
|------|------|
| 把 planner.py 和 orchestrator.py 合并成一个文件 | 它们的业务流程本质不同（一次性 vs 对话循环），强行合并会产生上帝函数 |
| 把统一调用层做成"框架"或"类继承体系" | 一个函数 + 一个配置表足够。KISS。 |
| 重试/fallback 策略 | MVP2 阶段风险可控，先不加复杂度 |

---

## 三、Orchestrator 状态机加固

### 3.1 问题

当前角色切换完全由 LLM 输出的文本标记驱动。系统是被动的——只解析标记，不做任何主动判断。这在三个场景下会出问题：

| 场景 | 当前行为 | 期望行为 |
|------|---------|---------|
| Teacher 教了 10 轮还没输出 `[PHASE_TRANSITION]` | 永远卡在 teaching | 系统提醒 Teacher 考虑是否该进入验证 |
| Diagnostician 对话超过 3 轮还没输出 `[DIAGNOSIS_COMPLETE]` | 永远卡在 diagnosis | 系统强制切换到 teaching |
| 所有 unit 完成后 | session.status 仍为 "active" | session.status 变为 "completed" |

### 3.2 加固策略

在 `orchestrator.py` 的状态机中增加三条边界规则：

**规则 1：教学轮次软提醒。** 当 teaching phase 的对话轮次超过阈值（默认 8 轮）且 LLM 仍未输出 PHASE_TRANSITION 时，在下一次 context_assembly 中注入一条系统提示："You have been teaching for N turns. Consider whether the learner is ready for verification." 不强制切换——这仍然是 LLM 的判断，但系统给了一个提醒。

**规则 2：诊断轮次硬切换。** 当 diagnosis phase 的对话轮次超过 3 轮时，orchestrator 直接将 phase 切换到 teaching，不等 LLM 标记。诊断的目的是快速定位起点，不是深入对话。

**规则 3：Session 完成标记。** 当最后一个 unit 通过验证后，session.status 设为 "completed"。前端据此显示"学习完成"状态。

### 3.3 工程变更

| 文件 | 变化 |
|------|------|
| `orchestrator.py` | 在 generate() 函数顶部，查当前 phase 的消息条数，据此注入提醒或强制切换 |
| `context_assembly.py` | `_build_teacher_context()` 接受 `turn_count` 参数，超阈值时注入提醒文本 |
| `orchestrator.py` | UNIT_PASSED 处理块中，检查是否为最后 unit，是则设 session.status = "completed" |

---

## 四、信息可靠性保障

### 4.1 问题的第一性原理分析

原理 1.3 承诺"学习必须建立在当前范围内最坚固、最难被推翻的模型之上"。LLM 会幻觉——编造事实、虚构逻辑、伪造数据。在学习系统中，学习者正处于信任状态，如果地基材料是错的，建构出的心智模型就是有毒的。

信息可靠性不是锦上添花——它是原理 1.3 在工程层面的直接要求。

### 4.2 风险分层

| 输出类型 | 例 | 幻觉风险 | 后果 |
|---------|---|---------|------|
| 事实性陈述 | "标普500过去50年平均年化回报约10%"、公式、定律 | 高 | 高——直接污染心智模型地基 |
| 结构性判断 | "复利依赖百分比运算作为前置知识"、内容角色标注 | 中 | 中——路径偏差 |
| 解释性内容 | 隐喻、类比、用自己的话解释概念 | 低 | 低——方向对即可 |

### 4.3 保障策略

四条策略，按成本从低到高。前两条覆盖 80% 的风险。

#### 策略 A：Prompt 层幻觉抑制（成本最低）

在 Teacher prompt 中加入强制规则：

1. **不确定时必须声明**："当你不确定某个具体数据或事实时，必须说明'此为估算/需自行验证'，不得编造看起来合理的数字。"
2. **数据标注来源类型**：引用具体数据时标注类别——`[公认常识]`、`[经典教材结论]`、`[需验证的估算]`。
3. **软基底标注义务**：当 `plan.mental_model.foundation_type` 包含 `"soft"` 时，Teacher 必须标注模型名称、适用边界、主要替代观点。

工程变更：修改 `prompts.py` 中 Teacher 的 DEFAULT_PROMPTS。

#### 策略 B：可验证锚点（Verifiable Anchors）

Planner 生成计划时，对每个 unit 的核心知识点附加**锚点**——明确的公式、可查证的定律名称、关键数据的量级。锚点存在 plan 结构中，Teacher 围绕锚点教学，Verifier 依据锚点验证。

```json
{
  "path": [{
    "unit_id": "u1",
    "topic": "复利：时间的杠杆",
    "anchors": [
      "公式: A = P(1+r)^n",
      "关键性质: 指数增长，时间是最强变量",
      "经典引用: 爱因斯坦称复利为'世界第八大奇迹'（出处有争议，但概念准确）"
    ]
  }]
}
```

工程变更：
- `planner.py`：Planner 输出 JSON 中每个 unit 新增 `anchors` 字段（Planner prompt 重写中包含）。
- `schemas.py`：`LearningUnit` 新增 `anchors: list[str]`。
- `context_assembly.py`：Teacher 和 Verifier 的 context builder 注入当前 unit 的 anchors。

#### 策略 C：模型意识显性传递

Teacher 在完成每个 unit 的核心教学后，必须说明"这个模型的适用条件和失效场景"。不是独立环节，是教学流程的自然收尾。

工程变更：`prompts.py` Teacher prompt 添加 CLOSURE RULE 段。

#### 策略 D：Verifier 锚点交叉验证

Verifier 对照 anchors 判断学习者回答的事实性是否正确。两次独立 LLM 调用在同一事实上同时幻觉的概率，低于单次。

工程变更：`context_assembly.py` 的 `_build_verifier_context()` 注入 anchors。

### 4.4 不做什么

| 不做 | 原因 |
|------|------|
| 实时事实检查 API | 教稳定基础知识（4.2），不是实时新闻 |
| 独立 Fact-Checker Agent | LLM 检查 LLM，本身也会幻觉；收益不确定，成本确定 |
| 外部知识库比对 | MVP2 阶段增加基础设施依赖过早 |

---

## 五、框架通用性

### 5.1 第一性原理分析

五条原理、四环模型、九步管线、知识类型分类、内容角色分层——没有任何一条是金融专属的。当前系统被绑定在金融领域，纯粹是因为三处硬编码：

1. Planner prompt 混入金融知识提示。
2. 组件目录全部是金融专属组件。
3. 数据库文件名 `finance.db`。

通用化的本质：**将"教学方法论"和"领域知识"解耦**。方法论由系统约束提供（prompt 中的通用规则），领域知识由 LLM 自带能力提供。

### 5.2 架构变更

#### 变更 1：Prompt 分层

- **Planner prompt** 只包含通用规划方法论（如何做目标锚定、第一性原理基底选择、内容角色标注、knowledge_map 生成）。删除所有金融特定内容。
- **Teacher/Verifier prompt** 保持不变（已经是通用的）。

工程变更：Planner prompt 重写（第七章）。

#### 变更 2：组件目录的领域标签

`catalog.py` 中每个组件新增 `domain` 字段（`"general"` 或 `"finance"` 等）。`get_catalog_for_prompt()` 增加 `domain` 参数，只返回通用组件 + 当前领域组件。

#### 变更 3：Plan 新增 `domain` 字段

Planner 从意图中识别领域，写入 `plan.domain`。后续 context_assembly 从 plan.domain 读取，传给 catalog 过滤。

工程变更：
- `domain.py`：Plan 新增 `domain = Column(String, nullable=True)`。
- `main.py`：启动迁移。
- Planner prompt 的 JSON schema 包含 `"domain"` 字段。
- `context_assembly.py`：读取 plan.domain，传给 `get_catalog_for_prompt(unit_topic, domain)`。

#### 变更 4：通用交互组件实现

| 组件 | 适用范围 | MVP2 是否实现 |
|------|---------|-------------|
| ConceptMap | 任何领域的概念关系展示 | 是 |
| MultipleChoice | 任何领域的知识检测 | 是 |
| FreeResponse | 任何领域的开放问答 | 视余量 |
| ScenarioCard | 任何领域的情境决策 | 视余量 |

#### 变更 5：数据库文件名

`database.py` 中 `finance.db` → `learning.db`。启动时检测旧文件存在则自动重命名。

### 5.3 不做什么

| 不做 | 原因 |
|------|------|
| 领域知识库 | LLM 自带知识；方法论由系统约束 |
| 领域选择 UI | Planner 从意图中自动识别 |
| 每领域专属组件 | 通用组件 + 金融组件足以验证通用性 |

---

## 六、知识网络可见性

### 6.1 第一性原理分析

当前：Planner 选出一条路径，学习者线性前进，看到"7 个单元"但看不到"知识全貌和排除理由"。

违反：
1. **1.2（知识结构是网状的）：** 应感知为网，不是线。
2. **3.4 第三条：** "'知道自己不知道什么'本身是学习成果。"
3. **11.2 第一条：** 路径选择的理由需可见。PlanReview 有文字 rationale，但没有"全貌 vs 路径"对比。

### 6.2 学习者需要看到的三层信息

| 层 | 含义 | 产品形态 |
|----|------|---------|
| 全貌 | 该目标下完整的知识节点和关联 | 节点 + 边的图 |
| 路径 | 被选中的路径 | 高亮节点 + 方向箭头 |
| 边界 | 有意排除的节点及原因 | 灰化节点 + 点击查看排除理由 |

### 6.3 架构变更

#### 变更 1：Planner 输出 knowledge_map

```json
{
  "knowledge_map": {
    "nodes": [
      { "id": "compound_interest", "label": "复利", "status": "on_path",
        "brief": "资金随时间指数增长的数学结构" },
      { "id": "derivatives_pricing", "label": "衍生品定价", "status": "excluded",
        "brief": "期权等衍生品的数学定价模型",
        "exclusion_reason": "超出入门目标的数学深度" },
      { "id": "behavioral_finance", "label": "行为金融学", "status": "contextual",
        "brief": "投资决策中的心理偏差",
        "exclusion_reason": "作为承重支撑在'损失厌恶'中涉及，不单独展开" }
    ],
    "edges": [
      { "from": "compound_interest", "to": "time_value_of_money", "relation": "enables" },
      { "from": "risk_return", "to": "diversification", "relation": "motivates" }
    ]
  }
}
```

节点 `status`：`on_path`（要学的）、`excluded`（有意排除）、`contextual`（其他节点中部分涉及）。

工程变更：
- `schemas.py`：新增 KnowledgeMapNode、KnowledgeMapEdge、KnowledgeMap。
- `domain.py`：Plan 新增 `knowledge_map = Column(JSON, nullable=True)` + 启动迁移。
- Planner prompt JSON schema 包含 knowledge_map（第七章）。
- `routers/plan.py`：GET 返回 knowledge_map。

#### 变更 2：PlanReview 知识网络图

- React Flow 渲染节点和边。`on_path` 高亮，`excluded` 灰化，`contextual` 半透明。
- 方向箭头标注学习顺序。点击查看详情/排除理由。
- dagre 自动布局。

工程变更：
- 安装 `@xyflow/react` + `dagre`。
- 新建 `frontend/src/components/interactive/KnowledgeMapView.tsx`。
- 修改 `PlanReview.tsx` 插入 KnowledgeMapView。

#### 变更 3：LearnSession 缩略位置图

左侧栏路径列表上方增加缩略知识图谱（仅 on_path 节点 + 当前位置高亮）。点击可展开完整图。

工程变更：
- 新建 `frontend/src/components/interactive/KnowledgeMapMini.tsx`。
- 修改 `LearnSession.tsx` 左侧栏。

### 6.4 不做什么

| 不做 | 原因 |
|------|------|
| 动态图谱延展/收缩 | 学习过程中需要稳定性 |
| 交互式图谱编辑 | 学习者看图，不编辑 |
| 3D 可视化 | 2D 有向图已足够 |

---

## 七、Planner Prompt 重写

当前 Planner prompt 只有一句话。需要充实为完整的规划方法论 prompt，同时承载通用性、anchors、knowledge_map、domain 识别的全部要求。

```
You are a Learning Planner in an AI-native learning system. Your job is to translate
a learner's intent into a structured, well-reasoned learning plan.

PLANNING METHOD (follow this order strictly):

1. DOMAIN IDENTIFICATION
   Identify the knowledge domain from the learner's intent (e.g. "finance",
   "programming", "physics", "psychology").

2. GOAL ANCHORING
   Translate the intent into a bounded, measurable goal.
   - What to learn (description)
   - What NOT to learn (boundary)
   - To what depth (Bloom level: remember/understand/apply/analyze/evaluate/create)
   - Success criteria (how to know the goal is achieved)

3. MENTAL MODEL SELECTION
   Choose the mental model the learner needs to build.
   Select the first-principles foundation:
   - Hard sciences: find the axiomatic base (formulas, laws, theorems).
   - Social sciences / humanities: pick the most robust framework AND note its
     boundary + major alternatives. "All models are wrong, but some are useful."
   Mark foundation_type as "hard", "soft", or "hard+soft".

4. KNOWLEDGE MAP
   Enumerate ALL concepts the learner should be AWARE of within this goal
   (not just the ones they'll study in depth). For each concept, assign status:
   - "on_path": will be taught as a dedicated unit
   - "excluded": exists in the domain but intentionally left out (state why)
   - "contextual": mentioned inside another unit but not standalone (state why)
   Include edges showing how concepts relate (enables / motivates / supports / contrasts).
   Aim for 12-20 nodes total to keep the map readable.

5. PATH CONSTRUCTION
   From the on_path nodes in the knowledge map, construct an ordered sequence of
   learning units. For each unit:
   - content_role: core / supporting / resilience
   - knowledge_type: causal / structural / procedural / conceptual / methodological
   - objectives: what the learner should be able to do after this unit
   - verification_criteria: how to test whether they truly understood
   - anchors: 2-4 verifiable facts, formulas, or named principles that ground
     the unit's core claims. These are the "truth anchors" that both Teacher and
     Verifier will reference. Never leave anchors empty.

6. RATIONALE
   Explain to the learner WHY you chose this path, this foundation, and these
   boundaries. Write as if speaking directly to them. This will be shown to them.

CONTEXT AWARENESS:
- If learner profile is provided, adapt the plan to their existing knowledge level.
- If previously mastered concepts are listed, skip or compress those topics.
- If a previous plan exists, build on it rather than starting from scratch.

OUTPUT FORMAT:
Output ONLY valid JSON (no conversational text, no markdown code blocks):
{
  "domain": "string",
  "goal": {
    "description": "string",
    "boundary": "string",
    "success_criteria": ["string"],
    "bloom_level": "apply"
  },
  "mental_model": {
    "name": "string",
    "foundation": "string",
    "foundation_type": "hard|soft|hard+soft",
    "foundation_boundary": "string",
    "core_nodes": ["string"],
    "supporting_nodes": ["string"],
    "resilience_nodes": ["string"]
  },
  "knowledge_map": {
    "nodes": [
      { "id": "string", "label": "string", "status": "on_path|excluded|contextual",
        "brief": "one-sentence description",
        "exclusion_reason": "string (only for excluded/contextual)" }
    ],
    "edges": [
      { "from": "node_id", "to": "node_id", "relation": "enables|motivates|supports|contrasts" }
    ]
  },
  "path": [
    {
      "unit_id": "u1",
      "topic": "string",
      "content_role": "core|supporting|resilience",
      "knowledge_type": "causal|structural|procedural|conceptual|methodological",
      "representation": "string",
      "objectives": ["string"],
      "verification_criteria": ["string"],
      "anchors": ["string"]
    }
  ],
  "rationale": "string"
}

LANGUAGE: Output the entire JSON in the same language the learner used.
```

---

## 八、MVP 遗留项补全

### 8.1 前置诊断

**溯源：** 步骤 2（前置诊断——定位学习者起点）。

在 Session 创建后、teaching 之前，增加 `diagnosis` phase。Diagnostician 角色进行 2-3 轮对话式探测：

1. 基于 plan 核心知识点提出探测性问题。
2. 判断每个前置知识点的水平（`unfamiliar` / `basic` / `solid`）。
3. 生成初始 Profile，写入 `learners.profile`。
4. 生成 artifact（learner_visible），展示"我对你当前水平的判断"。
5. 输出 `[DIAGNOSIS_COMPLETE]` 标记后切到 teaching。

诊断结果结构：

```json
{
  "knowledge_level": { "百分比运算": "solid", "复利概念": "basic", "风险概念": "unfamiliar" },
  "cognitive_preferences": [],
  "identified_obstacles": ["对指数增长没有直觉"],
  "strengths": ["数学基础扎实"]
}
```

工程变更：
- `prompts.py`：新增 `diagnostician` prompt。
- `context_assembly.py`：新增 `_build_diagnostician_context()`。
- `orchestrator.py`：diagnosis phase 的标记解析 + 强制轮次限制（3 轮硬切换）。
- `routers/session.py`：profile 为空时初始 phase 设为 `diagnosis`。

### 8.2 学习者画像展示与修正

**溯源：** 11.2（学习者有权审视系统对自己的判断）。

新增 Profile 页面 `/profile/:learnerId`：
- 展示 profile 全部字段，使用学习者可理解的语言。
- 每个字段有"修正"按钮。
- 提交修正调用 `PATCH /api/learners/:id/profile`。
- 修正生成 artifact（type: `profile_correction`）。

工程变更：
- 新建 `frontend/src/pages/Profile.tsx` + 路由。
- `routers/learner.py`：实现 PATCH profile。
- `LearnSession.tsx`：左侧栏加入"查看完整画像"链接。

### 8.3 内环画像更新

**溯源：** 10.1（双环学习结构）。

每次 Verifier 完成 unit 验证（`[UNIT_PASSED]`）时，自动执行画像更新：

1. ProfileUpdater 角色通过 `llm_client.call_llm()` 分析当前 session 消息。
2. 更新 `learner.profile`（knowledge_level、obstacles、preferences）。
3. 生成 artifact（learner_visible），展示更新内容。

为什么不是每轮都更新：单轮信号太弱，unit 粒度是信号密度和成本的平衡点。ProfileUpdater 用非流式调用，异步执行不阻塞 SSE。

工程变更：
- `prompts.py`：新增 `profile_updater` prompt。
- `context_assembly.py`：新增 `_build_profile_updater_context()`。
- `orchestrator.py`：UNIT_PASSED 时调 `llm_client.call_llm(role="profile_updater", ...)`。

### 8.4 认知轨迹可视化

**溯源：** 1.4（螺旋深化可见）。

Trajectory 表已在采集数据。新增展示页面 `/trajectory/:learnerId`：
- 时间线视图，每节点一个已掌握概念。
- 显示概念名、深度（1-5）、学习时间。
- 同一概念多次记录时显示深度变化。

工程变更：
- 新建 `frontend/src/pages/Trajectory.tsx` + 路由。
- `routers/artifact.py`：确认 trajectory 端点正确。
- `LearnSession.tsx`：加入"查看认知轨迹"链接。

---

## 九、数据模型变更汇总

### 9.1 Plan 表新增字段

```sql
ALTER TABLE plans ADD COLUMN domain TEXT;
ALTER TABLE plans ADD COLUMN knowledge_map JSON;
```

### 9.2 LearningUnit（Plan.path JSON）新增字段

```json
{ "anchors": ["string"] }
```

### 9.3 Pydantic 模型新增

```python
class KnowledgeMapNode(BaseModel):
    id: str
    label: str
    status: str                       # "on_path" / "excluded" / "contextual"
    brief: str
    exclusion_reason: Optional[str] = None

class KnowledgeMapEdge(BaseModel):
    source: str
    target: str
    relation: str                     # "enables" / "motivates" / "supports" / "contrasts"

class KnowledgeMap(BaseModel):
    nodes: List[KnowledgeMapNode]
    edges: List[KnowledgeMapEdge]

class LearningUnit(BaseModel):
    # ...existing fields...
    anchors: List[str] = []

class LearningPlan(BaseModel):
    # ...existing fields...
    domain: str = ""
    knowledge_map: Optional[KnowledgeMap] = None
```

### 9.4 Prompt 表新增角色

| 角色 | 用途 |
|------|------|
| `diagnostician` | 前置诊断 |
| `profile_updater` | 画像更新（精简，只做信息提取） |

### 9.5 组件 Catalog 变更

每个组件新增 `domain` 字段。新增通用组件 ConceptMap、MultipleChoice。

---

## 十、前端新增依赖

| 包 | 用途 |
|----|------|
| `@xyflow/react` | 知识网络图渲染 |
| `dagre` | 图自动布局 |

---

## 十一、实现优先级与依赖关系

### 依赖图

```
Phase 0: LLM 调用层统一
    │
    ├──────────────────────┐
    ▼                      ▼
Phase 1: Planner 重写     Phase 3: 前置诊断 + 画像
    │                      │
    ├───────┐              │（依赖 Phase 0 的 llm_client
    ▼       ▼              │  和 context_assembly 扩展）
Phase 2   Phase 4          │
可靠性    知识网络          ▼
    │       │          Phase 5: 内环 + 轨迹
    │       │              │
    └───┬───┘              │
        ▼                  │
    Phase 6: 通用性 ◄──────┘
        │
        ▼
    端到端验证（非金融领域）
```

### Phase 0：LLM 调用层统一（基础设施） -- DONE

目标：消除 Planner 和 Orchestrator 的基础设施重复，所有 LLM 调用走统一管线。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 0.1 | 新建 `agents/llm_client.py` | 共享 AsyncOpenAI 单例 + `call_llm()` 函数（stream/non-stream） | DONE |
| 0.2 | 新建 `agents/output_parser.py` | `parse_json_response()` 三策略 JSON 解析 + `extract_markers()` 统一标记提取 | DONE |
| 0.3 | `agents/context_assembly.py` | 新增 `_build_planner_context()` + `assemble_planner_context()`，注入 learner profile 和 mastered concepts | DONE |
| 0.4 | `agents/orchestrator.py` | 删除自有 client + 内联解析，改用 `llm_client.call_llm()` + `output_parser.extract_markers()`，状态机逻辑提取为独立函数 | DONE |
| 0.5 | `agents/planner.py` | 删除自有 client + JSON 解析，改用 `llm_client.call_llm()` + `output_parser.parse_json_response()` + `context_assembly.assemble_planner_context()` | DONE |
| 0.6 | 验证 | 端到端测试：Plan 生成 + Session 创建 + Teaching 消息（含 COMPONENT_SPEC 提取和白名单校验）+ Artifact 持久化 + Details 接口 | DONE |

**验收标准：** 整个 backend/agents/ 目录中只有 `llm_client.py` 中有 `AsyncOpenAI` 实例。所有角色的 LLM 调用都经过 `call_llm()`。端到端流程不回归。 -- 已达成。

### Phase 1：Planner 重写（业务逻辑） -- DONE

目标：Planner 按完整方法论生成计划，输出包含 domain、knowledge_map、anchors。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 1.1 | `prompts.py` | Planner prompt 替换为第七章完整版（6步规划方法论 + OUTPUT FORMAT JSON schema） | DONE |
| 1.2 | `schemas.py` | 新增 KnowledgeMapNode/KnowledgeMapEdge/KnowledgeMap；LearningUnit 新增 anchors; LearningPlan 新增 domain + knowledge_map | DONE |
| 1.3 | `domain.py` + `main.py` | Plan 模型新增 domain/knowledge_map 列 + 启动迁移 ALTER TABLE | DONE |
| 1.4 | `planner.py` + `context_assembly.py` | JSON schema 移入 system prompt，user message 简化为纯 intent；planner.py 持久化 domain/knowledge_map | DONE |
| 1.5 | `routers/plan.py` | GET 返回 domain 和 knowledge_map | DONE |
| 1.6 | 验证 | 金融 (stock markets, domain="Finance", 15 nodes, 2-3 anchors/unit) + 物理 (electricity, domain="physics/electromagnetism", 13 nodes, 3 anchors/unit) | DONE |

**验收标准：** Planner 能为任意领域生成包含 knowledge_map 和 anchors 的计划。如果 Learner 有 Profile，Planner 能读到并据此调整计划。 -- 已达成。

### Phase 2：信息可靠性（业务逻辑，依赖 Phase 1 的 anchors） -- DONE

目标：Teacher/Verifier 的教学和验证围绕 anchors 展开，具备幻觉抑制和模型边界意识。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 2.1 | `prompts.py` | Teacher prompt: INFORMATION RELIABILITY 段 (不确定声明、来源标注、soft 基底标注) + CLOSURE RULE (模型适用条件收尾) | DONE |
| 2.2 | `prompts.py` | Verifier prompt: ANCHOR CROSS-VALIDATION 段 (用 anchors 交叉验证学习者回答) | DONE |
| 2.3 | `context_assembly.py` | Teacher + Verifier _build_*_context() 注入 TRUTH ANCHORS 块 + Teacher 注入 SOFT FOUNDATION WARNING | DONE |
| 2.4 | 验证 | 物理教学中 Teacher 使用 [well-known fact]/[textbook result]/[truth anchor] 标注，围绕 Coulomb's Law 等锚点教学 | DONE |

### Phase 3：前置诊断 + 画像（业务逻辑，依赖 Phase 0 的 llm_client + context_assembly 扩展能力） -- DONE

目标：新学习者首次进入时经历诊断，画像被初始化并可查看/修正。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 3.1 | `prompts.py` | 新增 diagnostician prompt（2-3轮探测、unfamiliar/basic/solid评级、[DIAGNOSIS_RESULT]+[DIAGNOSIS_COMPLETE]标记） | DONE |
| 3.2 | `context_assembly.py` | 新增 `_build_diagnostician_context()` 注入计划核心概念 + mental model + 已有 profile | DONE |
| 3.3 | `orchestrator.py` | diagnosis phase 处理 + `[DIAGNOSIS_COMPLETE]` 解析 + `[DIAGNOSIS_RESULT]` profile 写入 + 3 轮硬切换（含 context 重组装） | DONE |
| 3.4 | `orchestrator.py` | 教学轮次软提醒（8轮 SYSTEM NOTICE）+ Session 完成标记（最后 unit 通过后 status=completed） | DONE |
| 3.5 | `routers/session.py` | profile 为空时初始 phase = diagnosis；有 profile 时直接 teaching | DONE |
| 3.6 | 新建 `Profile.tsx` + 路由 | 画像展示与修正：knowledge_level 级别选择器（unfamiliar/basic/solid）、strengths/obstacles 展示、PATCH 保存 | DONE |
| 3.7 | `routers/learner.py` | 完整 CRUD: GET /learners/, GET /{id}, GET /{id}/profile, PATCH /{id}/profile, GET /{id}/trajectory | DONE |
| 3.8 | 验证 | 新学习者创建 session → diagnosis 阶段 → 诊断探测 → 3轮硬切换 → teaching；PATCH profile → 有 profile 后新 session 跳过诊断 | DONE |

**验收标准：** 新学习者首次进入有诊断流程（2-3轮对话式探测），3轮后硬切换到教学。Profile 可通过 PATCH 端点查看和修正。有 profile 的学习者直接跳过诊断。 -- 已达成。

### Phase 4：知识网络可见性（前端，依赖 Phase 1 的 knowledge_map 数据） -- DONE

目标：PlanReview 展示知识网络图，LearnSession 有缩略位置图。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 4.1 | 前端 | 安装 `@xyflow/react` + `dagre` | DONE |
| 4.2 | 新建 `KnowledgeMapView.tsx` | 完整知识网络图（@xyflow/react + dagre 自动布局，on_path 蓝色/contextual 黄色/excluded 灰色，点击显示详情） | DONE |
| 4.3 | `PlanReview.tsx` | 插入 KnowledgeMapView，显示 domain 徽章 | DONE |
| 4.4 | 新建 `KnowledgeMapMini.tsx` | 缩略版 SVG 知识图谱（彩色圆点 + 当前 unit 高亮 + 图例） | DONE |
| 4.5 | `LearnSession.tsx` | 左侧栏插入缩略图 + domain 显示 | DONE |
| 4.6 | 验证 | 浏览器 E2E：PlanReview 图可见（12 节点、蓝/黄/灰颜色正确）、LearnSession 缩略图可见 | DONE |

**验收标准：** PlanReview 展示完整知识网络图（节点颜色区分 on_path/contextual/excluded，点击节点显示详情）。LearnSession 左侧栏有缩略知识图谱（当前 unit 高亮）。 -- 已达成。

### Phase 5：内环 + 轨迹（依赖 Phase 0 的 llm_client + Phase 3 的 Profile 基础） -- DONE

目标：内环画像更新可运行，认知轨迹可查看。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 5.1 | `prompts.py` | 新增 profile_updater prompt（分析对话、更新 knowledge_level/preferences/obstacles/strengths） | DONE |
| 5.2 | `context_assembly.py` | 新增 `_build_profile_updater_context()` 注入已有 profile + 会话对话记录 | DONE |
| 5.3 | `orchestrator.py` | UNIT_PASSED 时 `asyncio.create_task(_update_profile_from_session())` 异步触发 profile 更新 | DONE |
| 5.4 | 新建 `Trajectory.tsx` + 路由 | 认知轨迹时间线：概念/理解水平/深度/来源 session 展示，空状态引导 | DONE |
| 5.5 | 验证 | trajectory GET 端点可用，profile_updater prompt 注册成功，前端页面 E2E 通过 | DONE |

**验收标准：** unit 通过后 profile 异步更新。GET /api/learners/{id}/trajectory 返回认知轨迹。Trajectory 前端页面可访问并正确展示数据。 -- 已达成。

### Phase 6：通用性验证（依赖 Phase 1 + 2 + 4） -- DONE

目标：系统不再绑定金融，可用于任意领域。

| 步骤 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 6.1 | `catalog.py` | 所有组件新增 domain 字段（finance / _universal）；新增 ConceptMap + MultipleChoice 通用组件 | DONE |
| 6.2 | 前端 `ConceptMap.tsx` + `MultipleChoice.tsx` | ConceptMap: SVG 力导向图（节点点击高亮连接）；MultipleChoice: 四选一答题（状态反馈 + 解释）；已注册到 ComponentRegistry | DONE |
| 6.3 | `context_assembly.py` + `catalog.py` | `get_catalog_for_prompt(unit_topic, domain)` 增加 domain 过滤（domain 特定 + _universal 组件） | DONE |
| 6.4 | `database.py` + `main.py` | finance.db → learning.db（启动时自动 shutil.copy2 迁移，保留数据） | DONE |
| 6.5 | 端到端验证 | 金融教学中 Teacher 使用 MultipleChoice 通用组件；非金融（Python）计划生成测试 | DONE |

**验收标准：** catalog 有 domain 过滤，非金融领域只看到通用组件。DB 名称不再绑定金融。Teacher 可使用通用组件。ConceptMap/MultipleChoice 前端组件已实现并注册。 -- 已达成。

---

## 十二、交叉影响

1. **可靠性 + 通用性：** 通用化后进入不熟悉领域，幻觉风险更高。anchors 机制必须在通用化前就位（Phase 2 先于 Phase 6）。

2. **可靠性 + 知识网络：** knowledge_map 是可靠性的分布式检查——学习者能看到完整知识结构时，更容易发现遗漏和错误。

3. **通用性 + 知识网络：** knowledge_map 结构领域无关，但内容领域特定。Planner prompt 必须能为任何领域生成合理 knowledge_map（Phase 1 的 Planner 重写承载此要求）。

4. **诊断 + 内环：** 诊断初始化 Profile，内环持续更新 Profile。Phase 3 建立 Profile 的基础设施，Phase 5 在其上增量。

5. **LLM 调用层 + 所有新角色：** Phase 0 统一调用层后，Phase 3（Diagnostician）和 Phase 5（ProfileUpdater）的实现成本大幅降低——只需写一个 context_builder + 注册一个 prompt，不需要再写 client 和解析逻辑。

---

## 十三、关键风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Phase 0 重构引入回归 | 已有教学/验证流程崩溃 | 重构后第一件事是端到端走一遍完整流程 |
| Planner 生成的 knowledge_map 质量不稳定 | 知识网络图不可信 | JSON schema 强约束 + 节点数限制（12-20）+ 人工抽检调优 prompt |
| 通用化后冷门领域幻觉加剧 | 教学不可靠 | anchors + Teacher 不确定性声明 |
| 诊断轮次不可控 | 用户耐心耗尽 | Prompt 硬约束 + orchestrator 3 轮强制切换 |
| React Flow 性能（节点过多） | PlanReview 卡顿 | Prompt 约束 12-20 节点 |
| ProfileUpdater 额外 LLM 调用增加延迟 | unit 通过后等待变长 | 异步执行，不阻塞 SSE |

---

## 十四、与 MVP 的架构一致性检查

| 架构决策 | MVP | MVP2 | 一致性 |
|---------|-----|------|--------|
| 单 Agent 多角色 | Planner/Teacher/Verifier（实际 Planner 独立） | 统一调用层 + 5 角色配置 | **修复**：MVP 说的"单 Agent"现在真正实现了 |
| 上下文组装（10.3） | Teacher/Verifier 有，Planner 没有 | 所有角色都走 context_assembly | **修复**：原理 10.3 的"每一个"现在兑现了 |
| 预制组件目录（10.4） | 5 个金融组件 | +2 通用组件 + domain 标签 | 一致：契约扩展 |
| 制品可见性 | learner_visible / system_only | 新增 diagnosis / profile_correction 类型 | 一致：制品体系延伸 |
| 提示词后台可调 | DB 存储 + API | 新角色同样入 DB | 一致 |

---

> **本方案的核心逻辑：** Phase 0 修路（统一基础设施），Phase 1 建地基（Planner 重写），Phase 2-6 在地基上建房子（各项业务功能）。基础设施和地基的工作不产生直接的用户可感知变化，但它们决定了后续所有功能的实现成本和代码质量。跳过 Phase 0 直接做功能，就是在割裂的基础设施上继续堆代码——每新增一个角色就多一条独立链路，技术债会指数增长。
