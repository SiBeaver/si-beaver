export { OperationContext } from './context.js';
export { defineGoal, decomposeGoal, updateGoalStatus } from './goals.js';
export { beginExploration, recordExplorationFinding, concludeExploration, abandonExploration } from './exploration.js';
export { recordDecision } from './decisions.js';
export { createTask, updateTaskStatus } from './tasks.js';
export { identifyRisk, updateRisk, registerTechDebt } from './risks.js';
export { recordKnowledge } from './knowledge.js';
export { linkNodes, getProjectState, getNodeContext } from './graph.js';
export {
  getRoadmap, goalProgress, decisionTrail, knowledgeMap,
  staleItems, currentBlockers, recentActivity, fullTextSearch,
} from './queries.js';
