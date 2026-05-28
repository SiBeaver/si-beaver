import type { ProjectMeta } from '../lib/types';
import { getToken, clearToken } from '../lib/auth';

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse(res: Response) {
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json', ...authHeaders() } : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  await handleResponse(res);
  return res.json() as Promise<T>;
}

async function get<T>(url: string): Promise<T> {
  return request<T>('GET', url);
}

async function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>('POST', url, body);
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  return request<T>('PATCH', url, body);
}

// --- Project management ---

export function fetchProjects() {
  return get<ProjectMeta[]>('/api/v1/projects');
}

export function fetchProject(slug: string) {
  return get<ProjectMeta>(`/api/v1/projects/${slug}`);
}

export function createProject(input: { slug: string; name: string; description?: string }) {
  return post<ProjectMeta>('/api/v1/projects', input);
}

export function updateProject(slug: string, body: { name?: string; description?: string }) {
  return patch<ProjectMeta>(`/api/v1/projects/${slug}`, body);
}

// --- Project-scoped data ---

import type {
  RoadmapResponse,
  BlockersResponse,
  ProjectState,
  StaleResponse,
  GoalProgressResponse,
  KnowledgeMapResponse,
  ActivityResponse,
  NodeContext,
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

export function fetchKnowledgeMap(slug: string, domain?: string) {
  const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  return get<KnowledgeMapResponse>(`/api/v1/projects/${slug}/knowledge${params}`);
}

export function fetchActivity(slug: string, limit = 50) {
  return get<ActivityResponse>(`/api/v1/projects/${slug}/activity?limit=${limit}`);
}

export function fetchFullTextSearch(slug: string, query: string) {
  return get<{ results: import('../lib/types').CognitiveNode[] }>(`/api/v1/projects/${slug}/fts?q=${encodeURIComponent(query)}`);
}

export function fetchNodeContext(slug: string, nodeId: string) {
  return get<NodeContext>(`/api/v1/projects/${slug}/nodes/${nodeId}`);
}
