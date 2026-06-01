import type { Tool, ToolResult } from "../types/tool.js";

const registry = new Map<string, Tool>();

export function registerTool(tool: Tool) {
  registry.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(): string[] {
  return Array.from(registry.keys());
}
