# si-beaver MVP 需求规格说明书

## 背景

构建一个 AI 原生的项目认知平台。AI 工具（Claude Code、Qoder CLI、Cursor）通过认知图谱（目标、探索、决策、风险、技术债、知识）成为项目的持续参与者。系统建模的是 *推理过程*（为什么、尝试了什么、学到了什么），而不仅仅是 *工作项*。

**MVP 约束：**
- 仅包含项目图谱 + 语义 API（无前端）
- 本地优先，单用户（自用）
- 单项目
- 被动 API — si-beaver 暴露 API 供外部 AI 工具调用，不内置 AI 推理引擎

---

## 1. 核心数据模型

### 1.1 基础节点

所有认知节点共享以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | ULID | 按时间排序的唯一标识 |
| type | enum | 节点类型判别符 |
| title | string (最长 200) | 人类/AI 可读标题 |
| description | string (markdown) | 富文本正文 |
| status | enum (按类型) | 生命周期状态 |
| tags | string[] | 自由标签 |
| created_at | timestamp | 不可变创建时间 |
| updated_at | timestamp | 最后修改时间 |
| metadata | key-value | 可扩展属性 |

### 1.2 节点类型

#### Goal（目标）
为项目提供方向的长期目标。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | active / achieved / abandoned / deferred | 生命周期状态 |
| horizon | short / medium / long | 大致时间范围 |
| success_criteria | string[] | "完成"的定义 |
| priority | critical / high / medium / low | 重要程度 |

#### Task（任务）
具体的、可执行的工作项。总是从目标或探索派生而来。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | proposed / ready / in_progress / done / cancelled | 生命周期 |
| effort | trivial / small / medium / large / unknown | 规模估算 |
| priority | critical / high / medium / low | 紧急程度 |
| acceptance_criteria | string[] | 完成条件 |

#### Exploration（探索）
对未知事物的研究/调查。可以失败 — 这也是有价值的。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | proposed / active / concluded / abandoned | 生命周期 |
| hypothesis | string | 我们认为可能成立的假设 |
| approach | string | 计划如何调查 |
| findings | string[] | 累积的发现 |
| conclusion | string? | 最终结论 |
| outcome | validated / invalidated / partial / inconclusive / null | 结果类型 |

#### Decision（决策）
带有完整推理链的架构/设计决策。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | proposed / accepted / superseded / deprecated | 生命周期 |
| context | string | 促使做出此决策的情境 |
| rationale | string | 为什么选择这个方案 |
| alternatives_considered | {option, pros[], cons[], reason_rejected}[] | 考虑过的其他方案 |
| consequences | string[] | 接受的代价/权衡 |
| superseded_by | NodeID? | 取代此决策的后续决策 |

#### Risk（风险）
已识别的项目威胁。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | identified / analyzing / mitigated / accepted / occurred / resolved | 生命周期 |
| likelihood | low / medium / high | 发生概率 |
| impact | low / medium / high / critical | 发生后的严重程度 |
| mitigation_strategy | string? | 缓解方案 |
| trigger_conditions | string[] | 什么条件会触发此风险 |

#### TechDebt（技术债）
能运行但造成拖累的事物。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | identified / accepted / paying_down / resolved | 生命周期 |
| severity | low / medium / high / critical | 痛感程度 |
| affected_area | string | 受影响的模块/组件 |
| cost_of_delay | string | 不处理会怎样 |
| resolution_approach | string? | 如何修复 |

#### Artifact（产物）
具体的项目输出（证据/锚点）。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | draft / active / archived | 生命周期 |
| artifact_type | document / design / pr / commit / prototype / spec / other | 分类 |
| uri | string? | 外部引用（路径、URL、SHA） |
| content_summary | string? | 简要摘要 |

#### Knowledge（知识）
结晶化的理解 — 项目"知道"的东西。

| 字段 | 类型 | 说明 |
|------|------|------|
| status | tentative / established / outdated | 生命周期 |
| domain | string | 知识所属领域 |
| confidence | low / medium / high | 确信程度 |
| source | string | 如何获得此知识 |
| valid_until | string? | 失效条件 |

### 1.3 边（关系）模型

| 字段 | 类型 | 说明 |
|------|------|------|
| id | ULID | 唯一标识 |
| source_id | NodeID | 起始节点 |
| target_id | NodeID | 目标节点 |
| relation | enum | 关系类型 |
| weight | float? | 重要程度 (0.0-1.0) |
| annotation | string? | 为什么存在这个关系 |
| created_at | timestamp | 创建时间 |

### 1.4 关系类型

| 关系 | 有效的 源→目标 | 语义 |
|------|---------------|------|
| `decomposes_into` | Goal→Goal, Goal→Task | 父级分解为子级 |
| `spawns` | Goal→Exploration, Risk→Exploration | 触发调查 |
| `produces` | Exploration→Decision, Exploration→Knowledge | 研究的产出 |
| `informs` | Knowledge→Decision, Decision→Task | 知识指导行动 |
| `creates` | Decision→TechDebt, Decision→Risk | 决策的副作用 |
| `mitigates` | Task→Risk, Decision→Risk | 降低风险 |
| `addresses` | Task→TechDebt | 偿还技术债 |
| `blocks` | Risk→Goal, TechDebt→Task | 阻碍 |
| `relates_to` | Any→Any | 通用关联 |
| `supersedes` | Decision→Decision, Knowledge→Knowledge | 取代前者 |
| `evidenced_by` | Knowledge→Artifact, Decision→Artifact | 支撑证据 |
| `derived_from` | Task→Exploration, Goal→Knowledge | 来源/溯源 |

