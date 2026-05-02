// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Logger } from "pino";
import {
  cleanupExpiredData,
  type CleanupStore,
} from "../lib/cleanup.js";
import { badRequest } from "../lib/errors.js";

const cleanupOverrideSchema = z.object({
  traceRetentionDays: z.coerce.number().int().positive().optional(),
  verdictRetentionDays: z.coerce.number().int().positive().optional(),
  batchSize: z.coerce.number().int().positive().optional(),
});

export interface CleanupRouteDeps {
  cleanupStore: CleanupStore;
  logger?: Logger;
}

export function createCleanupRoutes(deps: CleanupRouteDeps) {
  const app = new Hono();

  app.post("/v1/admin/cleanup", async (c) => {
    const options = cleanupOverrideSchema.parse(await parseOptionalJsonBody(c));
    const result = await cleanupExpiredData(
      {
        cleanupStore: deps.cleanupStore,
        logger: deps.logger,
      },
      options,
    );

    return c.json({
      ok: true,
      ...result,
    });
  });

  return app;
}

async function parseOptionalJsonBody(c: Context) {
  const text = await c.req.text();
  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw badRequest("body: invalid JSON");
  }
}
