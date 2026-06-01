export interface Tool {
  name: string;
  execute(inputs: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  outputs: Record<string, unknown>;
  artifacts?: string[];
}