---

## 2. 生命周期规则

### Goal（目标）
```
active → achieved（成功标准满足，子项完成）
active → deferred（降低优先级，可能回来）
active → abandoned（不再相关）
deferred → active（重新提升优先级）
deferred → abandoned
```

### Exploration（探索）
```
proposed → active（开始调查）
active → concluded（发现已记录，outcome 已设置）
active → abandoned（不再有成效，但仍记录已有发现）
```
约束：结论化需要填写 `conclusion` + `outcome`。应产出 Decision/Knowledge/Task。

### Decision（决策）
```
proposed → accepted（被采纳）
accepted → superseded（必须链接到后续决策）
accepted → deprecated（上下文已变）
```

### Risk（风险）
```
identified → analyzing → mitigated → resolved
identified/analyzing → accepted（有意识地接受）
identified/analyzing → occurred → resolved
```

### TechDebt（技术债）
```
identified → accepted → paying_down → resolved
```

### Task（任务）
```
proposed → ready → in_progress → done
any → cancelled（需要理由）
```

### Knowledge（知识）
```
tentative → established（已确认）
established → outdated（被取代）
```

---

## 3. 语义 API 操作

### 设计原则
1. 操作是**认知性的**，不是 CRUD — "开始探索" 而非 "POST /explorations"
2. 操作有**副作用** — 自动创建关联节点和边
3. 每次变更都**产生事件** — 完整历史被保留
4. 响应包含**上下文** — 什么变了、关联了什么

### 3.1 探索操作

**`begin_exploration`**（开始探索）
- 输入：topic, hypothesis?, reason, approach?, related_goals[], triggered_by?
- 效果：创建 Exploration（active），建立到目标/触发器的边
- 事件：`exploration.started`

**`record_exploration_finding`**（记录探索发现）
- 输入：exploration_id, finding, significance (minor/major/breakthrough), related_nodes[]
- 效果：追加到 findings，创建 relates_to 边
- 事件：`exploration.finding_recorded`

**`conclude_exploration`**（结论化探索）
- 输入：exploration_id, conclusion, outcome, decisions[], knowledge[], follow_up_tasks[]
- 效果：状态→concluded，创建 Decision/Knowledge/Task 节点及边
- 事件：`exploration.concluded`

**`abandon_exploration`**（放弃探索）
- 输入：exploration_id, reason, learnings?
- 效果：状态→abandoned，可选创建 Knowledge 节点
- 事件：`exploration.abandoned`

### 3.2 目标操作

**`define_goal`**（定义目标）
- 输入：title, description, horizon, success_criteria[], priority, parent_goal?
- 效果：创建 Goal（active），从父目标建立边
- 事件：`goal.defined`

**`decompose_goal`**（分解目标）
- 输入：goal_id, sub_goals[], tasks[], explorations_needed[]
- 效果：创建子节点，建立 decomposes_into/spawns 边
- 事件：`goal.decomposed`

**`update_goal_status`**（更新目标状态）
- 输入：goal_id, new_status, reason
- 效果：校验状态转换，更新状态
- 事件：`goal.status_changed`

### 3.3 决策操作

**`record_decision`**（记录决策）
- 输入：title, context, rationale, alternatives_considered[], consequences[], related_goals[], related_explorations[], supersedes?, risks_created[], tech_debt_created[]
- 效果：创建 Decision（accepted），按需创建 Risk/TechDebt 节点，取代旧决策
- 事件：`decision.recorded`

### 3.4 风险操作

**`identify_risk`**（识别风险）
- 输入：title, description, likelihood, impact, trigger_conditions[], affected_goals[], mitigation_strategy?
- 效果：创建 Risk（identified），建立 blocks 边到目标
- 事件：`risk.identified`

**`update_risk`**（更新风险）
- 输入：risk_id, new_status?, likelihood?, impact?, mitigation_strategy?, reason
- 效果：更新字段，校验状态转换
- 事件：`risk.updated`

### 3.5 技术债操作

**`register_tech_debt`**（注册技术债）
- 输入：title, description, severity, affected_area, cost_of_delay, resolution_approach?, caused_by?, blocks[]
- 效果：创建 TechDebt（identified），建立边
- 事件：`tech_debt.registered`

### 3.6 知识操作

**`record_knowledge`**（记录知识）
- 输入：title, description, domain, confidence, source, derived_from[], invalidates[]
- 效果：创建 Knowledge（established），标记被取代的知识为 outdated
- 事件：`knowledge.recorded`

### 3.7 任务操作

