// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { PROFILE_DIR } from "./context.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandContext } from "cli-command";
import type { SyncCheckResult } from "../monitor/sync-loop.js";
import type { RecoveryConfig } from "../core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = resolve(__dirname, "../../config");
const packageRoot = resolve(__dirname, "../..");

async function loadMonitorRuntime(infraProfile: ReturnType<typeof createInfraProfileAdapter>) {
  const monitors = await infraProfile.getAllMonitors();
  const monitorEnvByService = Object.fromEntries(
    monitors.map((monitor) => [monitor.serviceId, monitor.env]),
  ) as Record<string, string>;
  const envs = [...new Set(monitors.map((monitor) => monitor.env).filter(Boolean))];

  const webhooks = new Map<string, { url: string; events: string[] }>();
  let defaultInterval: number | undefined;
  const recoveryByEnv: Record<string, RecoveryConfig> = {};

  for (const env of envs) {
    try {
      const { readFile } = await import("node:fs/promises");
      const raw = JSON.parse(await readFile(resolve(configDir, `${env}.json`), "utf-8"));
      const monitoring = raw.monitoring as {
        interval?: number;
        webhooks?: Array<{ url: string; events: string[] }>;
        recovery?: RecoveryConfig;
      } | undefined;
      if (monitoring?.interval) {
        defaultInterval = defaultInterval === undefined
          ? monitoring.interval
          : Math.min(defaultInterval, monitoring.interval);
      }
      if (monitoring?.recovery) {
        recoveryByEnv[env] = monitoring.recovery;
      }
      for (const webhook of monitoring?.webhooks ?? []) {
        const existing = webhooks.get(webhook.url);
        if (existing) {
          existing.events = [...new Set([...existing.events, ...webhook.events])];
        } else {
          webhooks.set(webhook.url, { ...webhook, events: [...new Set(webhook.events)] });
        }
      }
    } catch {
      /* env config 없으면 무시 */
    }
  }

  let ingest: Awaited<ReturnType<typeof loadOptionalIngestAdapter>>;
  try {
    ingest = await loadOptionalIngestAdapter();
  } catch {
    ingest = undefined;
  }

  let coordinate: Awaited<ReturnType<typeof loadCoordinateAdapter>>;
  try {
    coordinate = await loadCoordinateAdapter();
  } catch {
    coordinate = undefined;
  }

  return {
    ingest,
    coordinate,
    defaultInterval,
    recoveryByEnv,
    monitorEnvByService,
    webhooks: [...webhooks.values()],
  };
}

