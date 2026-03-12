import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";

export function healthRoutes(db: Db) {
  const routes = new Hono();

  routes.get("/health", (c) => {
    return c.json({ ok: true });
  });

  routes.get("/ready", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  return routes;
}
