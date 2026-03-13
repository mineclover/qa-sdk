import type {
  ScenarioSpec,
  RuntimeGraph,
  StoredRecord,
  VerdictReport,
} from "@qa-sdk/core";
import { INGEST_SERVER_URL } from "../config";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${INGEST_SERVER_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface CreatedSession {
  sessionId: string;
  scenarioId: string | null;
  startedAt: string;
}

export interface SessionEntry {
  sessionId: string;
  scenarioId: string | null;
  labels: Record<string, string> | null;
  startedAt: string;
  closedAt: string | null;
}

export function createSession(scenarioId?: string): Promise<CreatedSession> {
  return request<CreatedSession>("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ scenarioId }),
  });
}

export function listSessions(scenarioId: string): Promise<{ items: SessionEntry[] }> {
  return request<{ items: SessionEntry[] }>(
    `/v1/sessions?scenarioId=${encodeURIComponent(scenarioId)}`,
  );
}

export function listScenarios(domain?: string): Promise<ScenarioSpec[]> {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  const qs = params.toString();
  return request<{ items: ScenarioSpec[] }>(`/v1/scenarios${qs ? `?${qs}` : ""}`)
    .then((res) => res.items);
}

export function getScenario(scenarioId: string): Promise<ScenarioSpec> {
  return request<ScenarioSpec>(`/v1/scenarios/${encodeURIComponent(scenarioId)}`);
}

export function createScenario(
  spec: ScenarioSpec,
): Promise<{ accepted: boolean; scenario_id: string }> {
  return request<{ accepted: boolean; scenario_id: string }>("/v1/scenarios", {
    method: "POST",
    body: JSON.stringify(spec),
  });
}

export interface TraceMetadata {
  trace_id: string;
  service_name?: string;
  started_at?: string;
  record_count?: number;
}

export function getTrace(traceId: string): Promise<TraceMetadata> {
  return request<TraceMetadata>(`/v1/traces/${encodeURIComponent(traceId)}`);
}

export interface TraceRecordsPage {
  items: StoredRecord[];
  nextCursor: { timestamp: string; logId: string } | null;
  hasMore: boolean;
}

export function getTraceRecords(
  traceId: string,
  cursor?: string,
  limit?: number,
): Promise<TraceRecordsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit !== undefined) params.set("limit", String(limit));
  const qs = params.toString();
  return request<TraceRecordsPage>(
    `/v1/traces/${encodeURIComponent(traceId)}/records${qs ? `?${qs}` : ""}`,
  );
}

export function getTraceGraph(traceId: string): Promise<RuntimeGraph> {
  return request<RuntimeGraph>(`/v1/traces/${encodeURIComponent(traceId)}/graph`);
}

export interface VerdictList {
  verdicts: VerdictReport[];
}

export function getTraceVerdicts(traceId: string): Promise<VerdictList> {
  return request<{ items: VerdictReport[] }>(`/v1/traces/${encodeURIComponent(traceId)}/verdicts`)
    .then((res) => ({ verdicts: res.items }));
}

export function getSessionVerdicts(sessionId: string): Promise<VerdictList> {
  return request<{ items: VerdictReport[] }>(`/v1/sessions/${encodeURIComponent(sessionId)}/verdicts`)
    .then((res) => ({ verdicts: res.items }));
}

export function recomputeVerdicts(
  traceId: string,
): Promise<{ recomputed: boolean }> {
  return request<{ recomputed: boolean }>(
    `/v1/traces/${encodeURIComponent(traceId)}/verdicts/recompute`,
    { method: "POST" },
  );
}
