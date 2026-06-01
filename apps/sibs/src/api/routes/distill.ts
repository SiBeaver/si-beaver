import { Hono } from "hono";
import { sibs } from '@si-beaver/server';
import { chatCompletion, type ChatMessage, type ApiRequirementNode } from '@si-beaver/server';

export const distillRoutes = new Hono();

distillRoutes.post("/refine", async (c) => {
  const body = await c.req.json();
  const { requirementId, message } = body;
  if (!requirementId) return c.json({ error: "requirementId is required" }, 400);
  if (!message) return c.json({ error: "message is required" }, 400);

  const ctx = await sibs.getNodeContext(requirementId);
  const node = ctx.node as ApiRequirementNode | null;
  if (!node) return c.json({ error: "requirement not found" }, 404);

  const state = await sibs.getProjectState();

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是 Distill Agent，负责帮助用户精炼需求。你的职责：
1. 分析需求是否有模糊之处
2. 建议补充或修改验收标准
3. 检测与现有需求的潜在冲突
4. 识别缺失的维度

当前项目有 ${state.requirements.length} 个需求。

当前需求：
标题: ${node.title}
描述: ${node.description || "无"}
验收标准: ${(node.acceptanceCriteria ?? []).join("; ") || "无"}
来源: ${node.source ?? "未知"}
状态: ${node.status}

现有已接受的需求（用于冲突检测）：
${state.requirements.filter((r) => r.id !== requirementId).map((r) => `- ${r.title}`).join("\n") || "无"}

请用中文回答，给出具体可操作的建议。`,
    },
    { role: "user", content: message },
  ];

  const response = await chatCompletion(messages);
  return c.json({ reply: response.content, usage: response.usage });
});

distillRoutes.post("/check-feasibility", async (c) => {
  const body = await c.req.json();
  const { requirementId } = body;
  if (!requirementId) return c.json({ error: "requirementId is required" }, 400);

  const ctx = await sibs.getNodeContext(requirementId);
  const node = ctx.node as ApiRequirementNode | null;
  if (!node) return c.json({ error: "requirement not found" }, 404);

  const ac = node.acceptanceCriteria ?? [];
  const issues: string[] = [];

  if (ac.length === 0) {
    issues.push("无验收标准，无法评估可行性");
  }

  for (const criterion of ac) {
    if (criterion.length < 5) issues.push(`验收标准过于简短: "${criterion}"`);
  }

  return c.json({
    requirementId,
    feasible: issues.length === 0,
    acceptanceCriteriaCount: ac.length,
    issues,
  });
});

distillRoutes.post("/check-conflicts", async (c) => {
  const body = await c.req.json();
  const { requirementId } = body;
  if (!requirementId) return c.json({ error: "requirementId is required" }, 400);

  const ctx = await sibs.getNodeContext(requirementId);
  const node = ctx.node as ApiRequirementNode | null;
  if (!node) return c.json({ error: "requirement not found" }, 404);

  const state = await sibs.getProjectState();
  const others = state.requirements.filter(
    (r) => r.id !== requirementId && !["deprecated", "satisfied"].includes(r.status)
  );

  if (others.length === 0) {
    return c.json({ requirementId, conflicts: [], message: "无其他活跃需求" });
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `分析以下需求是否与现有需求存在冲突或重叠。输出 JSON:
{ "conflicts": [{ "id": "...", "title": "...", "overlap": "high|medium|low", "reason": "..." }] }
只报告 medium 或 high 重叠的。`,
    },
    {
      role: "user",
      content: `目标需求:
标题: ${node.title}
描述: ${node.description || "无"}
验收标准: ${(node.acceptanceCriteria ?? []).join("; ") || "无"}

现有需求:
${others.map((r) => `- [${r.id.slice(0, 8)}] ${r.title}: ${r.description || "无描述"}`).join("\n")}`,
    },
  ];

  try {
    const result = await chatCompletion(messages, { temperature: 0.2 });
    const parsed = JSON.parse(result.content);
    return c.json({ requirementId, ...parsed });
  } catch {
    return c.json({ requirementId, conflicts: [], error: "LLM parse failed" });
  }
});
