import type { WorkflowTemplate, WorkflowRun, TaskState, TaskDef, SibsReporter } from "../types/workflow.js";
import { resolveDeep, evaluateExpr, type EvalContext } from "./expression.js";
import { getTool } from "../tools/registry.js";

export class WorkflowEngine {
  private reporter?: SibsReporter;

  /** Attach a sibs reporter for automatic cognitive-layer integration. */
  setReporter(reporter: SibsReporter) {
    this.reporter = reporter;
  }

  /**
   * Execute a workflow template with the given parameters.
   *
   * Execution model:
   * 1. Compute DAG levels via topological sort
   * 2. For each level, run all ready tasks in parallel
   * 3. Each task: resolve inputs → invoke tool → handle timeout + retry
   * 4. First non-optional failure aborts the workflow
   * 5. On completion, report to sibs cognitive layer (if reporter set)
   */
  async execute(template: WorkflowTemplate, params: Record<string, unknown>): Promise<WorkflowRun> {
    const run: WorkflowRun = {
      id: crypto.randomUUID(),
      templateName: template.metadata.name,
      status: "running",
      params,
      taskStates: {},
      startedAt: new Date(),
    };

    const levels = this.buildLevels(template);

    for (const level of levels) {
      const runnable = level.filter((name) =>
        this.shouldRunTask(template.tasks[name], run.taskStates, params),
      );

      for (const name of level) {
        if (!runnable.includes(name)) {
          run.taskStates[name] = {
            status: "skipped",
            startedAt: new Date(),
            finishedAt: new Date(),
          };
        }
      }

      if (runnable.length === 0) continue;

      const results = await Promise.allSettled(
        runnable.map((name) => this.executeTask(name, template.tasks[name], run)),
      );

      for (let i = 0; i < runnable.length; i++) {
        const name = runnable[i];
        const result = results[i];
        if (result.status === "rejected") {
          run.taskStates[name] = {
            status: "failed",
            startedAt: run.taskStates[name]?.startedAt ?? new Date(),
            finishedAt: new Date(),
            error: String(result.reason),
          };
          run.status = "failed";
        }
      }

      if (run.status === "failed") break;
    }

    if (run.status === "running") {
      run.status = "succeeded";
    }
    run.finishedAt = new Date();

    // Report to sibs cognitive layer (fire-and-forget; don't block the result)
    if (this.reporter) {
      this.reporter.report(run).catch((err) =>
        console.error(`[sibs] reporter failed: ${err}`),
      );
    }

    return run;
  }

