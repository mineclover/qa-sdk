// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

import { Command } from "commander";
import { runScenario } from "./runner/runner.js";
import { parseScenarioEnv } from "./env/env.js";
import { scenario1Login } from "./scenarios/scenario-1-login.js";
import { scenario2ProjectCreate } from "./scenarios/scenario-2-project-create.js";
import type { Scenario, ScenarioResult } from "./runner/types.js";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenario1Login,
  scenario2ProjectCreate,
  // Plan 13b/c/d 가 추가
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
