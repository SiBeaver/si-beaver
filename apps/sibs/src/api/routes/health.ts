import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "sibeavercloud",
    version: "0.1.0",
    uptime: process.uptime(),
  });
});
