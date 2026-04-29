// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { Command } from "commander";
import { runScenario } from "./runner/runner.js";
import { parseScenarioEnv } from "./env/env.js";
import { scenario1Login } from "./scenarios/scenario-1-login.js";
import { scenario2ProjectCreate } from "./scenarios/scenario-2-project-create.js";
import { scenario3SelfDeptApproval } from "./scenarios/scenario-3-self-dept-approval.js";
import { scenario4CrossDeptDeny } from "./scenarios/scenario-4-cross-dept-deny.js";
import { scenario5ThreeStageApproval } from "./scenarios/scenario-5-three-stage-approval.js";
import { scenario6DelegatedResource } from "./scenarios/scenario-6-delegated-resource.js";
import { scenario7BitmapRefresh } from "./scenarios/scenario-7-bitmap-refresh.js";
import { scenario8PubsubInvalidation } from "./scenarios/scenario-8-pubsub-invalidation.js";
import { scenario9CanaryHappyPromote } from "./scenarios/scenario-9-canary-happy-promote.js";
import { scenario10CanaryRollbackCompatibility } from "./scenarios/scenario-10-canary-rollback-compatibility.js";
import { scenario11CanaryRollbackAuditSpike } from "./scenarios/scenario-11-canary-rollback-audit-spike.js";
import { scenario12ScaleUpLoadPressure } from "./scenarios/scenario-12-scale-up-load-pressure.js";
import { scenario13ScaleBlockedByDbPool } from "./scenarios/scenario-13-scale-blocked-by-db-pool.js";
import { scenario14ReadReplicaLagFallback } from "./scenarios/scenario-14-read-replica-lag-fallback.js";
import { scenario15OutboxMultiDispatcherLock } from "./scenarios/scenario-15-outbox-multi-dispatcher-lock.js";
import { scenario16BitmapCacheVersionFallback } from "./scenarios/scenario-16-bitmap-cache-version-fallback.js";
import { scenario17PassPriorityCanaryBlocksScale } from "./scenarios/scenario-17-pass-priority-canary-blocks-scale.js";
import type { Scenario, ScenarioResult } from "./runner/types.js";
import {
  fetchAuditEntryView,
  fetchAuditFirstFailureView,
  fetchAuditTraceView,
  summarizeAuditEntryView,
  summarizeAuditFirstFailureView,
  summarizeAuditTraceView,
} from "./post-run/audit-trace.js";
import {
  fetchAuditContextComposite,
  summarizeAuditContextComposite,
} from "./post-run/audit-context.js";
import {
  fetchGraphRetention,
  summarizeGraphRetention,
} from "./post-run/graph-retention.js";
import {
  fetchGraphRetentionInsight,
  summarizeGraphRetentionInsight,
} from "./post-run/graph-retention-insight.js";
import {
  fetchDensity,
  summarizeDensity,
} from "./post-run/density-collector.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  scenario3SelfDeptApproval,
  scenario4CrossDeptDeny,
  scenario5ThreeStageApproval,
  scenario6DelegatedResource,
  scenario7BitmapRefresh,
  scenario8PubsubInvalidation,
  scenario9CanaryHappyPromote,
  scenario10CanaryRollbackCompatibility,
  scenario11CanaryRollbackAuditSpike,
  scenario12ScaleUpLoadPressure,
  scenario13ScaleBlockedByDbPool,
  scenario14ReadReplicaLagFallback,
  scenario15OutboxMultiDispatcherLock,
  scenario16BitmapCacheVersionFallback,
  scenario17PassPriorityCanaryBlocksScale,
];

function summarizeTraceIds(traceIds: string[]): string {
  if (traceIds.length === 0) {
    return "0";
  }
  const preview = traceIds.slice(0, 3).join(", ");
  const more = traceIds.length > 3 ? `, +${traceIds.length - 3} more` : "";
  return `${traceIds.length} (${preview}${more})`;
}

