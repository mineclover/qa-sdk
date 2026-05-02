# Infra Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5단계 파이프라인 기반 멀티 프로바이더 배포 엔진을 `packages/infra-engine`에 구현한다. 서비스 배포 → 레지스트리 등록 → 품질 검증 → 관측까지 자동화.

**Architecture:** 코어(파이프라인 + 타입)는 qa-sdk 무의존 범용 모듈. 6개 어댑터(Registry, ServiceProfile, InfraProfile, Ingest, Coordinate, Gate)가 qa-sdk 연동 경계. Pulumi Automation API가 프로바이더별 배포 추상화. SOPS CLI로 시크릿 복호화.

**Tech Stack:** TypeScript, vitest, Pulumi Automation API `^3.229.0`, AWS SDK v3 `^3.1024.0`, execa `^9.0.0`, zod, tsup (ESM+CJS)

**Spec:** `docs/specs/infra-engine/infra-engine-pipeline.spec.md` (중심 인덱스) + 하위 8건

---

## 파일 구조

```
packages/infra-engine/              ← 신규 패키지
  src/
    core/
      types.ts                      — DeployContext, DeployResult, StageResult, Stage, DeployPipeline
      pipeline.ts                   — createPipeline(), 순차 실행 + 역순 rollback
    config/
      sops-loader.ts                — SopsLoader (execa → sops CLI)
      config-schema.ts              — ResolvedConfig zod 스키마
      config-stage.ts               — ConfigStage (decrypt + validate)
      env-bridge.ts                 — extractServiceEnv(), resolveConnectionEnv()
    providers/
      provider.ts                   — DeployProvider 인터페이스 + ProviderId + ValidationResult
      registry.ts                   — getProvider() 레지스트리
      cloudflare.ts                 — CloudflareProvider (첫 번째 구현)
    adapters/
      adapter.ts                    — 6개 포트 인터페이스 전부
      registry.ts                   — QaSdkRegistryAdapter
      service-profile.ts            — QaSdkServiceProfileAdapter
      infra-profile.ts              — QaSdkInfraProfileAdapter
      ingest.ts                     — QaSdkIngestAdapter
      coordinate.ts                 — QaSdkCoordinateAdapter
      gate.ts                       — QaSdkGateAdapter
    verify/
      health-check.ts               — httpProbe(), tcpProbe()
      gate-definitions.ts           — 내장 게이트 4종
      verify-stage.ts               — VerifyStage
    stages/
      provision-stage.ts            — ProvisionStage
      register-stage.ts             — RegisterStage
      observe-stage.ts              — ObserveStage
    monitor/
      sync-loop.ts                  — SyncLoop 주기적 상태 동기화
      dashboard.ts                  — DashboardData 인터페이스 구현
    index.ts                        — public API (deploy(), createPipeline())
  __tests__/
    core/pipeline.test.ts
    config/sops-loader.test.ts
    config/config-schema.test.ts
    config/config-stage.test.ts
    adapters/service-profile.test.ts
    adapters/infra-profile.test.ts
    adapters/gate.test.ts
    verify/health-check.test.ts
    verify/verify-stage.test.ts
    stages/register-stage.test.ts
    stages/observe-stage.test.ts
    stages/provision-stage.test.ts
    monitor/sync-loop.test.ts
  package.json
  tsconfig.json
  tsup.config.ts
```

---

## Task 1: 패키지 스캐폴딩 + 코어 타입

**Files:**
- Create: `packages/infra-engine/package.json`
- Create: `packages/infra-engine/tsconfig.json`
- Create: `packages/infra-engine/tsup.config.ts`
- Create: `packages/infra-engine/src/core/types.ts`
- Create: `packages/infra-engine/src/index.ts`

- [ ] **Step 1: package.json 생성**

```json
{
  "name": "infra-engine",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.0",
    "execa": "^9.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 생성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: tsup.config.ts 생성**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2023",
});
```

- [ ] **Step 4: core/types.ts — 모든 코어 타입 정의**

```typescript
// core/types.ts — qa-sdk 무의존 범용 타입

export type ProviderId = "cloudflare" | "aws" | "gcp" | "railway" | "vultr" | "local";

export interface DeployContext {
  readonly service: string;
  readonly provider: ProviderId;
  readonly env: string;
  readonly region: string;
  readonly configPath: string;
  readonly triggeredBy: "ci" | "manual";

  config?: ResolvedConfig;
  provision?: ProvisionResult;
  registration?: RegistrationResult;
  verification?: VerifyResult;
  observation?: ObserveResult;
}

export interface ResolvedConfig {
  global: GlobalConfig;
  services: Record<string, ServiceConfig>;
  connections: Record<string, ConnectionConfig>;
  monitoring?: MonitoringConfig;
}

export interface GlobalConfig {
  region: string;
  [key: string]: unknown;
}

export interface ServiceConfig {
  port: number;
  depends_on?: string[];
  gates?: GateDefinition[];
  [key: string]: unknown;
}

export interface ConnectionConfig {
  endpoint: string;
  health_path?: string;
  [key: string]: unknown;
}

export interface MonitoringConfig {
  interval: number;
  webhooks?: WebhookConfig[];
}

export interface WebhookConfig {
  url: string;
  events: string[];
}

export interface GateDefinition {
  name: string;
  type: "custom";
  check: string;
  expect_status: number;
  required: boolean;
}

export interface ProvisionResult {
  stackName: string;
  outputs: Record<string, string>;
  provider: string;
  region: string;
  duration: number;
}

export interface RegistrationResult {
  synced: boolean;
  manifestImpact?: string;
  profileUpdated: boolean;
  infraProfileUpdated: boolean;
  connectionChecks: ConnectionCheck[];
}

export interface ConnectionCheck {
  target: string;
  reachable: boolean;
  latency?: number;
}

export interface VerifyResult {
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: GateVerdict;
  checks: GateCheckResult[];
  retryCount: number;
  totalDuration: number;
}

export interface GateCheckResult {
  gate: string;
  verdict: "pass" | "warn" | "fail";
  detail: string;
  latency?: number;
}

export type GateVerdict = "pass" | "warn" | "fail";

export interface ObserveResult {
  eventEmitted: boolean;
  monitorRegistered: boolean;
  warnings: string[];
}

export interface DeployResult {
  success: boolean;
  endpoint?: string;
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: GateVerdict;
  duration: number;
  stageResults: StageResult[];
}

export interface StageResult {
  stage: string;
  status: "success" | "failed" | "skipped" | "rolled_back";
  duration: number;
  error?: string;
}

export interface Stage {
  readonly name: string;
  execute(ctx: DeployContext): Promise<DeployContext>;
  rollback?(ctx: DeployContext): Promise<void>;
}

export interface DeployPipeline {
  readonly stages: readonly Stage[];
  run(input: DeployContext): Promise<DeployResult>;
}

export interface InfraDeploymentEntry {
  serviceId: string;
  provider: string;
  env: string;
  region: string;
  endpoint: string;
  healthPath: string;
  stackName: string;
  deploymentVersion: string;
  deployedAt: string;
  triggeredBy: "ci" | "manual";
  metadata: Record<string, string>;
}

export interface MonitorTarget {
  serviceId: string;
  endpoint: string;
  healthPath: string;
  provider: string;
  env: string;
  region: string;
  namespace: string;
  interval: number;
  lastChecked?: string;
  lastStatus?: SyncStatus;
}

export type SyncStatus = "Synced" | "OutOfSync" | "Degraded" | "Unknown";
```

- [ ] **Step 5: index.ts — 초기 export**

```typescript
export * from "./core/types.js";
```

- [ ] **Step 6: 빌드 확인**

Run: `pnpm --filter infra-engine install && pnpm --filter infra-engine build`
Expected: dist/ 생성, 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): 패키지 스캐폴딩 + 코어 타입 정의"
```

---

## Task 2: 파이프라인 실행기 (TDD)

**Files:**
- Create: `packages/infra-engine/src/core/pipeline.ts`
- Create: `packages/infra-engine/__tests__/core/pipeline.test.ts`

- [ ] **Step 1: 파이프라인 테스트 작성**

```typescript
// __tests__/core/pipeline.test.ts
import { describe, it, expect, vi } from "vitest";
import { createPipeline } from "../../src/core/pipeline.js";
import type { DeployContext, Stage } from "../../src/core/types.js";

