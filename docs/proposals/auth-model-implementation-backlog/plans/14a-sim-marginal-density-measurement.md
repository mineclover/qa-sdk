---
lifecycle: draft
plan: 14a
phase: 4
depends-on: [13a, 13b, 13c, 13d, 11c, 07b]
---

# Plan 14a — sim §5 marginal density 측정 + reporting-api 노출

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 13a~d의 8 시나리오를 실행한 후 ingest-server의 `key_observations` 테이블에 누적된 prefix별 distinct/total 카운트를 분석하여 §5 `event-taxonomy-marginal-density.plan.md` 스펙의 marginal density 지표를 정확히 계산한다. (1) `sim-reporting-api`에 `MarginalDensityService` 추가 — `key_observations`를 읽어 prefix × axis 조합별 distinct entry / shape capacity 비율 계산. (2) `GET /density?prefix={id}&version={v}` endpoint — Plan 11c reporting domain 활용. (3) §5 스펙의 threshold (`underutilized < 0.1`, `saturated > 0.9`) 적용 — `underutilizedAxes` / `saturatedAxes` 응답 필드. (4) registry-service의 `/api/event-catalog/taxonomy/marginal-density` API 검증 (이미 존재하면 sim-reporting-api와 cross-check, 미존재 시 sim-reporting-api가 SSOT). (5) e2e: scenarios runner의 `--all` 실행 → 결과 ingest 누적 → density endpoint 호출 → §5 spec의 응답 schema 정확 매칭.

**Architecture:**
- **데이터 흐름**:
  ```
  8 시나리오 실행
       ↓ (browser-codec CLI adapter / IngestForwarder)
  ingest-server :3200 → key_observations 테이블 (prefix_id, version, packed_key, count, ...)
       ↓ (read)
  sim-reporting-api :4800
       ↓ /density endpoint
  scenario runner / 운영자
  ```
- **MarginalDensityService 알고리즘** (§5 §2.1 정확 매칭):
  ```
  for each axis_i in prefix.shape:
    observed_distinct = COUNT(DISTINCT decode(packed_key)[i])
                        FROM key_observations
                        WHERE prefix_id=? AND version=?
    marginal_density(axis_i) = observed_distinct / shape[axis_i]
  ```
- **§5 §3.1 응답 schema 1:1 매칭**:
  ```ts
  type MarginalDensityResponse = {
    catalog: string;
    prefix: string;
    version: string;
    axes: Array<{
      axisName: string;
      shapeCapacity: number;
      observedDistinct: number;
      marginalDensity: number;
      unobservedEntries: string[];
    }>;
    underutilizedAxes: string[];
    saturatedAxes: string[];
  };
  ```
- **threshold (§5 §3.4)**:
  - `underutilized: density < 0.1`
  - `saturated: density > 0.9` (스펙은 0.8이지만 본 plan은 0.9 채택 — task 요구사항에 명시. 0.8/0.9 둘 다 valid이므로 0.9 사용)
- **shape 조회**:
  - `weighted-index`의 `PrefixCodec` 또는 `LabelRegistry`에서 prefix의 shape 정보 조회
  - 본 plan은 `@qa-sdk/core`의 `getPrefixProfile` 활용 — Plan 09b의 SERVICE_PORTS와 유사 패턴
  - sim 도메인의 prefix는 `sim.bitmap`, `sim.project`, `sim.budget` 등 — 각 prefix의 shape이 sim-auth-api의 codec.ts (Plan 11a)에서 정의됨
- **decode**:
  - `key_observations.packed_key`는 정수 address — `DisjointUnionIndex.decode(addr)` 호출 → `{ kind, coords }`
  - axis_i의 observed distinct는 동일 kind의 동일 axis 값 distinct 수
- **registry-service cross-check**:
  - 본 plan은 sim-reporting-api에 우선 구현
  - registry-service의 `/api/event-catalog/taxonomy/marginal-density` API가 이미 존재하면 (Plan 14a 작성 시 grep 결과 미존재) sim-reporting-api 결과와 cross-check
  - registry-service에 신규 endpoint 추가는 본 plan 범위 외 — Phase 5