async function loadOptionalIngestAdapter() {
  const ingestUrl = process.env.INGEST_URL ?? "http://localhost:3200";
  try {
    const res = await fetch(`${ingestUrl}/health/live`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return undefined;
    const { createIngestAdapter } = await import("../adapters/ingest.js");
    return createIngestAdapter({ baseUrl: ingestUrl });
  } catch {
    return undefined;
  }
}

async function loadCoordinateAdapter() {
  const { createCoordinateAdapter } = await import("../adapters/coordinate.js");
  const { DEMO_CATALOG } = await import("demo-snapshot");
  return createCoordinateAdapter(DEMO_CATALOG);
}

function parsePositiveIntOption(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveIntOption(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function createAutoRecoveryHandler(
  ctx: CommandContext,
  infraProfile: ReturnType<typeof createInfraProfileAdapter>,
  runtimeRecoveryByEnv: Record<string, RecoveryConfig>,
  monitorEnvByService: Record<string, string>,
): Promise<((results: SyncCheckResult[]) => Promise<void>) | undefined> {
  const cliEnabled = !!ctx.options.autoRecover;
  const cliMaxRetries = parseOptionalPositiveIntOption(ctx.options.maxRetries);
  const cliCooldownSec = parseOptionalPositiveIntOption(ctx.options.cooldownSec);
  const { createAutoRecovery } = await import("../monitor/auto-recovery.js");
  const recoveryByEnv = new Map<string, ReturnType<typeof createAutoRecovery>>();

  for (const env of [...new Set(Object.values(monitorEnvByService))]) {
    const runtimeRecovery = runtimeRecoveryByEnv[env];
    const enabled = cliEnabled || runtimeRecovery?.enabled === true;
    if (!enabled) continue;

    const maxRetries = cliMaxRetries ?? runtimeRecovery?.maxRetries ?? 3;
    const cooldownSec = cliCooldownSec ?? runtimeRecovery?.cooldownSec ?? 300;

    const recovery = createAutoRecovery({
      maxRetries,
      cooldownMs: cooldownSec * 1000,
      onTrigger: async (serviceId, attempt) => {
        const deployment = await infraProfile.getDeployment(serviceId);
        if (!deployment) {
          console.warn(`[auto-recovery] ${serviceId}: deployment 정보 없음`);
          return false;
        }

        if (deployment.provider !== "local" && deployment.provider !== "cloudflare") {
          console.warn(`[auto-recovery] ${serviceId}: provider ${deployment.provider} 자동 복구 미지원`);
          return false;
        }

        const args = [
          "--filter", "infra-engine",
          "exec", "node", "--import", "tsx",
          "./scripts/infra.ts",
          "deploy",
          serviceId,
          deployment.env,
        ];
        if (deployment.provider === "cloudflare") {
          args.push("--provider", "cloudflare");
        }

        console.log(
          `[auto-recovery] ${serviceId}: 재배포 시도 ${attempt}/${maxRetries} (${deployment.provider}/${deployment.env})`,
        );

        try {
          const { execa } = await import("execa");
          await execa("pnpm", args, {
            cwd: packageRoot,
            env: process.env,
            stdio: "inherit",
          });
          console.log(`[auto-recovery] ${serviceId}: 재배포 성공`);
          return true;
        } catch (err) {
          console.warn(
            `[auto-recovery] ${serviceId}: 재배포 실패 — ${err instanceof Error ? err.message : String(err)}`,
          );
          return false;
        }
      },
      onEscalate: (serviceId, attempts) => {
        console.error(`[auto-recovery] ${serviceId}: ${attempts}회 시도 후 에스컬레이션 필요`);
      },
    });

    recoveryByEnv.set(env, recovery);
    console.log(`[auto-recovery] enabled for ${env} (maxRetries=${maxRetries}, cooldown=${cooldownSec}s)`);
  }

  if (recoveryByEnv.size === 0) return undefined;

  return async (results) => {
    const grouped = new Map<string, SyncCheckResult[]>();
    for (const result of results) {
      const env = monitorEnvByService[result.serviceId];
      if (!env || !recoveryByEnv.has(env)) continue;
      const group = grouped.get(env) ?? [];
      group.push(result);
      grouped.set(env, group);
    }

    for (const [env, envResults] of grouped) {
      await recoveryByEnv.get(env)!.evaluate(envResults);
    }
  };
}

/** monitor start — sync-loop 시작 */
export const monitorStartHandler: CommandHandler = async (ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const runtime = await loadMonitorRuntime(infraProfile);
  const onResults = await createAutoRecoveryHandler(
    ctx,
    infraProfile,
    runtime.recoveryByEnv,
    runtime.monitorEnvByService,
  );
  const intervalArg = ctx.options.interval
    ? parseInt(ctx.options.interval as string, 10)
    : (runtime.defaultInterval ?? 60);
  const { createSyncLoop } = await import("../monitor/sync-loop.js");
  const loop = createSyncLoop({
    infraProfile,
    ingest: runtime.ingest,
    coordinate: runtime.coordinate,
    webhooks: runtime.webhooks,
    interval: intervalArg,
    onResults,
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
export const monitorCheckHandler: CommandHandler = async (ctx) => {
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const runtime = await loadMonitorRuntime(infraProfile);
  const onResults = await createAutoRecoveryHandler(
    ctx,
    infraProfile,
    runtime.recoveryByEnv,
    runtime.monitorEnvByService,
  );
  const { createSyncLoop } = await import("../monitor/sync-loop.js");
  const loop = createSyncLoop({
    infraProfile,
    ingest: runtime.ingest,
    coordinate: runtime.coordinate,
    webhooks: runtime.webhooks,
    interval: runtime.defaultInterval,
    onResults,
  });
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