function makeCtx(overrides?: Partial<DeployContext>): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    ...overrides,
  };
}

function stubStage(name: string, effect?: (ctx: DeployContext) => DeployContext): Stage {
  return {
    name,
    execute: vi.fn(async (ctx) => (effect ? effect(ctx) : ctx)),
    rollback: vi.fn(async () => {}),
  };
}

describe("createPipeline", () => {
  it("순차 실행 — 모든 스테이지가 순서대로 호출", async () => {
    const order: string[] = [];
    const s1 = stubStage("a", (ctx) => { order.push("a"); return ctx; });
    const s2 = stubStage("b", (ctx) => { order.push("b"); return ctx; });

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(order).toEqual(["a", "b"]);
    expect(result.success).toBe(true);
    expect(result.stageResults).toHaveLength(2);
    expect(result.stageResults[0].stage).toBe("a");
    expect(result.stageResults[0].status).toBe("success");
  });

  it("실패 시 역순 rollback", async () => {
    const rollbackOrder: string[] = [];
    const s1: Stage = {
      name: "s1",
      execute: vi.fn(async (ctx) => ctx),
      rollback: vi.fn(async () => { rollbackOrder.push("s1"); }),
    };
    const s2: Stage = {
      name: "s2",
      execute: vi.fn(async () => { throw new Error("boom"); }),
      rollback: vi.fn(async () => { rollbackOrder.push("s2"); }),
    };

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(result.success).toBe(false);
    expect(rollbackOrder).toEqual(["s1"]); // s2는 실패했으므로 s1만 rollback
    expect(result.stageResults[1].status).toBe("failed");
    expect(result.stageResults[0].status).toBe("rolled_back");
  });

  it("rollback 없는 스테이지는 건너뜀", async () => {
    const s1: Stage = { name: "s1", execute: vi.fn(async (ctx) => ctx) }; // rollback 없음
    const s2: Stage = {
      name: "s2",
      execute: vi.fn(async () => { throw new Error("fail"); }),
    };

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(result.success).toBe(false);
    expect(result.stageResults[0].status).toBe("skipped"); // rollback 없어서 skipped
  });

  it("duration 측정", async () => {
    const slow: Stage = {
      name: "slow",
      execute: async (ctx) => {
        await new Promise((r) => setTimeout(r, 50));
        return ctx;
      },
    };

    const pipeline = createPipeline([slow]);
    const result = await pipeline.run(makeCtx());

    expect(result.duration).toBeGreaterThanOrEqual(40);
    expect(result.stageResults[0].duration).toBeGreaterThanOrEqual(40);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter infra-engine test -- --run __tests__/core/pipeline.test.ts`
Expected: FAIL — `createPipeline` 미존재

- [ ] **Step 3: pipeline.ts 구현**

```typescript
// core/pipeline.ts
import type { DeployContext, DeployPipeline, DeployResult, Stage, StageResult } from "./types.js";

export function createPipeline(stages: Stage[]): DeployPipeline {
  return {
    stages,
    async run(input: DeployContext): Promise<DeployResult> {
      const startTime = Date.now();
      const stageResults: StageResult[] = [];
      const completedStages: Stage[] = [];
      let ctx = input;

      for (const stage of stages) {
        const stageStart = Date.now();
        try {
          ctx = await stage.execute(ctx);
          stageResults.push({
            stage: stage.name,
            status: "success",
            duration: Date.now() - stageStart,
          });
          completedStages.push(stage);
        } catch (err) {
          stageResults.push({
            stage: stage.name,
            status: "failed",
            duration: Date.now() - stageStart,
            error: err instanceof Error ? err.message : String(err),
          });

          // 역순 rollback (완료된 스테이지만)
          for (let i = completedStages.length - 1; i >= 0; i--) {
            const completed = completedStages[i];
            const idx = stageResults.findIndex((r) => r.stage === completed.name);
            if (completed.rollback) {
              try {
                await completed.rollback(ctx);
                stageResults[idx].status = "rolled_back";
              } catch {
                // rollback 실패는 무시 (best-effort)
              }
            } else {
              stageResults[idx].status = "skipped";
            }
          }

          return {
            success: false,
            healthStatus: "failed",
            gateVerdict: "fail",
            duration: Date.now() - startTime,
            stageResults,
          };
        }
      }

      return {
        success: true,
        endpoint: ctx.provision?.outputs.endpoint,
        healthStatus: ctx.verification?.healthStatus ?? "healthy",
        gateVerdict: ctx.verification?.gateVerdict ?? "pass",
        duration: Date.now() - startTime,
        stageResults,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter infra-engine test -- --run __tests__/core/pipeline.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: index.ts 업데이트 + 커밋**

```typescript
// index.ts
export * from "./core/types.js";
export { createPipeline } from "./core/pipeline.js";
```

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): 파이프라인 실행기 — 순차 실행 + 역순 rollback"
```

---

## Task 3: 어댑터 인터페이스 6개 포트 정의

**Files:**
- Create: `packages/infra-engine/src/adapters/adapter.ts`

- [ ] **Step 1: 6개 포트 인터페이스 작성**

```typescript
// adapters/adapter.ts
import type {
  DeployContext,
  GateCheckResult,
  GateVerdict,
  InfraDeploymentEntry,
  MonitorTarget,
  ResolvedConfig,
} from "../core/types.js";

// --- 1. RegistryAdapter ---
export interface DeploymentSyncParams {
  serviceId: string;
  deploymentVersion: string;
  runtime: {
    namespace: string;
    name: string;
    env: string;
    region: string;
  };
  provider: string;
  project: string;
  stack: string;
  resourceKey: string;
  url?: string;
  urn?: string;
  outputs?: Record<string, unknown>;
  catalogId?: string;
}

export interface DeploymentSyncResult {
  synced: boolean;
  manifestImpact?: string;
}

export interface RegistryAdapter {
  syncDeployment(params: DeploymentSyncParams): Promise<DeploymentSyncResult>;
}

// --- 2. ServiceProfileAdapter ---
export interface ServiceProfileAdapter {
  get(serviceId: string): Promise<string | null>;
  set(serviceId: string, url: string): Promise<void>;
  restore(serviceId: string): Promise<void>;
}

// --- 3. InfraProfileAdapter ---
export interface InfraProfileAdapter {
  setDeployment(serviceId: string, entry: InfraDeploymentEntry): Promise<void>;
  getDeployment(serviceId: string): Promise<InfraDeploymentEntry | null>;
  getAllDeployments(): Promise<Record<string, InfraDeploymentEntry>>;
  restore(serviceId: string): Promise<void>;
  setMonitor(serviceId: string, target: MonitorTarget): Promise<void>;
  removeMonitor(serviceId: string): Promise<void>;
  getAllMonitors(): Promise<MonitorTarget[]>;
  updateMonitorStatus(serviceId: string, status: string, checkedAt: string): Promise<void>;
}

// --- 4. IngestAdapter ---
export interface IngestAdapter {
  emit(
    eventKey: string,
    payload: Record<string, unknown>,
    addressContext: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string }>;
}

// --- 5. CoordinateAdapter ---
export interface CoordinateAdapter {
  resolveSvcRef(serviceId: string, env: string, region: string, namespace?: string): string | null;
  encodeDeployEvent(svcRef: string | null, action: string, actor?: string): Record<string, string>;
  encodeHealthEvent(svcRef: string | null, status: string): Record<string, string>;
}

// --- 6. GateAdapter ---
export interface GateAdapter {
  evaluate(checks: GateCheckResult[]): GateVerdict;
}

// --- Adapters 묶음 ---
export interface Adapters {
  registry: RegistryAdapter;
  serviceProfile: ServiceProfileAdapter;
  infraProfile: InfraProfileAdapter;
  ingest: IngestAdapter;
  coordinate: CoordinateAdapter;
  gate: GateAdapter;
}

// --- Provider 인터페이스 ---
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DeployProvider {
  readonly name: string;
  getProgram(config: ResolvedConfig, serviceId: string): unknown; // PulumiFn
  destroy(stackName: string): Promise<void>;
  validate(config: ResolvedConfig): Promise<ValidationResult>;
}
```

- [ ] **Step 2: index.ts 업데이트 + 커밋**

```typescript
// index.ts
export * from "./core/types.js";
export { createPipeline } from "./core/pipeline.js";
export type * from "./adapters/adapter.js";
```

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): 어댑터 6개 포트 + DeployProvider 인터페이스"
```

---

## Task 4: GateAdapter + InfraProfileAdapter 구현 (TDD)

**Files:**
- Create: `packages/infra-engine/src/adapters/gate.ts`
- Create: `packages/infra-engine/src/adapters/infra-profile.ts`
- Create: `packages/infra-engine/__tests__/adapters/gate.test.ts`
- Create: `packages/infra-engine/__tests__/adapters/infra-profile.test.ts`

- [ ] **Step 1: GateAdapter 테스트**

```typescript
// __tests__/adapters/gate.test.ts
import { describe, it, expect } from "vitest";
import { createGateAdapter } from "../../src/adapters/gate.js";
import type { GateCheckResult } from "../../src/core/types.js";

describe("GateAdapter", () => {
  const gate = createGateAdapter();

  it("모든 게이트 pass → pass", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "200 OK" },
      { gate: "latency", verdict: "pass", detail: "50ms" },
    ];
    expect(gate.evaluate(checks)).toBe("pass");
  });

  it("빈 체크 → pass", () => {
    expect(gate.evaluate([])).toBe("pass");
  });

  it("하나라도 fail → fail", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "ok" },
      { gate: "db", verdict: "fail", detail: "timeout" },
    ];
    expect(gate.evaluate(checks)).toBe("fail");
  });

  it("fail 없고 warn 있으면 → warn", () => {
    const checks: GateCheckResult[] = [
      { gate: "health", verdict: "pass", detail: "ok" },
      { gate: "latency", verdict: "warn", detail: "2.5s" },
    ];
    expect(gate.evaluate(checks)).toBe("warn");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter infra-engine test -- --run __tests__/adapters/gate.test.ts`
Expected: FAIL

- [ ] **Step 3: GateAdapter 구현**

```typescript
// adapters/gate.ts
import type { GateAdapter, GateCheckResult, GateVerdict } from "../core/types.js";

export function createGateAdapter(): GateAdapter {
  return {
    evaluate(checks: GateCheckResult[]): GateVerdict {
      if (checks.some((c) => c.verdict === "fail")) return "fail";
      if (checks.some((c) => c.verdict === "warn")) return "warn";
      return "pass";
    },
  };
}
```

- [ ] **Step 4: GateAdapter 테스트 통과 확인**

Run: `pnpm --filter infra-engine test -- --run __tests__/adapters/gate.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: InfraProfileAdapter 테스트**

```typescript
// __tests__/adapters/infra-profile.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createInfraProfileAdapter } from "../../src/adapters/infra-profile.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InfraDeploymentEntry, MonitorTarget } from "../../src/core/types.js";

const entry: InfraDeploymentEntry = {
  serviceId: "test-svc",
  provider: "local",
  env: "dev",
  region: "local",
  endpoint: "http://localhost:3200",
  healthPath: "/health",
  stackName: "test-svc-dev-local-local",
  deploymentVersion: "abc123",
  deployedAt: "2026-04-05T00:00:00Z",
  triggeredBy: "manual",
  metadata: {},
};

describe("InfraProfileAdapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "infra-profile-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("setDeployment + getDeployment 라운드트립", async () => {
    const adapter = createInfraProfileAdapter(dir);
    await adapter.setDeployment("test-svc", entry);
    const result = await adapter.getDeployment("test-svc");
    expect(result).toEqual(entry);
  });

  it("존재하지 않는 서비스 → null", async () => {
    const adapter = createInfraProfileAdapter(dir);
    expect(await adapter.getDeployment("nope")).toBeNull();
  });

  it("restore — 이전 값 복원", async () => {
    const adapter = createInfraProfileAdapter(dir);
    await adapter.setDeployment("test-svc", entry);
    await adapter.setDeployment("test-svc", { ...entry, endpoint: "http://new:3200" });
    await adapter.restore("test-svc");
    const result = await adapter.getDeployment("test-svc");
    expect(result?.endpoint).toBe("http://localhost:3200");
  });

  it("모니터 등록 + 조회", async () => {
    const adapter = createInfraProfileAdapter(dir);
    const target: MonitorTarget = {
      serviceId: "test-svc",
      endpoint: "http://localhost:3200",
      healthPath: "/health",
      provider: "local",
      env: "dev",
      region: "local",
      namespace: "shop",
      interval: 60,
    };
    await adapter.setMonitor("test-svc", target);
    const all = await adapter.getAllMonitors();
    expect(all).toHaveLength(1);
    expect(all[0].serviceId).toBe("test-svc");
  });
});
```

- [ ] **Step 6: InfraProfileAdapter 구현**

```typescript
// adapters/infra-profile.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { InfraProfileAdapter } from "./adapter.js";
import type { InfraDeploymentEntry, MonitorTarget } from "../core/types.js";

interface InfraProfileData {
  deployments: Record<string, InfraDeploymentEntry>;
  monitors: MonitorTarget[];
}

const PROFILE_FILE = "infra-profile.json";
const ROLLBACK_FILE = "infra-profile.rollback.json";

export function createInfraProfileAdapter(baseDir: string): InfraProfileAdapter {
  const profilePath = join(baseDir, PROFILE_FILE);
  const rollbackPath = join(baseDir, ROLLBACK_FILE);

  async function load(): Promise<InfraProfileData> {
    try {
      const raw = await readFile(profilePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { deployments: {}, monitors: [] };
    }
  }

  async function save(data: InfraProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(profilePath, JSON.stringify(data, null, 2));
  }

  async function saveRollback(data: InfraProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(rollbackPath, JSON.stringify(data, null, 2));
  }

  async function loadRollback(): Promise<InfraProfileData> {
    try {
      const raw = await readFile(rollbackPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { deployments: {}, monitors: [] };
    }
  }

  return {
    async setDeployment(serviceId, entry) {
      const data = await load();
      await saveRollback(data); // 이전 상태 백업
      data.deployments[serviceId] = entry;
      await save(data);
    },
    async getDeployment(serviceId) {
      const data = await load();
      return data.deployments[serviceId] ?? null;
    },
    async getAllDeployments() {
      const data = await load();
      return data.deployments;
    },
    async restore(serviceId) {
      const rollback = await loadRollback();
      const current = await load();
      if (rollback.deployments[serviceId]) {
        current.deployments[serviceId] = rollback.deployments[serviceId];
      } else {
        delete current.deployments[serviceId];
      }
      await save(current);
    },
    async setMonitor(serviceId, target) {
      const data = await load();
      data.monitors = data.monitors.filter((m) => m.serviceId !== serviceId);
      data.monitors.push(target);
      await save(data);
    },
    async removeMonitor(serviceId) {
      const data = await load();
      data.monitors = data.monitors.filter((m) => m.serviceId !== serviceId);
      await save(data);
    },
    async getAllMonitors() {
      const data = await load();
      return data.monitors;
    },
    async updateMonitorStatus(serviceId, status, checkedAt) {
      const data = await load();
      const target = data.monitors.find((m) => m.serviceId === serviceId);
      if (target) {
        target.lastStatus = status as MonitorTarget["lastStatus"];
        target.lastChecked = checkedAt;
        await save(data);
      }
    },
  };
}
```

- [ ] **Step 7: 전체 테스트 통과 확인 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: 모든 테스트 PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): GateAdapter + InfraProfileAdapter 구현"
```

---

## Task 5: 설정 스키마 + SopsLoader (TDD)

**Files:**
- Create: `packages/infra-engine/src/config/config-schema.ts`
- Create: `packages/infra-engine/src/config/sops-loader.ts`
- Create: `packages/infra-engine/src/config/config-stage.ts`
- Create: `packages/infra-engine/src/config/env-bridge.ts`
- Create: `packages/infra-engine/__tests__/config/config-schema.test.ts`
- Create: `packages/infra-engine/__tests__/config/sops-loader.test.ts`
- Create: `packages/infra-engine/__tests__/config/config-stage.test.ts`

- [ ] **Step 1: config-schema zod 스키마 테스트**

```typescript
// __tests__/config/config-schema.test.ts
import { describe, it, expect } from "vitest";
import { configSchema } from "../../src/config/config-schema.js";

describe("configSchema", () => {
  it("유효한 설정 파싱", () => {
    const valid = {
      global: { region: "ap-northeast-2" },
      services: {
        "ingest-server": { port: 3200, store_driver: "memory" },
      },
      connections: {
        "ingest-server": { endpoint: "http://localhost:3200" },
      },
    };
    expect(() => configSchema.parse(valid)).not.toThrow();
  });

  it("global.region 누락 → 에러", () => {
    const invalid = {
      global: {},
      services: {},
      connections: {},
    };
    expect(() => configSchema.parse(invalid)).toThrow();
  });

  it("monitoring 선택 필드", () => {
    const withMonitoring = {
      global: { region: "local" },
      services: {},
      connections: {},
      monitoring: { interval: 30, webhooks: [{ url: "https://hook", events: ["OutOfSync"] }] },
    };
    const result = configSchema.parse(withMonitoring);
    expect(result.monitoring?.interval).toBe(30);
  });
});
```

- [ ] **Step 2: config-schema.ts 구현**

```typescript
// config/config-schema.ts
import { z } from "zod";

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
});

const monitoringSchema = z.object({
  interval: z.number().positive().default(60),
  webhooks: z.array(webhookSchema).optional(),
});

const gateDefSchema = z.object({
  name: z.string(),
  type: z.literal("custom"),
  check: z.string(),
  expect_status: z.number(),
  required: z.boolean(),
});

const serviceConfigSchema = z.object({
  port: z.number(),
  depends_on: z.array(z.string()).optional(),
  gates: z.array(gateDefSchema).optional(),
}).passthrough();

const connectionConfigSchema = z.object({
  endpoint: z.string(),
  health_path: z.string().optional(),
}).passthrough();

const globalConfigSchema = z.object({
  region: z.string(),
}).passthrough();

export const configSchema = z.object({
  global: globalConfigSchema,
  services: z.record(serviceConfigSchema),
  connections: z.record(connectionConfigSchema),
  monitoring: monitoringSchema.optional(),
});

export type ParsedConfig = z.infer<typeof configSchema>;
```

- [ ] **Step 3: sops-loader 테스트 (execa 모킹)**

```typescript
// __tests__/config/sops-loader.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { createSopsLoader } from "../../src/config/sops-loader.js";
import { execa } from "execa";

const mockedExeca = vi.mocked(execa);

describe("SopsLoader", () => {
  const loader = createSopsLoader();

  it("sops CLI 호출 → JSON 파싱", async () => {
    const jsonOutput = JSON.stringify({ global: { region: "local" }, services: {}, connections: {} });
    mockedExeca.mockResolvedValueOnce({ stdout: jsonOutput } as any);

    const result = await loader.decrypt("config/dev.yaml");
    expect(result).toEqual({ global: { region: "local" }, services: {}, connections: {} });
    expect(mockedExeca).toHaveBeenCalledWith("sops", ["--decrypt", "--output-type", "json", "config/dev.yaml"]);
  });

  it("sops 미설치 → 에러 메시지", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("ENOENT"));
    await expect(loader.decrypt("config/dev.yaml")).rejects.toThrow("sops");
  });
});
```

- [ ] **Step 4: sops-loader.ts 구현**

```typescript
// config/sops-loader.ts
import { execa } from "execa";

export interface SopsLoader {
  decrypt(configPath: string): Promise<Record<string, unknown>>;
}

export function createSopsLoader(): SopsLoader {
  return {
    async decrypt(configPath) {
      try {
        const { stdout } = await execa("sops", ["--decrypt", "--output-type", "json", configPath]);
        return JSON.parse(stdout);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          throw new Error("sops CLI가 설치되어 있지 않습니다. brew install sops 또는 공식 릴리스에서 설치하세요.");
        }
        throw new Error(`SOPS 복호화 실패: ${msg}`);
      }
    },
  };
}
```

- [ ] **Step 5: ConfigStage 테스트**

```typescript
// __tests__/config/config-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { createConfigStage } from "../../src/config/config-stage.js";
import type { DeployContext } from "../../src/core/types.js";
import type { SopsLoader } from "../../src/config/sops-loader.js";

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
  };
}

describe("ConfigStage", () => {
  it("복호화 + 검증 → ctx.config 채움", async () => {
    const mockLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: { region: "local" },
        services: { "test-svc": { port: 3200 } },
        connections: { "test-svc": { endpoint: "http://localhost:3200" } },
      })),
    };

    const stage = createConfigStage(mockLoader);
    const result = await stage.execute(makeCtx());

    expect(result.config).toBeDefined();
    expect(result.config!.global.region).toBe("local");
    expect(result.config!.services["test-svc"].port).toBe(3200);
  });

  it("검증 실패 → throw", async () => {
    const mockLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: {}, // region 누락
        services: {},
        connections: {},
      })),
    };

    const stage = createConfigStage(mockLoader);
    await expect(stage.execute(makeCtx())).rejects.toThrow();
  });
});
```

- [ ] **Step 6: config-stage.ts + env-bridge.ts 구현**

```typescript
// config/config-stage.ts
import type { Stage, DeployContext, ResolvedConfig } from "../core/types.js";
import type { SopsLoader } from "./sops-loader.js";
import { configSchema } from "./config-schema.js";

export function createConfigStage(loader: SopsLoader): Stage {
  return {
    name: "config",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const raw = await loader.decrypt(ctx.configPath);
      const config = configSchema.parse(raw) as ResolvedConfig;
      return { ...ctx, config };
    },
    // rollback 없음 — 읽기 전용
  };
}
```

```typescript
// config/env-bridge.ts
import type { ResolvedConfig } from "../core/types.js";

export function extractServiceEnv(config: ResolvedConfig, serviceId: string): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(svc)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      env[key.toUpperCase()] = String(value);
    }
  }
  return env;
}

export function resolveConnectionEnv(config: ResolvedConfig, serviceId: string): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc?.depends_on) return {};
  const env: Record<string, string> = {};
  for (const dep of svc.depends_on) {
    const conn = config.connections[dep];
    if (conn?.endpoint) {
      const envKey = dep.replace(/-/g, "_").toUpperCase() + "_URL";
      env[envKey] = conn.endpoint;
    }
  }
  return env;
}
```

- [ ] **Step 7: 전체 테스트 통과 확인 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): ConfigStage — SOPS 복호화 + zod 검증 + env-bridge"
```

---

## Task 6: 헬스체크 + VerifyStage (TDD)

**Files:**
- Create: `packages/infra-engine/src/verify/health-check.ts`
- Create: `packages/infra-engine/src/verify/gate-definitions.ts`
- Create: `packages/infra-engine/src/verify/verify-stage.ts`
- Create: `packages/infra-engine/__tests__/verify/health-check.test.ts`
- Create: `packages/infra-engine/__tests__/verify/verify-stage.test.ts`

- [ ] **Step 1: health-check 테스트**

```typescript
// __tests__/verify/health-check.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpProbe } from "../../src/verify/health-check.js";

// fetch를 모킹
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("httpProbe", () => {
  afterEach(() => vi.restoreAllMocks());

  it("200 → pass", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const result = await httpProbe("http://localhost:3200/health");
    expect(result.verdict).toBe("pass");
  });

  it("500 → fail", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await httpProbe("http://localhost:3200/health");
    expect(result.verdict).toBe("fail");
  });

  it("네트워크 에러 → fail", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await httpProbe("http://localhost:3200/health");
    expect(result.verdict).toBe("fail");
    expect(result.detail).toContain("ECONNREFUSED");
  });
});
```

- [ ] **Step 2: health-check.ts 구현**

```typescript
// verify/health-check.ts
import type { GateCheckResult } from "../core/types.js";

export async function httpProbe(
  url: string,
  options?: { timeout?: number },
): Promise<GateCheckResult> {
  const timeout = options?.timeout ?? 10_000;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    const latency = Date.now() - start;
    if (res.ok) {
      return { gate: "http-probe", verdict: "pass", detail: `${res.status}`, latency };
    }
    return { gate: "http-probe", verdict: "fail", detail: `status ${res.status}`, latency };
  } catch (err) {
    return {
      gate: "http-probe",
      verdict: "fail",
      detail: err instanceof Error ? err.message : String(err),
      latency: Date.now() - start,
    };
  }
}
```

- [ ] **Step 3: VerifyStage 테스트**

```typescript
// __tests__/verify/verify-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { createVerifyStage } from "../../src/verify/verify-stage.js";
import type { DeployContext, GateCheckResult } from "../../src/core/types.js";
import type { GateAdapter } from "../../src/adapters/adapter.js";

vi.stubGlobal("fetch", vi.fn());
const mockFetch = vi.mocked(globalThis.fetch);

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    config: {
      global: { region: "local" },
      services: { "test-svc": { port: 3200 } },
      connections: {},
    },
    provision: {
      stackName: "test",
      outputs: { endpoint: "http://localhost:3200" },
      provider: "local",
      region: "local",
      duration: 100,
    },
  };
}

describe("VerifyStage", () => {
  it("헬스체크 pass → healthy", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
    const gate: GateAdapter = { evaluate: () => "pass" };
    const stage = createVerifyStage(gate);
    const result = await stage.execute(makeCtx());
    expect(result.verification?.healthStatus).toBe("healthy");
  });

  it("헬스체크 fail → failed", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const gate: GateAdapter = { evaluate: () => "fail" };
    const stage = createVerifyStage(gate, { maxRetries: 1, retryDelay: 0 });
    await expect(stage.execute(makeCtx())).rejects.toThrow();
  });
});
```

- [ ] **Step 4: verify-stage.ts + gate-definitions.ts 구현**

```typescript
// verify/gate-definitions.ts
import type { GateCheckResult, DeployContext } from "../core/types.js";
import { httpProbe } from "./health-check.js";

