# CoordinateAdapter 좌표 실인코딩 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** infra-engine의 CoordinateAdapter를 fail-open(빈 값 반환)에서 Catalog 기반 실인코딩으로 전환한다.

**Architecture:** `createCoordinateAdapter(catalog: Catalog)` — Catalog 주입 방식. `@qa-sdk/core`의 `encodePrefix()`, `latestPrefixVersion()`으로 service/deploy_event/health_event prefix를 실인코딩. table_ref 차원은 `getFixedLabels()`가 자동 제외하므로 deploy_event의 actor는 인코딩 대상 아님. 모든 인코딩을 try-catch로 감싸서 fail-open 유지.

**Tech Stack:** TypeScript, @qa-sdk/core catalog runtime, Vitest

---

### Task 1: 의존성 추가 + createCoordinateAdapter 실인코딩

**Files:**
- Modify: `packages/infra-engine/package.json`
- Modify: `packages/infra-engine/src/adapters/coordinate.ts`

- [ ] **Step 1: 의존성 추가**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine add @qa-sdk/core demo-snapshot
```

- [ ] **Step 2: coordinate.ts 전체 교체**

`packages/infra-engine/src/adapters/coordinate.ts` 전체를 다음으로 교체:

```typescript
// adapters/coordinate.ts — CoordinateAdapter Catalog 기반 실인코딩
import type { Catalog } from "@qa-sdk/core";
import { latestPrefixVersion, encodePrefix } from "@qa-sdk/core";
import type { CoordinateAdapter } from "./adapter.js";

/**
 * Catalog 기반 좌표 인코딩 어댑터.
 * 인코딩 실패 시 fail-open — null / {} 반환.
 *
 * table_ref 차원(actor 등)은 getFixedLabels()가 자동 제외하므로
 * encodePrefix는 axis + prefix_ref 차원만 인코딩한다.
 */
export function createCoordinateAdapter(catalog: Catalog): CoordinateAdapter {
  return {
    resolveSvcRef(serviceId, env, region, namespace) {
      try {
        const version = latestPrefixVersion(catalog, "service");
        const prefix = catalog.prefixes.service;
        if (!prefix) return null;
        const vdef = prefix.versions.find(v => v.version === version);
        if (!vdef) return null;

        // 각 축에서 position 계산
        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === "table_ref") continue;

          const val = label === "env" ? env
            : label === "region" ? region
            : label === "svc_name" ? serviceId
            : label === "namespace" ? (namespace ?? "shop")
            : undefined;
          if (val === undefined) return null;

          if (dim.kind === "axis") {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return null;
            const idx = snap.entries.indexOf(val);
            if (idx < 0) return null;
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, "service", version, positions);
        return `service:${version}:${address}`;
      } catch {
        return null;
      }
    },

    encodeDeployEvent(svcRef, action, _actor) {
      if (!svcRef) return {};
      try {
        const version = latestPrefixVersion(catalog, "deploy_event");
        const prefix = catalog.prefixes.deploy_event;
        if (!prefix) return {};
        const vdef = prefix.versions.find(v => v.version === version);
        if (!vdef) return {};

        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === "table_ref") continue;

          if (dim.kind === "prefix_ref") {
            // svc_ref: svcRef에서 주소 추출 → refEntries에서 index 조회
            const address = parseSvcRefAddress(svcRef);
            if (address === null) return {};
            const ref = vdef.refEntries?.[label];
            if (!ref) return {};
            const idx = ref.values.indexOf(address);
            if (idx < 0) return {};
            positions[label] = idx;
          } else if (dim.kind === "axis") {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return {};
            const idx = snap.entries.indexOf(action);
            if (idx < 0) return {};
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, "deploy_event", version, positions);
        return { deploy_event: `deploy_event:${version}:${address}` };
      } catch {
        return {};
      }
    },

    encodeHealthEvent(svcRef, status) {
      if (!svcRef) return {};
      try {
        const version = latestPrefixVersion(catalog, "health_event");
        const prefix = catalog.prefixes.health_event;
        if (!prefix) return {};
        const vdef = prefix.versions.find(v => v.version === version);
        if (!vdef) return {};

        const positions: Record<string, number> = {};
        for (const label of prefix.labels) {
          const dim = prefix.dims[label];
          if (dim.kind === "table_ref") continue;

          if (dim.kind === "prefix_ref") {
            const address = parseSvcRefAddress(svcRef);
            if (address === null) return {};
            const ref = vdef.refEntries?.[label];
            if (!ref) return {};
            const idx = ref.values.indexOf(address);
            if (idx < 0) return {};
            positions[label] = idx;
          } else if (dim.kind === "axis") {
            const axis = catalog.axes[dim.axisId];
            const snap = axis?.versions[vdef.axisVersions[label]];
            if (!snap) return {};
            const idx = snap.entries.indexOf(status);
            if (idx < 0) return {};
            positions[label] = idx;
          }
        }

        const address = encodePrefix(catalog, "health_event", version, positions);
        return { health_event: `health_event:${version}:${address}` };
      } catch {
        return {};
      }
    },
  };
}

