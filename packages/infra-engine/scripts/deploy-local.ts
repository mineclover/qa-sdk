#!/usr/bin/env npx tsx
/**
 * 로컬 K3s에 서비스 배포 테스트
 *
 * 사전 조건:
 * 1. k3d cluster running: k3d cluster list
 * 2. Docker image built: docker build -t qa-sdk/ingest-server:latest -f Dockerfile.ingest-server .
 * 3. Image imported to k3d: k3d image import qa-sdk/ingest-server:latest -c qa-local
 *
 * 실행: npx tsx packages/infra-engine/scripts/deploy-local.ts [service] [env]
 * 예시: npx tsx packages/infra-engine/scripts/deploy-local.ts ingest-server dev
 */

// 0-3: Passphrase 자동 설정 — Pulumi 로컬 백엔드에서 암호 프롬프트 방지
process.env.PULUMI_CONFIG_PASSPHRASE ??= "";

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createPipeline } from "../src/core/pipeline.js";
import { createConfigStage } from "../src/config/config-stage.js";
import { createPlainLoader } from "../src/config/sops-loader.js";
import { createProvisionStage } from "../src/stages/provision-stage.js";
import { createRegisterStage } from "../src/stages/register-stage.js";
import { createVerifyStage } from "../src/verify/verify-stage.js";
import { createObserveStage } from "../src/stages/observe-stage.js";
import { createGateAdapter } from "../src/adapters/gate.js";
import { createInfraProfileAdapter } from "../src/adapters/infra-profile.js";
import { createServiceProfileAdapter } from "../src/adapters/service-profile.js";
import { createLocalProvider, type LocalProviderOptions } from "../src/providers/local.js";
import { registerProvider, getProvider } from "../src/providers/registry.js";
import { createPulumiDeployFn } from "../src/providers/pulumi-deploy.js";
import { writeDeploymentOutputArtifactRegistryRecord } from "../src/post-deploy/artifact-registry.js";
import { buildDeployHistoryEntry, readFleetRunContextFromEnv } from "../src/post-deploy/deploy-history.js";
import { runPostDeployCodegen } from "infra-env-kit";
import type {
  RegistryAdapter,
  IngestAdapter,
  CoordinateAdapter,
} from "../src/adapters/adapter.js";
import type { DeployContext, DeployHistoryEntry } from "../src/core/types.js";

// --- 설정 ---
const DRY_RUN = process.argv.includes("--dry-run");
const { positional: positionalArgs, flags } = parseScriptArgs(process.argv.slice(2));
const SERVICE = positionalArgs[0] || "ingest-server";
const ENV = positionalArgs[1] || "dev";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = positionalArgs[2] || `${ENV}.json`;
const CONFIG_PATH = resolve(__dirname, `../config/${CONFIG_FILE}`);
const PROFILE_DIR = resolve(homedir(), ".qa-sdk");
const ARTIFACT_REGISTRY = flags["artifact-registry"];
const FLEET_CONTEXT = readFleetRunContextFromEnv();