export async function runBuiltinGates(ctx: DeployContext): Promise<GateCheckResult[]> {
  const endpoint = ctx.provision!.outputs.endpoint;
  const healthPath = ctx.config?.connections[ctx.service]?.health_path ?? "/health";
  const checks: GateCheckResult[] = [];

  // 1. health-endpoint 게이트
  const healthResult = await httpProbe(`${endpoint}${healthPath}`);
  checks.push({ ...healthResult, gate: "health-endpoint" });

  // 2. response-time 게이트
  if (healthResult.latency != null) {
    const verdict = healthResult.latency > 10_000 ? "fail" : healthResult.latency > 2_000 ? "warn" : "pass";
    checks.push({
      gate: "response-time",
      verdict,
      detail: `${healthResult.latency}ms`,
      latency: healthResult.latency,
    });
  }

  // 3. dependency-reach 게이트
  const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
  for (const dep of deps) {
    const conn = ctx.config?.connections[dep];
    if (conn?.endpoint) {
      const depHealth = conn.health_path ?? "/health";
      const depResult = await httpProbe(`${conn.endpoint}${depHealth}`, { timeout: 5_000 });
      checks.push({ ...depResult, gate: `dependency-reach:${dep}` });
    }
  }

  return checks;
}
```

```typescript
// verify/verify-stage.ts
import type { Stage, DeployContext, VerifyResult, GateCheckResult } from "../core/types.js";
import type { GateAdapter } from "../adapters/adapter.js";
import { runBuiltinGates } from "./gate-definitions.js";

