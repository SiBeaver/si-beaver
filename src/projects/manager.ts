import { resolve } from 'path';
import { homedir } from 'os';
import { openDatabase } from '../storage/db.js';
import { OperationContext } from '../operations/context.js';
import { Registry } from './registry.js';
import { runMigration } from './migrate.js';
import type { ProjectMeta, CreateProjectInput, UpdateProjectInput } from './types.js';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export class ProjectManager {
  private basePath: string;
  private registry: Registry;
  private contexts = new Map<string, OperationContext>();

  constructor(basePath?: string) {
    this.basePath = basePath ?? resolve(homedir(), '.si-beaver');
    runMigration(this.basePath);
    this.registry = new Registry(resolve(this.basePath, 'registry.db'));
  }

  getContext(slug: string): OperationContext {
    const existing = this.contexts.get(slug);
    if (existing) return existing;

    const project = this.registry.getProject(slug);
    if (!project) {
      throw new Error(`Project "${slug}" not found`);
    }

    const dbPath = resolve(this.basePath, 'projects', slug, 'cognition.db');
    const db = openDatabase(dbPath);
    const ctx = new OperationContext(db);
    this.contexts.set(slug, ctx);
    return ctx;
  }

  createProject(input: CreateProjectInput): ProjectMeta {
    validateSlug(input.slug);
    if (this.registry.getProject(input.slug)) {
      throw new Error(`Project "${input.slug}" already exists`);
    }
    return this.registry.insertProject(input);
  }

  listProjects(): ProjectMeta[] {
    return this.registry.listProjects();
  }

  getProject(slug: string): ProjectMeta | null {
    return this.registry.getProject(slug);
  }

  updateProject(slug: string, patch: UpdateProjectInput): ProjectMeta {
    const result = this.registry.updateProject(slug, patch);
    if (!result) throw new Error(`Project "${slug}" not found`);
    return result;
  }

  /**
   * Returns existing project or auto-creates it (for MCP auto-registration).
   * Uses slug as the display name if creating.
   */
  ensureProject(slug: string): ProjectMeta {
    validateSlug(slug);
    const existing = this.registry.getProject(slug);
    if (existing) return existing;
    return this.registry.insertProject({ slug, name: slug });
  }

  archiveProject(slug: string): void {
    this.registry.archiveProject(slug);
    this.contexts.delete(slug);
  }

  getDefaultProject(): string {
    return process.env.SI_BEAVER_DEFAULT_PROJECT
      ?? this.registry.getConfig('default_project')
      ?? 'default';
  }

  setDefaultProject(slug: string): void {
    if (!this.registry.getProject(slug)) {
      throw new Error(`Project "${slug}" not found`);
    }
    this.registry.setConfig('default_project', slug);
  }

  close(): void {
    this.contexts.clear();
    this.registry.close();
  }
}

function validateSlug(slug: string): void {
  if (!slug || slug.length > 64) {
    throw new Error('Slug must be 1-64 characters');
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new Error('Slug must be lowercase alphanumeric with hyphens (e.g., "my-project")');
  }
}
