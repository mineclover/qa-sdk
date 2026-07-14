// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import type {
  EventRecord,
  GraphStore,
  RecordPaginationCursor,
  RecordStore,
  RuntimeGraph,
  SessionStore,
  StoredRecord,
  StoredRecordPage,
  StoredSession,
  StoredTrace,
  TraceStore,
} from '@qa-sdk/core';
import { z } from 'zod';
import { createNoopDebugStore, type DebugStore } from '../lib/debug-store.js';
import { badRequest, graphNotFound, sessionNotFound, traceNotFound } from '../lib/errors.js';

const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

const cursorSchema = z.object({
  timestamp: z.string().datetime(),
  logId: z.string().min(1),
});

export interface QueryDeps {
  graphStore: GraphStore;
  recordStore: RecordStore;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  debugStore?: DebugStore;
}

export function createQueryRoutes(deps: QueryDeps) {
  const app = new Hono();

  // 최근 trace 목록 — :traceId 보다 먼저 매칭되어야 함
  app.get('/v1/traces/recent', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50');
    if (deps.traceStore.findRecent) {
      const traces = await deps.traceStore.findRecent(limit);
      return c.json({ items: traces.map(toTraceResponse), total: traces.length });
    }
    return c.json({ items: [], total: 0 });
  });

  // POST /v1/traces/bulk-records — 여러 trace의 records를 한 번에 조회 (N+1 해소)
  app.post('/v1/traces/bulk-records', async (c) => {
    const body = await c.req.json<{ traceIds: string[]; limit?: number }>();
    if (!body.traceIds || !Array.isArray(body.traceIds)) {
      return c.json({ error: 'traceIds array required' }, 400);
    }
    const limit = body.limit ?? 20;
    const traceIds = body.traceIds.slice(0, limit);

    const result: Record<string, unknown[]> = {};
    await Promise.all(
      traceIds.map(async (traceId) => {
        const records = await deps.recordStore.findByTraceId(traceId);
        result[traceId] = records.map(toEventRecord);
      }),
    );

    return c.json(result);
  });

  app.get('/v1/traces/:traceId', async (c) => {
    const traceId = c.req.param('traceId');
    const trace = await deps.traceStore.findById(traceId);

    if (!trace) {
      throw traceNotFound(traceId);
    }

    return c.json(toTraceResponse(trace));
  });

  app.get('/v1/traces/:traceId/records', async (c) => {
    const traceId = c.req.param('traceId');
    const pagination = parsePaginationQuery(c.req.query());
    const trace = await deps.traceStore.findById(traceId);

    if (!trace) {
      throw traceNotFound(traceId);
    }

    const page = await deps.recordStore.findByTraceIdPaginated(traceId, pagination);

    return c.json(toPaginatedRecordResponse(page));
  });

  app.get('/v1/traces/:traceId/graph', async (c) => {
    const traceId = c.req.param('traceId');
    const graph = await deps.graphStore.findByTraceId(traceId);

    if (!graph) {
      throw graphNotFound(traceId);
    }

    return c.json(toRuntimeGraphResponse(graph));
  });

  app.get('/v1/debug/traces/:traceId/recent', async (c) => {
    const traceId = c.req.param('traceId');
    const trace = await deps.traceStore.findById(traceId);

    if (!trace) {
      throw traceNotFound(traceId);
    }

    const records = await resolveDebugStore(deps).getRecentByTrace(
      traceId,
      parseRecentLimit(c.req.query()),
    );

    return c.json({
      items: records.map(toEventRecord),
    });
  });

  app.get('/v1/sessions/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const session = await deps.sessionStore.findById(sessionId);

    if (!session) {
      throw sessionNotFound(sessionId);
    }

    return c.json(toSessionResponse(session));
  });

  app.get('/v1/sessions/:sessionId/records', async (c) => {
    const sessionId = c.req.param('sessionId');
    const pagination = parsePaginationQuery(c.req.query());
    const session = await deps.sessionStore.findById(sessionId);

    if (!session) {
      throw sessionNotFound(sessionId);
    }

    const page = await deps.recordStore.findBySessionIdPaginated(sessionId, pagination);

    return c.json(toPaginatedRecordResponse(page));
  });

  app.get('/v1/debug/sessions/:sessionId/recent', async (c) => {
    const sessionId = c.req.param('sessionId');
    const session = await deps.sessionStore.findById(sessionId);

    if (!session) {
      throw sessionNotFound(sessionId);
    }

    const records = await resolveDebugStore(deps).getRecentBySession(
      sessionId,
      parseRecentLimit(c.req.query()),
    );

    return c.json({
      items: records.map(toEventRecord),
    });
  });

  return app;
}

