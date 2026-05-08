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

export const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  achieved: '已达成',
  abandoned: '已放弃',
  deferred: '已延期',
  proposed: '待定',
  ready: '就绪',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
  concluded: '已结论',
  accepted: '已接受',
  superseded: '已取代',
  deprecated: '已弃用',
  identified: '已识别',
  analyzing: '分析中',
  mitigated: '已缓解',
  occurred: '已发生',
  resolved: '已解决',
  paying_down: '偿还中',
  tentative: '暂定',
  established: '已确立',
  outdated: '已过时',
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

export const HORIZON_LABELS: Record<string, string> = {
  short: '短期',
  medium: '中期',
  long: '长期',
};

export const LIKELIHOOD_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const IMPACT_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};