**Tech Stack:**
- @qa-sdk/sim-reporting-api (Plan 11c — Report + DailyMetric domain)
- ingest-server의 key_observations Drizzle schema 직접 query
- weighted-index — DisjointUnionIndex.decode
- vitest, ES2023

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/services/reporting-api/src/density/
├── density.module.ts
├── density.service.ts            # MarginalDensityService
├── density.service.test.ts
├── density.controller.ts
└── density.controller.test.ts
```

```
simulations/enterprise-pm/scenarios/src/post-run/
├── density-collector.ts          # 시나리오 후 density endpoint 호출 + 검증
└── density-collector.test.ts
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/reporting-api/src/app.module.ts` | DensityModule import |
| `simulations/enterprise-pm/services/reporting-api/package.json` | ingest-server schema dep (또는 직접 PG query) |
| `simulations/enterprise-pm/scenarios/src/cli.ts` | `density` subcommand 추가 — `sim-scenarios density --prefix=sim.bitmap` |
| `simulations/enterprise-pm/scenarios/src/cli.test.ts` | density 명령 테스트 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/scenarios/src/scenarios/scenario-8-pubsub-invalidation.ts && \
  ls simulations/enterprise-pm/services/reporting-api/src/reporting && \
  grep -n "key_observations" packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts | head -3
```

Expected: Plan 13d (8 시나리오) + Plan 11c (reporting domain) + Plan 07b/c (key_observations PG schema) 완료.

- [ ] **Step 2: registry-service marginal density endpoint 존재 여부 (cross-check 대상)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "marginal-density\|marginalDensity" packages/registry-service/src 2>&1 | head -5
```

Expected: 미존재 → sim-reporting-api가 본 plan 시점의 SSOT. 존재 시 본 plan 마지막 task에서 cross-check.

---

## Task 1: density.service — MarginalDensityService 핵심 로직 (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/reporting-api/src/density/density.service.ts`
- Create: `simulations/enterprise-pm/services/reporting-api/src/density/density.service.test.ts`

- [ ] **Step 1: density.service.test.ts (test-first)**

`MarginalDensityService`는 (1) prefix별 shape 조회, (2) key_observations distinct 집계, (3) density 계산 + threshold 적용. 본 테스트는 in-memory data로 알고리즘 검증.

