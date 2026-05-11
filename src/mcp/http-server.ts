/**
 * MCP Server with Streamable HTTP transport.
 * Routes: /mcp/{slug} — each slug gets a project-scoped MCP server.
 * Unknown slugs return 404; projects must be created via REST API.
 *
 * This module exports a handler function; it no longer starts its own server.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ProjectManager } from '../projects/index.js';
import { registerTools } from './tools.js';

// ============================================================
// Per-session MCP server factory
// ============================================================

async function createServerForSlug(manager: ProjectManager, slug: string): Promise<McpServer | null> {
  const project = await manager.getProject(slug);
  if (!project) return null;

  const server = new McpServer({
    name: `si-beaver/${slug}`,
    version: '0.2.0',
  });

  registerTools(server, {
    mode: 'scoped',
    slug,
    getContext: () => manager.getContext(slug),
  });

  return server;
}

// ============================================================
// Session management
// ============================================================

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  slug: string;
}

const sessions = new Map<string, SessionEntry>();

// ============================================================
// Exported handler
// ============================================================

const SLUG_PATTERN = /^\/mcp\/([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])$/;

/**
 * Handle an incoming request on `/mcp/{slug}`.
 * Returns true if the request was handled, false if the path didn't match.
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: ProjectManager,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  const match = SLUG_PATTERN.exec(url.pathname);
  if (!match) return false;

  const slug = match[1];
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (req.method === 'POST' || req.method === 'GET') {
    let entry: SessionEntry | undefined;
    let isNewSession = false;

    if (sessionId && sessions.has(sessionId)) {
      entry = sessions.get(sessionId)!;
    } else if (!sessionId && req.method === 'POST') {
      const server = await createServerForSlug(manager, slug);
      if (!server) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Project "${slug}" not found. Create it via REST API first.` }));
        return true;
      }
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      entry = { transport, slug };
      isNewSession = true;
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid session' }));
      return true;
    }

    await entry.transport.handleRequest(req, res);

    if (isNewSession && entry.transport.sessionId) {
      sessions.set(entry.transport.sessionId, entry);
    }
    return true;
  }

  if (req.method === 'DELETE') {
    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res);
      sessions.delete(sessionId);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
    }
    return true;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
  return true;
}

export { sessions };
