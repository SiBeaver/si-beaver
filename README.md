# si-beaver

AI 原生项目认知平台 — 结构化、有类型约束和因果关系的项目记忆层。

**核心差异化**：9 种节点 + 12 种有约束边 + 事件溯源 + 因果追溯。不是 ticket 系统，不是 AI 笔记。

## 技术栈

| 模块 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | AI 训练数据最多，类型安全 |
| 运行时 | Node.js (v24) | MCP SDK 官方支持 |
| 存储 | PostgreSQL (JSONB + FTS + pgvector) | 并发、备份、全文搜索、向量检索 |
| HTTP 框架 | Hono | 超轻量，多运行时 |
| 数据验证 | Zod | 运行时校验 + TS 类型推导 |
| MCP SDK | `@modelcontextprotocol/sdk` | 官方 SDK |
| 构建 | tsup | 零配置 ESM 打包 |

## 项目结构

```
si-beaver/
├── src/
│   ├── core/nodes/         # 9 种节点类型 + Zod schema
│   ├── core/edges/         # 12 种有约束边关系
│   ├── core/events/        # 事件溯源引擎
│   ├── operations/         # 语义操作（~30 个）
│   ├── projections/        # 投影引擎（semantic → MD）
│   │   └── engines/        # ADR / Roadmap 等投影模板
│   ├── storage/            # PostgreSQL 存储层
│   ├── mcp/                # MCP 服务器
│   ├── api/                # REST API (Hono)
│   └── projects/           # 多项目管理
├── package.json
└── tsconfig.json
```

## 概念边界：代码仓库 vs sibeaver

| 归属 | 判断标准 |
|------|----------|
| **代码仓库** | 描述"怎么写、怎么构建、怎么跑" |
| **sibeaver** | 描述"为什么做、做什么、学到了什么、有什么风险" |

实现细节跟代码走，认知过程放 sibeaver。更详细的判断规则见[父工程 AGENTS.md](../AGENTS.md)。

删掉这个信息，代码还能正常构建和运行吗？→ 能 → sibeaver。换一个开发者，他需要这信息才能改代码吗？→ 是 → 代码仓库。

## API

| 端点 | 说明 |
|------|------|
| `POST /api/v1/projects` | 创建项目 |
| `GET /api/v1/projects/:slug/state` | 项目认知状态快照 |
| `GET /api/v1/projects/:slug/roadmap` | 目标路线图（树状） |
| `GET /api/v1/projects/:slug/blockers` | 阻塞项 |
| `POST /api/v1/projects/:slug/projections/:type/generate` | 生成投影文档 |
| `POST /api/v1/projects/:slug/operations/:name` | 统一写操作 |
| `GET /api/v1/projects/:slug/projections` | 列出可用投影 |

## MCP

端点: `http://<host>:7420/mcp/{project-slug}`。连接后绑定项目，~35 个 tools 覆盖目标/任务/探索/决策/风险/知识/查询/投影全生命周期。

## 投影

- **ADR** (`type: "adr"`) — Decision → 架构决策文档
- **Roadmap** (`type: "roadmap"`) — Goal 树 → 需求全景（分组/进度/阻塞/阅读指南）

投影为单向生成（semantic → MD），输出由调用方写盘。宪法文档标记 `constitutional: true` 后永不自动覆盖。

## 开发

```bash
npm run dev     # 开发模式（tsx watch）
npm run build   # 构建
npm test        # 测试
```

部署见父工程 `deploy` skill 和 `AGENTS.md`。
