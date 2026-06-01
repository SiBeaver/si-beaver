import { sibs, type ApiEvent } from '@si-beaver/server';

export async function handleTaskCompleted(event: ApiEvent): Promise<void> {
  const diff = event.diff ?? [];
  const statusChange = diff.find((d) => d.field === "status");
  if (!statusChange || statusChange.newValue !== "done") return;

  const taskId = event.nodeId;
  if (!taskId) return;

  const taskCtx = await sibs.getNodeContext(taskId);
  const edges = taskCtx.edges ?? [];

  const goalEdge = edges.find((e) => e.relation === "decomposes_into" && e.targetId === taskId);
  if (!goalEdge) return;

  const goalId = goalEdge.sourceId;
  const goalCtx = await sibs.getNodeContext(goalId);
  const goalEdges = goalCtx.edges ?? [];

  const fulfillsEdge = goalEdges.find((e) => e.relation === "fulfills" && e.sourceId === goalId);
  if (!fulfillsEdge) return;

  const requirementId = fulfillsEdge.targetId;
  const reqCtx = await sibs.getNodeContext(requirementId);
  const req = reqCtx.node;
  if (!req || req.status !== "in_execution") return;

  const allTaskEdges = goalEdges.filter((e) => e.relation === "decomposes_into" && e.sourceId === goalId);
  let allDone = true;

  for (const edge of allTaskEdges) {
    const taskNode = await sibs.getNodeContext(edge.targetId);
    if (taskNode.node && !["done", "cancelled"].includes(taskNode.node.status)) {
      allDone = false;
      break;
    }
  }

  if (allDone) {
    console.log(`[SatisfactionCheck] all tasks done for requirement ${requirementId.slice(0, 8)}, marking satisfied`);
    await sibs.updateRequirementStatus({
      requirementId,
      newStatus: "satisfied",
      reason: "所有关联 Task 已完成",
    });
  }
}
