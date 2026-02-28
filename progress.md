# Progress

## 本次做了什么 (Iterations 0-5 completed)

### Iteration 0: 止血
- 后端 orchestrator.py 添加 VALID_COMPONENTS 硬校验白名单，LLM 编造的组件名直接丢弃降级为纯文本
- main.py 添加 on_startup 事件，每次服务器启动自动 seed_prompts 到数据库

### Iteration 1: 重写上下文组装（地基修复）
- 创建 `backend/components/catalog.py`：结构化组件目录
- 重写 `backend/agents/context_assembly.py`：Teacher 和 Verifier 分别注入不同粒度的上下文
- Verifier 排除 Teacher 教学内容（防止自我验证偏差）

### Iteration 2: 充实角色 Prompt
- Teacher: 脚手架 / 动机维持 / 组件规范 / 语言自适应
- Verifier: 四层验证协议（解释/预测/异常/边界），至少通过3层

### Iteration 3: 构建3个新交互组件（共5个）
- RiskReturnScatter / InflationTimeline / AssetAllocationPie

### Iteration 4: Artifact 内容充实
- 右侧栏决策卡片改为实质性描述

### Iteration 5: 修复两个用户反馈的真实 Bug

#### Bug 1: Verifier 层级跟踪混乱（第三层没过就跳到第四层，回头又忘了第四层已过）

**根因**：Verifier 的四层验证完全靠 LLM 的对话记忆，没有结构化状态。随着对话轮次增加，LLM 丢失了"我在哪一层、哪些已通过"的上下文。`context_assembly.py` 把所有消息一股脑塞给 Verifier，没有注入层级进度。

**修复**：
1. `models/domain.py`：Session 模型新增 `verification_state` JSON 列，存储 `{current_layer: N, layers: {"1": "passed", "2": "in_progress", ...}}`
2. `main.py`：启动时自动执行 `ALTER TABLE sessions ADD COLUMN verification_state TEXT`（兼容已有数据库）
3. `orchestrator.py`：
   - phase_transition 到 verification 时初始化 verification_state = `{current_layer: 1, layers: {1: "in_progress", 2-4: "pending"}}`
   - 解析 Verifier 输出中的 `[LAYER_PASSED: N]` 标记，更新 verification_state（层级推进，自动找下一个 pending 层）
   - unit 跃迁时重置 verification_state = null
4. `context_assembly.py`：
   - `_build_verifier_context()` 新增 `verification_state` 参数
   - 注入结构化层级进度块："VERIFICATION PROGRESS (authoritative, trust this over conversation history)"
   - 每层标记状态（PASSED / → CURRENT / PENDING），明确告诉 Verifier "You are on Layer N. Do NOT ask about other layers."
5. `prompts.py`：Verifier prompt 重写：
   - STATE TRACKING 部分：要求 Verifier 以 VERIFICATION PROGRESS 块为权威数据源
   - 每次只出一层题，答对才输出 `[LAYER_PASSED: N]`
   - 答错不跳层、不回头

#### Bug 2: 数学公式渲染为原始文本

**根因**：前端 `ReactMarkdown` 只配了 `remarkGfm`，没有数学渲染支持。`$...$` 和 `$$...$$` 被当作普通文本。

**修复**：
1. 安装 `remark-math` + `rehype-katex` + `katex`
2. `LearnSession.tsx`：ReactMarkdown 配置 `remarkPlugins={[remarkGfm, remarkMath]}` + `rehypePlugins={[rehypeKatex]}`，导入 `katex/dist/katex.min.css`
3. Teacher 和 Verifier prompt 都加入 MATH FORMATTING 规则：要求用 LaTeX 记法写公式（`$inline$` / `$$display$$`），禁止写纯文本公式

## 当前系统能力总结

