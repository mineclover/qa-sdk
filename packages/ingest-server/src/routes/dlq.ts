// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from "hono";
import type {
  DlqStore,
  GraphStore,
  RecordStore,
  ScenarioSpecStore,
  SessionStore,
  TraceStore,
  VerdictStore,
} from "@qa-sdk/core";
import { computePendingVerdicts, computeTraceVerdict, reconstructTrace } from "@qa-sdk/engine";
import { z } from "zod";
import type { Logger } from "pino";
import { badRequest } from "../lib/errors.js";

const listQuerySchema = z.object({
  status: z.enum(["pending"]).default("pending"),
  limit: z.coerce.number().int().positive().optional(),
});

export interface DlqDeps {
  dlqStore: DlqStore;
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  sessionStore: SessionStore;
  scenarioSpecStore: ScenarioSpecStore;
  verdictStore: VerdictStore;
  logger?: Logger;
  maxRetryAttempts?: number;
}

export function createDlqRoutes(deps: DlqDeps) {
  const app = new Hono();
  const maxRetryAttempts = deps.maxRetryAttempts ?? 3;

  app.get("/v1/admin/dlq", async (c) => {
    const query = listQuerySchema.parse(c.req.query());

    if (query.status !== "pending") {
      throw badRequest("status: only 'pending' is supported");
    }

    const items = await deps.dlqStore.findPending(normalizeLimit(query.limit));

    return c.json({
      items: items.map(toDlqResponse),
    });
  });

  app.post("/v1/admin/dlq/retry", async (c) => {
    const items = await deps.dlqStore.findPending(100);
    const resolved: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    for (const item of items) {
      if (item.attemptCount >= maxRetryAttempts) {
        skipped.push(item.id);
        deps.logger?.warn(
          {
            dlqId: item.id,
            traceId: item.traceId,
            phase: item.phase,
            attemptCount: item.attemptCount,
            maxRetryAttempts,
          },
          "skipping dlq item after max retry attempts",
        );
        continue;
      }

      await deps.dlqStore.markAttempted(item.id);

      try {
        if (item.phase === "reconstruction") {
          await reconstructTrace(deps, item.traceId);
          await deps.dlqStore.markResolved(item.id);
          resolved.push(item.id);

          await computePendingVerdicts(
            deps,
            [item.traceId],
            {
              onError: (traceId, error) => {
                deps.logger?.error(
                  {
                    err: error,
                    dlqId: item.id,
                    traceId,
                    phase: "verdict",
                  },
                  "failed to compute verdict while retrying reconstruction dlq item",
                );
              },
            },
          );
          continue;
        }

        await computeTraceVerdict(deps, item.traceId, { force: true });
        await deps.dlqStore.markResolved(item.id);
        resolved.push(item.id);
      } catch (error) {
        failed.push(item.id);
        deps.logger?.error(
          {
            err: error,
            dlqId: item.id,
            traceId: item.traceId,
            phase: item.phase,
          },
          "failed to retry dlq item",
        );
      }
    }

    return c.json({
      total: items.length,
      resolved,
      failed,
      skipped,
    });
  });

  return app;
}

function normalizeLimit(limit?: number): number {
  return Math.min(limit ?? 50, 200);
}

function toDlqResponse(item: {
  id: string;
  traceId: string;
  phase: string;
  errorMessage: string;
  attemptCount: number;
  lastAttemptedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}) {
  return {
    id: item.id,
    traceId: item.traceId,
    phase: item.phase,
    errorMessage: item.errorMessage,
    attemptCount: item.attemptCount,
    lastAttemptedAt: item.lastAttemptedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
  };
}