interface VerifyOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export function createVerifyStage(gate: GateAdapter, options?: VerifyOptions): Stage {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelay = options?.retryDelay ?? 5_000;

  return {
    name: "verify",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const start = Date.now();
      let checks: GateCheckResult[] = [];
      let retryCount = 0;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        checks = await runBuiltinGates(ctx);
        const verdict = gate.evaluate(checks);
        if (verdict !== "fail") {
          const verification: VerifyResult = {
            healthStatus: verdict === "pass" ? "healthy" : "degraded",
            gateVerdict: verdict,
            checks,
            retryCount: attempt,
            totalDuration: Date.now() - start,
          };
          return { ...ctx, verification };
        }
        retryCount = attempt;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }

      // 최종 실패 → throw (파이프라인 rollback 트리거)
      throw new Error(
        `VerifyStage 실패 (${retryCount + 1}회 시도): ${checks.filter((c) => c.verdict === "fail").map((c) => `${c.gate}: ${c.detail}`).join(", ")}`,
      );
    },
    // rollback 없음 — 읽기 전용 검증
  };
}
```

- [ ] **Step 5: 테스트 통과 확인 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): VerifyStage — 헬스체크 + 품질 게이트 + retry"
```

---

## Task 7: RegisterStage (TDD)

**Files:**
- Create: `packages/infra-engine/src/adapters/service-profile.ts`
- Create: `packages/infra-engine/src/stages/register-stage.ts`
- Create: `packages/infra-engine/__tests__/adapters/service-profile.test.ts`
- Create: `packages/infra-engine/__tests__/stages/register-stage.test.ts`

