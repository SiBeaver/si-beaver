import { Hono } from "hono";
import { saveRun, getRun, listRuns, updateRun, type WorkflowRun, type ApiEvent } from '@si-beaver/server';
import { handleRequirementAccepted } from "../../workflow/triggers/requirement-trigger.js";

export const workflowRoutes = new Hono();

workflowRoutes.post("/run", async (c) => {
  const body = await c.req.json();
  const run: WorkflowRun = {
    id: crypto.randomUUID(),
    status: "queued",
    requirementId: null,
    template: body.template ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveRun(run);
  return c.json(run, 202);
});

workflowRoutes.post("/from-requirement", async (c) => {
  const body = await c.req.json();
  const requirementId = body.requirementId;
  if (!requirementId) return c.json({ error: "requirementId is required" }, 400);

  const fakeEvent: ApiEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    eventType: "requirement.status_changed",
    actor: "system",
    operation: "trigger-workflow",
    nodeId: requirementId,
    nodeType: "requirement",
    payload: {},
    diff: [{ field: "status", oldValue: "proposed", newValue: "accepted" }],
    context: null,
  };

  handleRequirementAccepted(fakeEvent).catch(err => {
    console.error("[workflows/from-requirement] error:", err);
  });

  return c.json({ message: "workflow triggered", requirementId }, 202);
});

workflowRoutes.get("/", (c) => {
  const runs = listRuns(50);
  return c.json({ runs });
});

workflowRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) return c.json({ error: "not found" }, 404);
  return c.json(run);
});

workflowRoutes.post("/:id/cancel", (c) => {
  const id = c.req.param("id");
  const run = getRun(id);
  if (!run) return c.json({ error: "not found" }, 404);
  if (run.status === "succeeded" || run.status === "failed") {
    return c.json({ error: "cannot cancel terminal run" }, 400);
  }
  const updated = updateRun(id, { status: "cancelled" });
  return c.json(updated);
});
