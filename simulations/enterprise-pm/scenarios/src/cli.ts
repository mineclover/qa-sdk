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
import type { Scenario, ScenarioResult } from "./runner/types.js";
import {
  fetchGraphRetention,
  summarizeGraphRetention,
} from "./post-run/graph-retention.js";
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
];

export function buildCli(): Command {
  const cmd = new Command();
  cmd.name("sim-scenarios").description("qa-sdk 시뮬 시나리오 runner");

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
            const mark = r.status === "passed" ? "OK" : "XX";
            process.stdout.write(
              `[${mark}] ${r.name} — ${r.status} (${r.durationMs}ms, ${r.stepCount} step)\n`,
            );
            if (r.error) {
              process.stdout.write(
                `  → ${r.error.phase} 실패: ${r.error.message}\n`,
              );
            }
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
    .option("--keep-latest <n>", "graph별 최신 snapshot 보존 개수", "1")
    .option("--graph-id <id>", "단일 graphId만 prune", "")
    .option("--json", "JSON 출력", false)
    .action(
      async (opts: {
        auditUrl: string;
        keepLatest: string;
        graphId: string;
        json: boolean;
      }) => {
        const env = parseScenarioEnv({
          ...process.env,
          SCENARIO_AUDIT_URL: opts.auditUrl,
        });
        const keepLatest = Number.parseInt(opts.keepLatest, 10);
        if (!Number.isFinite(keepLatest) || keepLatest < 0) {
          throw new Error(`invalid --keep-latest: ${opts.keepLatest}`);
        }

        const result = await fetchGraphRetention(env.SCENARIO_AUDIT_URL, {
          keepLatest,
          graphId: opts.graphId || undefined,
        });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          process.stdout.write(summarizeGraphRetention(result) + "\n");
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
