export interface WorkflowTemplate {
  apiVersion: string;
  kind: "Workflow";
  metadata: {
    name: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  params?: ParamDef[];
  tasks: Record<string, TaskDef>;
}

export interface ParamDef {
  name: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface TaskDef {
  tool: string;
  description?: string;
  depends?: string | string[];
  when?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, string>;
  timeout?: string;
  retry?: number;
}

export interface WorkflowRun {
  id: string;
  templateName: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  params: Record<string, unknown>;
  taskStates: Record<string, TaskState>;
  startedAt: Date;
  finishedAt?: Date;
}

export interface TaskState {
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  startedAt: Date;
  finishedAt?: Date;
  outputs?: Record<string, unknown>;
  error?: string;
  attempts?: number;
  stdout?: string;
  stderr?: string;
}

export interface SibsReporter {
  report(run: WorkflowRun): Promise<void>;
}
