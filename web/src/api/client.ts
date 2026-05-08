import type { ProjectMeta } from '../lib/types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// --- Project management ---

export function fetchProjects() {
  return get<ProjectMeta[]>('/api/v1/projects');
}

export function createProject(input: { slug: string; name: string; description?: string }) {
  return post<ProjectMeta>('/api/v1/projects', input);
}

// --- Project-scoped data ---

import type {
  RoadmapResponse,
  BlockersResponse,
  ProjectState,
  StaleResponse,
  GoalProgressResponse,
} from '../lib/types';

export function fetchRoadmap(slug: string, includeCompleted = true, maxDepth = 5) {
  const params = new URLSearchParams({
    'include-completed': String(includeCompleted),
    'max-depth': String(maxDepth),
  });
  return get<RoadmapResponse>(`/api/v1/projects/${slug}/roadmap?${params}`);
}

export function fetchBlockers(slug: string) {
  return get<BlockersResponse>(`/api/v1/projects/${slug}/blockers`);
}

export function fetchProjectState(slug: string) {
  return get<ProjectState>(`/api/v1/projects/${slug}/state`);
}

export function fetchStale(slug: string, days = 7) {
  return get<StaleResponse>(`/api/v1/projects/${slug}/stale?days=${days}`);
}

export function fetchGoalProgress(slug: string) {
  return get<GoalProgressResponse>(`/api/v1/projects/${slug}/goals/progress`);
}
