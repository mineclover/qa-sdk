import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";
import {
  InMemoryDlqStore,
  InMemoryGraphStore,
  InMemoryScenarioSpecStore,
  InMemorySessionStore,
  InMemoryTraceStore,
  InMemoryVerdictStore,
} from "@qa-sdk/store";
import type { ScenarioSpec, VerdictInsert } from "@qa-sdk/core";
import { createErrorHandler } from "../middleware/error-handler.js";
import { createVerdictRoutes } from "./verdict.js";
import { reconstruct } from "@qa-sdk/engine";

const SCENARIO: ScenarioSpec = {
  scenario_id: "checkout-flow",
  version: "1.0.0",
  domain: "checkout",
  steps: [{ id: "s1", event_key: "page_view", required: true, kind: "sequence" }],
};

function buildDeps() {
  return {
    traceStore: new InMemoryTraceStore(),
    sessionStore: new InMemorySessionStore(),
    verdictStore: new InMemoryVerdictStore(),
    graphStore: new InMemoryGraphStore(),
    scenarioSpecStore: new InMemoryScenarioSpecStore(),
    dlqStore: new InMemoryDlqStore(),
  };
}

function buildApp(deps = buildDeps()) {
  const app = new Hono();
  app.onError(createErrorHandler(pino({ level: "silent" })));
  app.route("/", createVerdictRoutes(deps));
  return { app, deps };
}

async function seedVerdictContext(deps: ReturnType<typeof buildDeps>, traceId: string) {
  const sessionId = "qas_001";
  await deps.sessionStore.upsert({ sessionId, scenarioId: SCENARIO.scenario_id });
  await deps.traceStore.upsert({
    traceId,
    sessionId,
    recordCount: 1,
    firstTimestamp: new Date("2026-03-13T00:00:00.000Z"),
    lastTimestamp: new Date("2026-03-13T00:00:01.000Z"),
  });
  await deps.scenarioSpecStore.upsert(SCENARIO);
  const graph = reconstruct(traceId, [
    {
      log_id: `log_${traceId}`,
      timestamp: "2026-03-13T00:00:00.000Z",
      record_kind: "log",
      trace_id: traceId,
      span_id: `spn_${traceId}`,
      event_key: "page_view",
      event_version: "1",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: {},
    },
  ]);
  await deps.graphStore.upsert(traceId, graph);
}

async function insertVerdict(deps: ReturnType<typeof buildDeps>, traceId: string) {
  const verdictInsert: VerdictInsert = {
    id: "vrd_test",
    scenarioId: SCENARIO.scenario_id,
    traceId,
    qaSessionId: "qas_001",
    overallVerdict: "pass",
    report: { scenario_id: SCENARIO.scenario_id, trace_id: traceId, qa_session_id: "qas_001", overall_verdict: "pass", step_matches: [], missing_steps: [], unexpected_nodes: [], latency_violations: [], ordering_violations: [], summary: "all pass", computed_at: "2026-03-12T00:00:00.000Z" },
  };
  await deps.verdictStore.insert(verdictInsert);
}

describe("GET /v1/traces/:traceId/verdicts", () => {
  it("returns 404 when trace does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/traces/trc_missing/verdicts");
    expect(res.status).toBe(404);
  });

  it("returns 200 with empty items when trace has no verdicts", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 0,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/traces/trc_001/verdicts");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("returns stored verdicts for the trace", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });
    await insertVerdict(deps, "trc_001");

    const res = await app.request("/v1/traces/trc_001/verdicts");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].overallVerdict).toBe("pass");
    expect(body.items[0].computedAt).toBeDefined();
  });
});

describe("GET /v1/sessions/:sessionId/verdicts", () => {
  it("returns 404 when session does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/sessions/qas_missing/verdicts");
    expect(res.status).toBe(404);
  });

  it("returns verdicts for the session", async () => {
    const { app, deps } = buildApp();
    await deps.sessionStore.upsert({ sessionId: "qas_001" });
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });
    await insertVerdict(deps, "trc_001");

    const res = await app.request("/v1/sessions/qas_001/verdicts");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /v1/traces/:traceId/verdicts/recompute", () => {
  it("returns 404 when trace does not exist", async () => {
    const { app } = buildApp();
    const res = await app.request("/v1/traces/trc_missing/verdicts/recompute", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 200 with computed results after recomputation", async () => {
    const { app, deps } = buildApp();
    await seedVerdictContext(deps, "trc_001");

    const res = await app.request("/v1/traces/trc_001/verdicts/recompute", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.computed).toBeDefined();
    expect(body.skipped).toBeDefined();
    expect(body.failed).toBeDefined();
  });

  it("returns 200 with skipped when trace has no session", async () => {
    const { app, deps } = buildApp();
    await deps.traceStore.upsert({
      traceId: "trc_001",
      recordCount: 1,
      firstTimestamp: new Date(),
      lastTimestamp: new Date(),
    });

    const res = await app.request("/v1/traces/trc_001/verdicts/recompute", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toContain("trc_001");
  });

  it("force-recomputes even when verdict already exists", async () => {
    const { app, deps } = buildApp();
    await seedVerdictContext(deps, "trc_001");
    await insertVerdict(deps, "trc_001");

    const res = await app.request("/v1/traces/trc_001/verdicts/recompute", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.computed).toHaveLength(1);
  });

  it("recomputed verdict contains path_observation with reached_nodes", async () => {
    const { app, deps } = buildApp();
    await seedVerdictContext(deps, "trc_001");

    await app.request("/v1/traces/trc_001/verdicts/recompute", { method: "POST" });

    const res = await app.request("/v1/traces/trc_001/verdicts");
    const body = await res.json();
    const report = body.items[0].report;

    expect(report.path_observation).toBeDefined();
    expect(report.path_observation.reached_nodes).toBeInstanceOf(Array);
    expect(report.path_observation.loop_detected).toBe(false);
    // page_view가 terminal (outgoing edge 없음) → goal reached
    expect(report.path_observation.reached_goals).toContain("s1");
    expect(report.path_observation.terminal_reason).toBe("goal_reached");
  });
});
