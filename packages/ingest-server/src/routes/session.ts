import { Hono } from "hono";
import { z } from "zod";
import type { SessionStore } from "@qa-sdk/core";
import { badRequest, sessionNotFound } from "../lib/errors.js";

export interface SessionRouteDeps {
  sessionStore: SessionStore;
}

const createSessionBodySchema = z.object({
  scenarioId: z.string().min(1).optional(),
  labels: z.record(z.string()).optional(),
});

const listSessionsQuerySchema = z.object({
  scenarioId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export function createSessionRoutes(deps: SessionRouteDeps) {
  const app = new Hono();

  app.get("/v1/sessions", async (c) => {
    const query = listSessionsQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!query.success) throw badRequest("invalid query parameters");

    const { scenarioId, limit } = query.data;

    if (!scenarioId) {
      return c.json({ items: [] });
    }

    const sessions = await deps.sessionStore.findByScenarioId(scenarioId, limit);

    return c.json({
      items: sessions.map((s) => ({
        sessionId: s.sessionId,
        scenarioId: s.scenarioId,
        labels: s.labels,
        startedAt: s.startedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
      })),
    });
  });

  app.post("/v1/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createSessionBodySchema.safeParse(body);

    if (!parsed.success) {
      throw badRequest("invalid request body");
    }

    const { scenarioId, labels } = parsed.data;
    const sessionId = `qas_${crypto.randomUUID().replace(/-/g, "")}`;

    await deps.sessionStore.upsert({ sessionId, scenarioId, labels });

    const session = await deps.sessionStore.findById(sessionId);

    return c.json(
      {
        sessionId: session!.sessionId,
        scenarioId: session!.scenarioId,
        startedAt: session!.startedAt.toISOString(),
      },
      201,
    );
  });

  app.post("/v1/sessions/:sessionId/close", async (c) => {
    const sessionId = c.req.param("sessionId");
    const session = await deps.sessionStore.findById(sessionId);

    if (!session) {
      throw sessionNotFound(sessionId);
    }

    await deps.sessionStore.close(sessionId);

    return c.json({ closed: true, sessionId });
  });

  return app;
}