- [ ] **Step 1: ServiceProfileAdapter 테스트**

```typescript
// __tests__/adapters/service-profile.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServiceProfileAdapter } from "../../src/adapters/service-profile.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ServiceProfileAdapter", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "svc-profile-"));
    await writeFile(
      join(dir, "service-profile.json"),
      JSON.stringify({ mode: "local", insightsDriver: "local", services: { "test-svc": "http://old:3200" } }),
    );
  });

  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("get 기존 URL", async () => {
    const adapter = createServiceProfileAdapter(dir);
    expect(await adapter.get("test-svc")).toBe("http://old:3200");
  });

  it("set → URL 업데이트", async () => {
    const adapter = createServiceProfileAdapter(dir);
    await adapter.set("test-svc", "http://new:3200");
    expect(await adapter.get("test-svc")).toBe("http://new:3200");
  });

  it("restore → 이전 URL 복원", async () => {
    const adapter = createServiceProfileAdapter(dir);
    await adapter.set("test-svc", "http://new:3200");
    await adapter.restore("test-svc");
    expect(await adapter.get("test-svc")).toBe("http://old:3200");
  });
});
```

- [ ] **Step 2: service-profile.ts 구현**

```typescript
// adapters/service-profile.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ServiceProfileAdapter } from "./adapter.js";

const PROFILE = "service-profile.json";
const ROLLBACK = "service-profile.rollback.json";

interface ProfileData {
  mode: string;
  insightsDriver: string;
  services: Record<string, string>;
  [key: string]: unknown;
}

export function createServiceProfileAdapter(baseDir: string): ServiceProfileAdapter {
  const profilePath = join(baseDir, PROFILE);
  const rollbackPath = join(baseDir, ROLLBACK);

  async function load(): Promise<ProfileData> {
    try {
      return JSON.parse(await readFile(profilePath, "utf-8"));
    } catch {
      return { mode: "local", insightsDriver: "local", services: {} };
    }
  }

  async function save(data: ProfileData): Promise<void> {
    await mkdir(baseDir, { recursive: true });
    await writeFile(profilePath, JSON.stringify(data, null, 2));
  }

  return {
    async get(serviceId) {
      const data = await load();
      return data.services[serviceId] ?? null;
    },
    async set(serviceId, url) {
      const data = await load();
      // rollback 백업
      await writeFile(rollbackPath, JSON.stringify(data, null, 2));
      data.services[serviceId] = url;
      await save(data);
    },
    async restore(serviceId) {
      try {
        const rollback: ProfileData = JSON.parse(await readFile(rollbackPath, "utf-8"));
        const current = await load();
        current.services[serviceId] = rollback.services[serviceId] ?? current.services[serviceId];
        await save(current);
      } catch {
        // rollback 파일 없으면 무시
      }
    },
  };
}
```

