/**
 * MCP Server with stdio transport (for local CLI usage).
 * Exposes all tools with an optional project param (global mode).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolve } from 'path';
import { homedir } from 'os';
import { ProjectManager } from '../projects/index.js';
import { registerTools } from './tools.js';

// ============================================================
// Initialization
// ============================================================

const BASE_PATH = process.env.SI_BEAVER_HOME
  ?? resolve(homedir(), '.si-beaver');

const manager = new ProjectManager(BASE_PATH);

const server = new McpServer({
  name: 'si-beaver',
  version: '0.2.0',
});

registerTools(server, { mode: 'global', manager });

// ============================================================
// Start
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('si-beaver MCP server started (stdio, multi-project)');
}

main().catch(console.error);
