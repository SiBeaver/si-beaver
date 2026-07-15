export interface ProjectMeta {
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  metadata: Record<string, unknown>;
}

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
