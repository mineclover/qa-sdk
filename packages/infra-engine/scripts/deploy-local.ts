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
import { pulumiDeployFn } from "../src/providers/pulumi-deploy.js";
import type {
  RegistryAdapter,
  IngestAdapter,
  CoordinateAdapter,
} from "../src/adapters/adapter.js";
import type { DeployContext } from "../src/core/types.js";

// --- 설정 ---
const SERVICE = process.argv[2] || "ingest-server";
const ENV = process.argv[3] || "dev";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = process.argv[4] || `${ENV}.json`;
const CONFIG_PATH = resolve(__dirname, `../config/${CONFIG_FILE}`);
const PROFILE_DIR = resolve(homedir(), ".qa-sdk");

async function main() {
  console.log(`\n=== infra-engine 로컬 배포 ===`);
  console.log(`서비스: ${SERVICE}`);
  console.log(`환경:   ${ENV}`);
  console.log(`설정:   ${CONFIG_PATH}\n`);

  // 프로바이더 등록 — nginx 테스트 시 이미지/헬스체크 오버라이드
  const isNginxTest = SERVICE === "nginx-test";
  registerProvider(createLocalProvider({
    env: ENV,
    imageOverride: isNginxTest ? "nginx:alpine" : undefined,
    healthPath: isNginxTest ? "/" : "/health/live",
  }));

  // 어댑터 설정
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);
  const gate = createGateAdapter();

  // 외부 서비스 mock (registry, ingest는 아직 실연동 안 함)
  const mockRegistry: RegistryAdapter = {
    syncDeployment: async (params) => {
      console.log(`[registry] sync: ${params.serviceId} → ${params.url}`);
      return { synced: true };
    },
  };
  const mockIngest: IngestAdapter = {
    emit: async (key: string) => {
      console.log(`[ingest] emit: ${key}`);
      return { ok: true };
    },
  };
  const mockCoordinate: CoordinateAdapter = {
    resolveSvcRef: () => null, // 로컬에서는 좌표 해석 건너뜀
    encodeDeployEvent: () => ({}),
    encodeHealthEvent: () => ({}),
  };

  // 파이프라인 구성
  const pipeline = createPipeline([
    createConfigStage(createPlainLoader()),
    createProvisionStage(getProvider, pulumiDeployFn),
    createRegisterStage(mockRegistry, serviceProfile, infraProfile),
    createVerifyStage(gate, { maxRetries: 5, retryDelay: 3000 }),
    createObserveStage(mockIngest, mockCoordinate, infraProfile),
  ]);

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
