import type { OperationContext } from '../operations/context.js';
import { autoLink } from './linker.js';
import { config } from '../config/index.js';

export const AUTO_LINK_OPERATIONS = new Set([
  'define_goal',
  'define_requirement',
  'record_knowledge',
  'record_decision',
  'identify_risk',
  'register_tech_debt',
  'begin_exploration',
]);

export function triggerAutoLink(ctx: OperationContext, result: any): void {
  if (!config.llmApiKey) return;

  const nodeId = extractNodeId(result);
  if (!nodeId) return;

  setImmediate(() => {
    autoLink(ctx, nodeId).then((res) => {
      if (res.created_edges.length > 0) {
        console.log(`[auto-link] Created ${res.created_edges.length} edges for node ${nodeId}`);
      }
    }).catch((err) => {
      console.error(`[auto-link] Failed for node ${nodeId}:`, err);
    });
  });
}

function extractNodeId(result: any): string | null {
  if (!result || typeof result !== 'object') return null;
  if (result.goal?.id) return result.goal.id;
  if (result.requirement?.id) return result.requirement.id;
  if (result.knowledge?.id) return result.knowledge.id;
  if (result.decision?.id) return result.decision.id;
  if (result.risk?.id) return result.risk.id;
  if (result.tech_debt?.id) return result.tech_debt.id;
  if (result.exploration?.id) return result.exploration.id;
  return null;
}
