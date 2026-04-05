#!/usr/bin/env pnpm exec tsx
/**
 * infra-engine 통합 CLI
 *
 * 사용:
 *   infra discover [--all|--list|--deep|--code] <args>
 *   infra deploy <service> <env> [config] [--dry-run]
 *   infra deploy --all <env> [--continue-on-error]
 *   infra destroy <service> <env> [--yes]
 *   infra export [env|ts|compose|docs] <args> [--out <path>]
 *   infra status <env>
 *   infra history <service> [--json]
 *   infra audit
 *   infra monitor [start|check|status] [--interval N]
 *   infra dashboard [summary|service <id>|export [path]]
 *   infra env [up|down|status|reset]
 *   infra pf [list|cleanup]
 *   infra --help
 */

// infra-config.json 기반 설정 적용
import { loadInfraConfig, applyConfigToEnv } from "../src/commands/config-manager.js";
const infraConfig = await loadInfraConfig();
applyConfigToEnv(infraConfig); // 환경변수에 설정 반영 (passphrase, backend, 서비스 URL 등)

// MinIO 자동 감지 fallback (infra-config에 없어도 MinIO가 떠있으면 연결)
import { detectEnvironment } from "../src/commands/env-manager.js";
await detectEnvironment();

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createInfraProfileAdapter } from "../src/adapters/infra-profile.js";
import { createDiscoveryClient } from "../src/discovery/client.js";
import type { AuditIssue } from "../src/commands/audit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:3300";
const PROFILE_DIR = resolve(homedir(), ".qa-sdk");

const cmd = process.argv[2];
const rest = process.argv.slice(3);

// 하위 스크립트에 인자 위임
function delegateTo(scriptPath: string, args: string[]) {
  process.argv = [process.argv[0], scriptPath, ...args];
}