/** "service:v1:42" → 42 파싱. 실패 시 null. */
function parseSvcRefAddress(svcRef: string): number | null {
  const parts = svcRef.split(":");
  if (parts.length < 3) return null;
  const addr = Number(parts[parts.length - 1]);
  return Number.isNaN(addr) ? null : addr;
}
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter infra-engine build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add packages/infra-engine/package.json packages/infra-engine/src/adapters/coordinate.ts pnpm-lock.yaml
git commit -m "feat(infra): implement CoordinateAdapter real encoding with Catalog

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 와이어링 업데이트

**Files:**
- Modify: `packages/infra-engine/src/cli/cmd-deploy.ts`
- Modify: `packages/infra-engine/scripts/deploy-local.ts`

- [ ] **Step 1: cmd-deploy.ts 와이어링 변경**

`packages/infra-engine/src/cli/cmd-deploy.ts`에서 `createCoordinateAdapter()` 호출을 찾아 (약 lines 121-124):

```typescript
// 기존
const { createCoordinateAdapter } = await import("../adapters/coordinate.js");
const coordinateAdapter = createCoordinateAdapter();
```

다음으로 변경:

```typescript
const { createCoordinateAdapter } = await import("../adapters/coordinate.js");
const { DEMO_CATALOG } = await import("demo-snapshot");
const coordinateAdapter = createCoordinateAdapter(DEMO_CATALOG);
```

- [ ] **Step 2: deploy-local.ts 와이어링 변경**

`packages/infra-engine/scripts/deploy-local.ts`에서 동일 패턴 적용 (약 lines 121-122):

```typescript
// 기존
const { createCoordinateAdapter } = await import("../src/adapters/coordinate.js");
const coordinateAdapter = createCoordinateAdapter();
```

변경:

```typescript
const { createCoordinateAdapter } = await import("../src/adapters/coordinate.js");
const { DEMO_CATALOG } = await import("demo-snapshot");
const coordinateAdapter = createCoordinateAdapter(DEMO_CATALOG);
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter infra-engine build`
Expected: 성공

- [ ] **Step 4: Commit**

```bash
git add packages/infra-engine/src/cli/cmd-deploy.ts packages/infra-engine/scripts/deploy-local.ts
git commit -m "feat(infra): wire DEMO_CATALOG into CoordinateAdapter

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 테스트 업데이트

**Files:**
- Modify: `packages/infra-engine/__tests__/adapters/coordinate.test.ts`

- [ ] **Step 1: 테스트 전체 교체**

`packages/infra-engine/__tests__/adapters/coordinate.test.ts` 전체를 다음으로 교체:

```typescript
import { describe, it, expect } from "vitest";
import { createCoordinateAdapter } from "../../src/adapters/coordinate.js";
import type { Catalog } from "@qa-sdk/core";

