import type { NodeType } from '../nodes/types.js';
import type { RelationType } from '../edges/types.js';

export interface LinkStrategy {
  candidateTypes: NodeType[];
  preferredRelations: RelationType[];
  maxCandidates: number;
}

export const LINK_STRATEGIES: Record<NodeType, LinkStrategy> = {
  requirement: {
    candidateTypes: ['knowledge', 'requirement', 'goal'],
    preferredRelations: ['relates_to', 'supersedes', 'blocks'],
    maxCandidates: 15,
  },
  goal: {
    candidateTypes: ['requirement', 'goal', 'knowledge'],
    preferredRelations: ['fulfills', 'decomposes_into', 'relates_to'],
    maxCandidates: 15,
  },
  task: {
    candidateTypes: ['goal', 'task', 'risk', 'tech_debt'],
    preferredRelations: ['decomposes_into', 'blocks', 'mitigates', 'addresses'],
    maxCandidates: 12,
  },
  knowledge: {
    candidateTypes: ['decision', 'goal', 'requirement', 'knowledge'],
    preferredRelations: ['informs', 'contradicts', 'relates_to'],
    maxCandidates: 15,
  },
  decision: {
    candidateTypes: ['exploration', 'knowledge', 'risk', 'tech_debt'],
    preferredRelations: ['produces', 'informs', 'creates', 'relates_to'],
    maxCandidates: 12,
  },
  exploration: {
    candidateTypes: ['goal', 'risk', 'knowledge'],
    preferredRelations: ['spawns', 'relates_to'],
    maxCandidates: 10,
  },
  risk: {
    candidateTypes: ['goal', 'task', 'decision'],
    preferredRelations: ['blocks', 'relates_to'],
    maxCandidates: 10,
  },
  tech_debt: {
    candidateTypes: ['task', 'decision', 'goal'],
    preferredRelations: ['blocks', 'addresses', 'relates_to'],
    maxCandidates: 10,
  },
  artifact: {
    candidateTypes: ['knowledge', 'decision', 'requirement'],
    preferredRelations: ['evidenced_by', 'relates_to'],
    maxCandidates: 8,
  },
};
