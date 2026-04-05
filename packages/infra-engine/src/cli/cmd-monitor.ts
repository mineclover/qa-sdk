import type { CommandHandler } from "cli-command";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { PROFILE_DIR } from "./context.js";

/** monitor start — sync-loop 시작 */
export const monitorStartHandler: CommandHandler = async (ctx) => {
  const intervalArg = ctx.options.interval ? parseInt(ctx.options.interval as string) : 60;
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const { createSyncLoop } = await import("../monitor/sync-loop.js");
  const loop = createSyncLoop({
    infraProfile,
    interval: intervalArg,
    onStatusChange: (svc, prev, curr) => {
      const icon = curr === "Synced" ? "[OK]" : curr === "OutOfSync" ? "[FAIL]" : curr === "Degraded" ? "[WARN]" : "[?]";
      console.log(`${icon} ${svc}: ${prev} -> ${curr}`);
    },
  });
  loop.start();
  console.log("Ctrl+C로 종료");
  // 프로세스 유지
  await new Promise(() => {}); // never resolves
};

/** monitor check — 수동 1회 체크 */
export const monitorCheckHandler: CommandHandler = async (_ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const { createSyncLoop } = await import("../monitor/sync-loop.js");
  const loop = createSyncLoop({ infraProfile });
  const results = await loop.syncAll();
  if (results.length === 0) {
    console.log("모니터링 대상 없음 (배포된 서비스 없음)");
  } else {
    console.log(`\n=== Monitor Check (${results.length}건) ===\n`);
    for (const r of results) {
      const icon = r.currentStatus === "Synced" ? "[OK]" : r.currentStatus === "OutOfSync" ? "[FAIL]" : r.currentStatus === "Degraded" ? "[WARN]" : "[?]";
      const changed = r.changed ? ` (${r.previousStatus} -> ${r.currentStatus})` : "";
      console.log(`  ${icon} ${r.serviceId.padEnd(25)} ${r.currentStatus}${changed}  ${r.latency ?? "-"}ms`);
    }
  }
};

/** monitor status — 마지막 결과 */
export const monitorStatusHandler: CommandHandler = async (_ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const monitors = await infraProfile.getAllMonitors();
  if (monitors.length === 0) {
    console.log("모니터링 대상 없음");
  } else {
    console.log(`\n=== Monitor Status (${monitors.length}건) ===\n`);
    for (const m of monitors) {
      const icon = m.lastStatus === "Synced" ? "[OK]" : m.lastStatus === "OutOfSync" ? "[FAIL]" : m.lastStatus === "Degraded" ? "[WARN]" : "[?]";
      console.log(`  ${icon} ${m.serviceId.padEnd(25)} ${m.lastStatus ?? "Unknown"}  last: ${m.lastChecked ?? "never"}`);
    }
  }
};
