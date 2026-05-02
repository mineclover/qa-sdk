// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { PROFILE_DIR } from "./context.js";

/** history 명령 — 배포 이력 조회 */
export const historyHandler: CommandHandler = async (ctx) => {
  const service = ctx.args.service;
  if (!service) {
    if (!ctx.options.fleet) {
      console.error("사용: infra history <service> [--json] 또는 infra history --fleet [--env <env>] [--json]");
      process.exit(1);
    }
  }

  const isJson = !!ctx.options.json;
  const isFleet = !!ctx.options.fleet;
  const envFilter = typeof ctx.options.env === "string" ? ctx.options.env : undefined;
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);

  if (isFleet) {
    const allHistory = await infraProfile.getAllHistory();
    const fleetHistory = Object.entries(allHistory)
      .flatMap(([historyKey, entries]) =>
        entries
          .filter((entry) => entry.mode === "fleet-summary")
          .filter((entry) => !envFilter || entry.env === envFilter)
          .map((entry) => ({ historyKey, ...entry })),
      )
      .sort((left, right) => new Date(right.deployedAt).getTime() - new Date(left.deployedAt).getTime());

    if (isJson) {
      console.log(JSON.stringify(fleetHistory, null, 2));
      return;
    }

    if (fleetHistory.length === 0) {
      console.log(`\nfleet: 배포 이력 없음${envFilter ? ` (env=${envFilter})` : ""}`);
      return;
    }

    console.log(`\n=== Fleet 배포 이력 (${fleetHistory.length}건)${envFilter ? ` env=${envFilter}` : ""} ===\n`);
    for (const h of fleetHistory) {
      const icon = h.success ? "[OK]" : "[FAIL]";
      const details = [
        `env=${h.env}`,
        `provider=${h.provider}`,
        `${h.duration}ms`,
        h.mode ? `mode=${h.mode}` : undefined,
        h.runId ? `run=${h.runId}` : undefined,
        h.scope ? `scope=${h.scope}` : undefined,
        h.historyKey ? `key=${h.historyKey}` : undefined,
        h.artifactId ? `artifact=${h.artifactId}` : undefined,
        h.error ? `error=${h.error}` : undefined,
      ].filter(Boolean).join("  ");
      console.log(`  ${icon} ${h.deployedAt}  ${details}`);
    }
    return;
  }

  const history = await infraProfile.getHistory(service!);

  if (isJson) {
    console.log(JSON.stringify(history, null, 2));
  } else {
    if (history.length === 0) {
      console.log(`\n${service}: 배포 이력 없음`);
    } else {
      console.log(`\n=== ${service} 배포 이력 (${history.length}건) ===\n`);
      for (const h of history) {
        const icon = h.success ? "[OK]" : "[FAIL]";
        const details = [
          `env=${h.env}`,
          `provider=${h.provider}`,
          `${h.duration}ms`,
          h.mode ? `mode=${h.mode}` : undefined,
          h.runId ? `run=${h.runId}` : undefined,
          h.scope ? `scope=${h.scope}` : undefined,
          h.endpoint ? h.endpoint : undefined,
          h.artifactId ? `artifact=${h.artifactId}` : undefined,
          h.error ? `error=${h.error}` : undefined,
        ].filter(Boolean).join("  ");
        console.log(`  ${icon} ${h.deployedAt}  ${details}`);
      }
    }
  }
};