| 能力 | 状态 | 说明 |
|------|------|------|
| 意图 -> 结构化计划 | ✅ | Planner 生成 goal/mental_model/path/rationale |
| 计划审阅页 | ✅ | PlanReview 展示心智模型、路径、理由 |
| 教学对话 (聚焦 unit) | ✅ | Teacher context 包含 unit objectives/knowledge_type |
| 交互组件 (5个) | ✅ | CompoundInterest, EmergencyBuffer, RiskReturn, Inflation, AssetAllocation |
| 组件安全 | ✅ | 后端硬校验白名单 + catalog 约束 prompt |
| 分层理解验证 | ✅ | 四层协议 + 结构化状态跟踪（不再依赖 LLM 记忆） |
| 验证层级状态追踪 | ✅ 新 | Session.verification_state JSON + 系统注入层级进度 |
| 数学公式渲染 | ✅ 新 | KaTeX + remark-math + rehype-katex |
| 认知轨迹记录 | ✅ | Verifier [UNIT_PASSED: score=N] 写入 trajectory 表 |
| 动态 unit 跃迁 | ✅ | 通过验证后自动切到下一个 unit |
| Artifact 实质内容 | ✅ | 右侧栏决策卡片有教学理由和组件选择解释 |
| Agent 思考过程可见 | ✅ | ThinkingAccordion 折叠面板 |
| Prompt 后台可调 | ✅ | /api/admin/prompts GET/PUT + 启动时自动同步 |

## 还没做什么

| 项目 | 设计文档引用 | 优先级 |
|------|------------|--------|
| 前置诊断 (2-3轮对话探测知识水平) | 步骤2, MVP 2.1 | 中 |
| 学习者画像页面 + 修正 API | 步骤2, 11.2 | 中 |
| 认知轨迹可视化页面 (/trajectory) | 1.4, 11.2 | 中 |
| 内环：从对话中提取学习者特征更新 profile | 10.1 双环 | 中 |
| 最后单元的迁移练习 | 步骤9, MVP 2.2 | 低 |
| Generative UI (即时生成新组件) | MVP 2.3 推迟 | 推迟 |

### Iteration 6: 上下文管理全面 Review 与修复

完整 review 了系统上下文管理的数据流、角色差异、存储层、结构标记解析链路，发现并修复 6 个问题：

#### 6.1 P0: 用户消息被重复注入 LLM context (已修复)

**根因**: `orchestrator.py` 先存 user message 到 DB，然后 `context_assembly.py` 从 DB 取 history（已含刚存的），末尾又追加一次。LLM 每轮看到当前消息两次。
**修复**: 将 user message 存 DB 的时机移到 `assemble_context()` 之后。history 查询不含当前消息，末尾追加是唯一一份。

#### 6.2 P0: Verifier 没有真正过滤 Teacher 消息 (已修复)

**根因**: `Message` 表没有 `phase` 字段，`context_assembly.py` 无法区分 Teaching/Verification 阶段的 assistant 消息，Verifier 看到 Teacher 完整教学内容，存在自我验证偏差。
**修复**:
- `models/domain.py`: Message 新增 `phase` 列 (`"teaching"` / `"verification"`)
- `main.py`: 启动时自动 ALTER TABLE 迁移
- `orchestrator.py`: 存 user/assistant 消息时带上当前 session phase
- `context_assembly.py`: Verifier 只取 `phase="verification"` 的 assistant 消息

#### 6.3 P1: 无 token 预算管理 (已修复)

**根因**: 硬编码 `.limit(20)` 条消息，不考虑长度，可能溢出 context window。
**修复**: 新增 `_estimate_tokens()` (len/3 粗估) 和 `_trim_history_to_budget()` 函数。System prompt 和当前 user message 始终保留，从最旧消息开始裁剪。预算通过 `MAX_CONTEXT_TOKENS` 环境变量可调（默认 6000）。

#### 6.4 P2: 前端 artifact 刷新丢失 (已修复)

**根因**: `LearnSession.tsx` artifacts 只在 React state 中，初始化不从 DB 加载。orchestrator 的 artifact 也只推 SSE 不存 DB。
**修复**:
- `orchestrator.py`: artifact SSE yield 前先存到 Artifact 表
- `routers/session.py`: `GET /details` 返回 `artifacts` 数组
- `LearnSession.tsx`: `fetchSessionData` 中加载已有 artifacts

#### 6.5 P2: 组件 Catalog 全量注入 (已修复)

**根因**: Teacher system prompt 每次注入全部5个组件描述 (~800 token)，与当前 unit topic 无关时浪费 token。
**修复**: `catalog.py` 的 `get_catalog_for_prompt(unit_topic)` 改为按 `applicable_topics` 与 unit topic 做子串匹配过滤。无匹配时回退全量。`context_assembly.py` 传入当前 unit topic。

#### 6.6 P2: 无跨 Session 记忆 (已修复)

**根因**: context_assembly 只读当前 session 的 Message history，学习者通过 Unit 1 后进入 Unit 2 时没有前序记忆。
**修复**: 新增 `_get_mastered_concepts()` 查 Trajectory 表，`_format_mastered_concepts()` 格式化为 "PREVIOUSLY MASTERED CONCEPTS" 块，注入 Teacher 和 Verifier 的 system prompt。

