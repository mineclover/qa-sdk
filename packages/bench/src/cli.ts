#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { DEMO_CATALOG } from "demo-snapshot";
import type { OwnerType } from "@qa-sdk/core";
import {
  HttpTransport,
  NoopTransport,
  toTransmissionBuild,
  toTransmissionSource,
  type ServiceBootConfig,
} from "@qa-sdk/sdk";
import { createBenchmarkQaContext } from "./context.js";
import { createQaLoggerBenchmarkHarness } from "./logger-harness.js";
import { renderBenchmarkReport } from "./report.js";
import { runBenchmark } from "./runner.js";
import {
  createCheckoutScenario,
  createLoginScenario,
  createSearchScenario,
} from "./scenario.js";
import type { BenchmarkScenario } from "./types.js";

const HELP = `
qa-bench — qa-bridge/QaLogger 기반 benchmark harness

Usage:
  qa-bench [options]

Options:
  --scenario <checkout|search|login>   기본: checkout
  --concurrency <n>                    기본: 1
  --iterations <n>                     기본: 10
  --warmup <n>                         기본: 2
  --transport <noop|http>              기본: noop
  --ingest-url <url>                   http transport일 때 필요
  --batch-size <n>                     기본: 8
  --flush-interval-ms <n>              기본: 0
  --owner-type <tenant|workspace|user|agent>  기본: workspace
  --owner-id <id>                      기본: qa-sdk-bench
  --namespace <name>                   기본: shop
  --service <name>                     기본: shopping-web
  --env <name>                         기본: dev
  --region <name>                      기본: asia
  --sdk-version <ver>                  기본: 0.1.0
  --format <text|markdown|json>        기본: text
  --report-out <path>                  report 파일 저장
  --json-out <path>                    summary JSON 저장
  --help
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      concurrency: { type: "string" },
      iterations: { type: "string" },
      warmup: { type: "string" },
      transport: { type: "string" },
      "ingest-url": { type: "string" },
      "batch-size": { type: "string" },
      "flush-interval-ms": { type: "string" },
      "owner-type": { type: "string" },
      "owner-id": { type: "string" },
      namespace: { type: "string" },
      service: { type: "string" },
      env: { type: "string" },
      region: { type: "string" },
      "sdk-version": { type: "string" },
      format: { type: "string" },
      "report-out": { type: "string" },
      "json-out": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP.trim());
    return;
  }

  const scenario = resolveScenario(values.scenario);
  const serviceConfig: ServiceBootConfig = {
    namespace: values.namespace ?? "shop",
    name: values.service ?? "shopping-web",
    env: values.env ?? "dev",
    region: values.region ?? "asia",
  };

  let infraContext: Record<string, string> | undefined;
  let benchmarkContext:
    | ReturnType<typeof createBenchmarkQaContext<typeof DEMO_CATALOG>>
    | undefined;
  try {
    benchmarkContext = createBenchmarkQaContext({
      catalog: DEMO_CATALOG,
      serviceConfig,
    });
    infraContext = benchmarkContext.infraContext();
  } catch {
    // fail-open: 벤치 자체는 계속 진행
  }

  const transportKind = values.transport ?? "noop";
  const summary = await runBenchmark({
    scenario: resolveScenario(values.scenario, benchmarkContext),
    concurrency: parseIntOption(values.concurrency, 1),
    warmupIterations: parseIntOption(values.warmup, 2),
    measuredIterations: parseIntOption(values.iterations, 10),
    harnessFactory: () =>
      createQaLoggerBenchmarkHarness({
        transport: resolveTransport(transportKind, values["ingest-url"]),
        owner: {
          owner_type: resolveOwnerType(values["owner-type"]),
          owner_id: values["owner-id"] ?? "qa-sdk-bench",
        },
        source: toTransmissionSource(
          serviceConfig,
          "@qa-sdk/bench",
          values["sdk-version"] ?? "0.1.0",
        ),
        runtime: {
          platform: "node",
          os_version: process.version,
        },
        build: toTransmissionBuild(serviceConfig),
        batchSize: parseIntOption(values["batch-size"], 8),
        flushIntervalMs: parseIntOption(values["flush-interval-ms"], 0),
        measureEnvelopeBytes: true,
        ...(infraContext ? { infraContext } : {}),
      }),
  });

  const metadata = {
    transport: transportKind,
    concurrency: summary.concurrency,
    warmupIterations: summary.warmupIterations,
    measuredIterations: summary.measuredIterations,
    batchSize: parseIntOption(values["batch-size"], 8),
    flushIntervalMs: parseIntOption(values["flush-interval-ms"], 0),
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
    ...(infraContext ? { serviceContext: infraContext.service } : {}),
    ...(values["ingest-url"] ? { ingestUrl: values["ingest-url"] } : {}),
  };

  const format = values.format ?? "text";
  if (format === "json") {
    const json = JSON.stringify(summary, null, 2);
    console.log(json);
    if (values["json-out"]) {
      await writeFile(values["json-out"], `${json}\n`, "utf8");
    }
    return;
  }

  const report = renderBenchmarkReport(summary, {
    format: format === "markdown" ? "markdown" : "text",
    title: "qa-bench Report",
    metadata,
  });

  console.log(report);

  if (values["report-out"]) {
    await writeFile(values["report-out"], `${report}\n`, "utf8");
  }
  if (values["json-out"]) {
    await writeFile(values["json-out"], `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }
}

function resolveTransport(kind: string, ingestUrl?: string) {
  if (kind === "noop") {
    return new NoopTransport();
  }
  if (kind === "http") {
    if (!ingestUrl) {
      throw new Error("--transport http requires --ingest-url");
    }
    return new HttpTransport({ endpoint: normalizeIngestUrl(ingestUrl) });
  }
  throw new Error(`Unsupported transport: ${kind}`);
}

function normalizeIngestUrl(ingestUrl: string): string {
  const normalized = ingestUrl.replace(/\/+$/, "");
  return normalized.endsWith("/v1/ingest") ? normalized : `${normalized}/v1/ingest`;
}

function resolveScenario(
  name: string | undefined,
  benchmarkContext?: ReturnType<typeof createBenchmarkQaContext<typeof DEMO_CATALOG>>,
): BenchmarkScenario {
  const options = benchmarkContext ? { qaContext: benchmarkContext } : undefined;
  switch (name ?? "checkout") {
    case "checkout":
      return createCheckoutScenario(options);
    case "search":
      return createSearchScenario(options);
    case "login":
      return createLoginScenario(options);
    default:
      throw new Error(`Unknown scenario: ${name}`);
  }
}

function parseIntOption(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveOwnerType(input: string | undefined): OwnerType {
  const value = input ?? "workspace";
  switch (value) {
    case "tenant":
    case "workspace":
    case "user":
    case "agent":
      return value;
    default:
      throw new Error(`Unsupported owner type: ${input}`);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-bench] ${message}`);
  process.exitCode = 1;
});