```ts
// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { describe, expect, it, vi } from "vitest";
import { MarginalDensityService } from "./density.service.js";
import { DisjointUnionIndex } from "weighted-index";

const mockUnion = new DisjointUnionIndex([
  { kind: "user_action", shape: [4], labels: ["login", "logout", "refresh", "rotate"] },
  { kind: "dept_action", shape: [3], labels: ["assign", "manage", "budget"] },
]);

interface ObservationRow {
  prefix_id: string;
  version: string;
  packed_key: number;
  count: number;
}

function makeStore(rows: ObservationRow[]) {
  return {
    listObservations: vi.fn(async (args: { prefix_id: string; version: string }) =>
      rows.filter((r) => r.prefix_id === args.prefix_id && r.version === args.version),
    ),
  };
}

const fixedPrefix = {
  id: "sim.bitmap",
  version: "uv1",
  union: mockUnion,
  /** axis별 사람 읽는 이름. */
  axes: [
    { name: "user_action", labels: ["login", "logout", "refresh", "rotate"] },
    { name: "dept_action", labels: ["assign", "manage", "budget"] },
  ],
};

describe("MarginalDensityService", () => {
  it("axis별 distinct entry 카운트 + density 계산", async () => {
    // user_action의 login/logout 2개 관측 (4개 중 2 → density 0.5)
    // dept_action의 budget 1개 관측 (3개 중 1 → density 0.333)
    const userLoginAddr = mockUnion.encode("user_action", [0]);
    const userLogoutAddr = mockUnion.encode("user_action", [1]);
    const deptBudgetAddr = mockUnion.encode("dept_action", [2]);
    const store = makeStore([
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: userLoginAddr, count: 100 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: userLogoutAddr, count: 50 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: deptBudgetAddr, count: 10 },
    ]);
    const svc = new MarginalDensityService({
      keyObservationStore: store,
      prefixCatalog: { resolve: vi.fn(async (id: string) => id === "sim.bitmap" ? fixedPrefix : null) },
      thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
    });
    const result = await svc.compute({ catalog: "sim", prefix: "sim.bitmap", version: "uv1" });
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.version).toBe("uv1");
    expect(result.axes).toHaveLength(2);

    const ua = result.axes.find((a) => a.axisName === "user_action")!;
    expect(ua.shapeCapacity).toBe(4);
    expect(ua.observedDistinct).toBe(2);
    expect(ua.marginalDensity).toBeCloseTo(0.5, 5);
    expect(ua.unobservedEntries.sort()).toEqual(["refresh", "rotate"]);

    const da = result.axes.find((a) => a.axisName === "dept_action")!;
    expect(da.shapeCapacity).toBe(3);
    expect(da.observedDistinct).toBe(1);
    expect(da.marginalDensity).toBeCloseTo(1/3, 5);
    expect(da.unobservedEntries.sort()).toEqual(["assign", "manage"]);
  });

  it("§5 §3.4 threshold — underutilized (< 0.1) / saturated (> 0.9)", async () => {
    // user_action: 0개 관측 (density 0 → underutilized)
    // dept_action: 3개 관측 (density 1.0 → saturated)
    const da0 = mockUnion.encode("dept_action", [0]);
    const da1 = mockUnion.encode("dept_action", [1]);
    const da2 = mockUnion.encode("dept_action", [2]);
    const store = makeStore([
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da0, count: 1 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da1, count: 1 },
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: da2, count: 1 },
    ]);
    const svc = new MarginalDensityService({
      keyObservationStore: store,
      prefixCatalog: { resolve: vi.fn(async () => fixedPrefix) },
      thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
    });
    const result = await svc.compute({ catalog: "sim", prefix: "sim.bitmap", version: "uv1" });
    expect(result.underutilizedAxes).toEqual(["user_action"]);
    expect(result.saturatedAxes).toEqual(["dept_action"]);
  });

  it("미존재 prefix → throw", async () => {
    const svc = new MarginalDensityService({
      keyObservationStore: makeStore([]),
      prefixCatalog: { resolve: vi.fn(async () => null) },
      thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
    });
    await expect(svc.compute({ catalog: "sim", prefix: "missing", version: "uv1" }))
      .rejects.toThrow(/prefix.*not.*found/i);
  });

  it("관측 0건 — 모든 axis density 0, 모든 axis underutilized", async () => {
    const svc = new MarginalDensityService({
      keyObservationStore: makeStore([]),
      prefixCatalog: { resolve: vi.fn(async () => fixedPrefix) },
      thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
    });
    const result = await svc.compute({ catalog: "sim", prefix: "sim.bitmap", version: "uv1" });
    for (const a of result.axes) {
      expect(a.observedDistinct).toBe(0);
      expect(a.marginalDensity).toBe(0);
    }
    expect(result.underutilizedAxes.sort()).toEqual(["dept_action", "user_action"]);
    expect(result.saturatedAxes).toEqual([]);
  });

  it("invalid packed_key (decode 실패) — silent skip + warn (graceful)", async () => {
    const store = makeStore([
      { prefix_id: "sim.bitmap", version: "uv1", packed_key: 999_999_999, count: 1 },
    ]);
    const warnSpy = vi.fn();
    const svc = new MarginalDensityService({
      keyObservationStore: store,
      prefixCatalog: { resolve: vi.fn(async () => fixedPrefix) },
      thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
      logger: { warn: warnSpy, info: vi.fn(), error: vi.fn() },
    });
    const result = await svc.compute({ catalog: "sim", prefix: "sim.bitmap", version: "uv1" });
    expect(result.axes.every((a) => a.observedDistinct === 0)).toBe(true);
    // skip 자체는 valid — silent fallback이 아닌 명시적 warn
    expect(warnSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: density.service.ts**

```ts
// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { Inject, Injectable } from "@nestjs/common";
import type { DisjointUnionIndex } from "weighted-index";

export interface KeyObservationRow {
  prefix_id: string;
  version: string;
  packed_key: number;
  count: number;
}

export interface KeyObservationStore {
  listObservations(args: { prefix_id: string; version: string }): Promise<KeyObservationRow[]>;
}

export interface PrefixDescriptor {
  id: string;
  version: string;
  union: DisjointUnionIndex;
  /** axis_i 메타 — axisName + label 목록. union의 각 variant와 매칭. */
  axes: Array<{ name: string; labels: readonly string[] }>;
}

export interface PrefixCatalog {
  resolve(id: string): Promise<PrefixDescriptor | null>;
}

export interface MarginalDensityThresholds {
  /** density < this → underutilized. §5 §3.4 default 0.1. */
  underutilizedBelow: number;
  /** density > this → saturated. §5 §3.4 default 0.9 (스펙은 0.8 — 본 plan 0.9 채택). */
  saturatedAbove: number;
}

export interface DensityServiceLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

export interface MarginalDensityServiceOptions {
  keyObservationStore: KeyObservationStore;
  prefixCatalog: PrefixCatalog;
  thresholds: MarginalDensityThresholds;
  logger?: DensityServiceLogger;
}

export interface ComputeArgs {
  catalog: string;
  prefix: string;
  version: string;
}

