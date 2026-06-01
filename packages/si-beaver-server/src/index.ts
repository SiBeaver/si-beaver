// si-beaver server version
export const VERSION = '0.2.0';

// core types & lifecycle
export * from './nodes/types.js';
export * from './edges/types.js';
export * from './events/types.js';
export * from './events/interfaces.js';
export * from './events/emitter.js';
export * from './lifecycle/machines.js';
export * from './context.js';

// server internals
export * from './storage/index.js';
export * from './operations/index.js';
export * from './projections/index.js';
export * from './embedding/index.js';
export { ProjectManager } from './projects/manager.js';
export type { ProjectMeta, CreateProjectInput, UpdateProjectInput } from './projects/types.js';
export { createSiBeaverApp, operationHandlers, type SiBeaverApp } from './api/server.js';
export { handleMcpRequest } from './mcp/http-server.js';
export { startEmbedSync, getEmbedSyncStats } from './jobs/embed-sync.js';

// workflow engine
export { config } from './config/index.js';
export * from './types/tool.js';
export * from './types/workflow.js';
export { resolveDeep, evaluateExpr } from './engine/expression.js';
export type { EvalContext } from './engine/expression.js';
export { WorkflowEngine } from './engine/workflow-engine.js';
export { registerTool, getTool, listTools } from './tools/registry.js';
export { initTools } from './tools/init.js';
export { run, hasBinary } from './tools/cli-utils.js';

// sibs client & LLM
export { sibs, setDirectSibs, type DirectSibsContext } from './sibs-client.js';
export { chatCompletion, jsonCompletion } from './llm-client.js';
export type { ChatMessage } from './llm-client.js';
export { startPoller, onEvent, setDirectEventSource, type DirectEventSource } from './event-poller.js';
export type { EventHandler } from './event-poller.js';
export { saveRun, getRun, listRuns, updateRun } from './run-store.js';
export type { WorkflowRun } from './run-store.js';
export type {
  ApiEvent,
  ApiNode,
  ApiNodeContext,
  ApiProjectState,
  ApiCognitiveNode,
  ApiGoalNode,
  ApiTaskNode,
  ApiRequirementNode,
  ApiKnowledgeNode,
  ApiEdge,
  ApiFieldDiff,
} from './api-types.js';
export { SibsReporter } from './sibs-reporter.js';
