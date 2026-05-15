/**
 * Degraded MCP session for non-existent projects.
 * Exposes only `initialize_project` so agents can self-recover.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProjectManager } from '../projects/index.js';

export function createDegradedServer(manager: ProjectManager, slug: string): McpServer {
  const server = new McpServer(
    {
      name: `si-beaver/${slug}`,
      version: '0.2.0',
    },
    {
      instructions: [
        `Project "${slug}" does not exist yet.`,
        `This is a degraded session with limited functionality.`,
        `Call the "initialize_project" tool to create the project, then reconnect to this endpoint.`,
      ].join(' '),
    },
  );

  server.tool(
    'initialize_project',
    `Create project "${slug}" so this MCP endpoint becomes fully functional. After success, you MUST disconnect and reconnect to /mcp/${slug} to get the full tool set.`,
    {
      name: z.string().describe('Display name for the project (e.g., "My Awesome Project")'),
      description: z.string().optional().describe('Optional project description'),
    },
    async (args) => {
      const start = Date.now();
      try {
        const project = await manager.createProject({
          slug,
          name: args.name,
          description: args.description,
        });
        console.log(`[MCP] ${slug} initialize_project ${Date.now() - start}ms name="${project.name}"`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              project: { slug: project.slug, name: project.name },
              next_step: `Project "${slug}" created successfully. You MUST now disconnect from this session and reconnect to the same endpoint (/mcp/${slug}) to access the full set of project tools.`,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[MCP] ${slug} initialize_project FAIL ${Date.now() - start}ms: ${message}`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: message }, null, 2),
          }],
          isError: true,
        };
      }
    },
  );

  return server;
}