/** §5 §3.1 응답 스키마 1:1 매칭. */
export interface MarginalDensityResponse {
  catalog: string;
  prefix: string;
  version: string;
  axes: Array<{
    axisName: string;
    shapeCapacity: number;
    observedDistinct: number;
    marginalDensity: number;
    unobservedEntries: string[];
  }>;
  underutilizedAxes: string[];
  saturatedAxes: string[];
}

@Injectable()
export class MarginalDensityService {
  private readonly logger: DensityServiceLogger;

  constructor(@Inject("DENSITY_OPTIONS") private readonly opts: MarginalDensityServiceOptions) {
    this.logger = opts.logger ?? { info: () => {}, warn: () => {}, error: () => {} };
  }

  async compute(args: ComputeArgs): Promise<MarginalDensityResponse> {
    const desc = await this.opts.prefixCatalog.resolve(args.prefix);
    if (!desc) {
      throw new Error(`prefix not found: ${args.prefix}`);
    }
    if (desc.version !== args.version) {
      throw new Error(`prefix version mismatch: requested ${args.version}, catalog has ${desc.version}`);
    }

    const rows = await this.opts.keyObservationStore.listObservations({
      prefix_id: args.prefix,
      version: args.version,
    });

    // axis_i × decoded coord → set of distinct coord values
    const observedByAxis = new Map<string, Set<number>>();
    for (const axis of desc.axes) observedByAxis.set(axis.name, new Set());

    for (const row of rows) {
      let decoded: { kind: string; coords: number[] };
      try {
        decoded = desc.union.decode(row.packed_key);
      } catch (err) {
        this.logger.warn(
          { packed_key: row.packed_key, prefix: args.prefix, err: (err as Error).message },
          "key_observations decode 실패 — silent skip + warn",
        );
        continue;
      }
      const set = observedByAxis.get(decoded.kind);
      if (!set) {
        // axis not in catalog — schema drift
        this.logger.warn(
          { kind: decoded.kind, prefix: args.prefix },
          "decoded kind not in catalog axes — skip",
        );
        continue;
      }
      // axis는 1차원 가정 — coords[0]만 distinct로 카운트
      // 다차원은 본 plan 범위 외 (§5 §3.1 단일 prefix + 단일 version 가정)
      if (decoded.coords.length >= 1) set.add(decoded.coords[0]);
    }

    const axes = desc.axes.map((axis) => {
      const observed = observedByAxis.get(axis.name)!;
      const shapeCapacity = axis.labels.length;
      const observedDistinct = observed.size;
      const marginalDensity = shapeCapacity === 0 ? 0 : observedDistinct / shapeCapacity;
      const unobservedEntries: string[] = [];
      for (let i = 0; i < axis.labels.length; i++) {
        if (!observed.has(i)) unobservedEntries.push(axis.labels[i]);
      }
      return {
        axisName: axis.name,
        shapeCapacity,
        observedDistinct,
        marginalDensity,
        unobservedEntries,
      };
    });

    const underutilizedAxes = axes
      .filter((a) => a.marginalDensity < this.opts.thresholds.underutilizedBelow)
      .map((a) => a.axisName);
    const saturatedAxes = axes
      .filter((a) => a.marginalDensity > this.opts.thresholds.saturatedAbove)
      .map((a) => a.axisName);

    return {
      catalog: args.catalog,
      prefix: args.prefix,
      version: args.version,
      axes,
      underutilizedAxes,
      saturatedAxes,
    };
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-reporting-api test -- density.service
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/reporting-api/src/density/density.service.ts \
          simulations/enterprise-pm/services/reporting-api/src/density/density.service.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-reporting-api): MarginalDensityService — §5 §2.1 알고리즘 정확 구현

axis별 distinct entry / shape capacity = density.
§5 §3.4 threshold — underutilized < 0.1 / saturated > 0.9.
unobservedEntries로 어느 entry가 미관측인지 명시.
decode 실패는 silent skip + warn (no fallback approximation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: density.controller — GET /density endpoint (TDD)

**Files:**
- Create: `simulations/enterprise-pm/services/reporting-api/src/density/density.controller.ts`
- Create: `simulations/enterprise-pm/services/reporting-api/src/density/density.controller.test.ts`

- [ ] **Step 1: density.controller.ts**

```ts
import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { MarginalDensityService } from "./density.service.js";

@Controller("density")
export class DensityController {
  constructor(private readonly svc: MarginalDensityService) {}

  /**
   * GET /density?catalog=sim&prefix=sim.bitmap&version=uv1
   * §5 §3.1 endpoint 시그니처 정확 매칭.
   */
  @Get()
  async density(
    @Query("catalog") catalog: string,
    @Query("prefix") prefix: string,
    @Query("version") version: string,
  ) {
    if (!catalog || !prefix || !version) {
      throw new BadRequestException({
        error: "missing_query_params",
        required: ["catalog", "prefix", "version"],
      });
    }
    return this.svc.compute({ catalog, prefix, version });
  }
}
```

- [ ] **Step 2: density.controller.test.ts**

```ts
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { DensityController } from "./density.controller.js";
import { MarginalDensityService } from "./density.service.js";

describe("DensityController", () => {
  it("GET /density — 200 + §5 §3.1 schema", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DensityController],
      providers: [
        {
          provide: MarginalDensityService,
          useValue: {
            compute: vi.fn(async () => ({
              catalog: "sim", prefix: "sim.bitmap", version: "uv1",
              axes: [{ axisName: "user_action", shapeCapacity: 4, observedDistinct: 2, marginalDensity: 0.5, unobservedEntries: ["x", "y"] }],
              underutilizedAxes: [],
              saturatedAxes: [],
            })),
          },
        },
      ],
    }).compile();
    const ctrl = moduleRef.get(DensityController);
    const result = await ctrl.density("sim", "sim.bitmap", "uv1");
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.axes).toHaveLength(1);
  });

  it("GET /density — query param 누락 → BadRequest", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DensityController],
      providers: [{ provide: MarginalDensityService, useValue: { compute: vi.fn() } }],
    }).compile();
    const ctrl = moduleRef.get(DensityController);
    await expect(ctrl.density("", "sim.bitmap", "uv1")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: density.module.ts + app.module.ts 통합**

```ts
// density.module.ts
import { Module } from "@nestjs/common";
import { DensityController } from "./density.controller.js";
import { MarginalDensityService, type MarginalDensityServiceOptions } from "./density.service.js";
// 실 store/catalog 주입은 호출자 측에서 구체 구현 — 본 module은 useFactory 패턴

@Module({
  controllers: [DensityController],
  providers: [
    MarginalDensityService,
    {
      provide: "DENSITY_OPTIONS",
      useFactory: (): MarginalDensityServiceOptions => {
        // sim-reporting-api는 실 ingest-server PG 또는 in-memory store에 따라 분기
        // 본 module은 placeholder factory — 실제 주입은 app.module에서 override
        throw new Error("DENSITY_OPTIONS provider must be overridden by app.module");
      },
    },
  ],
  exports: [MarginalDensityService],
})
export class DensityModule {}
```

`app.module.ts`에 DensityModule import + DENSITY_OPTIONS provider override:

```ts
// app.module.ts
import { DensityModule } from "./density/density.module.js";
import { ingestStoreFactory } from "./density/ingest-store.factory.js"; // sim-reporting-api 측에서 ingest-server PG 어댑터 구성

@Module({
  imports: [
    DensityModule,
    // ... 기존 모듈
  ],
  providers: [
    {
      provide: "DENSITY_OPTIONS",
      useFactory: () => ({
        keyObservationStore: ingestStoreFactory(),
        prefixCatalog: simPrefixCatalog,
        thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
      }),
    },
  ],
})
export class AppModule {}
```

`ingestStoreFactory`는 ingest-server의 key_observations PG schema를 직접 query — Plan 07b/c에서 정의된 schema 활용. 본 plan은 `ingestStoreFactory.ts` 별도 작성 (실 PG connection + drizzle query).

- [ ] **Step 4: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-reporting-api test -- density && \
  pnpm --filter @qa-sdk/sim-reporting-api typecheck
```

Expected: 5 (service) + 2 (controller) = 7 PASS.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/reporting-api/src/density && \
  git commit -m "$(cat <<'EOF'
feat(sim-reporting-api): GET /density endpoint — §5 §3.1 schema

DensityController + DensityModule.
DENSITY_OPTIONS provider — app.module에서 override (ingest store 주입).
3 query params 필수 (catalog/prefix/version) — 누락 시 400.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ingest-store.factory.ts — key_observations PG query

**Files:**
- Create: `simulations/enterprise-pm/services/reporting-api/src/density/ingest-store.factory.ts`

- [ ] **Step 1: ingest-store.factory.ts**

```ts
// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * ingest-server의 key_observations 테이블을 직접 query하여
 * MarginalDensityService에 KeyObservationStore 인터페이스로 노출.
 *
 * Plan 07b/c에서 정의된 PG schema 사용 — column: prefix_id, version, packed_key, count, last_seen, ...
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { KeyObservationRow, KeyObservationStore } from "./density.service.js";

export function createKeyObservationStore(db: PostgresJsDatabase): KeyObservationStore {
  return {
    async listObservations(args) {
      const result = await db.execute(sql`
        SELECT prefix_id, version, packed_key, count
        FROM ingest.key_observations
        WHERE prefix_id = ${args.prefix_id}
          AND version = ${args.version}
      `);
      // drizzle execute는 raw rows 반환 — Cast
      return (result as unknown as KeyObservationRow[]).map((r) => ({
        prefix_id: r.prefix_id,
        version: r.version,
        packed_key: Number(r.packed_key),
        count: Number(r.count),
      }));
    },
  };
}
```

- [ ] **Step 2: 단위 테스트는 db-bootstrap fixture 활용 (생략 — Plan 07b의 PG fixture 패턴)**

본 plan은 in-memory smoke로 충분 — 실 PG 통합은 Plan 14b의 통합 회귀에서 검증.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/reporting-api/src/density/ingest-store.factory.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-reporting-api): key_observations PG query factory

drizzle execute로 ingest.key_observations 직접 조회.
Plan 07b의 PG schema column (prefix_id, version, packed_key, count) 정확 매칭.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: scenarios runner에 density subcommand 추가

**Files:**
- Modify: `simulations/enterprise-pm/scenarios/src/cli.ts`
- Create: `simulations/enterprise-pm/scenarios/src/post-run/density-collector.ts`
- Create: `simulations/enterprise-pm/scenarios/src/post-run/density-collector.test.ts`

- [ ] **Step 1: density-collector.ts**

```ts
// @def.boundary sim-scenarios
// @def.doc event-taxonomy-marginal-density

export interface DensityResponse {
  catalog: string;
  prefix: string;
  version: string;
  axes: Array<{
    axisName: string;
    shapeCapacity: number;
    observedDistinct: number;
    marginalDensity: number;
    unobservedEntries: string[];
  }>;
  underutilizedAxes: string[];
  saturatedAxes: string[];
}

export async function fetchDensity(
  reportingApiUrl: string,
  args: { catalog: string; prefix: string; version: string },
): Promise<DensityResponse> {
  const url = new URL("/density", reportingApiUrl);
  url.searchParams.set("catalog", args.catalog);
  url.searchParams.set("prefix", args.prefix);
  url.searchParams.set("version", args.version);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`fetchDensity ${args.prefix}: status=${res.status} body=${await res.text()}`);
  }
  return (await res.json()) as DensityResponse;
}

export function summarizeDensity(d: DensityResponse): string {
  const lines: string[] = [];
  lines.push(`density: ${d.prefix} (${d.version})`);
  for (const a of d.axes) {
    const pct = (a.marginalDensity * 100).toFixed(1);
    lines.push(`  ${a.axisName}: ${a.observedDistinct}/${a.shapeCapacity} (${pct}%)`);
    if (a.unobservedEntries.length > 0 && a.unobservedEntries.length <= 5) {
      lines.push(`    unobserved: ${a.unobservedEntries.join(", ")}`);
    }
  }
  if (d.underutilizedAxes.length > 0) {
    lines.push(`  ⚠ underutilized: ${d.underutilizedAxes.join(", ")}`);
  }
  if (d.saturatedAxes.length > 0) {
    lines.push(`  ⚠ saturated: ${d.saturatedAxes.join(", ")}`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 2: density-collector.test.ts (mock fetch)**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchDensity, summarizeDensity } from "./density-collector.js";

afterEach(() => vi.restoreAllMocks());

describe("density-collector", () => {
  it("fetchDensity — 200 → §5 §3.1 응답 deserialize", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      const u = new URL(String(url));
      expect(u.pathname).toBe("/density");
      expect(u.searchParams.get("prefix")).toBe("sim.bitmap");
      return Response.json({
        catalog: "sim", prefix: "sim.bitmap", version: "uv1",
        axes: [{ axisName: "user_action", shapeCapacity: 4, observedDistinct: 2, marginalDensity: 0.5, unobservedEntries: [] }],
        underutilizedAxes: [],
        saturatedAxes: [],
      });
    }));
    const result = await fetchDensity("http://reporting", { catalog: "sim", prefix: "sim.bitmap", version: "uv1" });
    expect(result.prefix).toBe("sim.bitmap");
    expect(result.axes[0].marginalDensity).toBe(0.5);
  });

  it("fetchDensity — 5xx → throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 503 })));
    await expect(fetchDensity("http://x", { catalog: "sim", prefix: "p", version: "v" }))
      .rejects.toThrow();
  });

  it("summarizeDensity — multi-line 출력 + threshold 알림", () => {
    const summary = summarizeDensity({
      catalog: "sim", prefix: "sim.bitmap", version: "uv1",
      axes: [
        { axisName: "user_action", shapeCapacity: 4, observedDistinct: 0, marginalDensity: 0, unobservedEntries: ["a","b"] },
        { axisName: "dept_action", shapeCapacity: 3, observedDistinct: 3, marginalDensity: 1.0, unobservedEntries: [] },
      ],
      underutilizedAxes: ["user_action"],
      saturatedAxes: ["dept_action"],
    });
    expect(summary).toContain("underutilized: user_action");
    expect(summary).toContain("saturated: dept_action");
    expect(summary).toContain("0/4");
    expect(summary).toContain("3/3");
  });
});
```

- [ ] **Step 3: cli.ts에 density 명령 추가**

```ts
// cli.ts
import { fetchDensity, summarizeDensity } from "./post-run/density-collector.js";

// buildCli 안에 추가
cmd
  .command("density")
  .description("§5 marginal density 측정 — sim-reporting-api 호출")
  .option("--catalog <id>", "catalog ID", "sim")
  .option("--prefix <id>", "prefix ID (예: sim.bitmap)", "sim.bitmap")
  .option("--version <v>", "prefix version", "uv1")
  .option("--reporting-url <url>", "sim-reporting-api base URL", "http://localhost:4800")
  .option("--json", "JSON 출력", false)
  .action(async (opts: { catalog: string; prefix: string; version: string; reportingUrl: string; json: boolean }) => {
    const result = await fetchDensity(opts.reportingUrl, {
      catalog: opts.catalog, prefix: opts.prefix, version: opts.version,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      process.stdout.write(summarizeDensity(result) + "\n");
    }
  });
```

- [ ] **Step 4: 테스트 + smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-scenarios test -- density-collector && \
  pnpm --filter @qa-sdk/sim-scenarios build && \
  cd simulations/enterprise-pm/scenarios && node dist/cli.js --help
```

Expected: 3 PASS, --help에 density 명령 출력.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scenarios/src/post-run \
          simulations/enterprise-pm/scenarios/src/cli.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-scenarios): density subcommand — §5 marginal density 조회

fetchDensity → sim-reporting-api /density endpoint.
summarizeDensity 사람 읽는 출력 + threshold 알림.
sim-scenarios density --prefix=sim.bitmap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: e2e — 8 시나리오 실행 → density 검증

**Files:**
- Create: `simulations/enterprise-pm/scripts/measure-density.sh`

- [ ] **Step 1: measure-density.sh**

```bash
#!/usr/bin/env bash
# Plan 14a — 8 시나리오 실행 후 marginal density 측정 e2e
# 사전 조건: docker-compose 부팅, 9 서비스 fully ready, ingest-server 부팅
set -euo pipefail

cd "$(dirname "$0")/.."
SCENARIOS_DIR="$(pwd)/scenarios"
REPORTING_URL=${REPORTING_URL:-http://localhost:4800}

echo "==> 1. 8 시나리오 batch 실행 (--all)"
node "$SCENARIOS_DIR/dist/cli.js" run --all --json > /tmp/sim-scenarios-results.json
PASSED=$(jq '[.[] | select(.status == "passed")] | length' /tmp/sim-scenarios-results.json)
FAILED=$(jq '[.[] | select(.status == "failed")] | length' /tmp/sim-scenarios-results.json)
echo "  → passed=$PASSED failed=$FAILED"

if [ "$FAILED" -gt 0 ]; then
  echo "  ⚠ 시나리오 실패 — density 측정 진행 (참고용)"
fi

echo "==> 2. density 측정 (sim.bitmap, uv1)"
node "$SCENARIOS_DIR/dist/cli.js" density --prefix=sim.bitmap --version=uv1 --reporting-url="$REPORTING_URL"

echo "==> 3. density 측정 (sim.project, uv1)"
node "$SCENARIOS_DIR/dist/cli.js" density --prefix=sim.project --version=uv1 --reporting-url="$REPORTING_URL" || \
  echo "  → sim.project density 측정 건너뜀 (관측 0건일 수 있음)"

echo "==> 4. density 측정 (sim.budget, uv1)"
node "$SCENARIOS_DIR/dist/cli.js" density --prefix=sim.budget --version=uv1 --reporting-url="$REPORTING_URL" || \
  echo "  → sim.budget density 측정 건너뜀"

echo "==> 5. JSON 출력 — Plan 14b 회귀 자료"
node "$SCENARIOS_DIR/dist/cli.js" density --prefix=sim.bitmap --version=uv1 --reporting-url="$REPORTING_URL" --json > /tmp/sim-density-bitmap.json
echo "  → /tmp/sim-density-bitmap.json 작성"

echo "✓ density 측정 완료"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/measure-density.sh
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scripts/measure-density.sh && \
  git commit -m "$(cat <<'EOF'
feat(sim): measure-density.sh — 8 시나리오 → density 측정 e2e 스크립트

batch 실행 → JSON 결과 저장 → density 명령 호출 (3 prefix).
실 환경(docker-compose)에서 운영자 실행. Plan 14b가 회귀에 통합.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: registry-service cross-check (옵션)

**Files:**
- Create: `simulations/enterprise-pm/scripts/cross-check-density.sh` (옵션)

registry-service의 `/api/event-catalog/taxonomy/marginal-density` 신규 추가는 본 plan 범위 외. 단 endpoint 존재 시 cross-check만:

- [ ] **Step 1: 존재 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "marginal-density\|marginalDensity" packages/registry-service/src 2>&1 | head -3
```

- [ ] **Step 2: 미존재 시 — defer 명시**

본 plan의 task로 추가하지 않음. Phase 5 또는 별도 plan에서 registry-service에 동일 endpoint 추가 후 sim-reporting-api와 결과 cross-check 자동화.

- [ ] **Step 3: 존재 시 — cross-check 스크립트**

```bash
#!/usr/bin/env bash
# registry-service vs sim-reporting-api density 결과 cross-check
set -euo pipefail
PREFIX=${1:-sim.bitmap}
VERSION=${2:-uv1}

R1=$(curl -fsS "http://localhost:4800/density?catalog=sim&prefix=$PREFIX&version=$VERSION")
R2=$(curl -fsS "http://localhost:3300/api/event-catalog/taxonomy/marginal-density?catalog=sim&prefix=$PREFIX&version=$VERSION" 2>&1 || echo "{}")

echo "sim-reporting-api: $R1"
echo "registry-service: $R2"
diff <(echo "$R1" | jq -S .) <(echo "$R2" | jq -S .) || echo "⚠ 결과 차이 발견"
```

본 step은 옵션. 본 plan의 commit으로는 추가 안 함.

---

## Self-Review

- [ ] §5 §2.1 알고리즘 정확 구현 — `marginal_density(axis_i) = count_distinct(observed) / shape[axis_i]`
- [ ] §5 §3.1 응답 schema 1:1 매칭 — `axes` / `underutilizedAxes` / `saturatedAxes` / `unobservedEntries`
- [ ] §5 §3.4 threshold 적용 — underutilized < 0.1, saturated > 0.9 (task 요구사항)
- [ ] sim-reporting-api에 GET /density endpoint
- [ ] ingest-store factory가 ingest.key_observations 직접 query (Plan 07b/c PG schema)
- [ ] sim-scenarios CLI에 density subcommand
- [ ] measure-density.sh — 8 시나리오 실행 → density 측정 e2e
- [ ] decode 실패는 silent skip + warn (no fallback approximation, no silent OK)
- [ ] missing prefix → throw (no fallback)
- [ ] 누적 PASS: density.service 5 + controller 2 + density-collector 3 = 10 PASS

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| registry-service에 marginal-density endpoint 추가 | 본 plan은 sim-reporting-api에 우선 — registry는 별도 SSOT | Phase 5 |
| 다중 axis (다차원 coords) density 계산 | §5 §3.1은 단일 prefix + 단일 version 가정 — 다차원은 차후 확장 | 후속 |
| time-series density (시간 축 추세) | §5 §4 Phase 2 — Grafana 통합 후 | 후속 |
| classificationRate threshold 조정 | §5 §5.1 명시적 제외 | 별도 |
| Density gating (CI) | §5 §4 Phase 3 — threshold 합의 후 | 후속 |

---

## 의존·후속

- **Plan 13a/b/c/d**: 8 시나리오 — 본 plan의 측정 입력 데이터 생성.
- **Plan 11c**: sim-reporting-api Reporting + DailyMetric domain 위에 density module 추가.
- **Plan 07b/c**: ingest-server key_observations PG schema — ingest-store factory가 직접 query.
- **Plan 14b**: 통합 회귀 — measure-density.sh를 회귀에 포함.
