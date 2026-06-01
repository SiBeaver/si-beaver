import { sibs, chatCompletion, type ChatMessage, type ApiEvent, type ApiRequirementNode, type ApiKnowledgeNode } from '@si-beaver/server';

export async function handleKnowledgeRecorded(event: ApiEvent): Promise<void> {
  const knowledgeId = event.nodeId;
  if (!knowledgeId) return;

  console.log(`[SelfHeal] knowledge ${knowledgeId.slice(0, 8)} recorded, checking conflicts`);

  const ctx = await sibs.getNodeContext(knowledgeId);
  const knowledge = ctx.node;
  if (!knowledge) return;

  const state = await sibs.getProjectState();
  const activeRequirements = (state.requirements ?? []).filter(
    (r) => r.status === "in_execution" || r.status === "accepted"
  );

  if (activeRequirements.length === 0) return;

  for (const req of activeRequirements) {
    const ac = req.acceptanceCriteria ?? [];
    if (ac.length === 0) continue;

    const conflict = await detectConflict(knowledge as ApiKnowledgeNode, req, ac);
    if (conflict) {
      console.log(`[SelfHeal] conflict detected: knowledge "${knowledge.title}" contradicts requirement "${req.title}"`);

      await sibs.linkNodes({
        sourceId: knowledgeId,
        targetId: req.id,
        relation: "contradicts",
        annotation: conflict.reason,
      });

      if (req.status === "in_execution") {
        await sibs.updateRequirementStatus({
          requirementId: req.id,
          newStatus: "revision_needed",
          reason: `Knowledge「${knowledge.title}」与验收标准冲突: ${conflict.reason}`,
          revisionSuggestion: conflict.suggestion,
        });
      }
    }
  }
}

interface ConflictResult {
  reason: string;
  suggestion: string;
}

async function detectConflict(
  knowledge: ApiKnowledgeNode,
  requirement: ApiRequirementNode,
  acceptanceCriteria: string[]
): Promise<ConflictResult | null> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是一个需求验收标准冲突检测器。判断一条新发现的知识是否与需求的验收标准存在冲突。

如果存在冲突，输出 JSON: { "conflict": true, "reason": "冲突原因", "suggestion": "修订建议" }
如果不存在冲突，输出 JSON: { "conflict": false }

冲突的定义：知识表明某个验收标准不可达、需要更长时间、或存在技术限制使其无法满足。`,
    },
    {
      role: "user",
      content: `知识:
标题: ${knowledge.title}
内容: ${knowledge.description || "无"}
领域: ${knowledge.domain || "未知"}

需求: ${requirement.title}
验收标准:
${acceptanceCriteria.map((ac: string, i: number) => `${i + 1}. ${ac}`).join("\n")}`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.1 });
    const parsed = JSON.parse(res.content);
    if (parsed.conflict) {
      return { reason: parsed.reason, suggestion: parsed.suggestion };
    }
    return null;
  } catch {
    return null;
  }
}
