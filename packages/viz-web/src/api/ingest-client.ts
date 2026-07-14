// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { ScenarioSpec, RuntimeGraph, StoredRecord, VerdictReport } from '@qa-sdk/core';
import { INGEST_SERVER_URL } from '../config';

// ── Runtime shape validation ──────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function assertString(obj: Record<string, unknown>, field: string, context: string): void {
  if (typeof obj[field] !== 'string') {
    throw new Error(
      `[ingest-client:${context}] expected string field "${field}", got ${JSON.stringify(obj[field])}`,
    );
  }
}

function assertArray(obj: Record<string, unknown>, field: string, context: string): unknown[] {
  if (!Array.isArray(obj[field])) {
    throw new Error(
      `[ingest-client:${context}] expected array field "${field}", got ${JSON.stringify(obj[field])}`,
    );
  }
  return obj[field] as unknown[];
}

function validateCreatedSession(data: unknown): CreatedSession {
  if (!isObject(data)) throw new Error('[ingest-client:createSession] response is not an object');
  assertString(data, 'sessionId', 'createSession');
  assertString(data, 'startedAt', 'createSession');
  return data as unknown as CreatedSession;
}

function validateSessionItems(data: unknown): { items: SessionEntry[] } {
  if (!isObject(data)) throw new Error('[ingest-client:listSessions] response is not an object');
  const items = assertArray(data, 'items', 'listSessions');
  for (const item of items) {
    if (!isObject(item)) throw new Error('[ingest-client:listSessions] item is not an object');
    assertString(item, 'sessionId', 'listSessions.item');
    assertString(item, 'startedAt', 'listSessions.item');
  }
  return data as unknown as { items: SessionEntry[] };
}

function validateScenarioItems(data: unknown): ScenarioSpec[] {
  if (!isObject(data)) throw new Error('[ingest-client:listScenarios] response is not an object');
  const items = assertArray(data, 'items', 'listScenarios');
  for (const item of items) {
    if (!isObject(item)) throw new Error('[ingest-client:listScenarios] item is not an object');
    assertString(item, 'scenario_id', 'listScenarios.item');
    if (!Array.isArray(item['steps'])) {
      throw new Error('[ingest-client:listScenarios] item.steps is not an array');
    }
  }
  return items as unknown as ScenarioSpec[];
}

function validateVerdictItems(data: unknown): VerdictReport[] {
  if (!isObject(data)) throw new Error('[ingest-client:verdicts] response is not an object');
  const items = assertArray(data, 'items', 'verdicts');
  return items.map((item, i) => {
    if (!isObject(item)) throw new Error(`[ingest-client:verdicts] items[${i}] is not an object`);
    if (!isObject(item['report'])) {
      throw new Error(`[ingest-client:verdicts] items[${i}].report is not an object`);
    }
    const report = item['report'];
    assertString(report, 'overall_verdict', `verdicts.items[${i}].report`);
    if (!Array.isArray(report['step_matches'])) {
      throw new Error(`[ingest-client:verdicts] items[${i}].report.step_matches is not an array`);
    }
    return report as unknown as VerdictReport;
  });
}

// ── HTTP helper ───────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${INGEST_SERVER_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Exported interfaces ───────────────────────────────────────

export interface CreatedSession {
  sessionId: string;
  scenarioId: string | null;
  startedAt: string;
}

export interface SessionEntry {
  sessionId: string;
  scenarioId: string | null;
  labels: Record<string, string> | null;
  actorId: string | null;
  userId: string | null;
  userAttributes: Record<string, string> | null;
  startedAt: string;
  closedAt: string | null;
}

// ── API functions ─────────────────────────────────────────────

export async function createSession(scenarioId?: string): Promise<CreatedSession> {
  const data = await request<unknown>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({ scenarioId }),
  });
  return validateCreatedSession(data);
}

export async function listSessions(scenarioId: string): Promise<{ items: SessionEntry[] }> {
  const data = await request<unknown>(`/v1/sessions?scenarioId=${encodeURIComponent(scenarioId)}`);
  return validateSessionItems(data);
}

export async function listScenarios(domain?: string): Promise<ScenarioSpec[]> {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  const qs = params.toString();
  const data = await request<unknown>(`/v1/scenarios${qs ? `?${qs}` : ''}`);
  return validateScenarioItems(data);
}

export function getScenario(scenarioId: string): Promise<ScenarioSpec> {
  return request<ScenarioSpec>(`/v1/scenarios/${encodeURIComponent(scenarioId)}`);
}