- [ ] **Step 3: RegisterStage 테스트**

```typescript
// __tests__/stages/register-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { createRegisterStage } from "../../src/stages/register-stage.js";
import type { DeployContext } from "../../src/core/types.js";
import type { RegistryAdapter, ServiceProfileAdapter, InfraProfileAdapter } from "../../src/adapters/adapter.js";

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    config: {
      global: { region: "local" },
      services: { "test-svc": { port: 3200 } },
      connections: {},
    },
    provision: {
      stackName: "test-svc-dev-local-local",
      outputs: { endpoint: "http://localhost:3200" },
      provider: "local",
      region: "local",
      duration: 100,
    },
  };
}

describe("RegisterStage", () => {
  it("등록 + 프로필 갱신 성공", async () => {
    const registry: RegistryAdapter = {
      syncDeployment: vi.fn(async () => ({ synced: true })),
    };
    const profile: ServiceProfileAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      restore: vi.fn(async () => {}),
    };
    const infraProfile: InfraProfileAdapter = {
      setDeployment: vi.fn(async () => {}),
      getDeployment: vi.fn(async () => null),
      getAllDeployments: vi.fn(async () => ({})),
      restore: vi.fn(async () => {}),
      setMonitor: vi.fn(async () => {}),
      removeMonitor: vi.fn(async () => {}),
      getAllMonitors: vi.fn(async () => []),
      updateMonitorStatus: vi.fn(async () => {}),
    };

    const stage = createRegisterStage(registry, profile, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.registration?.synced).toBe(true);
    expect(result.registration?.profileUpdated).toBe(true);
    expect(registry.syncDeployment).toHaveBeenCalledOnce();
    expect(profile.set).toHaveBeenCalledWith("test-svc", "http://localhost:3200");
  });
});
```

- [ ] **Step 4: register-stage.ts 구현**

```typescript
// stages/register-stage.ts
import type { Stage, DeployContext, RegistrationResult, ConnectionCheck } from "../core/types.js";
import type { RegistryAdapter, ServiceProfileAdapter, InfraProfileAdapter } from "../adapters/adapter.js";

export function createRegisterStage(
  registry: RegistryAdapter,
  profile: ServiceProfileAdapter,
  infraProfile: InfraProfileAdapter,
): Stage {
  return {
    name: "register",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const provision = ctx.provision!;
      const endpoint = provision.outputs.endpoint;

      // 1. registry-service 동기화
      const syncResult = await registry.syncDeployment({
        serviceId: ctx.service,
        deploymentVersion: provision.outputs.version ?? "unknown",
        runtime: {
          namespace: "default",
          name: ctx.service,
          env: ctx.env,
          region: ctx.region,
        },
        provider: ctx.provider,
        project: `infra-engine-${ctx.service}`,
        stack: provision.stackName,
        resourceKey: provision.outputs.resourceId ?? ctx.service,
        url: endpoint,
        outputs: provision.outputs,
      });

      // 2. service-profile URL 업데이트
      await profile.set(ctx.service, endpoint);

      // 3. infra-profile 확장 메타데이터 기록
      await infraProfile.setDeployment(ctx.service, {
        serviceId: ctx.service,
        provider: ctx.provider,
        env: ctx.env,
        region: ctx.region,
        endpoint,
        healthPath: ctx.config?.connections[ctx.service]?.health_path ?? "/health",
        stackName: provision.stackName,
        deploymentVersion: provision.outputs.version ?? "unknown",
        deployedAt: new Date().toISOString(),
        triggeredBy: ctx.triggeredBy,
        metadata: {},
      });

      // 4. 연결 사전 검증
      const connectionChecks: ConnectionCheck[] = [];
      const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
      for (const dep of deps) {
        const conn = ctx.config?.connections[dep];
        if (conn?.endpoint) {
          try {
            const start = Date.now();
            await fetch(conn.endpoint + (conn.health_path ?? "/health"), {
              method: "HEAD",
              signal: AbortSignal.timeout(5_000),
            });
            connectionChecks.push({ target: dep, reachable: true, latency: Date.now() - start });
          } catch {
            connectionChecks.push({ target: dep, reachable: false });
          }
        }
      }

      const registration: RegistrationResult = {
        synced: syncResult.synced,
        manifestImpact: syncResult.manifestImpact,
        profileUpdated: true,
        infraProfileUpdated: true,
        connectionChecks,
      };

      return { ...ctx, registration };
    },

    async rollback(ctx: DeployContext): Promise<void> {
      await infraProfile.restore(ctx.service);
      await profile.restore(ctx.service);
    },
  };
}
```

- [ ] **Step 5: 테스트 통과 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): RegisterStage — registry sync + 프로필 갱신 + rollback"
```

---

## Task 8: ObserveStage (TDD)

**Files:**
- Create: `packages/infra-engine/src/stages/observe-stage.ts`
- Create: `packages/infra-engine/__tests__/stages/observe-stage.test.ts`

- [ ] **Step 1: ObserveStage 테스트**

```typescript
// __tests__/stages/observe-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { createObserveStage } from "../../src/stages/observe-stage.js";
import type { DeployContext } from "../../src/core/types.js";
import type { IngestAdapter, CoordinateAdapter, InfraProfileAdapter } from "../../src/adapters/adapter.js";

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    config: { global: { region: "local" }, services: {}, connections: {} },
    provision: {
      stackName: "test",
      outputs: { endpoint: "http://localhost:3200" },
      provider: "local",
      region: "local",
      duration: 100,
    },
    verification: {
      healthStatus: "healthy",
      gateVerdict: "pass",
      checks: [],
      retryCount: 0,
      totalDuration: 50,
    },
  };
}

describe("ObserveStage", () => {
  it("emit 성공 + 모니터 등록", async () => {
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: true })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: vi.fn(() => "service:v1:42"),
      encodeDeployEvent: vi.fn(() => ({ deploy_event: "deploy_event:v1:100" })),
      encodeHealthEvent: vi.fn(() => ({})),
    };
    const infraProfile: InfraProfileAdapter = {
      setDeployment: vi.fn(async () => {}),
      getDeployment: vi.fn(async () => null),
      getAllDeployments: vi.fn(async () => ({})),
      restore: vi.fn(async () => {}),
      setMonitor: vi.fn(async () => {}),
      removeMonitor: vi.fn(async () => {}),
      getAllMonitors: vi.fn(async () => []),
      updateMonitorStatus: vi.fn(async () => {}),
    };

    const stage = createObserveStage(ingest, coord, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.observation?.eventEmitted).toBe(true);
    expect(result.observation?.monitorRegistered).toBe(true);
    expect(ingest.emit).toHaveBeenCalledOnce();
    expect(infraProfile.setMonitor).toHaveBeenCalledOnce();
  });

  it("ingest 실패 → fail-open (warnings)", async () => {
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: false, error: "timeout" })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: () => null,
      encodeDeployEvent: () => ({}),
      encodeHealthEvent: () => ({}),
    };
    const infraProfile: InfraProfileAdapter = {
      setDeployment: vi.fn(async () => {}),
      getDeployment: vi.fn(async () => null),
      getAllDeployments: vi.fn(async () => ({})),
      restore: vi.fn(async () => {}),
      setMonitor: vi.fn(async () => {}),
      removeMonitor: vi.fn(async () => {}),
      getAllMonitors: vi.fn(async () => []),
      updateMonitorStatus: vi.fn(async () => {}),
    };

    const stage = createObserveStage(ingest, coord, infraProfile);
    const result = await stage.execute(makeCtx());

    expect(result.observation?.eventEmitted).toBe(false);
    expect(result.observation?.warnings).toContain("timeout");
  });
});
```

- [ ] **Step 2: observe-stage.ts 구현**

```typescript
// stages/observe-stage.ts
import type { Stage, DeployContext, ObserveResult, StageResult } from "../core/types.js";
import type { IngestAdapter, CoordinateAdapter, InfraProfileAdapter } from "../adapters/adapter.js";