function parsePaginationQuery(query: Record<string, string | undefined>) {
  const parsed = paginationQuerySchema.parse(query);

  return {
    cursor: parsed.cursor ? decodeCursor(parsed.cursor) : undefined,
    limit: normalizeLimit(parsed.limit),
  };
}

function normalizeLimit(limit?: number): number {
  return Math.min(limit ?? 50, 200);
}

function parseRecentLimit(query: Record<string, string | undefined>): number {
  const parsed = recentQuerySchema.parse(query);
  return normalizeLimit(parsed.limit);
}

function decodeCursor(cursor: string): RecordPaginationCursor {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = cursorSchema.parse(JSON.parse(decoded));

    return {
      timestamp: new Date(parsed.timestamp),
      logId: parsed.logId,
    };
  } catch {
    throw badRequest('cursor: invalid cursor');
  }
}

function encodeCursor(cursor: RecordPaginationCursor): string {
  return Buffer.from(
    JSON.stringify({
      timestamp: cursor.timestamp.toISOString(),
      logId: cursor.logId,
    }),
  ).toString('base64url');
}

function toTraceResponse(trace: StoredTrace) {
  return {
    traceId: trace.traceId,
    sessionId: trace.sessionId,
    serviceName: trace.serviceName,
    actorId: trace.actorId,
    userId: trace.userId,
    userAttributes: trace.userAttributes,
    recordCount: trace.recordCount,
    firstTimestamp: toNullableIsoString(trace.firstTimestamp),
    lastTimestamp: toNullableIsoString(trace.lastTimestamp),
    reconstructed: trace.reconstructed,
  };
}

function toSessionResponse(session: StoredSession) {
  return {
    sessionId: session.sessionId,
    scenarioId: session.scenarioId,
    labels: session.labels,
    actorId: session.actorId,
    userId: session.userId,
    userAttributes: session.userAttributes,
    startedAt: session.startedAt.toISOString(),
    closedAt: toNullableIsoString(session.closedAt),
  };
}

function toPaginatedRecordResponse(page: StoredRecordPage) {
  return {
    items: page.items.map(toEventRecord),
    next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    has_more: page.hasMore,
  };
}

function toRuntimeGraphResponse(graph: RuntimeGraph) {
  return {
    ...graph,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  };
}

function toEventRecord(record: StoredRecord): EventRecord {
  return {
    log_id: record.logId,
    timestamp: record.timestamp.toISOString(),
    record_kind: record.recordKind as EventRecord['record_kind'],
    trace_id: record.traceId,
    span_id: record.spanId,
    parent_span_id: record.parentSpanId,
    event_key: record.eventKey,
    event_version: record.eventVersion,
    span_name: record.spanName,
    start_time: record.startTime?.toISOString(),
    end_time: record.endTime?.toISOString(),
    status_code: record.statusCode as EventRecord['status_code'],
    payload_format: record.payloadFormat as EventRecord['payload_format'],
    payload_encoding: record.payloadEncoding as EventRecord['payload_encoding'],
    payload_masking_applied: record.payloadMaskingApplied,
    payload_masked_fields: record.payloadMaskedFields,
    payload: record.payload,
    qa_session_id: record.qaSessionId,
    _registry_warning: record.registryWarning,
    address_context: record.addressContext ?? undefined,
  };
}

function toNullableIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function resolveDebugStore(deps: QueryDeps): DebugStore {
  return deps.debugStore ?? createNoopDebugStore();
}