async function main() {
  switch (cmd) {
    case "discover": {
      delegateTo("discover.ts", rest);
      await import("./discover.js");
      break;
    }
    case "deploy": {
      // fleet 일괄 배포: infra deploy --all <env> [--continue-on-error]
      if (rest[0] === "--all") {
        const env = rest[1] ?? "dev";
        const continueOnError = rest.includes("--continue-on-error");
        const configPath = resolve(__dirname, `../config/${env}.json`);
        let config: { services: Record<string, unknown> };
        try {
          config = JSON.parse(await readFile(configPath, "utf-8"));
        } catch {
          console.error(`설정 파일을 찾을 수 없습니다: ${configPath}`);
          process.exit(1);
          return; // TypeScript narrowing
        }
        const services = Object.keys(config.services);

        console.log(`\n=== Fleet Deploy (${env}) — ${services.length}개 서비스 ===\n`);
        const results: Array<{ service: string; success: boolean; duration: number; error?: string }> = [];

        for (const svc of services) {
          console.log(`\n--- ${svc} ---`);
          const start = Date.now();
          try {
            const { execa } = await import("execa");
            await execa("pnpm", ["exec", "tsx", resolve(__dirname, "deploy-local.ts"), svc, env], {
              stdio: "inherit",
              env: { ...process.env, PULUMI_CONFIG_PASSPHRASE: "" },
            });
            results.push({ service: svc, success: true, duration: Date.now() - start });
          } catch (err) {
            results.push({ service: svc, success: false, duration: Date.now() - start, error: String(err) });
            if (!continueOnError) {
              console.error(`\n${svc} 실패 — 중단 (--continue-on-error로 계속 가능)`);
              break;
            }
          }
        }

        // 요약
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        console.log(`\n=== Fleet Deploy 결과 ===`);
        console.log(`  성공: ${succeeded}  실패: ${failed}  총 소요: ${totalDuration}ms`);
        for (const r of results) {
          const icon = r.success ? "[OK]" : "[FAIL]";
          console.log(`  ${icon} ${r.service.padEnd(25)} ${r.duration}ms${r.error ? ` — ${r.error.slice(0, 50)}` : ""}`);
        }

        process.exit(failed > 0 ? 1 : 0);
      }

      // Cloudflare 배포: infra deploy <service> <env> --provider cloudflare [config]
      if (rest.includes("--provider") && rest[rest.indexOf("--provider") + 1] === "cloudflare") {
        const service = rest[0];
        const env = rest[1] ?? "prod";
        const configIdx = rest.findIndex(a => a.endsWith(".json"));
        const configFile = configIdx !== -1 ? rest[configIdx] : "cloudflare-prod.json";
        const configPath = resolve(__dirname, `../config/${configFile}`);
        const dryRun = rest.includes("--dry-run");

        const { createPipeline } = await import("../src/core/pipeline.js");
        const { createConfigStage } = await import("../src/config/config-stage.js");
        const { createPlainLoader } = await import("../src/config/sops-loader.js");
        const { createProvisionStage } = await import("../src/stages/provision-stage.js");
        const { createRegisterStage } = await import("../src/stages/register-stage.js");
        const { createVerifyStage } = await import("../src/verify/verify-stage.js");
        const { createObserveStage } = await import("../src/stages/observe-stage.js");
        const { createGateAdapter } = await import("../src/adapters/gate.js");
        const { createInfraProfileAdapter } = await import("../src/adapters/infra-profile.js");
        const { createServiceProfileAdapter } = await import("../src/adapters/service-profile.js");
        const { createCloudflareProvider, wranglerDeployFn } = await import("../src/providers/cloudflare.js");
        const { registerProvider, getProvider } = await import("../src/providers/registry.js");
        const { createRegistryAdapter } = await import("../src/adapters/registry.js");

        console.log(`\n=== Cloudflare 배포 ===`);
        console.log(`서비스: ${service}`);
        console.log(`환경:   ${env}`);
        console.log(`설정:   ${configPath}${dryRun ? " (dry-run)" : ""}\n`);

        registerProvider(createCloudflareProvider());
        const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
        const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);
        const gate = createGateAdapter();

        // registry 연동
        let registry: any;
        try {
          const res = await fetch(`${REGISTRY_URL}/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) { registry = createRegistryAdapter(REGISTRY_URL); console.log("[registry] 실서비스 연결"); }
          else throw new Error();
        } catch {
          registry = { syncDeployment: async (p: any) => { console.log(`[registry-mock] sync: ${p.serviceId}`); return { synced: true }; } };
        }

        // IngestAdapter — ingest-server 실행 시 실연동, 미실행 시 mock fallback
        let ingestAdapter: any;
        try {
          const ingestRes = await fetch("http://localhost:3200/health/live", { signal: AbortSignal.timeout(2000) });
          if (ingestRes.ok) {
            const { createIngestAdapter } = await import("../src/adapters/ingest.js");
            ingestAdapter = createIngestAdapter({ baseUrl: "http://localhost:3200" });
            console.log("[ingest] 실서비스 연결됨 (localhost:3200)");
          } else throw new Error();
        } catch {
          console.log("[ingest] 미실행 — mock 모드");
          ingestAdapter = { emit: async (key: string) => { console.log(`[ingest-mock] emit: ${key}`); return { ok: true }; } };
        }

        const { createCoordinateAdapter } = await import("../src/adapters/coordinate.js");
        const coordinateAdapter = createCoordinateAdapter();

        const stages = dryRun
          ? [createConfigStage(createPlainLoader())]
          : [
              createConfigStage(createPlainLoader()),
              createProvisionStage(getProvider, wranglerDeployFn),
              createRegisterStage(registry, serviceProfile, infraProfile),
              createVerifyStage(gate, { maxRetries: 3, retryDelay: 5000 }),
              createObserveStage(ingestAdapter, coordinateAdapter, infraProfile),
            ];

        const pipeline = createPipeline(stages);
        const result = await pipeline.run({
          service,
          provider: "cloudflare" as any,
          env,
          region: "global",
          configPath,
          triggeredBy: "manual",
        });

        console.log(`\n=== 배포 결과 ===`);
        console.log(`성공:     ${result.success}`);
        console.log(`엔드포인트: ${result.endpoint}`);
        console.log(`소요시간: ${result.duration}ms`);
        for (const s of result.stageResults) {
          console.log(`  ${s.stage}: ${s.status} (${s.duration}ms)${s.error ? ` — ${s.error}` : ""}`);
        }

        if (result.success) {
          await infraProfile.addHistory(service, {
            deployedAt: new Date().toISOString(),
            version: result.endpoint ?? "unknown",
            env, provider: "cloudflare",
            endpoint: result.endpoint ?? "",
            duration: result.duration,
            success: true,
            triggeredBy: "manual",
          });
        }

        process.exit(result.success ? 0 : 1);
      }

      // 단일 서비스 배포 (local K3s)
      delegateTo("deploy-local.ts", rest);
      await import("./deploy-local.js");
      break;
    }
    case "destroy": {
      const service = rest[0];
      const env = rest[1] ?? "dev";
      const yes = rest.includes("--yes");
      if (!service) {
        console.error("사용: infra destroy <service> <env> [--yes]");
        process.exit(1);
      }
      if (!yes) {
        console.log(`${service} (${env}) 리소스를 삭제합니다. 계속하려면 --yes 플래그를 추가하세요.`);
        process.exit(0);
      }
      const { destroy } = await import("../src/commands/destroy.js");
      await destroy(service, env);
      break;
    }
    case "export": {
      // --out 플래그 파싱
      const outIdx = rest.indexOf("--out");
      if (outIdx !== -1) {
        const outPath = rest[outIdx + 1];
        if (outPath) {
          process.env.INFRA_EXPORT_OUT = outPath;
        }
        rest.splice(outIdx, 2);
      }
      delegateTo("export.ts", rest);
      await import("./export.js");
      break;
    }
    case "status": {
      delegateTo("export.ts", ["status", ...rest]);
      await import("./export.js");
      break;
    }
    case "history": {
      const service = rest[0];
      if (!service) {
        console.error("사용: infra history <service> [--json]");
        process.exit(1);
      }
      const isJson = rest.includes("--json");
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
      break;
    }
    case "audit": {
      const client = createDiscoveryClient(REGISTRY_URL);
      const { auditRegistry } = await import("../src/commands/audit.js");
      const result = await auditRegistry(client);

      console.log(`\n=== Registry 감사 ===\n`);
      if (result.errors.length > 0) {
        console.log(`에러 (${result.errors.length}건):`);
        for (const e of result.errors) console.log(`  ${e.serviceId}: ${e.message}`);
      }
      if (result.warnings.length > 0) {
        console.log(`경고 (${result.warnings.length}건):`);
        // 유형별 그룹핑
        const byType = new Map<string, AuditIssue[]>();
        for (const w of result.warnings) {
          const list = byType.get(w.type) ?? [];
          list.push(w);
          byType.set(w.type, list);
        }
        for (const [type, issues] of [...byType.entries()].sort()) {
          console.log(`\n  [${type}] (${issues.length}건)`);
          for (const i of issues) console.log(`    ${i.serviceId}: ${i.message}`);
        }
      }
      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log("이상 없음");
      }
      console.log(`\n요약: ${result.errors.length} 에러, ${result.warnings.length} 경고`);
      break;
    }
    case "pf": {
      const sub = rest[0] ?? "list";
      const { readFile: readFileFs, writeFile } = await import("node:fs/promises");
      const pfPath = resolve(PROFILE_DIR, "infra-pf.json");

      if (sub === "list") {
        try {
          const map = JSON.parse(await readFileFs(pfPath, "utf-8"));
          const entries = Object.entries(map);
          if (entries.length === 0) {
            console.log("활성 port-forward 없음");
          } else {
            console.log("\n=== 활성 Port-Forward ===\n");
            for (const [key, val] of entries as [string, any][]) {
              let alive = false;
              try { process.kill(val.pid, 0); alive = true; } catch {}
              const icon = alive ? "[alive]" : "[dead]";
              console.log(`  ${icon} ${key.padEnd(25)} PID=${val.pid}  port=${val.localPort}  svc=${val.service}`);
            }
          }
        } catch {
          console.log("활성 port-forward 없음");
        }
      } else if (sub === "cleanup") {
        try {
          const map = JSON.parse(await readFileFs(pfPath, "utf-8"));
          let cleaned = 0;
          for (const [key, val] of Object.entries(map) as [string, any][]) {
            try { process.kill(val.pid, 0); } catch {
              delete map[key];
              cleaned++;
            }
          }
          await writeFile(pfPath, JSON.stringify(map, null, 2));
          console.log(`정리됨: ${cleaned}건 (죽은 PID 제거)`);
        } catch {
          console.log("정리할 항목 없음");
        }
      } else {
        console.error(`알 수 없는 pf 서브커맨드: ${sub}`);
        console.error("사용: infra pf [list|cleanup]");
        process.exit(1);
      }
      break;
    }
    case "monitor": {
      const sub = rest[0] ?? "status";
      const infraProfile = createInfraProfileAdapter(PROFILE_DIR);

      if (sub === "start") {
        const intervalIdx = rest.indexOf("--interval");
        const intervalArg = intervalIdx !== -1 ? parseInt(rest[intervalIdx + 1]) : 60;
        const { createSyncLoop } = await import("../src/monitor/sync-loop.js");
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
        break;
      }

      if (sub === "once" || sub === "check") {
        const { createSyncLoop } = await import("../src/monitor/sync-loop.js");
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
        break;
      }

      if (sub === "status") {
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
        break;
      }

      console.error("사용: infra monitor [start|check|status] [--interval N]");
      break;
    }
    case "dashboard": {
      const sub = rest[0] ?? "summary";
      const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
      const { createDashboardData } = await import("../src/monitor/dashboard.js");
      const dashboard = createDashboardData(infraProfile);

      if (sub === "summary") {
        const s = await dashboard.getSummary();
        console.log(`\n=== Dashboard Summary ===`);
        console.log(`  시각:       ${s.timestamp}`);
        console.log(`  배포:       ${s.deployed}건`);
        console.log(`  모니터:     ${s.monitored}건`);
        console.log(`  상태:       ${Object.entries(s.byStatus).map(([k, v]) => `${k}:${v}`).join(", ")}`);
        console.log(`  프로바이더: ${Object.entries(s.byProvider).map(([k, v]) => `${k}:${v}`).join(", ") || "-"}`);
        console.log(`  환경:       ${Object.entries(s.byEnv).map(([k, v]) => `${k}:${v}`).join(", ") || "-"}`);
      } else if (sub === "service") {
        const svcId = rest[1];
        if (!svcId) {
          console.error("사용: infra dashboard service <serviceId>");
          process.exit(1);
        }
        const d = await dashboard.getServiceDashboard(svcId);
        console.log(`\n=== ${svcId} Dashboard ===`);
        if (d.deployment) {
          console.log(`  배포: ${d.deployment.provider}/${d.deployment.env} -> ${d.deployment.endpoint}`);
          console.log(`  배포일: ${d.deployment.deployedAt}`);
        } else {
          console.log("  배포: 없음");
        }
        if (d.monitor) {
          console.log(`  모니터: ${d.monitor.status} (마지막: ${d.monitor.lastChecked})`);
        }
        console.log(`  이력: ${d.history.length}건`);
        if (d.uptime) {
          console.log(`  uptime: ${d.uptime.percentage}% (since ${d.uptime.since})`);
        }
      } else if (sub === "export") {
        const json = await dashboard.exportJson();
        const outPath = rest[1] ?? "generated/dashboard.json";
        const { mkdir, writeFile: writeFileFs } = await import("node:fs/promises");
        await mkdir(resolve(outPath, ".."), { recursive: true });
        await writeFileFs(outPath, json);
        console.log(`생성됨: ${outPath}`);
      } else {
        console.error("사용: infra dashboard [summary|service <id>|export [path]]");
      }
      break;
    }
    case "env": {
      const sub = rest[0] ?? "status";
      const infraEngineCwd = dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
      const { envUp, envDown, envStatus, envReset } = await import("../src/commands/env-manager.js");

      switch (sub) {
        case "up": await envUp(infraEngineCwd); break;
        case "down": await envDown(infraEngineCwd); break;
        case "status": await envStatus(); break;
        case "reset": await envReset(infraEngineCwd); break;
        default:
          console.error("사용: infra env [up|down|status|reset]");
          process.exit(1);
      }
      break;
    }
    case "config": {
      const {
        loadInfraConfig: loadCfg, saveInfraConfig: saveCfg,
        switchProfile, setConfigField, formatConfig, listPresets, getPreset,
      } = await import("../src/commands/config-manager.js");
      const sub = rest[0] ?? "show";

      if (sub === "show") {
        const cfg = await loadCfg();
        console.log(`\n=== 인프라 설정 ===\n`);
        console.log(formatConfig(cfg));
        console.log("");
        break;
      }

      if (sub === "use") {
        const profile = rest[1];
        if (!profile) {
          console.log(`사용 가능한 프로필: ${listPresets().join(", ")}`);
          process.exit(1);
        }
        const cfg = await switchProfile(profile);
        console.log(`\n✅ 프로필 전환: ${profile}\n`);
        console.log(formatConfig(cfg));
        console.log("");
        break;
      }

      if (sub === "set") {
        const field = rest[1];
        const value = rest[2];
        if (!field || !value) {
          console.error("사용: infra config set <field> <value>");
          console.error("필드: backend, k8s-context, registry, ingest, definition, ingest-store, s3-endpoint, s3-bucket");
          process.exit(1);
        }
        const cfg = await setConfigField(field, value);
        console.log(`\n✅ ${field} = ${value}\n`);
        console.log(formatConfig(cfg));
        console.log("");
        break;
      }

      if (sub === "presets") {
        console.log("\n=== 프로필 프리셋 ===\n");
        for (const name of listPresets()) {
          const p = getPreset(name)!;
          console.log(`  [${name}]`);
          console.log(`    backend: ${p.backend}${p.s3Endpoint ? ` (${p.s3Endpoint})` : ""}`);
          console.log(`    services: ${p.services.registry}`);
          console.log("");
        }
        break;
      }

      console.error("사용: infra config [show|use <profile>|set <field> <value>|presets]");
      process.exit(1);
    }
    case "--help":
    case "-h":
    case undefined: {
      console.log(`
infra-engine CLI

사용:
  infra discover [--all|--list|--deep|--code] <service> <env>
  infra deploy <service> <env> [config] [--dry-run]
  infra deploy --all <env> [--continue-on-error]
  infra deploy <service> <env> --provider cloudflare
  infra destroy <service> <env> [--yes]
  infra export [env|ts|compose|docs] <args> [--out <path>]
  infra status <env>
  infra history <service> [--json]
  infra audit
  infra config [show|use <profile>|set <field> <value>|presets]
  infra monitor [start|check|status] [--interval N]
  infra dashboard [summary|service <id>|export [path]]
  infra env [up|down|status|reset]
  infra pf [list|cleanup]
  infra --help
`);
      break;
    }
    default:
      console.error(`알 수 없는 명령: ${cmd}`);
      console.error("infra --help 로 사용법을 확인하세요.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("에러:", err.message ?? err);
  process.exit(1);
});