function mapHealthStatus(status: "healthy" | "degraded" | "failed"): "healthy" | "degraded" | "unhealthy" {
  return status === "failed" ? "unhealthy" : status;
}

export function createObserveStage(
  ingest: IngestAdapter,
  coordinate: CoordinateAdapter,
  infraProfile: InfraProfileAdapter,
): Stage {
  return {
    name: "observe",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const warnings: string[] = [];
      let eventEmitted = false;
      let monitorRegistered = false;

      // 1. 좌표 해석 (fail-open)
      const svcRef = coordinate.resolveSvcRef(ctx.service, ctx.env, ctx.region);
      const action = ctx.verification?.healthStatus === "failed" ? "rollback" : "deploy";
      const addressContext = coordinate.encodeDeployEvent(svcRef, action);

      // 2. ingest emit (fail-open)
      try {
        const payload = {
          service_id: ctx.service,
          provider: ctx.provider,
          env: ctx.env,
          region: ctx.region,
          endpoint: ctx.provision?.outputs.endpoint ?? "",
          health_status: mapHealthStatus(ctx.verification?.healthStatus ?? "healthy"),
          gate_verdict: ctx.verification?.gateVerdict ?? "pass",
          duration_ms: ctx.provision?.duration ?? 0,
          stage_results: [] as StageResult[], // 파이프라인 실행기가 나중에 채움
          triggered_by: ctx.triggeredBy,
          rollback: action === "rollback",
          stack_name: ctx.provision?.stackName ?? "",
        };

        const result = await ingest.emit("deploy_event", payload, addressContext);
        if (result.ok) {
          eventEmitted = true;
        } else {
          warnings.push(result.error ?? "ingest emit 실패");
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }

      // 3. 모니터 등록 (fail-open)
      try {
        await infraProfile.setMonitor(ctx.service, {
          serviceId: ctx.service,
          endpoint: ctx.provision?.outputs.endpoint ?? "",
          healthPath: ctx.config?.connections[ctx.service]?.health_path ?? "/health",
          provider: ctx.provider,
          env: ctx.env,
          region: ctx.region,
          namespace: "default",
          interval: ctx.config?.monitoring?.interval ?? 60,
        });
        monitorRegistered = true;
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }

      const observation: ObserveResult = { eventEmitted, monitorRegistered, warnings };
      return { ...ctx, observation };
    },
    // rollback 없음 — fail-open
  };
}
```

- [ ] **Step 3: 테스트 통과 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): ObserveStage — deploy_event emit + 모니터링 등록 (fail-open)"
```

---

## Task 9: DeployProvider 인터페이스 + 프로바이더 레지스트리

**Files:**
- Create: `packages/infra-engine/src/providers/provider.ts` (이미 adapter.ts에 타입 있음, re-export)
- Create: `packages/infra-engine/src/providers/registry.ts`

- [ ] **Step 1: 프로바이더 레지스트리 구현**

```typescript
// providers/registry.ts
import type { DeployProvider } from "../adapters/adapter.js";

const providers = new Map<string, DeployProvider>();

export function registerProvider(provider: DeployProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): DeployProvider {
  const p = providers.get(name);
  if (!p) throw new Error(`알 수 없는 프로바이더: ${name}. 등록된 프로바이더: ${[...providers.keys()].join(", ")}`);
  return p;
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): DeployProvider 레지스트리 — register/get/list"
```

---

## Task 10: ProvisionStage (TDD)

**Files:**
- Create: `packages/infra-engine/src/stages/provision-stage.ts`
- Create: `packages/infra-engine/__tests__/stages/provision-stage.test.ts`

- [ ] **Step 1: ProvisionStage 테스트 (프로바이더 모킹)**

```typescript
// __tests__/stages/provision-stage.test.ts
import { describe, it, expect, vi } from "vitest";
import { createProvisionStage } from "../../src/stages/provision-stage.js";
import type { DeployContext, ResolvedConfig } from "../../src/core/types.js";
import type { DeployProvider, ValidationResult } from "../../src/adapters/adapter.js";

function makeCtx(): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    config: {
      global: { region: "local" },
      services: { "test-svc": { port: 3200 } },
      connections: {},
    },
  };
}

function mockProvider(): DeployProvider {
  return {
    name: "local",
    getProgram: vi.fn(() => ({})),
    destroy: vi.fn(async () => {}),
    validate: vi.fn(async (): Promise<ValidationResult> => ({ valid: true, errors: [] })),
  };
}

describe("ProvisionStage", () => {
  it("프로바이더 검증 + 배포 → ProvisionResult", async () => {
    const provider = mockProvider();
    const deploy = vi.fn(async () => ({
      stackName: "test-svc-dev-local-local",
      outputs: { endpoint: "http://localhost:3200" },
    }));

    const stage = createProvisionStage(() => provider, deploy);
    const result = await stage.execute(makeCtx());

    expect(result.provision).toBeDefined();
    expect(result.provision!.outputs.endpoint).toBe("http://localhost:3200");
    expect(provider.validate).toHaveBeenCalledOnce();
  });

  it("검증 실패 → throw", async () => {
    const provider = mockProvider();
    vi.mocked(provider.validate).mockResolvedValueOnce({ valid: false, errors: ["API key missing"] });

    const stage = createProvisionStage(() => provider, vi.fn());
    await expect(stage.execute(makeCtx())).rejects.toThrow("API key missing");
  });
});
```

- [ ] **Step 2: provision-stage.ts 구현**

```typescript
// stages/provision-stage.ts
import type { Stage, DeployContext, ProvisionResult, ResolvedConfig } from "../core/types.js";
import type { DeployProvider } from "../adapters/adapter.js";

type DeployFn = (
  provider: DeployProvider,
  config: ResolvedConfig,
  serviceId: string,
  stackName: string,
) => Promise<{ stackName: string; outputs: Record<string, string> }>;

type ProviderResolver = (name: string) => DeployProvider;

export function createProvisionStage(
  resolveProvider: ProviderResolver,
  deployFn: DeployFn,
): Stage {
  let lastProvider: DeployProvider | null = null;
  let lastStackName: string | null = null;

  return {
    name: "provision",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const provider = resolveProvider(ctx.provider);
      lastProvider = provider;

      // 사전 검증
      const validation = await provider.validate(ctx.config!);
      if (!validation.valid) {
        throw new Error(`프로바이더 검증 실패 (${provider.name}): ${validation.errors.join(", ")}`);
      }

      const stackName = `${ctx.service}-${ctx.env}-${ctx.provider}-${ctx.region}`;
      lastStackName = stackName;
      const start = Date.now();

      const result = await deployFn(provider, ctx.config!, ctx.service, stackName);

      const provision: ProvisionResult = {
        stackName: result.stackName,
        outputs: result.outputs,
        provider: ctx.provider,
        region: ctx.region,
        duration: Date.now() - start,
      };

      return { ...ctx, provision };
    },

    async rollback(): Promise<void> {
      if (lastProvider && lastStackName) {
        await lastProvider.destroy(lastStackName);
      }
    },
  };
}
```

- [ ] **Step 3: 테스트 통과 + 커밋**

Run: `pnpm --filter infra-engine test -- --run`
Expected: PASS

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): ProvisionStage — 프로바이더 검증 + 배포 + rollback"
```

---

## Task 11: deploy() 통합 함수 + public API

**Files:**
- Modify: `packages/infra-engine/src/index.ts`

- [ ] **Step 1: deploy() 통합 함수**

```typescript
// index.ts — 최종 public API
export * from "./core/types.js";
export { createPipeline } from "./core/pipeline.js";
export type * from "./adapters/adapter.js";
export { createGateAdapter } from "./adapters/gate.js";
export { createInfraProfileAdapter } from "./adapters/infra-profile.js";
export { createServiceProfileAdapter } from "./adapters/service-profile.js";
export { createSopsLoader } from "./config/sops-loader.js";
export { createConfigStage } from "./config/config-stage.js";
export { extractServiceEnv, resolveConnectionEnv } from "./config/env-bridge.js";
export { createVerifyStage } from "./verify/verify-stage.js";
export { createRegisterStage } from "./stages/register-stage.js";
export { createObserveStage } from "./stages/observe-stage.js";
export { createProvisionStage } from "./stages/provision-stage.js";
export { registerProvider, getProvider, listProviders } from "./providers/registry.js";