/** 테스트용 미니 catalog — DEMO_CATALOG 구조의 축소판 */
const MINI_CATALOG: Catalog = {
  id: "test",
  name: "test",
  axes: {
    env: { id: "env", name: "env", versions: { v1: { entries: ["dev", "stage", "prod"], capacity: 4 } } },
    region: { id: "region", name: "region", versions: { v1: { entries: ["asia", "usa"], capacity: 4 } } },
    svc_name: { id: "svc_name", name: "svc_name", versions: { v1: { entries: ["web", "api", "auth"], capacity: 4 } } },
    namespace: { id: "namespace", name: "namespace", versions: { v1: { entries: ["shop", "cms"], capacity: 4 } } },
    deploy_action: { id: "deploy_action", name: "deploy_action", versions: { v1: { entries: ["deploy", "rollback", "scale_up"], capacity: 4 } } },
    health_status: { id: "health_status", name: "health_status", versions: { v1: { entries: ["healthy", "degraded", "unhealthy"], capacity: 4 } } },
  },
  prefixes: {
    service: {
      id: "service", name: "서비스",
      description: "",
      labels: ["env", "region", "svc_name", "namespace"],
      dims: {
        env: { kind: "axis", axisId: "env" },
        region: { kind: "axis", axisId: "region" },
        svc_name: { kind: "axis", axisId: "svc_name" },
        namespace: { kind: "axis", axisId: "namespace" },
      },
      meta: {},
      versions: [{ version: "v1", axisVersions: { env: "v1", region: "v1", svc_name: "v1", namespace: "v1" } }],
    },
    deploy_event: {
      id: "deploy_event", name: "배포 이벤트",
      description: "",
      labels: ["svc_ref", "deploy_action", "actor"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        deploy_action: { kind: "axis", axisId: "deploy_action" },
        actor: { kind: "table_ref", table: "members" },
      },
      meta: {},
      versions: [{
        version: "v1",
        axisVersions: { deploy_action: "v1" },
        refEntries: { svc_ref: { values: [0, 1, 2], refVersion: "v1" } },
      }],
    },
    health_event: {
      id: "health_event", name: "헬스 이벤트",
      description: "",
      labels: ["svc_ref", "health_status"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        health_status: { kind: "axis", axisId: "health_status" },
      },
      meta: {},
      versions: [{
        version: "v1",
        axisVersions: { health_status: "v1" },
        refEntries: { svc_ref: { values: [0, 1, 2], refVersion: "v1" } },
      }],
    },
  },
} as unknown as Catalog;