function parseScriptArgs(args: readonly string[]): {
  positional: string[];
  flags: Record<string, string | undefined>;
} {
  const positional: string[] = [];
  const parsedFlags: Record<string, string | undefined> = {};
  const booleanFlags = new Set(["dry-run", "sync"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (booleanFlags.has(key)) {
      parsedFlags[key] = inlineValue ?? "true";
      continue;
    }

    if (inlineValue !== undefined) {
      parsedFlags[key] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      parsedFlags[key] = next;
      index += 1;
    } else {
      parsedFlags[key] = "true";
    }
  }

  return { positional, flags: parsedFlags };
}

async function getGitSha(): Promise<string> {
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("git", ["rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return `build-${Date.now()}`;
  }
}

async function main() {
  console.log(`\n=== infra-engine 로컬 배포 ===`);
  console.log(`서비스: ${SERVICE}`);
  console.log(`환경:   ${ENV}`);
  console.log(`설정:   ${CONFIG_PATH}\n`);

  // 프로바이더 등록 — nginx 테스트 시 이미지/헬스체크 오버라이드
  // healthPath: config의 health_path가 우선, 없으면 local.ts 기본값 /health/live
  const isNginxTest = SERVICE === "nginx-test";
  registerProvider(createLocalProvider({
    env: ENV,
    imageOverride: isNginxTest ? "nginx:alpine" : undefined,
    healthPath: isNginxTest ? "/" : undefined,
  }));

  // 어댑터 설정
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);
  const gate = createGateAdapter();

  // 실제 registry-service 연동 (미실행 시 mock fallback)
  let registry: RegistryAdapter;
  try {
    const registryUrl = process.env.REGISTRY_URL ?? "http://localhost:3300";
    const res = await fetch(new URL("/health", registryUrl), { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const { createRegistryAdapter } = await import("../src/adapters/registry.js");
      registry = createRegistryAdapter(registryUrl);
      console.log(`[registry] 실서비스 연결됨 (${registryUrl})`);
    } else {
      throw new Error("not ok");
    }
  } catch {
    console.log("[registry] 미실행 — mock 모드");
    registry = {
      syncDeployment: async (params) => {
        console.log(`[registry-mock] sync: ${params.serviceId} → ${params.url}`);
        return { synced: true };
      },
    };
  }
  // IngestAdapter — ingest-server 실행 시 실연동, 미실행 시 mock fallback
  let ingestAdapter: IngestAdapter;
  try {
    const ingestUrl = process.env.INGEST_URL ?? "http://localhost:3200";
    const res = await fetch(new URL("/health/live", ingestUrl), { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const { createIngestAdapter } = await import("../src/adapters/ingest.js");
      ingestAdapter = createIngestAdapter({ baseUrl: ingestUrl });
      console.log(`[ingest] 실서비스 연결됨 (${ingestUrl})`);
    } else {
      throw new Error("not ok");
    }
  } catch {
    console.log("[ingest] 미실행 — mock 모드");
    ingestAdapter = {
      emit: async (key: string) => {
        console.log(`[ingest-mock] emit: ${key}`);
        return { ok: true };
      },
    };
  }

  const { createCoordinateAdapter } = await import("../src/adapters/coordinate.js");
  const { DEMO_CATALOG } = await import("demo-snapshot");
  const coordinateAdapter = createCoordinateAdapter(DEMO_CATALOG);

  // 파이프라인 구성 — dry-run 시 config + provision(preview)만 실행
  const stages = DRY_RUN
    ? [
        createConfigStage(createPlainLoader()),
        createProvisionStage(getProvider, createPulumiDeployFn({ env: ENV, dryRun: true })),
      ]
    : [
        createConfigStage(createPlainLoader()),
        createProvisionStage(getProvider, createPulumiDeployFn({ env: ENV })),
        createRegisterStage(registry, serviceProfile, infraProfile),
        createVerifyStage(gate, { maxRetries: 5, retryDelay: 3000 }),
        createObserveStage(ingestAdapter, coordinateAdapter, infraProfile),
      ];
  const pipeline = createPipeline(stages);

  // 실행
  const result = await pipeline.run({
    service: SERVICE,
    provider: "local",
    env: ENV,
    region: "local",
    configPath: CONFIG_PATH,
    triggeredBy: "manual",
  } as DeployContext);

  // 결과 출력
  console.log(`\n=== 배포 결과 ===`);
  console.log(`성공:     ${result.success}`);
  console.log(`엔드포인트: ${result.endpoint}`);
  console.log(`상태:     ${result.healthStatus}`);
  console.log(`게이트:   ${result.gateVerdict}`);
  console.log(`소요시간: ${result.duration}ms`);
  console.log(`\n스테이지별:`);
  for (const s of result.stageResults) {
    console.log(
      `  ${s.stage}: ${s.status} (${s.duration}ms)${s.error ? ` — ${s.error}` : ""}`,
    );
  }

  // 배포 이력 기록
  if (!DRY_RUN) {
    let artifactId: string | undefined;
    const deployedAt = new Date().toISOString();

    // 버전 기록
    if (result.success) {
      try {
        const { createVersionStore } = await import("../src/post-deploy/version-manager.js");
        const vs = createVersionStore();
        const gitSha = await getGitSha();
        const vEntry = await vs.setVersion(SERVICE, ENV, gitSha, result.endpoint ?? "", "local");
        if (vEntry.previousVersion) {
          console.log(`[version] ${vEntry.previousVersion} -> ${vEntry.currentVersion}`);
        } else {
          console.log(`[version] ${gitSha.slice(0, 8)} (초기 배포)`);
        }
      } catch { /* 버전 기록 실패 무시 */ }
    }

    if (result.success && ARTIFACT_REGISTRY) {
      try {
        const record = await writeDeploymentOutputArtifactRegistryRecord({
          artifactRegistry: ARTIFACT_REGISTRY,
          service: SERVICE,
          env: ENV,
          provider: "local",
          configPath: CONFIG_PATH,
          result,
          fleetRunId: FLEET_CONTEXT.runId,
          fleetMode: FLEET_CONTEXT.mode,
          fleetScope: FLEET_CONTEXT.scope,
        });
        if (record) {
          artifactId = record.artifactId;
          console.log(`[artifact-registry] ${record.artifactId} -> ${ARTIFACT_REGISTRY}`);
        }
      } catch (err) {
        console.warn(`[artifact-registry] 기록 실패: ${err}`);
      }
    }

    const historyEntry: DeployHistoryEntry = buildDeployHistoryEntry({
      deployedAt,
      version: result.endpoint ?? "unknown",
      env: ENV,
      provider: "local",
      endpoint: result.endpoint ?? "",
      duration: result.duration,
      success: result.success,
      triggeredBy: "manual",
      configPath: CONFIG_PATH,
      artifactId,
    }, FLEET_CONTEXT);
    await infraProfile.addHistory(SERVICE, historyEntry);
  }

  // --sync: codegen + cascade
  if (result.success && process.argv.includes("--sync")) {
    try {
      const { createDiscoveryClient } = await import("../src/discovery/client.js");
      const client = createDiscoveryClient(process.env.REGISTRY_URL ?? "http://localhost:3300");
      const codegenResult = await runPostDeployCodegen(client, SERVICE, ENV);
      console.log(`[codegen] TS: ${codegenResult.tsPath}`);
      console.log(`[codegen] env: ${codegenResult.envPaths.length}건`);
    } catch (err) {
      console.warn(`[codegen] 실패: ${err instanceof Error ? err.message : err}`);
    }

    try {
      const { findCascadeTargets, executeCascade } = await import("../src/post-deploy/cascade.js");
      const { createPlainLoader: pl } = await import("../src/config/sops-loader.js");
      const rawConfig = await pl().decrypt(CONFIG_PATH);
      const targets = findCascadeTargets(rawConfig as any, SERVICE);
      await executeCascade(targets, ENV, { dryRun: true });
    } catch { /* cascade 감지 실패 무시 */ }
  }

  // 프로필 확인
  const deployment = await infraProfile.getDeployment(SERVICE);
  if (deployment) {
    console.log(`\n=== 인프라 프로필 ===`);
    console.log(`  provider: ${deployment.provider}`);
    console.log(`  endpoint: ${deployment.endpoint}`);
    console.log(`  env:      ${deployment.env}`);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("배포 실패:", err);
  process.exit(1);
});
