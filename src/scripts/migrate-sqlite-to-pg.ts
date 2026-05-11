/**
 * One-time migration: SQLite → PostgreSQL
 * Reads registry.db + per-project cognition.db files from a local directory,
 * inserts everything into the PG database.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-sqlite-to-pg.ts /tmp/sibeaver-sqlite/data
 */
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, readdirSync } from 'fs';
import { getPool, closePool, getConnectionString } from '../storage/db.js';

const dataDir = process.argv[2];
if (!dataDir) {
  console.error('Usage: npx tsx src/scripts/migrate-sqlite-to-pg.ts <data-dir>');
  process.exit(1);
}

async function main() {
  console.log(`Connecting to PG: ${getConnectionString().replace(/:[^@]+@/, ':***@')}`);
  const sql = await getPool(); // This also runs schema DDL

  // 1. Migrate registry (projects + config)
  const registryPath = resolve(dataDir, 'registry.db');
  if (!existsSync(registryPath)) {
    console.error(`registry.db not found at ${registryPath}`);
    process.exit(1);
  }

  const registryDb = new Database(registryPath, { readonly: true });

  const projects = registryDb.prepare('SELECT * FROM projects').all() as any[];
  console.log(`Found ${projects.length} projects in registry`);

  for (const p of projects) {
    await sql`
      INSERT INTO projects (slug, name, description, created_at, updated_at, archived, metadata)
      VALUES (${p.slug}, ${p.name}, ${p.description}, ${p.created_at}, ${p.updated_at},
              ${!!p.archived}, ${p.metadata}::jsonb)
      ON CONFLICT (slug) DO NOTHING
    `;
    console.log(`  project: ${p.slug}`);
  }

  const configs = registryDb.prepare('SELECT * FROM config').all() as any[];
  for (const c of configs) {
    await sql`
      INSERT INTO config (key, value) VALUES (${c.key}, ${c.value})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  registryDb.close();
  console.log('Registry migrated.\n');

  // 2. Migrate each project's cognition.db
  const projectsDir = resolve(dataDir, 'projects');
  if (!existsSync(projectsDir)) {
    console.error(`projects/ directory not found at ${projectsDir}`);
    process.exit(1);
  }

  const slugs = readdirSync(projectsDir);
  for (const slug of slugs) {
    const dbPath = resolve(projectsDir, slug, 'cognition.db');
    if (!existsSync(dbPath)) {
      console.log(`  [skip] ${slug}: no cognition.db`);
      continue;
    }

    console.log(`Migrating project: ${slug}`);
    const db = new Database(dbPath, { readonly: true });

    // Nodes
    const nodes = db.prepare('SELECT * FROM nodes').all() as any[];
    console.log(`  nodes: ${nodes.length}`);
    for (const n of nodes) {
      await sql`
        INSERT INTO nodes (id, project_id, type, title, description, status, tags, created_at, updated_at, metadata, data)
        VALUES (${n.id}, ${slug}, ${n.type}, ${n.title}, ${n.description}, ${n.status},
                ${n.tags}::jsonb, ${n.created_at}, ${n.updated_at},
                ${n.metadata}::jsonb, ${n.data}::jsonb)
        ON CONFLICT (project_id, id) DO NOTHING
      `;
    }

    // Edges
    const edges = db.prepare('SELECT * FROM edges').all() as any[];
    console.log(`  edges: ${edges.length}`);
    for (const e of edges) {
      await sql`
        INSERT INTO edges (id, project_id, source_id, target_id, relation, weight, annotation, created_at)
        VALUES (${e.id}, ${slug}, ${e.source_id}, ${e.target_id}, ${e.relation},
                ${e.weight}, ${e.annotation}, ${e.created_at})
        ON CONFLICT (project_id, id) DO NOTHING
      `;
    }

    // Events
    const events = db.prepare('SELECT * FROM events').all() as any[];
    console.log(`  events: ${events.length}`);
    for (const ev of events) {
      await sql`
        INSERT INTO events (id, project_id, timestamp, event_type, actor, operation, node_id, node_type, payload, diff, context)
        VALUES (${ev.id}, ${slug}, ${ev.timestamp}, ${ev.event_type}, ${ev.actor}, ${ev.operation},
                ${ev.node_id}, ${ev.node_type}, ${ev.payload}::jsonb,
                ${ev.diff ? ev.diff : null}::jsonb, ${ev.context})
        ON CONFLICT (project_id, id) DO NOTHING
      `;
    }

    db.close();
    console.log(`  done.\n`);
  }

  console.log('Migration complete!');
  await closePool();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
