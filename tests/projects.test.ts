import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ProjectManager } from '../src/projects/manager.js';
import { Registry } from '../src/projects/registry.js';
import { runMigration } from '../src/projects/migrate.js';
import { openDatabase } from '../src/storage/db.js';

const TEST_BASE = '/tmp/si-beaver-projects-test';

function cleanup() {
  try { rmSync(TEST_BASE, { recursive: true, force: true }); } catch {}
}

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    cleanup();
    registry = new Registry(resolve(TEST_BASE, 'registry.db'));
  });

  afterEach(() => {
    registry.close();
    cleanup();
  });

  it('creates and lists projects', () => {
    registry.insertProject({ slug: 'foo', name: 'Foo Project' });
    registry.insertProject({ slug: 'bar', name: 'Bar Project', description: 'desc' });
    const list = registry.listProjects();
    expect(list).toHaveLength(2);
    const slugs = list.map(p => p.slug).sort();
    expect(slugs).toEqual(['bar', 'foo']);
  });

  it('gets a project by slug', () => {
    registry.insertProject({ slug: 'test', name: 'Test' });
    const project = registry.getProject('test');
    expect(project).not.toBeNull();
    expect(project!.name).toBe('Test');
    expect(project!.archived).toBe(false);
  });

  it('returns null for non-existent project', () => {
    expect(registry.getProject('nope')).toBeNull();
  });

  it('updates a project', () => {
    registry.insertProject({ slug: 'upd', name: 'Old Name' });
    const updated = registry.updateProject('upd', { name: 'New Name', description: 'new desc' });
    expect(updated!.name).toBe('New Name');
    expect(updated!.description).toBe('new desc');
  });

  it('archives a project', () => {
    registry.insertProject({ slug: 'arc', name: 'To Archive' });
    registry.archiveProject('arc');
    const list = registry.listProjects();
    expect(list).toHaveLength(0); // archived not in list
    const direct = registry.getProject('arc');
    expect(direct!.archived).toBe(true);
  });

  it('manages config values', () => {
    expect(registry.getConfig('default_project')).toBe('default');
    registry.setConfig('default_project', 'other');
    expect(registry.getConfig('default_project')).toBe('other');
  });
});

describe('ProjectManager', () => {
  let manager: ProjectManager;

  beforeEach(() => {
    cleanup();
    manager = new ProjectManager(TEST_BASE);
  });

  afterEach(() => {
    manager.close();
    cleanup();
  });

  it('auto-creates default project on first run', () => {
    const list = manager.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe('default');
  });

  it('creates a new project', () => {
    const project = manager.createProject({ slug: 'my-app', name: 'My App' });
    expect(project.slug).toBe('my-app');
    expect(manager.listProjects()).toHaveLength(2);
  });

  it('rejects duplicate slugs', () => {
    manager.createProject({ slug: 'dup', name: 'Dup' });
    expect(() => manager.createProject({ slug: 'dup', name: 'Dup2' }))
      .toThrow('already exists');
  });

  it('rejects invalid slugs', () => {
    expect(() => manager.createProject({ slug: 'UPPER', name: 'X' })).toThrow();
    expect(() => manager.createProject({ slug: '-start', name: 'X' })).toThrow();
    expect(() => manager.createProject({ slug: 'end-', name: 'X' })).toThrow();
    expect(() => manager.createProject({ slug: 'has space', name: 'X' })).toThrow();
    expect(() => manager.createProject({ slug: '', name: 'X' })).toThrow();
  });

  it('accepts valid single-char slug', () => {
    const p = manager.createProject({ slug: 'x', name: 'X' });
    expect(p.slug).toBe('x');
  });

  it('gets OperationContext for a project', () => {
    const ctx = manager.getContext('default');
    expect(ctx).toBeDefined();
    expect(ctx.nodes).toBeDefined();
    expect(ctx.edges).toBeDefined();
  });

  it('caches OperationContext', () => {
    const ctx1 = manager.getContext('default');
    const ctx2 = manager.getContext('default');
    expect(ctx1).toBe(ctx2);
  });

  it('throws for non-existent project context', () => {
    expect(() => manager.getContext('nope')).toThrow('not found');
  });

  it('manages default project', () => {
    expect(manager.getDefaultProject()).toBe('default');
    manager.createProject({ slug: 'other', name: 'Other' });
    manager.setDefaultProject('other');
    expect(manager.getDefaultProject()).toBe('other');
  });

  it('throws when setting non-existent default', () => {
    expect(() => manager.setDefaultProject('nope')).toThrow('not found');
  });
});

describe('Migration', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('creates registry from scratch', () => {
    runMigration(TEST_BASE);
    expect(existsSync(resolve(TEST_BASE, 'registry.db'))).toBe(true);
    const registry = new Registry(resolve(TEST_BASE, 'registry.db'));
    const projects = registry.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].slug).toBe('default');
    registry.close();
  });

  it('detects legacy database and marks migration', () => {
    // Create a legacy DB first
    const legacyPath = resolve(TEST_BASE, 'projects', 'default', 'cognition.db');
    openDatabase(legacyPath).close();

    runMigration(TEST_BASE);
    const registry = new Registry(resolve(TEST_BASE, 'registry.db'));
    const project = registry.getProject('default');
    expect(project!.description).toContain('Migrated');
    registry.close();
  });

  it('is idempotent', () => {
    runMigration(TEST_BASE);
    runMigration(TEST_BASE); // should not throw
    const registry = new Registry(resolve(TEST_BASE, 'registry.db'));
    expect(registry.listProjects()).toHaveLength(1);
    registry.close();
  });
});
