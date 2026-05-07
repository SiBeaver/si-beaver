import type { CognitiveNode } from './types';

export type Tab = 'overview' | 'roadmap' | 'risks';

export const NODE_TYPE_COLORS: Record<CognitiveNode['type'], string> = {
  goal: 'blue',
  task: 'green',
  exploration: 'purple',
  decision: 'gold',
  risk: 'red',
  tech_debt: 'orange',
  artifact: 'cyan',
  knowledge: 'geekblue',
};

export const NODE_TYPE_LABELS: Record<CognitiveNode['type'], string> = {
  goal: '目标',
  task: '任务',
  exploration: '探索',
  decision: '决策',
  risk: '风险',
  tech_debt: '技术债',
  artifact: '产物',
  knowledge: '知识',
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  achieved: 'blue',
  abandoned: 'default',
  deferred: 'gold',
  proposed: 'default',
  ready: 'cyan',
  in_progress: 'processing',
  done: 'success',
  cancelled: 'default',
  concluded: 'blue',
  accepted: 'green',
  superseded: 'default',
  deprecated: 'default',
  identified: 'warning',
  analyzing: 'processing',
  mitigated: 'success',
  occurred: 'error',
  resolved: 'success',
  paying_down: 'processing',
  tentative: 'warning',
  established: 'success',
  outdated: 'default',
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'default',
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'default',
};
