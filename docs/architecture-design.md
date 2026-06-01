# sibeavercloud — 架构设计

> 基于 V3 设计文档 + 现有骨架代码

---

## 1. 现状

已实现：
- Hono HTTP server (port 7430) + Bearer auth
- Tool 系统 (jadx, adb, frida, aapt) + 注册表
- Workflow DAG 引擎（拓扑排序、并行执行、重试、超时、条件执行）
- Expression 引擎 (${{ params.x, tasks.y.outputs.z }})
- SIBS Reporter（执行完将结果写回 sibeaver 认知图）
- secflow/v1 JSON Schema + 示例模板

未实现：
- Workflow 运行持久化（当前 API 返回 stub）
- YAML 解析 + 验证（依赖已声明未接入）
- 需求驱动的 Workflow（V3 设计的核心）
- Distill Agent
- 自愈回路

---

## 2. 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│  sibeavercloud (port 7430)                                   │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Distill Module   │  │  Workflow Module                  │ │
│  │  ───────────────  │  │  ──────────────────────────────  │ │
│  │  /api/v1/distill  │  │  /api/v1/workflows               │ │
│  │                   │  │                                   │ │
│  │  • refine session │  │  • requirement workflow trigger   │ │
│  │  • gap detection  │  │  • secflow/v1 execution          │ │
│  │  • feasibility    │  │  • governance checks             │ │
│  │  • conflict check │  │  • auto-decompose                │ │
│  └──────────────────┘  │  • self-heal detector             │ │
│                         └──────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Core Services                                            ││
│  │  • SIBS Client (read/write sibeaver via REST)             ││
│  │  • Event Poller (poll sibeaver /events for triggers)      ││
│  │  • Tool Registry (jadx, adb, frida, aapt + 扩展)          ││
│  │  • Run Store (workflow 运行状态持久化)                       ││
│  │  • LLM Client (调用 LLM 做分解/分析)                       ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌────────────────┐           ┌─────────────────────┐
│  sibeaver      │           │  LLM Provider       │
│  (port 7420)   │           │  (OpenAI/local)     │
│  REST + MCP    │           │                     │
└────────────────┘           └─────────────────────┘
```

---

## 3. 模块拆分

### 3.1 Core Services（基础设施）

#### SIBS Client
封装对 sibeaver REST API 的调用。

```
src/core/sibs-client.ts
```

- 认证：Bearer token from config
- 读操作：getProjectState, getNodeContext, getEvents
- 写操作：defineGoal, createTask, updateRequirementStatus, linkNodes, recordKnowledge
- 因果一致性：所有写操作附带 reason

#### Event Poller
sibeaver 无 push 能力，cloud 需要轮询 `/events` 检测触发条件。

```
src/core/event-poller.ts
```

- 定时轮询 `GET /projects/:slug/events?since=<lastSeen>`
- 匹配事件类型触发 handler：
  - `requirement.status_changed` (new_status=accepted) → 触发 Workflow
  - `knowledge.recorded` → 触发自愈检测
- 支持多项目

#### Run Store
Workflow 执行状态持久化。

```
src/core/run-store.ts
```

- 轻量 JSON 文件存储（初期不上 DB）
- 每个 run: id, status, requirement_id, created_at, task_states, result
- 状态：queued → running → succeeded/failed/cancelled

#### LLM Client
统一的 LLM 调用接口。

```
src/core/llm-client.ts
```

- Provider 抽象（OpenAI compatible API）
- 支持 system prompt + user message + tool calling
- 用于 Distill 精炼 + Workflow 分解

---

### 3.2 Workflow Module（执行层）

保留现有 secflow/v1 DAG 引擎，新增需求驱动层。

#### Requirement Workflow Trigger

```
src/workflow/triggers/requirement-trigger.ts
```

Event Poller 检测到 `requirement.status_changed → accepted` 时：
1. 读取 requirement 节点（验收标准、上下文）
2. 运行 Governance 检查
3. 通过 → 调用 `updateRequirementStatus(in_execution)`
4. 进入 Decompose 阶段

#### Governance

```
src/workflow/governance.ts
```

- 重复检测：比对 title/description 与已有 accepted 需求（文本相似度，初期用简单编辑距离）
- 依赖检查：requirement 是否有 blocks 边指向未完成的节点
- 可行性确认：验收标准是否为空

#### Auto-Decompose

```
src/workflow/decompose.ts
```

- 输入：requirement (title + description + acceptance_criteria)
- LLM 调用：分解为 Goal → Task 树
- 输出：通过 SIBS Client 写入 sibeaver（defineGoal, createTask, linkNodes fulfills）

#### Task Executor

```
src/workflow/executor.ts
```

两种模式：
1. **secflow 模式**：使用现有 DAG 引擎跑 YAML 模板（sibat 场景）
2. **agent 模式**：调用外部 agent 执行 task（未来对接 Qoder CLI）

初期只实现 secflow 模式 + 手动标记完成。

#### Self-Heal Detector

```
src/workflow/self-heal.ts
```

Event Poller 检测到 `knowledge.recorded` 时：
1. 遍历 knowledge → 找到关联 requirement（通过 fulfills 链）
2. 比对 knowledge.description 与 requirement.acceptance_criteria
3. 如发现语义冲突（初期用关键词匹配，后续用 embedding）：
   - 调用 linkNodes(knowledge, requirement, contradicts)
   - 调用 updateRequirementStatus(revision_needed, reason)

---

### 3.3 Distill Module（精炼层）

Event-driven agent session，不常驻。

#### Refine Session

```
src/distill/session.ts
```

- API: `POST /api/v1/distill/refine`
- 输入：requirement_id + user_message
- 流程：
  1. 加载 requirement 上下文（SIBS Client 读图）
  2. 加载项目状态摘要
  3. LLM 调用（system prompt 描述角色，tools 包含 gap_detect/conflict_check）
  4. 返回建议（修改验收标准、发现缺口、冲突提示）

#### Gap Detection

```
src/distill/gap-detect.ts
```

- 分析验收标准覆盖度
- 基于项目已有 knowledge 推算缺失维度
- 初期用 LLM 直接分析，不做独立向量检索

#### Conflict Check

```
src/distill/conflict-check.ts
```

- 比对新需求与已有 accepted 需求的语义重叠
- 初期：LLM 对比两个需求的 title+description+acceptance_criteria
- 返回重叠度评估 + 建议

---

## 4. API 设计

### Workflow API（扩展现有）

```
POST /api/v1/workflows/run              # 现有：secflow 模板执行
POST /api/v1/workflows/from-requirement # 新增：需求驱动
GET  /api/v1/workflows/:id              # 现有：查询状态
GET  /api/v1/workflows                  # 新增：列出运行中的 workflow
POST /api/v1/workflows/:id/cancel       # 新增：取消
```

### Distill API（新增）

```
POST /api/v1/distill/refine             # 精炼会话（单次请求-响应）
POST /api/v1/distill/check-feasibility  # 可行性检查
POST /api/v1/distill/check-conflicts    # 冲突检测
```

### 管理 API

```
GET  /api/v1/config                     # 查看当前配置
GET  /api/v1/tools                      # 列出可用工具
```

---

## 5. 配置扩展

```typescript
export const config = {
  port: env('PORT', '7430'),
  authToken: env('AUTH_TOKEN', ''),
  sibsUrl: env('SIBS_URL', 'http://localhost:7420'),
  sibsToken: env('SIBS_TOKEN', ''),           // 新增：访问 sibeaver 的 token
  sibsProject: env('SIBS_PROJECT', ''),       // 新增：默认项目 slug
  llmBaseUrl: env('LLM_BASE_URL', ''),        // 新增：LLM API endpoint
  llmApiKey: env('LLM_API_KEY', ''),          // 新增：LLM API key
  llmModel: env('LLM_MODEL', 'gpt-4o'),      // 新增：默认模型
  pollInterval: env('POLL_INTERVAL', '10000'), // 新增：事件轮询间隔 ms
};
```

---

## 6. 实施路径

### Phase 1: 基础设施 + Workflow 完善

1. **SIBS Client** — 封装 REST 调用
2. **Run Store** — JSON 文件持久化
3. **完善现有 workflow API** — 接入 YAML 解析 + 验证 + Run Store
4. **Event Poller** — 轮询框架

验证：手动触发 secflow 模板执行 → 结果写回 sibeaver → API 查询状态

### Phase 2: 需求驱动 Workflow

5. **Requirement Trigger** — 监听 accepted 事件
6. **Governance** — 基础治理检查
7. **LLM Client** — 统一 LLM 调用
8. **Auto-Decompose** — LLM 分解需求 → Goal/Task
9. **updateRequirementStatus** — 自动流转 in_execution/satisfied

验证：define_requirement → accepted → 自动分解出 Goal/Task → 手动完成 → satisfied

### Phase 3: Distill

10. **Refine Session** — 精炼 API
11. **Gap Detection** — 缺口探测
12. **Conflict Check** — 冲突检测

验证：调用 /distill/refine → 返回验收标准建议

### Phase 4: 自愈

13. **Self-Heal Detector** — Knowledge 冲突检测
14. **contradicts 边自动创建** + revision_needed 状态触发

验证：记录与验收标准矛盾的 Knowledge → 自动标记 revision_needed

---

## 7. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 事件检测 | 轮询而非 webhook | sibeaver 无 push 能力，轮询够用（10s 间隔） |
| 状态存储 | JSON 文件 | 初期简单，单实例部署无并发 |
| LLM 调用 | OpenAI compatible API | 通用，可切换 provider |
| 语义比对 | LLM 直接判断 | 初期不上 embedding 向量库，复杂度低 |
| Agent 执行 | 暂不实现 | 先靠手动完成 Task，后续对接 Qoder CLI |
| 前端 | 无 | Cloud 无独立前端，通过 si-beaver-web 展示 |

---

## 8. 文件结构预览

```
src/
├── index.ts                         # 入口：启动 server + event poller
├── config/
│   └── index.ts                     # 配置（扩展）
├── api/
│   ├── server.ts                    # Hono app（扩展路由）
│   ├── middleware/
│   │   └── auth.ts                  # Bearer auth（不变）
│   └── routes/
│       ├── health.ts                # 健康检查（不变）
│       ├── workflows.ts             # Workflow API（扩展）
│       └── distill.ts               # Distill API（新增）
├── core/
│   ├── sibs-client.ts               # sibeaver REST 客户端
│   ├── event-poller.ts              # 事件轮询
│   ├── run-store.ts                 # Workflow 运行持久化
│   └── llm-client.ts               # LLM 调用
├── distill/
│   ├── session.ts                   # 精炼会话
│   ├── gap-detect.ts                # 缺口探测
│   └── conflict-check.ts           # 冲突检测
├── workflow/
│   ├── triggers/
│   │   └── requirement-trigger.ts   # 需求触发
│   ├── governance.ts                # 治理检查
│   ├── decompose.ts                 # LLM 自动分解
│   ├── executor.ts                  # 执行调度
│   └── self-heal.ts                 # 自愈检测
├── engine/                          # 现有 DAG 引擎（不变）
│   ├── expression.ts
│   ├── workflow-engine.ts
│   └── sibs-reporter.ts
├── tools/                           # 现有工具系统（不变）
│   ├── registry.ts
│   ├── cli-utils.ts
│   ├── init.ts
│   ├── jadx.ts
│   ├── adb.ts
│   ├── frida.ts
│   └── aapt.ts
├── types/
│   ├── tool.ts                      # 不变
│   └── workflow.ts                  # 扩展
└── schema/
    └── secflow-v1.json              # 不变
```
