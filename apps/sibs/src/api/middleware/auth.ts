import type { Context, Next } from "hono";
import { config } from '@si-beaver/server';

export async function authMiddleware(c: Context, next: Next) {
  if (!config.authToken) {
    return next();
  }

  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = header.slice(7);
  if (token !== config.authToken) {
    return c.json({ error: "Invalid token" }, 403);
  }

  return next();
}
