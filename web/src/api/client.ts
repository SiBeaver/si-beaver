import type {
  RoadmapResponse,
  BlockersResponse,
  ProjectState,
  StaleResponse,
  GoalProgressResponse,
} from '../lib/types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchRoadmap(includeCompleted = true, maxDepth = 5) {
  const params = new URLSearchParams({
    include_completed: String(includeCompleted),
    max_depth: String(maxDepth),
  });
  return get<RoadmapResponse>(`/api/v1/roadmap?${params}`);
}

export function fetchBlockers() {
  return get<BlockersResponse>('/api/v1/blockers');
}

export function fetchProjectState() {
  return get<ProjectState>('/api/v1/project/state');
}

export function fetchStale(days = 7) {
  return get<StaleResponse>(`/api/v1/stale?days=${days}`);
}

export function fetchGoalProgress() {
  return get<GoalProgressResponse>('/api/v1/goals/progress');
}
