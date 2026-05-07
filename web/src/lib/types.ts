// Mirror of backend node types — kept simple with optional type-specific fields

export interface CognitiveNode {
  id: string;
  type: 'goal' | 'task' | 'exploration' | 'decision' | 'risk' | 'tech_debt' | 'artifact' | 'knowledge';
  title: string;
  description: string;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  // goal
  horizon?: 'short' | 'medium' | 'long';
  success_criteria?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  // task
  effort?: 'trivial' | 'small' | 'medium' | 'large' | 'unknown';
  acceptance_criteria?: string[];
  // exploration
  hypothesis?: string;
  approach?: string;
  findings?: string[];
  conclusion?: string | null;
  outcome?: 'validated' | 'invalidated' | 'partial' | 'inconclusive' | null;
  // decision
  context?: string;
  rationale?: string;
  alternatives_considered?: { option: string; pros: string[]; cons: string[]; reason_rejected: string }[];
  consequences?: string[];
  superseded_by?: string | null;
  // risk
  likelihood?: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high' | 'critical';
  mitigation_strategy?: string | null;
  trigger_conditions?: string[];
  // tech_debt
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affected_area?: string;
  cost_of_delay?: string;
  resolution_approach?: string | null;
  // knowledge
  domain?: string;
  confidence?: 'low' | 'medium' | 'high';
  source?: string;
  // artifact
  artifact_type?: string;
  uri?: string | null;
  content_summary?: string | null;
}

export interface RoadmapItem {
  node: CognitiveNode;
  children: RoadmapItem[];
  progress: { total: number; done: number };
}

export interface RoadmapResponse {
  roadmap: RoadmapItem[];
}

export interface GoalProgressItem {
  goal: CognitiveNode;
  total: number;
  done: number;
  percentage: number;
}

export interface GoalProgressResponse {
  goals: GoalProgressItem[];
}

export interface BlockerItem {
  blocker: CognitiveNode;
  blocks: CognitiveNode[];
}

export interface BlockersResponse {
  blockers: BlockerItem[];
}

export interface ProjectState {
  active_goals: CognitiveNode[];
  active_explorations: CognitiveNode[];
  recent_decisions: CognitiveNode[];
  open_risks: CognitiveNode[];
  critical_tech_debt: CognitiveNode[];
  pending_tasks: CognitiveNode[];
  statistics: {
    total_goals: number;
    achieved_goals: number;
    active_explorations: number;
    open_risks: number;
    pending_tasks: number;
    tech_debt_items: number;
  };
}

export interface StaleResponse {
  stale_items: CognitiveNode[];
  cutoff_date: string;
  days: number;
}
