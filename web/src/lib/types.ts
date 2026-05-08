export interface ProjectMeta {
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  metadata: Record<string, unknown>;
}

// Mirror of backend node types — camelCase field names matching REST API responses

export interface CognitiveNode {
  id: string;
  type: 'goal' | 'task' | 'exploration' | 'decision' | 'risk' | 'tech_debt' | 'artifact' | 'knowledge';
  title: string;
  description: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  // goal
  horizon?: 'short' | 'medium' | 'long';
  successCriteria?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  // task
  effort?: 'trivial' | 'small' | 'medium' | 'large' | 'unknown';
  acceptanceCriteria?: string[];
  // exploration
  hypothesis?: string;
  approach?: string;
  findings?: string[];
  conclusion?: string | null;
  outcome?: 'validated' | 'invalidated' | 'partial' | 'inconclusive' | null;
  // decision
  context?: string;
  rationale?: string;
  alternativesConsidered?: { option: string; pros: string[]; cons: string[]; reasonRejected: string }[];
  consequences?: string[];
  supersededBy?: string | null;
  // risk
  likelihood?: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategy?: string | null;
  triggerConditions?: string[];
  // tech_debt
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedArea?: string;
  costOfDelay?: string;
  resolutionApproach?: string | null;
  // knowledge
  domain?: string;
  confidence?: 'low' | 'medium' | 'high';
  source?: string;
  // artifact
  artifactType?: string;
  uri?: string | null;
  contentSummary?: string | null;
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
  activeGoals: CognitiveNode[];
  activeExplorations: CognitiveNode[];
  recentDecisions: CognitiveNode[];
  openRisks: CognitiveNode[];
  criticalTechDebt: CognitiveNode[];
  pendingTasks: CognitiveNode[];
  statistics: {
    totalGoals: number;
    achievedGoals: number;
    activeExplorations: number;
    openRisks: number;
    pendingTasks: number;
    techDebtItems: number;
  };
}

export interface StaleResponse {
  staleItems: CognitiveNode[];
  cutoffDate: string;
  days: number;
}
