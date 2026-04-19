// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { PROFILE_DIR } from "./context.js";

/** history 명령 — 배포 이력 조회 */
export const historyHandler: CommandHandler = async (ctx) => {
  const service = ctx.args.service;
  if (!service) {
    console.error("사용: infra history <service> [--json]");
    process.exit(1);
  }

  const isJson = !!ctx.options.json;
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const history = await infraProfile.getHistory(service);

  if (isJson) {
    console.log(JSON.stringify(history, null, 2));
  } else {
    if (history.length === 0) {
      console.log(`\n${service}: 배포 이력 없음`);
    } else {
      console.log(`\n=== ${service} 배포 이력 (${history.length}건) ===\n`);
      for (const h of history) {
        const icon = h.success ? "[OK]" : "[FAIL]";
        console.log(`  ${icon} ${h.deployedAt}  env=${h.env}  ${h.duration}ms  ${h.endpoint}`);
      }
    }
  }
};