## 当前系统能力总结

| 能力 | 状态 | 说明 |
|------|------|------|
| 意图 -> 结构化计划 | OK | Planner 生成 goal/mental_model/path/rationale |
| 计划审阅页 | OK | PlanReview 展示心智模型、路径、理由 |
| 教学对话 (聚焦 unit) | OK | Teacher context 包含 unit objectives/knowledge_type |
| 交互组件 (5个) | OK | CompoundInterest, EmergencyBuffer, RiskReturn, Inflation, AssetAllocation |
| 组件安全 | OK | 后端硬校验白名单 + catalog 约束 prompt |
| 分层理解验证 | OK | 四层协议 + 结构化状态跟踪（不依赖 LLM 记忆） |
| 数学公式渲染 | OK | KaTeX + remark-math + rehype-katex |
| 认知轨迹记录 | OK | Verifier [UNIT_PASSED: score=N] 写入 trajectory 表 |
| 动态 unit 跃迁 | OK | 通过验证后自动切到下一个 unit |
| Artifact 持久化 | OK (新) | orchestrator 存 DB + 前端初始化加载 + SSE 实时推送 |
| Agent 思考过程可见 | OK | ThinkingAccordion 折叠面板 |
| Prompt 后台可调 | OK | /api/admin/prompts GET/PUT + 启动时自动同步 |
| 上下文消息去重 | OK (新) | user message 存 DB 在 context 组装之后 |
| Verifier 信息隔离 | OK (新) | Message.phase 字段 + 只取 verification 阶段 assistant 消息 |
| Token 预算管理 | OK (新) | 粗估 token + 从旧消息裁剪 + MAX_CONTEXT_TOKENS 可调 |
| 组件 Catalog 按需过滤 | OK (新) | 按 unit topic 过滤，无匹配回退全量 |
| 跨 Session 记忆 | OK (新) | Trajectory 回注 Teacher/Verifier context |

### MVP2 Phase 0: LLM 调用层统一（基础设施重构）

消除 Planner 和 Orchestrator 的基础设施重复，所有 LLM 调用走统一管线。

| 步骤 | 改动 | 状态 |
|------|------|------|
| 0.1 | 新建 `agents/llm_client.py`: 共享 AsyncOpenAI 单例 + `call_llm(messages, stream)` | DONE |
| 0.2 | 新建 `agents/output_parser.py`: `parse_json_response()` 三策略 JSON 解析 + `extract_markers()` 提取 COMPONENT_SPEC/PHASE_TRANSITION/LAYER_PASSED/UNIT_PASSED/DIAGNOSIS_COMPLETE | DONE |
| 0.3 | `agents/context_assembly.py`: 新增 `_build_planner_context()` + `assemble_planner_context()`, Planner 可读 learner profile 和 mastered concepts | DONE |
| 0.4 | `agents/orchestrator.py`: 删除自有 AsyncOpenAI 实例和内联解析, 改用 llm_client + output_parser. 状态机处理提取为独立函数 | DONE |
| 0.5 | `agents/planner.py`: 删除自有 AsyncOpenAI 和 JSON 解析, 改用 llm_client + output_parser + context_assembly | DONE |
| 0.6 | 端到端验证: Plan 生成 + Session 创建 + Teaching 消息 (含 COMPONENT_SPEC 白名单) + Artifact 持久化 + Details API | DONE |

**结果**: backend/agents/ 中只有 llm_client.py 有 AsyncOpenAI 实例。所有 LLM 调用走 call_llm()。原有流程无回归。Planner 现在通过 context_assembly 获得上下文，可以读到 learner profile 和 trajectory（为后续 Phase 3 诊断做好铺垫）。

### MVP2 Phase 1: Planner 重写（业务逻辑）

Planner 按完整方法论生成计划，输出包含 domain、knowledge_map、anchors。

| 步骤 | 改动 | 状态 |
|------|------|------|
| 1.1 | `prompts.py`: Planner prompt 替换为完整 6 步规划方法论 + JSON schema | DONE |
| 1.2 | `schemas.py`: 新增 KnowledgeMapNode/Edge/Map; LearningUnit.anchors; LearningPlan.domain/knowledge_map | DONE |
| 1.3 | `domain.py` + `main.py`: Plan 表新增 domain/knowledge_map 列 + 启动迁移 | DONE |
| 1.4 | `planner.py` + `context_assembly.py`: JSON schema 移入 system prompt, user message 简化, 持久化新字段 | DONE |
| 1.5 | `routers/plan.py`: GET 返回 domain + knowledge_map | DONE |
| 1.6 | 验证: 金融(stock markets, 15 nodes) + 物理(electricity, 13 nodes) 均生成含 anchors 的计划 | DONE |

