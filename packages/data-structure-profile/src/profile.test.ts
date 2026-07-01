import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  assessDpmReadiness,
  compileLineage,
  measureProfile,
  parseProfileTaxonomy,
  parseProfile,
  toBenchReportInput,
  toQualityLedgerRunInputs,
  validateProfile,
} from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, "../../../docs/proposals/data-structure-profile/fixtures");
const taxonomyPath = join(__dirname, "../../../docs/taxonomies/data-structure-profile.yaml");

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function readJsonFixture<T>(name: string): T {
  return JSON.parse(readFixture(name)) as T;
}

describe("Data Structure Profile fixture compiler", () => {
  test("compiles the order-event fixture into deterministic artifacts", () => {
    const profile = parseProfile(readFixture("order-events.profile.yaml"));

    expect(validateProfile(profile)).toEqual(readJsonFixture("expected-validation-report.json"));
    expect(compileLineage(profile)).toEqual(readJsonFixture("expected-lineage.json"));
    expect(measureProfile(profile)).toEqual(readJsonFixture("expected-measurement-report.json"));
    expect(assessDpmReadiness(profile)).toEqual(readJsonFixture("expected-dpm-readiness.json"));
  });

  test("reports missing stream safety evidence with stable diagnostic codes", () => {
    const profile = parseProfile(readFixture("order-events.profile.yaml"));
    delete profile.source.event_id_path;
    delete profile.source.schema_ref;
    const explode = profile.transforms.find((transform) => transform.id === "explode-items");
    if (explode?.semantics) {
      delete explode.semantics.max_array_length;
    }

    const report = validateProfile(profile);

    expect(report.summary.errors).toBe(2);
    expect(report.summary.warnings).toBe(2);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "dsp-quality-dedup-key-missing",
      "dsp-quality-schema-ref-missing",
      "dsp-transform-unbounded-array",
      "dsp-privacy-dpm-ref-missing",
    ]);
  });

  test("resolves profile vocabulary references against the taxonomy draft", () => {
    const taxonomy = parseProfileTaxonomy(readFileSync(taxonomyPath, "utf8"));
    const profile = parseProfile(readFixture("order-events.profile.yaml"));

    expect(validateProfile(profile, { taxonomy }).diagnostics).toEqual([
      {
        code: "dsp-privacy-dpm-ref-missing",
        severity: "warning",
        target: "privacy.dpm_policy_ref",
        message: "Sensitive paths exist but no DPM policy reference is declared.",
      },
    ]);

    profile.source.kind = "rabbitmq";
    profile.structures[0]!.kind = "payload";
    profile.quality_gates[0]!.risk = "duplicates";

    const report = validateProfile(profile, { taxonomy });

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "dsp-taxonomy-ref-unknown",
    );
    expect(report.diagnostics.filter((diagnostic) => diagnostic.code === "dsp-taxonomy-ref-unknown")).toEqual([
      {
        code: "dsp-taxonomy-ref-unknown",
        severity: "error",
        target: "source.kind",
        message: 'Unknown data-source-kind "rabbitmq".',
      },
      {
        code: "dsp-taxonomy-ref-unknown",
        severity: "error",
        target: "structures.order-event.kind",
        message: 'Unknown structure-kind "payload".',
      },
      {
        code: "dsp-taxonomy-ref-unknown",
        severity: "error",
        target: "quality_gates.event-id-dedup-required.risk",
        message: 'Unknown quality-risk "duplicates".',
      },
    ]);
  });

  test("converts validation report into quality-ledger run inputs", () => {
    const profile = parseProfile(readFixture("order-events.profile.yaml"));
    const report = validateProfile(profile);

    const runs = toQualityLedgerRunInputs(report, {
      docVersion: profile.version,
      command: "data-structure-profile validate order-events-to-order-item-facts",
    });

    expect(runs).toEqual([
      {
        gateDocId: "data-structure-profile/order-events-to-order-item-facts/event-id-dedup-required",
        docVersion: 1,
        bundleId: "data-structure-profile/order-events-to-order-item-facts",
        command: "data-structure-profile validate order-events-to-order-item-facts",
        outcome: "pass",
        exitCode: 0,
        notes: "risk=dedup; severity=error; result=pass; evidence=$.event_id",
        successPattern: "event-id-dedup-required",
        successPatternMatched: true,
      },
      {
        gateDocId: "data-structure-profile/order-events-to-order-item-facts/replay-policy-required",
        docVersion: 1,
        bundleId: "data-structure-profile/order-events-to-order-item-facts",
        command: "data-structure-profile validate order-events-to-order-item-facts",
        outcome: "pass",
        exitCode: 0,
        notes: "risk=replay; severity=error; result=pass; evidence=source.replay_policy",
        successPattern: "replay-policy-required",
        successPatternMatched: true,
      },
      {
        gateDocId: "data-structure-profile/order-events-to-order-item-facts/schema-drift-watch",
        docVersion: 1,
        bundleId: "data-structure-profile/order-events-to-order-item-facts",
        command: "data-structure-profile validate order-events-to-order-item-facts",
        outcome: "pass",
        exitCode: 0,
        notes: "risk=schema-drift; severity=warning; result=pass; evidence=./order-event.schema.json",
        successPattern: "schema-drift-watch",
        successPatternMatched: true,
      },
      {
        gateDocId: "data-structure-profile/order-events-to-order-item-facts/array-explosion-budget",
        docVersion: 1,
        bundleId: "data-structure-profile/order-events-to-order-item-facts",
        command: "data-structure-profile validate order-events-to-order-item-facts",
        outcome: "pass",
        exitCode: 0,
        notes: "risk=array-explosion; severity=error; result=pass; evidence=max_array_length=200",
        successPattern: "array-explosion-budget",
        successPatternMatched: true,
      },
      {
        gateDocId: "data-structure-profile/order-events-to-order-item-facts/privacy-readiness",
        docVersion: 1,
        bundleId: "data-structure-profile/order-events-to-order-item-facts",
        command: "data-structure-profile validate order-events-to-order-item-facts",
        outcome: "pass",
        exitCode: 0,
        notes: "risk=pii-leak; severity=warning; result=warn; evidence=privacy.dpm_policy_ref",
        successPattern: "privacy-readiness",
        successPatternMatched: true,
      },
    ]);
  });

  test("converts measurement report into bench report input", () => {
    const profile = parseProfile(readFixture("order-events.profile.yaml"));
    const measurement = measureProfile(profile);

    const reportInput = toBenchReportInput(measurement, {
      startedAt: "2026-07-01T00:00:00.000Z",
      completedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(reportInput).toEqual({
      title: "Data Structure Profile Measurement",
      metadata: {
        profile: "order-events-to-order-item-facts",
        rowMultiplier: 5,
        estimatedFactRowsPerSec: 5000,
        estimatedOutputBytesPerSec: 1280000,
      },
      summary: {
        scenarioId: "data-structure-profile:order-events-to-order-item-facts:measurement-dry-run",
        scenarioName: "Data Structure Profile dry-run: order-events-to-order-item-facts",
        concurrency: 1,
        warmupIterations: 0,
        measuredIterations: 1,
        startedAt: "2026-07-01T00:00:00.000Z",
        completedAt: "2026-07-01T00:00:00.000Z",
        elapsedMs: 0,
        scenarioLatencyMs: { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 },
        scenarioRate: 5000,
        counters: {
          sessionsStarted: 0,
          eventsEmitted: 1000,
          metricsEmitted: 4,
          flushCalls: 0,
        },
        transport: {
          envelopesSent: 1000,
          recordsSent: 5000,
          failedSends: 0,
          bytesSent: 1280000,
          sendLatencyMs: { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 },
        },
      },
    });
  });
});
