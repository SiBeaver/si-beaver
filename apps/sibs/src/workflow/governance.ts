import { sibs, type ApiEdge, type ApiRequirementNode } from '@si-beaver/server';

export interface GovernanceResult {
  passed: boolean;
  issues: string[];
}

export async function runGovernance(requirementId: string): Promise<GovernanceResult> {
  const issues: string[] = [];

  const ctx = await sibs.getNodeContext(requirementId);
  const node = ctx.node;

  if (!node) {
    return { passed: false, issues: ["Requirement node not found"] };
  }

  if (!(node as ApiRequirementNode).acceptanceCriteria || (node as ApiRequirementNode).acceptanceCriteria.length === 0) {
    issues.push("验收标准为空——无法确定退出条件");
  }

  const edges = ctx.edges ?? [];
  const blockingEdges = edges.filter(
    (e) => e.relation === "blocks" && e.sourceId === requirementId
  );
  if (blockingEdges.length > 0) {
    issues.push(`此需求阻塞 ${blockingEdges.length} 个节点，建议先确认依赖`);
  }

  const state = await sibs.getProjectState();
  const existingRequirements = (state.requirements ?? []).filter(
    (r) => r.id !== requirementId && r.status === "accepted"
  );

  for (const existing of existingRequirements) {
    if (isSimilar(node.title, existing.title)) {
      issues.push(`与已有需求「${existing.title}」(${existing.id.slice(0, 8)}) 可能重复`);
    }
  }

  return { passed: issues.length === 0, issues };
}

function isSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}