export function formatScenarioResult(result: ScenarioResult): string {
  const mark = result.status === "passed" ? "OK" : "XX";
  const lines = [
    `[${mark}] ${result.name}`,
    `  summary: ${result.status}, ${result.durationMs}ms, ${result.stepCount} step`,
    `  traces: ${summarizeTraceIds(result.traceIds)}`,
  ];

  if (result.operatorHints?.length) {
    for (const [index, hint] of result.operatorHints.entries()) {
      lines.push(`  operator.${index + 1}: ${hint}`);
    }
  }

  if (result.error) {
    lines.push(`  error.${result.error.phase}: ${result.error.message}`);
  }

  return lines.join("\n");
}

export function buildCli(): Command {
  const cmd = new Command();
  cmd.name("sim-scenarios").description("qa-sdk 시뮬 시나리오 runner");
  const auditCmd = cmd.command("audit").description("audit/graph composite 조회");

  cmd
    .command("run [name]")
    .description("시나리오 1개 또는 --all 실행")
    .option("--all", "모든 등록된 시나리오 실행", false)
    .option("--mode <mode>", "in-process | http", "in-process")
    .option("--gateway-url <url>", "gateway base URL", "http://localhost:8888")
    .option("--json", "결과를 JSON으로 출력", false)
    .action(
      async (
        name: string | undefined,
        opts: {
          all: boolean;
          mode: string;
          gatewayUrl: string;
          json: boolean;
        },
      ) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_MODE: opts.mode,
          SCENARIO_GATEWAY_URL: opts.gatewayUrl,
        });
        const targets = opts.all
          ? ALL_SCENARIOS
          : ALL_SCENARIOS.filter((s) => s.name === name);
        if (targets.length === 0) {
          process.stderr.write(`unknown scenario: ${name}\n`);
          process.stderr.write(
            `available: ${ALL_SCENARIOS.map((s) => s.name).join(", ")}\n`,
          );
          process.exitCode = 2;
          return;
        }

        const results: ScenarioResult[] = [];
        for (const s of targets) {
          const result = await runScenario(s, {
            gatewayUrl: env.SCENARIO_GATEWAY_URL,
            mode: env.SCENARIO_MODE,
          });
          results.push(result);
        }

        if (opts.json) {
          process.stdout.write(JSON.stringify(results, null, 2) + "\n");
        } else {
          for (const r of results) {
            process.stdout.write(formatScenarioResult(r) + "\n");
          }
        }

        const failed = results.filter((r) => r.status === "failed").length;
        process.exitCode = failed === 0 ? 0 : 1;
      },
    );

  cmd
    .command("list")
    .description("등록된 시나리오 목록 출력")
    .action(() => {
      for (const s of ALL_SCENARIOS) {
        process.stdout.write(`${s.name} — ${s.description}\n`);
        for (const v of s.validates) process.stdout.write(`  · ${v}\n`);
      }
    });

  cmd
    .command("density")
    .description("§5 marginal density 측정 — sim-reporting-api 호출")
    .option("--catalog <id>", "catalog ID", "sim")
    .option("--prefix <id>", "prefix ID (예: sim.bitmap)", "sim.bitmap")
    .option("--version <v>", "prefix version", "uv1")
    .option(
      "--reporting-url <url>",
      "sim-reporting-api base URL",
      "http://localhost:4800",
    )
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        catalog: string;
        prefix: string;
        version: string;
        reportingUrl: string;
        json: boolean;
      }) => {
        const result = await fetchDensity(opts.reportingUrl, {
          catalog: opts.catalog,
          prefix: opts.prefix,
          version: opts.version,
        });
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeDensity(result) + "\n");
        }
      },
    );

  auditCmd
    .command("trace")
    .description("audit trace 조회")
    .requiredOption("--root-span-id <id>", "audit rootSpanId")
    .option(
      "--audit-url <url>",
      "sim-audit-browser-api base URL",
      "http://localhost:5100",
    )
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        rootSpanId: string;
        auditUrl: string;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
        });
        const result = await fetchAuditTraceView(
          env.SCENARIO_AUDIT_URL,
          opts.rootSpanId,
        );
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeAuditTraceView(result) + "\n");
        }
      },
    );

  auditCmd
    .command("first-failure")
    .description("audit firstFailure 조회")
    .requiredOption("--root-span-id <id>", "audit rootSpanId")
    .option(
      "--audit-url <url>",
      "sim-audit-browser-api base URL",
      "http://localhost:5100",
    )
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        rootSpanId: string;
        auditUrl: string;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
        });
        const result = await fetchAuditFirstFailureView(
          env.SCENARIO_AUDIT_URL,
          opts.rootSpanId,
        );
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeAuditFirstFailureView(result) + "\n");
        }
      },
    );

  auditCmd
    .command("entry")
    .description("audit entry 조회")
    .requiredOption("--span-id <id>", "audit spanId")
    .option(
      "--audit-url <url>",
      "sim-audit-browser-api base URL",
      "http://localhost:5100",
    )
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        spanId: string;
        auditUrl: string;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
        });
        const result = await fetchAuditEntryView(
          env.SCENARIO_AUDIT_URL,
          opts.spanId,
        );
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeAuditEntryView(result) + "\n");
        }
      },
    );

  auditCmd
    .command("context")
    .description("trace + graph + retention insight composite view")
    .requiredOption("--root-span-id <id>", "audit rootSpanId")
    .requiredOption("--graph-id <id>", "delegated graphId")
    .option(
      "--audit-url <url>",
      "sim-audit-browser-api base URL",
      "http://localhost:5100",
    )
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        rootSpanId: string;
        graphId: string;
        auditUrl: string;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
        });
        const result = await fetchAuditContextComposite(
          env.SCENARIO_AUDIT_URL,
          opts.rootSpanId,
          opts.graphId,
        );
        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeAuditContextComposite(result) + "\n");
        }
      },
    );

  cmd
    .command("housekeeping")
    .description("운영 housekeeping 작업 실행")
    .command("graph-retention")
    .description("authorization graph snapshot retention sweep")
    .option(
      "--audit-url <url>",
      "sim-audit-browser-api base URL",
      "http://localhost:5100",
    )
    .option(
      "--ingest-url <url>",
      "ingest-server base URL",
      "http://localhost:3200",
    )
    .option("--keep-latest <n>", "graph별 최신 snapshot 보존 개수", "1")
    .option("--graph-id <id>", "단일 graphId만 prune", "")
    .option("--with-insight", "prune 후 ingest insight까지 이어서 조회", false)
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        auditUrl: string;
        ingestUrl: string;
        keepLatest: string;
        graphId: string;
        withInsight: boolean;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
          SCENARIO_INGEST_URL: opts.ingestUrl,
        });
        const keepLatest = Number.parseInt(opts.keepLatest, 10);
        if (!Number.isFinite(keepLatest) || keepLatest < 0) {
          throw new Error(`invalid --keep-latest: ${opts.keepLatest}`);
        }

        const result = await fetchGraphRetention(env.SCENARIO_AUDIT_URL, {
          keepLatest,
          graphId: opts.graphId || undefined,
        });

        const insight = opts.withInsight
          ? await fetchGraphRetentionInsight(env.SCENARIO_INGEST_URL, {
              graphId: opts.graphId || undefined,
              limit: 20,
            })
          : null;

        if (opts.json) {
          process.stdout.write(
            JSON.stringify(
              insight ? { retention: result, insight } : result,
              null,
              2,
            ) + "\n",
          );
        } else {
          process.stdout.write(summarizeGraphRetention(result) + "\n");
          if (insight) {
            process.stdout.write(summarizeGraphRetentionInsight(insight) + "\n");
          }
        }
      },
    );

  return cmd;
}

// shebang 으로 실행 (tsup banner 가 주입).
if (import.meta.url === `file://${process.argv[1]}`) {
  buildCli()
    .parseAsync(process.argv)
    .catch((err) => {
      process.stderr.write(`scenarios CLI error: ${(err as Error).message}\n`);
      process.exit(1);
    });
}