  /**
   * Execute a single task: resolve inputs, invoke tool, capture outputs.
   * Handles timeout and retry per task configuration.
   */
  private async executeTask(name: string, taskDef: TaskDef, run: WorkflowRun): Promise<void> {
    const maxRetries = taskDef.retry ?? 0;
    const timeoutMs = this.parseTimeout(taskDef.timeout);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      run.taskStates[name] = {
        status: "running",
        startedAt: new Date(),
        attempts: attempt + 1,
      };

      try {
        const evalCtx: EvalContext = {
          params: run.params,
          taskOutputs: this.collectTaskOutputs(run.taskStates),
        };

        const resolvedInputs = resolveDeep(taskDef.inputs ?? {}, evalCtx) as Record<string, unknown>;

        const toolResult = await this.invokeWithTimeout(taskDef.tool, resolvedInputs, timeoutMs);

        const resolvedOutputs = this.resolveOutputs(taskDef.outputs, toolResult.outputs, evalCtx, toolResult);

        run.taskStates[name] = {
          status: "succeeded",
          startedAt: run.taskStates[name].startedAt,
          finishedAt: new Date(),
          outputs: resolvedOutputs,
          attempts: attempt + 1,
          stdout: toolResult.stdout,
          stderr: toolResult.stderr,
        };
        return;
      } catch (err) {
        if (attempt < maxRetries) continue;
        throw err;
      }
    }
  }

  /**
   * Invoke a tool by name, with an optional timeout.
   */
  private async invokeWithTimeout(
    toolName: string,
    inputs: Record<string, unknown>,
    timeoutMs: number | null,
  ) {
    const tool = getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
      try {
        const result = await tool.execute(inputs);
        clearTimeout(timer);
        return result;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }

    return tool.execute(inputs);
  }

  /**
   * Build execution levels from the DAG. Level 0 = no dependencies, level 1 = depends on level 0, etc.
   */
  private buildLevels(template: WorkflowTemplate): string[][] {
    const tasks = template.tasks;
    const taskNames = Object.keys(tasks);
    const levels: string[][] = [];
    const assigned = new Set<string>();

    while (assigned.size < taskNames.length) {
      const level: string[] = [];
      for (const name of taskNames) {
        if (assigned.has(name)) continue;

        const deps = this.getDepNames(tasks[name]);
        const allDepsAssigned = deps.every((d) => assigned.has(d) || !tasks[d]);
        if (allDepsAssigned) {
          level.push(name);
        }
      }

      if (level.length === 0) {
        throw new Error(`Unresolvable dependency in DAG: ${taskNames.filter((n) => !assigned.has(n)).join(", ")}`);
      }

      levels.push(level);
      for (const name of level) assigned.add(name);
    }

    return levels;
  }

  private getDepNames(taskDef: TaskDef): string[] {
    if (!taskDef.depends) return [];
    const deps = Array.isArray(taskDef.depends) ? taskDef.depends : [taskDef.depends];
    return deps.map((d) => this.parseDepends(d).name);
  }

  /**
   * Determine whether a task should execute.
   */
  private shouldRunTask(
    taskDef: TaskDef | undefined,
    taskStates: Record<string, TaskState>,
    params: Record<string, unknown>,
  ): boolean {
    if (!taskDef) return false;

    if (taskDef.depends) {
      const deps = Array.isArray(taskDef.depends) ? taskDef.depends : [taskDef.depends];
      for (const dep of deps) {
        const parsed = this.parseDepends(dep);
        if (parsed.optional) continue;

        const depState = taskStates[parsed.name];
        if (!depState) return false;

        const expected = parsed.expectedStatus ?? "succeeded";
        if (depState.status !== expected) return false;
      }
    }

    if (taskDef.when) {
      const ctx: EvalContext = { params, taskOutputs: this.collectTaskOutputs(taskStates) };
      const rawExpr = taskDef.when;
      const expr =
        rawExpr.startsWith("${{") && rawExpr.endsWith("}}") ? rawExpr.slice(3, -2).trim() : rawExpr;
      const result = evaluateExpr(expr, ctx);
      if (!result) return false;
    }

    return true;
  }

  private parseTimeout(timeout?: string): number | null {
    if (!timeout) return null;
    const match = /^(\d+)([smh])$/.exec(timeout);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 3600 * 1000;
      default:
        return null;
    }
  }

  private parseDepends(dep: string): {
    name: string;
    optional: boolean;
    expectedStatus?: "succeeded" | "failed" | "skipped";
  } {
    let name = dep;
    let optional = false;
    let expectedStatus: "succeeded" | "failed" | "skipped" | undefined;

    if (name.endsWith("?")) {
      optional = true;
      name = name.slice(0, -1);
    }

    const statusMatch = /\.(Succeeded|Failed|Skipped)$/.exec(name);
    if (statusMatch) {
      expectedStatus = statusMatch[1].toLowerCase() as "succeeded" | "failed" | "skipped";
      name = name.slice(0, -statusMatch[1].length - 1);
    }

    return { name, optional, expectedStatus };
  }

  private collectTaskOutputs(taskStates: Record<string, TaskState>): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [name, state] of Object.entries(taskStates)) {
      result[name] = state.outputs ?? {};
    }
    return result;
  }

  private resolveOutputs(
    outputDefs: Record<string, string> | undefined,
    rawOutputs: Record<string, unknown>,
    evalCtx: EvalContext,
    toolResult?: { stdout?: string; stderr?: string },
  ): Record<string, unknown> {
    if (!outputDefs) return rawOutputs;

    const resolved: Record<string, unknown> = { ...rawOutputs };
    const ctx: EvalContext = {
      ...evalCtx,
      self: { stdout: toolResult?.stdout, stderr: toolResult?.stderr },
    };

    for (const [key, expr] of Object.entries(outputDefs)) {
      if (typeof expr === "string" && expr.includes("extract(")) {
        resolved[key] = evaluateExpr(expr, ctx);
      } else {
        resolved[key] = expr;
      }
    }

    return resolved;
  }
}
