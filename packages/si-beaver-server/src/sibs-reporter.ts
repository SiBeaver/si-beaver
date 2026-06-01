import type { WorkflowRun, TaskState, SibsReporter as ISibsReporter } from "./types/workflow.js";
import { sibs } from "./sibs-client.js";

export class SibsReporter implements ISibsReporter {
  private projectSlug: string;

  constructor(projectSlug: string) {
    this.projectSlug = projectSlug;
  }

  async report(run: WorkflowRun): Promise<void> {
    if (run.status === "cancelled") return;

    // 1. Create a task for the workflow
    const taskResult = await sibs.createTask({
      title: `Workflow: ${run.templateName}`,
      description: [
        `Workflow run ${run.id}`,
        `Status: ${run.status}`,
        `Tasks: ${Object.keys(run.taskStates).length}`,
        `Started: ${run.startedAt.toISOString()}`,
        `Finished: ${run.finishedAt?.toISOString()}`,
      ].join("\n"),
      effort: "medium",
      priority: "high",
    });

    const taskId = (taskResult as any)?.id as string | undefined;

    // 2. Report findings as knowledge nodes
    for (const [taskName, state] of Object.entries(run.taskStates)) {
      if (state.status !== "succeeded" || !state.outputs) continue;

      if (state.outputs.findings) {
        await this.reportFindings(taskName, state);
      }

      if (state.outputs.issues) {
        await this.reportIssues(taskName, state);
      }
    }

    // 3. If workflow failed, create a risk
    if (run.status === "failed") {
      await sibs.identifyRisk({
        title: `Workflow failure: ${run.templateName}`,
        description: [
          `Workflow ${run.id} failed.`,
          ...Object.entries(run.taskStates)
            .filter(([, s]) => s.status === "failed")
            .map(([n, s]) => `- ${n}: ${s.error ?? "unknown error"}`),
        ].join("\n"),
        likelihood: "high",
        impact: "high",
        tags: ["sibat", "workflow-failure"],
      });
    }
  }

  private async reportFindings(taskName: string, state: TaskState) {
    const findings = state.outputs?.findings;
    if (!Array.isArray(findings)) return;

    for (const finding of findings) {
      const title = finding.title || finding.type || `${taskName} finding`;
      const desc = typeof finding === "string" ? finding : JSON.stringify(finding);
      await sibs.recordKnowledge({
        title,
        description: `Source: ${taskName}\n${desc}`,
        domain: "security",
        confidence: finding.severity === "CRITICAL" ? "high" : "medium",
        source: "sibat-workflow",
      });
    }
  }

  private async reportIssues(taskName: string, state: TaskState) {
    const issues = state.outputs?.issues;
    if (!Array.isArray(issues)) return;

    for (const issue of issues) {
      const title = issue.type || `${taskName} issue`;
      const severity: string = issue.severity || "MEDIUM";

      await sibs.identifyRisk({
        title,
        description: `Source: ${taskName}\nDetail: ${issue.detail || JSON.stringify(issue)}`,
        likelihood: severity === "HIGH" || severity === "CRITICAL" ? "high" : "medium",
        impact: severity === "CRITICAL" ? "critical" : severity === "HIGH" ? "high" : "medium",
        tags: ["sibat", taskName, severity.toLowerCase()],
      });
    }
  }
}