**结果**: Planner 可为任意领域生成包含 knowledge_map (12-20 nodes, on_path/excluded/contextual) 和 anchors (2-4 per unit) 的计划。GET API 返回新字段。教学流程无回归。

### MVP2 Phase 2: 信息可靠性（anchors + 幻觉抑制 + 模型边界）

| 步骤 | 改动 | 状态 |
|------|------|------|
| 2.1 | `prompts.py` Teacher: INFORMATION RELIABILITY (不确定声明、来源标注 [well-known fact]/[textbook result]/[estimate]) + CLOSURE RULE (模型收尾) | DONE |
| 2.2 | `prompts.py` Verifier: ANCHOR CROSS-VALIDATION (用 anchors 验证学习者事实性回答) | DONE |
| 2.3 | `context_assembly.py`: Teacher/Verifier 注入 TRUTH ANCHORS + SOFT FOUNDATION WARNING | DONE |
| 2.4 | 验证: 物理教学中 Teacher 使用来源标注、围绕 Coulomb's Law 锚点教学 | DONE |

**结果**: Teacher 围绕 anchors 教学并标注信息来源类型。Verifier 可用 anchors 交叉验证学习者回答。Soft 基底自动触发模型边界提示。

### MVP2 Phase 3: 前置诊断 + 画像 + 状态机加固

| 步骤 | 改动 | 状态 |
|------|------|------|
| 3.1 | `prompts.py`: 新增 diagnostician prompt（2-3轮探测、knowledge_level 评级、[DIAGNOSIS_RESULT]+[DIAGNOSIS_COMPLETE] 标记） | DONE |
| 3.2 | `context_assembly.py`: 新增 `_build_diagnostician_context()` + role_map 修正 diagnosis→diagnostician | DONE |
| 3.3 | `orchestrator.py`: `_handle_diagnosis_complete()` 解析 [DIAGNOSIS_RESULT] 写入 learner.profile + 转 teaching；`_handle_diagnosis_cutoff()` 3轮后强制转 teaching + context 重组装 | DONE |
| 3.4 | `orchestrator.py`: 教学软提醒（context_assembly 8轮 SYSTEM NOTICE）+ Session 完成标记（最后 unit status=completed） | DONE |
| 3.5 | `routers/session.py`: profile 为空→phase=diagnosis；有 profile→直接 teaching | DONE |
| 3.7 | `routers/learner.py`: 完整 CRUD: GET /learners/, GET /{id}, GET /{id}/profile, PATCH /{id}/profile（merge 语义）, GET /{id}/trajectory | DONE |
| 3.8 | 验证: 新 session→diagnosis→诊断探测→3轮切换→teaching OK；PATCH profile→新 session 跳过诊断 OK | DONE |

**结果**: 新学习者首次进入有诊断流程，3轮硬切换保障不卡住。Profile PATCH 支持增量合并。有 profile 后直接教学。

### MVP2 Phase 5: 内环 + 轨迹（后端）

| 步骤 | 改动 | 状态 |
|------|------|------|
| 5.1 | `prompts.py`: 新增 profile_updater prompt（分析对话、输出 JSON profile 更新） | DONE |
| 5.2 | `context_assembly.py`: 新增 `_build_profile_updater_context()` 注入已有 profile + 会话对话 | DONE |
| 5.3 | `orchestrator.py`: UNIT_PASSED 时 `asyncio.create_task()` 异步触发 `_update_profile_from_session()` | DONE |

**结果**: unit 通过后自动异步调用 profile_updater LLM 更新 learner.profile。GET /api/learners/{id}/trajectory 返回认知轨迹。

### MVP2 Phase 6: 通用性（后端）

| 步骤 | 改动 | 状态 |
|------|------|------|
| 6.1 | `catalog.py`: 所有组件新增 domain 字段（finance/_universal）+ 新增 ConceptMap + MultipleChoice 通用组件 | DONE |
| 6.3 | `catalog.py` + `context_assembly.py`: `get_catalog_for_prompt(unit_topic, domain)` domain 过滤（domain 特定 + _universal） | DONE |
| 6.4 | `database.py` + `main.py`: finance.db → learning.db（shutil.copy2 迁移 + 标题更新） | DONE |
| 6.5 | 验证: 金融教学中 Teacher 使用 MultipleChoice 通用组件 ✓ | DONE |