describe("CoordinateAdapter", () => {
  const coord = createCoordinateAdapter(MINI_CATALOG);

  // service prefix: env(4) × region(4) × svc_name(4) × namespace(4)
  // strides: [64, 16, 4, 1]
  // dev=0, asia=0, web=0, shop=0 → address = 0
  // dev=0, asia=0, api=1, shop=0 → address = 4

  it("resolveSvcRef — 정상 인코딩", () => {
    const result = coord.resolveSvcRef("web", "dev", "asia", "shop");
    expect(result).toMatch(/^service:v1:\d+$/);
    // dev=0, asia=0, web=0, shop=0 → 0*64 + 0*16 + 0*4 + 0*1 = 0
    expect(result).toBe("service:v1:0");
  });

  it("resolveSvcRef — 다른 좌표", () => {
    const result = coord.resolveSvcRef("api", "dev", "asia", "shop");
    // dev=0, asia=0, api=1, shop=0 → 0*64 + 0*16 + 1*4 + 0*1 = 4
    expect(result).toBe("service:v1:4");
  });

  it("resolveSvcRef — namespace 기본값 shop", () => {
    const result = coord.resolveSvcRef("web", "dev", "asia");
    expect(result).toBe("service:v1:0");
  });

  it("resolveSvcRef — 미등록 서비스 → null", () => {
    expect(coord.resolveSvcRef("unknown-svc", "dev", "asia")).toBeNull();
  });

  it("resolveSvcRef — 미등록 env → null", () => {
    expect(coord.resolveSvcRef("web", "unknown-env", "asia")).toBeNull();
  });

  it("encodeDeployEvent — null svcRef → {}", () => {
    expect(coord.encodeDeployEvent(null, "deploy")).toEqual({});
  });

  it("encodeDeployEvent — 정상 인코딩", () => {
    // svcRef address=0 → refEntries [0,1,2] 에서 index 0
    // deploy_action "deploy" → index 0
    // deploy_event 고정 차원: svc_ref(3) × deploy_action(4) → strides: [4, 1]
    // position: svc_ref=0, deploy_action=0 → 0*4 + 0*1 = 0
    const result = coord.encodeDeployEvent("service:v1:0", "deploy");
    expect(result).toHaveProperty("deploy_event");
    expect(result.deploy_event).toMatch(/^deploy_event:v1:\d+$/);
  });

  it("encodeDeployEvent — rollback 액션", () => {
    // deploy_action "rollback" → index 1
    // position: svc_ref=0, deploy_action=1 → 0*4 + 1*1 = 1
    const result = coord.encodeDeployEvent("service:v1:0", "rollback");
    expect(result.deploy_event).toBe("deploy_event:v1:1");
  });

  it("encodeDeployEvent — 미등록 action → {}", () => {
    expect(coord.encodeDeployEvent("service:v1:0", "unknown_action")).toEqual({});
  });

  it("encodeDeployEvent — svcRef가 refEntries에 없으면 → {}", () => {
    // address=999는 refEntries [0,1,2]에 없음
    expect(coord.encodeDeployEvent("service:v1:999", "deploy")).toEqual({});
  });

  it("encodeHealthEvent — null svcRef → {}", () => {
    expect(coord.encodeHealthEvent(null, "healthy")).toEqual({});
  });

  it("encodeHealthEvent — 정상 인코딩", () => {
    // health_event 고정 차원: svc_ref(3) × health_status(4) → strides: [4, 1]
    // svc_ref address=0 → index 0, health_status "healthy" → index 0
    // 0*4 + 0*1 = 0
    const result = coord.encodeHealthEvent("service:v1:0", "healthy");
    expect(result).toHaveProperty("health_event");
    expect(result.health_event).toBe("health_event:v1:0");
  });

  it("encodeHealthEvent — degraded 상태", () => {
    // health_status "degraded" → index 1
    const result = coord.encodeHealthEvent("service:v1:0", "degraded");
    expect(result.health_event).toBe("health_event:v1:1");
  });

  it("encodeHealthEvent — 미등록 status → {}", () => {
    expect(coord.encodeHealthEvent("service:v1:0", "unknown_status")).toEqual({});
  });
});

describe("CoordinateAdapter — empty catalog (fail-open)", () => {
  const emptyCatalog = { id: "empty", name: "empty", axes: {}, prefixes: {} } as unknown as Catalog;
  const coord = createCoordinateAdapter(emptyCatalog);

  it("resolveSvcRef → null", () => {
    expect(coord.resolveSvcRef("web", "dev", "asia")).toBeNull();
  });

  it("encodeDeployEvent → {}", () => {
    expect(coord.encodeDeployEvent("service:v1:0", "deploy")).toEqual({});
  });

  it("encodeHealthEvent → {}", () => {
    expect(coord.encodeHealthEvent("service:v1:0", "healthy")).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm --filter infra-engine test -- --run coordinate`
Expected: 전부 PASS (약 16개)

- [ ] **Step 3: Commit**

```bash
git add packages/infra-engine/__tests__/adapters/coordinate.test.ts
git commit -m "test(infra): update CoordinateAdapter tests for real encoding (16 cases)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: infra-engine.todo.md + spec 업데이트

**Files:**
- Modify: `docs/specs/infra-engine/infra-engine.todo.md`

- [ ] **Step 1: CoordinateAdapter 항목을 완료로 이동**

`docs/specs/infra-engine/infra-engine.todo.md`의 운영 통합 섹션에서 CoordinateAdapter 행을 제거:

```markdown
- [ ] **CoordinateAdapter 좌표 인코딩** — demo-catalog WeightedIndex로 실인코딩 (현재 fail-open)
```

→ 구현 완료 요약에 추가:
```markdown
- 좌표: CoordinateAdapter Catalog 기반 실인코딩 (service/deploy_event/health_event)
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/infra-engine/infra-engine.todo.md
git commit -m "docs: mark CoordinateAdapter 실인코딩 as completed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
