import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { VerdictInsert, VerdictReport } from "@qa-sdk/core";
import { DrizzleVerdictStore } from "../../index.js";
import { verdictReports } from "../../db/schema.js";
import type { Db } from "../../db/client.js";
import {
  cleanupDb,
  closeTestDb,
  createTestDb,
  hasTestDatabaseUrl,
} from "./test-db.js";
import { seedTrace } from "./test-fixtures.js";

function buildReport(overrides: Partial<VerdictReport> = {}): VerdictReport {
  return {
    scenario_id: "scenario_signup",
    trace_id: "trace_1",
    qa_session_id: "session_1",
    overall_verdict: "pass",
    step_matches: [
      {
        step_id: "step_1",
        matched_node_id: "node_1",
        verdict: "pass",
        constraint_results: [],
      },
    ],
    missing_steps: [],
    unexpected_nodes: [],
    ordering_violations: [],
    latency_violations: [],
    summary: "Scenario matched successfully.",
    computed_at: "2026-03-12T01:00:00.000Z",
    ...overrides,
  };
}

function buildVerdict(overrides: Partial<VerdictInsert> = {}): VerdictInsert {
  return {
    id: "verdict_1",
    scenarioId: "scenario_signup",
    traceId: "trace_1",
    qaSessionId: "session_1",
    overallVerdict: "pass",
    report: buildReport(),
    ...overrides,
  };
}

const describeIfDatabase = hasTestDatabaseUrl ? describe : describe.skip;

describeIfDatabase("DrizzleVerdictStore", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });

  beforeEach(async () => {
    await cleanupDb();
  });

  afterEach(async () => {
    await cleanupDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("inserts verdicts and queries them by scenario/trace and session", async () => {
    await seedTrace(db, { traceId: "trace_1" });
    await seedTrace(db, { traceId: "trace_2" });

    const store = new DrizzleVerdictStore(db);
    const verdict = buildVerdict();
    const otherVerdict = buildVerdict({
      id: "verdict_2",
      scenarioId: "scenario_checkout",
      traceId: "trace_2",
      qaSessionId: "session_1",
      report: buildReport({
        scenario_id: "scenario_checkout",
        trace_id: "trace_2",
      }),
    });

    await store.insert(verdict);
    await store.insert(otherVerdict);

    await expect(
      store.findByScenarioAndTrace("scenario_signup", "trace_1"),
    ).resolves.toEqual({
      ...verdict,
      computedAt: expect.any(Date),
    });

    const sessionVerdicts = await store.findBySessionId("session_1");
    expect(sessionVerdicts).toHaveLength(2);
    expect(sessionVerdicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "verdict_1",
          scenarioId: "scenario_signup",
          traceId: "trace_1",
        }),
        expect.objectContaining({
          id: "verdict_2",
          scenarioId: "scenario_checkout",
          traceId: "trace_2",
        }),
      ]),
    );
  });

  it("enforces the unique scenario and trace pair constraint", async () => {
    await seedTrace(db, { traceId: "trace_1" });

    const store = new DrizzleVerdictStore(db);
    await store.insert(buildVerdict());

    await expect(
      store.insert(
        buildVerdict({
          id: "verdict_2",
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    expect(await db.select().from(verdictReports)).toHaveLength(1);
  });
});
