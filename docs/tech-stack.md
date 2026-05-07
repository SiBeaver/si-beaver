# si-beaver 技术选型

## 决策日期：2026-05-07

## 选型原则

- 快速迭代
- AI 友好（AI 工具对代码理解和生成质量最高）
- 社区成熟，轮子多
- 云友好

## 技术栈

| 模块 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | AI 训练数据最多，类型安全，开发速度快 |
| 运行时 | Node.js (v24) | 已有环境，MCP SDK 官方支持 |
| MCP SDK | `@modelcontextprotocol/sdk` | 官方 SDK，TypeScript 一等支持 |
| 存储 | SQLite (`better-sqlite3`) | 本地优先零配置，单文件，后续可迁移 PostgreSQL |
| HTTP 框架 | Hono | 超轻量，现代 API，支持多运行时 |
| 数据验证 | Zod | 运行时校验 + 自动推导 TypeScript 类型 |
| ID 生成 | ulidx | 时间排序的唯一 ID |
| 测试 | Vitest | 快速，兼容 Jest API |
| 构建/开发 | tsx（开发直接运行）+ tsup（构建） | 零配置 |

## 被排除的方案

| 语言 | 排除理由 |
|------|---------|
| Java/Kotlin | 迭代慢，样板代码多，MCP SDK 不成熟 |
| Go | JSON 处理啰嗦，MCP 生态弱 |
| Rust | 迭代太慢，MVP 不需要极致性能 |
| Python | 类型系统弱，大项目维护困难 |

## 项目结构

```
si-beaver/
├── src/
│   ├── core/              # 领域核心
│   │   ├── nodes/         # 节点类型定义 + Zod schema
│   │   ├── edges/         # 边类型定义
│   │   ├── events/        # 事件系统
│   │   └── lifecycle/     # 状态机转换校验
│   ├── operations/        # 语义操作实现
│   ├── storage/           # SQLite 存储层
│   ├── mcp/               # MCP 服务器适配
│   ├── api/               # REST API 适配
│   └── index.ts           # 入口
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 数据目录

```
~/.si-beaver/
├── config.json            # 全局配置
└── projects/
    └── {slug}/
        ├── cognition.db   # SQLite 数据库
        └── project.json   # 项目元信息
```