**`create_task`**（创建任务）
- 输入：title, description, effort, priority, acceptance_criteria[], parent_goal?, addresses_tech_debt?, mitigates_risk?
- 效果：创建 Task（proposed），建立边
- 事件：`task.created`

**`update_task_status`**（更新任务状态）
- 输入：task_id, new_status, reason?, artifacts[]
- 效果：更新状态，完成时创建 Artifact 节点
- 事件：`task.status_changed`

### 3.8 图操作

**`link_nodes`**（关联节点）
- 输入：source_id, target_id, relation, annotation?
- 效果：创建边（校验关系类型对源/目标节点类型是否有意义）
- 事件：`graph.edge_created`

### 3.9 读操作

**`get_project_state`**（获取项目状态）
- 输入：include_sections[] (goals, active_explorations, recent_decisions, open_risks, tech_debt, roadmap, blockers, recent_activity), depth (summary/detailed)
- 返回：项目全局快照，含统计信息

**`get_roadmap`**（获取路线图）
- 输入：root_goal?, include_completed, max_depth
- 返回：目标树，含进度、子项、阻碍、探索

**`get_node_context`**（获取节点上下文）
- 输入：node_id, depth (1-2 跳), include_events
- 返回：节点 + 边 + 邻居 + 事件历史

### 3.10 查询操作

| 查询 | 返回内容 |
|------|---------|
| `current_blockers` | 阻碍活跃 Goal/Task 的 Risk/TechDebt |
| `active_explorations` | "active" 状态的探索及其关联目标 |
| `recent_decisions` | 最近 N 个决策及其理由 |
| `open_risks` | 未解决的风险 |
| `critical_tech_debt` | 高/严重级别的技术债 |
| `stale_items` | 超过 N 天未更新的节点 |
| `recent_activity` | 最近 N 个事件 |
| `goal_progress` | 目标及其子项完成百分比 |
| `decision_trail(node_id)` | 追溯决策/探索链 |
| `knowledge_map(domain)` | 按领域过滤知识 |
| `full_text_search(query)` | 搜索所有文本字段 |

---

## 4. 事件系统（工程记忆）

### 事件记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | ULID | 按时间排序 |
| timestamp | timestamp | 发生时间 |
| event_type | string | 如 "exploration.started" |
| actor | "user" / "system" | 谁发起的 |
| operation | string | 语义操作名称 |
| node_id | NodeID? | 主要受影响的节点 |
| node_type | NodeType? | 主要节点类型 |
| payload | JSON | 完整操作详情 |
| diff | {field, old, new}[]? | 具体变更内容 |
| context | string? | 自由格式的原因说明 |

### 特性
- 只追加 — 事件不可删除或修改
- 每次变更恰好产生一个事件
- 当前节点状态单独物化存储以提升查询性能
- 事件日志支持：时间线查询、节点历史、决策链重建

### 事件类型
```
goal.defined, goal.decomposed, goal.status_changed
exploration.started, exploration.finding_recorded, exploration.concluded, exploration.abandoned
decision.recorded, decision.superseded
risk.identified, risk.updated
tech_debt.registered, tech_debt.status_changed
knowledge.recorded, knowledge.invalidated
task.created, task.status_changed
graph.edge_created, graph.edge_removed
artifact.created
```

---

## 5. 集成模型

### 主接口：MCP 服务器
- 传输方式：stdio（本地进程，无需网络）
- 所有变更操作 → MCP tools
- 所有读操作 → MCP resources（如 `cognition://project/state`、`cognition://nodes/{id}`）
- AI 工具通过 MCP tool 描述发现可用操作

### 辅助接口：REST API
- 本地 HTTP，用于调试/脚本/非 MCP 工具
- 与 MCP 暴露相同的操作集

### 使用模式
1. AI 工具启动会话 → 调用 `get_project_state` 加载上下文
2. 工作过程中 → 做出决策/发现时调用语义操作
3. 会话结束 → 项目图谱被新知识充实

---

## 6. 与传统工单系统的区别

| 维度 | 工单系统 | si-beaver |
|------|---------|-----------|
| 核心原语 | 工单（要做的事） | 认知节点（已知/已决策/已探索的事物） |
| 探索 | 无法建模 | 一等公民，含假设、发现、结果 |
| 决策 | 埋在评论里 | 一等公民，含理由、备选方案、代价 |
| 知识 | 断开连接的 wiki | 图谱关联到源探索/决策 |
| 关系 | 父子、阻塞 | 丰富的语义关系（产生、通知、取代） |
| 历史 | 状态变更日志 | 完整的事件溯源工程记忆 |
| 主要消费者 | 人类看看板 | AI 加载项目上下文 |
| "完成"的价值 | 工单关闭 | 知识结晶化，图谱被充实 |

---

## 7. MVP 成功标准

1. 能在日常开发工作流中本地运行
2. AI 工具可通过 MCP 连接并有意义地读写项目图谱
3. 使用 2 周后，`get_project_state` 能提供真正有用的上下文，提升 AI 输出质量
4. 探索 → 决策 → 知识 的流程能捕获原本会丢失的推理过程
5. 能通过图谱追溯回答"为什么做了决策 X？"