**结果**: catalog 支持 domain 过滤，非金融领域只看到通用组件。DB 名称不再绑定金融。Teacher 在金融教学中成功使用了 MultipleChoice 通用组件。

### MVP2 Phase 4: 知识网络可见性（前端）

| 步骤 | 改动 | 状态 |
|------|------|------|
| 4.1 | `package.json`: 安装 `@xyflow/react` + `dagre` | DONE |
| 4.2 | 新建 `KnowledgeMapView.tsx`: @xyflow/react + dagre 自动布局, on_path 蓝/contextual 黄/excluded 灰, 点击显示详情面板 | DONE |
| 4.3 | `PlanReview.tsx`: 插入 KnowledgeMapView + domain 徽章 | DONE |
| 4.4 | 新建 `KnowledgeMapMini.tsx`: 缩略 SVG (彩色圆点 + 当前 unit 高亮 + 图例) | DONE |
| 4.5 | `LearnSession.tsx`: 左侧栏插入缩略知识图谱 + domain 显示 | DONE |
| 4.6 | 浏览器 E2E 验证: PlanReview 12 节点图可见, 颜色正确; LearnSession 缩略图可见 | DONE |

**结果**: PlanReview 展示完整知识网络图（节点颜色区分状态，点击查看详情）。LearnSession 左侧栏有缩略知识图谱。

### MVP2 Phase 3.6: Profile 前端页面

| 步骤 | 改动 | 状态 |
|------|------|------|
| 3.6 | 新建 `Profile.tsx` + `/profile/:learnerId` 路由: knowledge_level 级别选择器 (unfamiliar/basic/solid), strengths/obstacles 展示, PATCH 保存 | DONE |
| 验证 | 浏览器 E2E: test_user profile 页面加载, knowledge_level 两个概念显示, 级别按钮可见, strengths 显示 | DONE |

### MVP2 Phase 5.4: 认知轨迹前端页面

| 步骤 | 改动 | 状态 |
|------|------|------|
| 5.4 | 新建 `Trajectory.tsx` + `/trajectory/:learnerId` 路由: 时间线视图, 概念/理解/深度/来源 session, 空状态引导 | DONE |
| 验证 | 浏览器 E2E: trajectory 页面加载, 空状态显示 "No trajectory data yet." | DONE |

### MVP2 Phase 6.2: 通用交互组件（前端）

| 步骤 | 改动 | 状态 |
|------|------|------|
| 6.2a | 新建 `ConceptMap.tsx`: SVG 力导向图, 节点点击高亮连接, 支持 nodes/edges props | DONE |
| 6.2b | 新建 `MultipleChoice.tsx`: 四选一答题, 选中反馈 (正确绿/错误红), 解释展示 | DONE |
| 6.2c | `ComponentRegistry.ts`: 注册 ConceptMap + MultipleChoice | DONE |

**结果**: 7 个交互组件（5 金融 + 2 通用）全部注册到 ComponentRegistry，TypeScript 编译零错误。

## MVP2 全部 Phase 完成状态

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 0 | LLM 调用层统一 | DONE |
| Phase 1 | Planner 重写 | DONE |
| Phase 2 | 信息可靠性 | DONE |
| Phase 3 | 前置诊断 + 画像 + 状态机加固 | DONE |
| Phase 4 | 知识网络可见性 | DONE |
| Phase 5 | 内环 + 轨迹 | DONE |
| Phase 6 | 通用性验证 | DONE |

## 还没做什么

| 项目 | 设计文档引用 | 优先级 |
|------|------------|--------|
| Generative UI (即时生成新组件) | MVP 2.3 推迟 | 推迟 |

## 已知的问题和 bug

1. SSE 流结束时 StatReload 有时触发 "ASGI callable returned without completing response" 警告（不影响功能）
2. LLM 非流式调用（Planner）在生成大型计划时耗时较长（3-5分钟），属 LLM 端点性能，非代码问题

## 下次开始时应该先做什么

1. 读这个 progress.md
2. MVP2 全部 Phase 已完成，可以开始 MVP3 规划或用户验收测试
3. 唯一推迟项：Generative UI（即时生成新组件）
