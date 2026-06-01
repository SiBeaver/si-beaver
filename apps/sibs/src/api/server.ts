import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { workflowRoutes } from "./routes/workflows.js";
import { distillRoutes } from "./routes/distill.js";
import { listTools } from '@si-beaver/server';
import { config } from '@si-beaver/server';

export const app = new Hono();

app.route("/health", healthRoutes);

app.use("/api/*", authMiddleware);
app.route("/api/v1/workflows", workflowRoutes);
app.route("/api/v1/distill", distillRoutes);

app.get("/api/v1/tools", (c) => {
  return c.json({ tools: listTools() });
});

app.get("/api/v1/config", (c) => {
  return c.json({
    sibsUrl: config.sibsUrl,
    sibsProject: config.sibsProject,
    llmModel: config.llmModel,
    pollInterval: config.pollInterval,
  });
});
