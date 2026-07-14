// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import type {
  VerdictStore,
  TraceStore,
  SessionStore,
  GraphStore,
  ScenarioSpecStore,
  DlqStore,
} from '@qa-sdk/core';
import { computePendingVerdicts } from '@qa-sdk/engine';
import { traceNotFound, sessionNotFound } from '../lib/errors.js';

export interface VerdictDeps {
  verdictStore: VerdictStore;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  graphStore: GraphStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
}

export function createVerdictRoutes(deps: VerdictDeps) {
  const app = new Hono();

  app.get('/v1/traces/:traceId/verdicts', async (c) => {
    const traceId = c.req.param('traceId');
    const trace = await deps.traceStore.findById(traceId);

    if (!trace) {
      throw traceNotFound(traceId);
    }

    const verdicts = await deps.verdictStore.findByTraceId(traceId);

    return c.json({
      items: verdicts.map(toVerdictResponse),
    });
  });

  app.get('/v1/sessions/:sessionId/verdicts', async (c) => {
    const sessionId = c.req.param('sessionId');
    const session = await deps.sessionStore.findById(sessionId);

    if (!session) {
      throw sessionNotFound(sessionId);
    }

    const verdicts = await deps.verdictStore.findBySessionId(sessionId);

    return c.json({
      items: verdicts.map(toVerdictResponse),
    });
  });

  app.post('/v1/traces/:traceId/verdicts/recompute', async (c) => {
    const traceId = c.req.param('traceId');
    const trace = await deps.traceStore.findById(traceId);

    if (!trace) {
      throw traceNotFound(traceId);
    }

    const result = await computePendingVerdicts(deps, [traceId], { force: true });

    return c.json({
      computed: result.computed,
      skipped: result.skipped,
      failed: result.failed,
    });
  });

  return app;
}

function toVerdictResponse(verdict: {
  id: string;
  scenarioId: string;
  traceId: string;
  qaSessionId?: string;
  overallVerdict: string;
  report: unknown;
  computedAt: Date;
}) {
  return {
    id: verdict.id,
    scenarioId: verdict.scenarioId,
    traceId: verdict.traceId,
    qaSessionId: verdict.qaSessionId ?? null,
    overallVerdict: verdict.overallVerdict,
    report: verdict.report,
    computedAt: verdict.computedAt.toISOString(),
  };
}