import { createPipeline } from "./core/pipeline.js";
import { createConfigStage } from "./config/config-stage.js";
import { createSopsLoader } from "./config/sops-loader.js";
import { createVerifyStage } from "./verify/verify-stage.js";
import { createRegisterStage } from "./stages/register-stage.js";
import { createObserveStage } from "./stages/observe-stage.js";
import { createProvisionStage } from "./stages/provision-stage.js";
import { createGateAdapter } from "./adapters/gate.js";
import { getProvider } from "./providers/registry.js";
import type { Adapters, DeployProvider } from "./adapters/adapter.js";
import type { DeployContext, DeployResult, ResolvedConfig } from "./core/types.js";

export interface DeployOptions {
  service: string;
  provider: string;
  env: string;
  region: string;
  configPath: string;
  triggeredBy?: "ci" | "manual";
  adapters: Adapters;
  deployFn: (
    provider: DeployProvider,
    config: ResolvedConfig,
    serviceId: string,
    stackName: string,
  ) => Promise<{ stackName: string; outputs: Record<string, string> }>;
}

export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const sopsLoader = createSopsLoader();
  const gateAdapter = options.adapters.gate;

  const pipeline = createPipeline([
    createConfigStage(sopsLoader),
    createProvisionStage(getProvider, options.deployFn),
    createRegisterStage(options.adapters.registry, options.adapters.serviceProfile, options.adapters.infraProfile),
    createVerifyStage(gateAdapter),
    createObserveStage(options.adapters.ingest, options.adapters.coordinate, options.adapters.infraProfile),
  ]);

  return pipeline.run({
    service: options.service,
    provider: options.provider as DeployContext["provider"],
    env: options.env,
    region: options.region,
    configPath: options.configPath,
    triggeredBy: options.triggeredBy ?? "manual",
  });
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

Run: `pnpm --filter infra-engine build`
Expected: dist/ 생성, 에러 없음

```bash
git add packages/infra-engine/
git commit -m "feat(infra-engine): deploy() 통합 함수 + public API export"
```

---

## Task 12: 전체 통합 테스트

**Files:**
- Create: `packages/infra-engine/__tests__/integration.test.ts`

- [ ] **Step 1: 전체 파이프라인 통합 테스트**

```typescript
// __tests__/integration.test.ts
import { describe, it, expect, vi } from "vitest";
import { createPipeline } from "../src/core/pipeline.js";
import { createConfigStage } from "../src/config/config-stage.js";
import { createProvisionStage } from "../src/stages/provision-stage.js";
import { createRegisterStage } from "../src/stages/register-stage.js";
import { createVerifyStage } from "../src/verify/verify-stage.js";
import { createObserveStage } from "../src/stages/observe-stage.js";
import { createGateAdapter } from "../src/adapters/gate.js";
import type { SopsLoader } from "../src/config/sops-loader.js";
import type {
  RegistryAdapter,
  ServiceProfileAdapter,
  InfraProfileAdapter,
  IngestAdapter,
  CoordinateAdapter,
  DeployProvider,
  ValidationResult,
} from "../src/adapters/adapter.js";
import type { DeployContext } from "../src/core/types.js";

// fetch 모킹 (헬스체크용)
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));

describe("5단계 파이프라인 통합 테스트", () => {
  it("성공 경로: Config → Provision → Register → Verify → Observe", async () => {
    // 모킹
    const sopsLoader: SopsLoader = {
      decrypt: vi.fn(async () => ({
        global: { region: "local" },
        services: { "test-svc": { port: 3200 } },
        connections: { "test-svc": { endpoint: "http://localhost:3200" } },
      })),
    };

    const provider: DeployProvider = {
      name: "local",
      getProgram: vi.fn(() => ({})),
      destroy: vi.fn(async () => {}),
      validate: vi.fn(async (): Promise<ValidationResult> => ({ valid: true, errors: [] })),
    };

    const deployFn = vi.fn(async () => ({
      stackName: "test-svc-dev-local-local",
      outputs: { endpoint: "http://localhost:3200" },
    }));

    const registry: RegistryAdapter = { syncDeployment: vi.fn(async () => ({ synced: true })) };
    const profile: ServiceProfileAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      restore: vi.fn(async () => {}),
    };
    const infraProfile: InfraProfileAdapter = {
      setDeployment: vi.fn(async () => {}),
      getDeployment: vi.fn(async () => null),
      getAllDeployments: vi.fn(async () => ({})),
      restore: vi.fn(async () => {}),
      setMonitor: vi.fn(async () => {}),
      removeMonitor: vi.fn(async () => {}),
      getAllMonitors: vi.fn(async () => []),
      updateMonitorStatus: vi.fn(async () => {}),
    };
    const ingest: IngestAdapter = { emit: vi.fn(async () => ({ ok: true })) };
    const coord: CoordinateAdapter = {
      resolveSvcRef: () => "service:v1:42",
      encodeDeployEvent: () => ({ deploy_event: "deploy_event:v1:100" }),
      encodeHealthEvent: () => ({}),
    };

    const gate = createGateAdapter();

    // 파이프라인 구성
    const pipeline = createPipeline([
      createConfigStage(sopsLoader),
      createProvisionStage(() => provider, deployFn),
      createRegisterStage(registry, profile, infraProfile),
      createVerifyStage(gate),
      createObserveStage(ingest, coord, infraProfile),
    ]);

    // 실행
    const result = await pipeline.run({
      service: "test-svc",
      provider: "local",
      env: "dev",
      region: "local",
      configPath: "config/dev.yaml",
      triggeredBy: "manual",
    });

    // 검증
    expect(result.success).toBe(true);
    expect(result.healthStatus).toBe("healthy");
    expect(result.gateVerdict).toBe("pass");
    expect(result.stageResults).toHaveLength(5);
    expect(result.stageResults.map((s) => s.stage)).toEqual([
      "config", "provision", "register", "verify", "observe",
    ]);
    expect(result.stageResults.every((s) => s.status === "success")).toBe(true);

    // 어댑터 호출 검증
    expect(sopsLoader.decrypt).toHaveBeenCalledOnce();
    expect(deployFn).toHaveBeenCalledOnce();
    expect(registry.syncDeployment).toHaveBeenCalledOnce();
    expect(profile.set).toHaveBeenCalledWith("test-svc", "http://localhost:3200");
    expect(ingest.emit).toHaveBeenCalledOnce();
    expect(infraProfile.setMonitor).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 통과 확인**

Run: `pnpm --filter infra-engine test -- --run`
Expected: 전체 PASS

- [ ] **Step 3: 최종 빌드 + 커밋**

Run: `pnpm --filter infra-engine build`

```bash
git add packages/infra-engine/
git commit -m "test(infra-engine): 5단계 파이프라인 통합 테스트"
```

---

## 다음 단계 (별도 계획으로 분리)

현재 계획은 **코어 파이프라인 + 어댑터 인터페이스 + 로컬 어댑터 구현**까지. 다음 항목은 별도 구현 계획으로:

1. **Pulumi 실제 연동** — LocalWorkspace + S3 backend + DynamoDB lock
2. **프로바이더별 구현** — Cloudflare, Railway, AWS, GCP, Vultr, Local
3. **qa-sdk 어댑터 실구현** — QaSdkRegistryAdapter, QaSdkIngestAdapter, QaSdkCoordinateAdapter
4. **SyncLoop 모니터링** — 주기적 헬스체크 + webhook 알림
5. **GitHub Actions CI/CD** — OIDC 인증 + deploy.yaml 워크플로우
6. **SOPS 설정 파일** — 환경별 YAML 템플릿 + sops.yaml 규칙