export function createScenario(
  spec: ScenarioSpec,
): Promise<{ accepted: boolean; scenario_id: string }> {
  return request<{ accepted: boolean; scenario_id: string }>('/v1/scenarios', {
    method: 'POST',
    body: JSON.stringify(spec),
  });
}

export interface TraceMetadata {
  traceId: string;
  sessionId: string | null;
  serviceName: string | null;
  actorId: string | null;
  userId: string | null;
  userAttributes: Record<string, string> | null;
  recordCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  reconstructed: boolean;
}

export function getTrace(traceId: string): Promise<TraceMetadata> {
  return request<TraceMetadata>(`/v1/traces/${encodeURIComponent(traceId)}`);
}

export interface TraceRecordsPage {
  items: StoredRecord[];
  next_cursor: string | null;
  has_more: boolean;
}

// API returns EventRecord (snake_case) — convert to StoredRecord (camelCase)
function toStoredRecord(r: Record<string, unknown>): StoredRecord {
  return {
    logId: r['log_id'] as string,
    traceId: r['trace_id'] as string,
    spanId: r['span_id'] as string,
    parentSpanId: r['parent_span_id'] as string | undefined,
    timestamp: new Date(r['timestamp'] as string),
    recordKind: r['record_kind'] as string,
    eventKey: r['event_key'] as string,
    eventVersion: r['event_version'] as string,
    spanName: r['span_name'] as string | undefined,
    startTime: r['start_time'] ? new Date(r['start_time'] as string) : undefined,
    endTime: r['end_time'] ? new Date(r['end_time'] as string) : undefined,
    statusCode: r['status_code'] as string | undefined,
    payloadFormat: r['payload_format'] as string,
    payloadEncoding: r['payload_encoding'] as string,
    payloadMaskingApplied: r['payload_masking_applied'] as boolean,
    payloadMaskedFields: r['payload_masked_fields'] as string[],
    payload: r['payload'],
    qaSessionId: r['qa_session_id'] as string | undefined,
    registryWarning: r['_registry_warning'] as string | undefined,
    createdAt: new Date(r['timestamp'] as string),
  };
}

const MAX_FETCH_RECORDS = 1_000;

export async function getSessionRecords(sessionId: string): Promise<StoredRecord[]> {
  const all: StoredRecord[] = [];
  let cursor: string | undefined;

  do {
    const qs = new URLSearchParams({ limit: '200' });
    if (cursor) qs.set('cursor', cursor);
    const data = await request<unknown>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/records?${qs}`,
    );
    if (!isObject(data))
      throw new Error('[ingest-client:getSessionRecords] response is not an object');
    const items = assertArray(data, 'items', 'getSessionRecords');
    for (const item of items) {
      if (isObject(item)) all.push(toStoredRecord(item));
    }
    cursor = typeof data['next_cursor'] === 'string' ? data['next_cursor'] : undefined;
  } while (cursor && all.length < MAX_FETCH_RECORDS);

  return all;
}

export function getTraceRecords(
  traceId: string,
  cursor?: string,
  limit?: number,
): Promise<TraceRecordsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit !== undefined) params.set('limit', String(limit));
  const qs = params.toString();
  return request<TraceRecordsPage>(
    `/v1/traces/${encodeURIComponent(traceId)}/records${qs ? `?${qs}` : ''}`,
  );
}

export function getTraceGraph(traceId: string): Promise<RuntimeGraph> {
  return request<RuntimeGraph>(`/v1/traces/${encodeURIComponent(traceId)}/graph`);
}

export interface VerdictList {
  verdicts: VerdictReport[];
}

export async function getTraceVerdicts(traceId: string): Promise<VerdictList> {
  const data = await request<unknown>(`/v1/traces/${encodeURIComponent(traceId)}/verdicts`);
  return { verdicts: validateVerdictItems(data) };
}

export async function getSessionVerdicts(sessionId: string): Promise<VerdictList> {
  const data = await request<unknown>(`/v1/sessions/${encodeURIComponent(sessionId)}/verdicts`);
  return { verdicts: validateVerdictItems(data) };
}

export function recomputeVerdicts(traceId: string): Promise<{
  computed: Array<{ traceId: string; scenarioId: string }>;
  skipped: string[];
  failed: string[];
}> {
  return request<{
    computed: Array<{ traceId: string; scenarioId: string }>;
    skipped: string[];
    failed: string[];
  }>(`/v1/traces/${encodeURIComponent(traceId)}/verdicts/recompute`, { method: 'POST' });
}
