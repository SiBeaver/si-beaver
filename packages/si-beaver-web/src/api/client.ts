import type { ProjectMeta, CognitiveNode } from '../lib/types';
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

export interface KnowledgeTreeNode {
  id: string;
  title: string;
  domain: string;
  description: string;
  content: string;
  status: string;
  confidence: string;
  pinned: boolean;
  sort_order: number;
  parent_id: string | null;
  children: KnowledgeTreeNode[];
  tags: string[];
  updated_at: string;
  source: string;
}

export interface KnowledgeTreeResponse {
  tree: KnowledgeTreeNode[];
  total: number;
}

export function fetchKnowledgeTree(slug: string) {
  return get<KnowledgeTreeResponse>(`/api/v1/projects/${slug}/knowledge/tree`);
}

export function fetchNodeContext(slug: string, nodeId: string) {
  return get<NodeContext>(`/api/v1/projects/${slug}/nodes/${nodeId}`);
}

// --- Knowledge operations ---

export interface DistillResponse {
  created: CognitiveNode[];
  summary: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KnowledgeChatResponse {
  reply: string;
  reasoning: string | null;
  saved: CognitiveNode[];
}

export function distillKnowledge(slug: string, text: string, domain?: string, source?: string) {
  return post<DistillResponse>(`/api/v1/projects/${slug}/knowledge/distill`, { text, domain, source });
}

export function knowledgeChat(slug: string, messages: ChatMessage[], action?: 'chat' | 'save') {
  return post<KnowledgeChatResponse>(`/api/v1/projects/${slug}/knowledge/chat`, { messages, action });
}

export function executeOperation(slug: string, operation: string, input: Record<string, unknown>) {
  return post<unknown>(`/api/v1/projects/${slug}/operations/${operation}`, input);
}

export function deleteNode(slug: string, nodeId: string) {
  return post<unknown>(`/api/v1/projects/${slug}/operations/delete-node`, { node_id: nodeId });
}

export interface CapabilityTreeNode {
  id: string;
  title: string;
  description: string;
  maturity: string;
  scope: string;
  domain: string;
  acceptanceCriteria: string[];
  tags: string[];
  updatedAt: string;
  children: CapabilityTreeNode[];
  progress: { done: number; total: number };
}

export interface CapabilityTreeResponse {
  tree: CapabilityTreeNode[];
  total: number;
}

export function fetchCapabilityTree(slug: string) {
  return get<CapabilityTreeResponse>(`/api/v1/projects/${slug}/capabilities/tree`);
}
