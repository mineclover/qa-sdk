## 단계 3: catalog service version axis 등록 + sim-service-catalog 패키지

**Spec 참조:** `02-canary-topology.md` §2 + §5

본 단계는 시뮬 서비스 버전을 qa-sdk catalog의 version axis 위 정수 좌표로 묶는 grammar/조작 layer를 만든다. 후속 시뮬(auth, pm, …)도 같은 패턴을 재사용할 수 있도록 enterprise-pm 외부 공용 패키지(`packages/sim-service-catalog`)로 둔다. 본 패키지는 단계 2의 `sim-identifier-grammar`를 import해서 prefix·version-tag raw 보간을 차단한다.

### File Structure (단계 3)

| 종류 | 경로 |
|---|---|
| Create | `packages/sim-service-catalog/package.json` |
| Create | `packages/sim-service-catalog/tsup.config.ts` |
| Create | `packages/sim-service-catalog/tsconfig.json` |
| Create | `packages/sim-service-catalog/vitest.config.ts` |
| Create | `packages/sim-service-catalog/src/index.ts` |
| Create | `packages/sim-service-catalog/src/types.ts` |
| Create | `packages/sim-service-catalog/src/get-service-version-tag.ts` (+ `.test.ts`) |
| Create | `packages/sim-service-catalog/src/transition-state.ts` (+ `.test.ts`) |
| Create | `packages/sim-service-catalog/src/get-current-topology.ts` (+ `.test.ts`) |
| Create | `simulations/enterprise-pm/contracts/service-version.catalog.ts` |
| Modify | `simulations/enterprise-pm/scripts/sim-build.sh` (catalog 산출 `APPROVAL_V1_TAG`/`APPROVAL_V2_TAG` 주입) |
| Create | `simulations/enterprise-pm/scripts/validate-catalog.ts` |
| Modify | `simulations/enterprise-pm/package.json` (`sim:catalog:validate` 스크립트) |

---

### Task 3.1: 패키지 골격 생성

**Files:**
- Create: `packages/sim-service-catalog/{package.json, tsup.config.ts, tsconfig.json, vitest.config.ts, src/index.ts, src/types.ts}`

- [ ] **Step 3.1.1: package.json (ralph-tui-integration 패턴 그대로)**

`packages/sim-service-catalog/package.json`:

```json
{
  "name": "sim-service-catalog",
  "version": "0.1.0",
  "description": "시뮬 서비스 버전 카탈로그 — qa-sdk catalog version axis 위 prefix/state/version 조작 layer",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "sim-identifier-grammar": "workspace:*",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 3.1.2: tsup/tsconfig/vitest config**

세 파일 모두 Plan A Task 2.1.2~2.1.4의 `sim-identifier-grammar` 콘텐츠를 글자 그대로 복사한다 (entry `src/index.ts`, ESM+CJS dual, ES2023 NodeNext, vitest node + `passWithNoTests: false`). 패키지 단위 변경 사항 없음.

- [ ] **Step 3.1.3: src/index.ts + src/types.ts**

`src/index.ts` (빈 진입점, 후속 task에서 채움):

```typescript
// sim-service-catalog — 시뮬 서비스 버전 카탈로그 진입점.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2 §5
export {};
```

`src/types.ts`:

```typescript
import type { ServicePrefix, VersionTag, VersionTagState } from "sim-identifier-grammar";

export type ServiceState = VersionTagState; // retired | stable | candidate

export interface VersionEntry {
  /** version tag — sim-identifier-grammar canonical 표기 (예: "v3", "v4-candidate"). */
  version: string;
  state: ServiceState;
}

export interface CatalogPrefixDefinition {
  /** canonical service prefix 문자열 — sim-identifier-grammar buildServicePrefix 통과. */
  prefix: string;
  versionAxis: { kind: "version"; capacity: number };
  refEntries: VersionEntry[];
}

/** spec 02 §5의 getCurrentTopology 반환. */
export interface Topology {
  prefix: ServicePrefix;
  stable: VersionTag;            // 정확히 1개 — invariant
  candidate: VersionTag | null;  // 0 또는 1개
  retired: VersionTag[];
  /** 호출 측이 관리하는 catalog revision. gateway/controller 부팅 sync용. */
  revision: number;
}

export interface TransitionLog {
  prefix: string;
  from: VersionEntry;
  to: VersionEntry;
  occurredAt: string; // ISO-8601
  revision: number;
}
```

- [ ] **Step 3.1.4: install + 빌드 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm install
pnpm --filter sim-identifier-grammar build
pnpm --filter sim-service-catalog build
```

기대: `dist/index.{js,cjs,d.ts}` 생성, workspace import 정상 해석.

- [ ] **Step 3.1.5: Commit**

```bash
git add packages/sim-service-catalog/
git commit -m "feat(sim-service-catalog): package skeleton (tsup ESM+CJS dual + sim-identifier-grammar dep)"
```

---

### Task 3.2: getServiceVersionTag(prefix, state) 구현 + 테스트

**Files:**
- Create: `packages/sim-service-catalog/src/get-service-version-tag.ts` (+ `.test.ts`)
- Modify: `packages/sim-service-catalog/src/index.ts`

spec 02 §5의 *"빌드 스크립트용. catalog에서 정확히 한 개의 (prefix, state) → version 매핑을 돌려준다. 0개 또는 2개 이상이면 throw"* 계약.

- [ ] **Step 3.2.1: 실패 테스트 작성 (test-first)**

`src/get-service-version-tag.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildServicePrefix,
  parseVersionTag,
} from "sim-identifier-grammar";
import { getServiceVersionTag } from "./get-service-version-tag.js";
import type { CatalogPrefixDefinition } from "./types.js";

const APPROVAL: CatalogPrefixDefinition = {
  prefix: buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" }),
  versionAxis: { kind: "version", capacity: 64 },
  refEntries: [
    { version: "v1", state: "retired" },
    { version: "v2", state: "retired" },
    { version: "v3", state: "stable" },
    { version: "v4-candidate", state: "candidate" },
  ],
};

describe("getServiceVersionTag (spec 02 §5)", () => {
  it("stable → v3, candidate → v4-candidate (parseVersionTag로 회수 가능)", () => {
    expect(parseVersionTag(getServiceVersionTag(APPROVAL, "stable")))
      .toEqual({ axis: "version", value: 3, state: "stable" });
    expect(parseVersionTag(getServiceVersionTag(APPROVAL, "candidate")))
      .toEqual({ axis: "version", value: 4, state: "candidate" });
  });

  it("retired는 다수 가능 → throw (exactly-one invariant)", () => {
    expect(() => getServiceVersionTag(APPROVAL, "retired")).toThrow();
  });

  it("매칭 entry 0개 → throw", () => {
    const noCandidate = {
      ...APPROVAL,
      refEntries: APPROVAL.refEntries.filter((e) => e.state !== "candidate"),
    };
    expect(() => getServiceVersionTag(noCandidate, "candidate")).toThrow();
  });

  it("매칭 entry 2개 이상 → throw (stable 중복)", () => {
    const dupStable = {
      ...APPROVAL,
      refEntries: [
        { version: "v3", state: "stable" as const },
        { version: "v5", state: "stable" as const },
      ],
    };
    expect(() => getServiceVersionTag(dupStable, "stable")).toThrow();
  });
});
```

- [ ] **Step 3.2.2: 테스트 실패 확인**

```bash
pnpm --filter sim-service-catalog test get-service-version-tag
```

기대: FAIL (모듈 미정의).

- [ ] **Step 3.2.3: 최소 구현**

`src/get-service-version-tag.ts`:

```typescript
import { parseServicePrefix, parseVersionTag } from "sim-identifier-grammar";
import type { CatalogPrefixDefinition, ServiceState } from "./types.js";

/**
 * spec 02 §5: catalog에서 (prefix, state) → version 매핑을 정확히 1개 돌려준다.
 * 0개 또는 2개 이상이면 invariant 위반으로 throw.
 */
export function getServiceVersionTag(
  catalog: CatalogPrefixDefinition,
  state: ServiceState,
): string {
  parseServicePrefix(catalog.prefix); // raw 문자열 차단
  const matched = catalog.refEntries.filter((e) => e.state === state);
  if (matched.length === 0) {
    throw new Error(
      `getServiceVersionTag: prefix=${catalog.prefix} state=${state} — 0개 매칭 (exactly one expected)`,
    );
  }
  if (matched.length > 1) {
    throw new Error(
      `getServiceVersionTag: prefix=${catalog.prefix} state=${state} — ${matched.length}개 매칭 (0개 또는 2개 이상은 invariant 위반)`,
    );
  }
  parseVersionTag(matched[0].version); // 반환 전 grammar 검증
  return matched[0].version;
}
```

- [ ] **Step 3.2.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-service-catalog test get-service-version-tag
```

기대: 4 PASS.

`src/index.ts`에 추가:

```typescript
export { getServiceVersionTag } from "./get-service-version-tag.js";
export type {
  CatalogPrefixDefinition,
  ServiceState,
  Topology,
  TransitionLog,
  VersionEntry,
} from "./types.js";
```

- [ ] **Step 3.2.5: Commit**

```bash
git add packages/sim-service-catalog/src/get-service-version-tag.ts \
        packages/sim-service-catalog/src/get-service-version-tag.test.ts \
        packages/sim-service-catalog/src/types.ts \
        packages/sim-service-catalog/src/index.ts
git commit -m "feat(sim-service-catalog): getServiceVersionTag(prefix, state) — exactly-one invariant"
```

---

### Task 3.3: transitionState({ prefix, from, to }) 구현 + 테스트

**Files:**
- Create: `packages/sim-service-catalog/src/transition-state.ts` (+ `.test.ts`)
- Modify: `packages/sim-service-catalog/src/index.ts`

spec 02 §5: *"controller 승격/롤백 시 호출. invariant 위반 시 throw + audit 기록"*. 본 task는 in-memory mutation + transition log만 책임지고, audit-recorder/ingest 발행은 hook으로 호출 측에 위임한다 (외부 시스템 호출은 패키지 외부 — spec 02 §5 마지막 단락 단방향 의존 유지).

- [ ] **Step 3.3.1: 실패 테스트 작성**

`src/transition-state.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildServicePrefix } from "sim-identifier-grammar";
import { transitionState } from "./transition-state.js";
import type { CatalogPrefixDefinition, TransitionLog } from "./types.js";

function makeCatalog(): CatalogPrefixDefinition {
  return {
    prefix: buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" }),
    versionAxis: { kind: "version", capacity: 64 },
    refEntries: [
      { version: "v1", state: "retired" },
      { version: "v2", state: "retired" },
      { version: "v3", state: "stable" },
      { version: "v4-candidate", state: "candidate" },
    ],
  };
}

describe("transitionState (spec 02 §2.3 + §5)", () => {
  it("candidate → stable: 옛 stable 자동 retired + log 기록", () => {
    const r = transitionState(makeCatalog(), {
      from: { version: "v4-candidate", state: "candidate" },
      to: { version: "v4", state: "stable" },
    });
    expect(r.catalog.refEntries.find((e) => e.state === "stable"))
      .toEqual({ version: "v4", state: "stable" });
    expect(r.catalog.refEntries.filter((e) => e.state === "retired").map((e) => e.version))
      .toContain("v3");
    expect(r.catalog.refEntries.find((e) => e.state === "candidate")).toBeUndefined();
    expect(r.log.from.version).toBe("v4-candidate");
    expect(r.log.to.version).toBe("v4");
  });

  it("candidate → retired: 단순 롤백, stable 보존", () => {
    const r = transitionState(makeCatalog(), {
      from: { version: "v4-candidate", state: "candidate" },
      to: { version: "v4-candidate", state: "retired" },
    });
    expect(r.catalog.refEntries.find((e) => e.state === "candidate")).toBeUndefined();
    expect(r.catalog.refEntries.find((e) => e.state === "stable")?.version).toBe("v3");
  });

  it.each([
    ["retired", "stable"],
    ["retired", "candidate"],
    ["stable", "candidate"],
  ] as const)("illegal transition %s → %s → reject", (from, to) => {
    const fromVer = from === "stable" ? "v3" : "v1";
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: fromVer, state: from },
        to: { version: fromVer, state: to },
      }),
    ).toThrow(/illegal transition/);
  });

  it("from entry가 catalog에 없으면 throw", () => {
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: "v99-candidate", state: "candidate" },
        to: { version: "v99", state: "stable" },
      }),
    ).toThrow(/from entry not found/);
  });

  it("audit hook은 성공 전이에만 호출됨 (실패 전이는 기록 안 함)", () => {
    const recorded: TransitionLog[] = [];
    transitionState(makeCatalog(), {
      from: { version: "v4-candidate", state: "candidate" },
      to: { version: "v4", state: "stable" },
      onTransition: (log) => recorded.push(log),
    });
    expect(recorded).toHaveLength(1);
    expect(() =>
      transitionState(makeCatalog(), {
        from: { version: "v1", state: "retired" },
        to: { version: "v1", state: "stable" },
        onTransition: (log) => recorded.push(log),
      }),
    ).toThrow();
    expect(recorded).toHaveLength(1);
  });
});
```

- [ ] **Step 3.3.2: 테스트 실패 확인**

```bash
pnpm --filter sim-service-catalog test transition-state
```

기대: FAIL.

- [ ] **Step 3.3.3: 최소 구현**

`src/transition-state.ts`:

```typescript
import { parseServicePrefix, parseVersionTag } from "sim-identifier-grammar";
import type {
  CatalogPrefixDefinition,
  ServiceState,
  TransitionLog,
  VersionEntry,
} from "./types.js";

/**
 * spec 02 §2.3: 허용 전이는 candidate → {stable, retired} 두 가지.
 * - candidate → stable: 옛 stable은 자동 retired (정방향 승격)
 * - candidate → retired: 롤백
 * 그 외(retired→*, stable→candidate)는 모두 illegal.
 */
const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [ServiceState, ServiceState]> = [
  ["candidate", "stable"],
  ["candidate", "retired"],
];

export interface TransitionInput {
  from: VersionEntry;
  to: VersionEntry;
  /** 성공 전이 시 호출 — 호출 측이 audit-recorder/ingest 발행 책임. */
  onTransition?: (log: TransitionLog) => void;
  /** controller가 단조 증가로 관리. 미지정 시 1. */
  revision?: number;
  occurredAt?: string;
}

export interface TransitionResult {
  catalog: CatalogPrefixDefinition;
  log: TransitionLog;
}

export function transitionState(
  catalog: CatalogPrefixDefinition,
  input: TransitionInput,
): TransitionResult {
  parseServicePrefix(catalog.prefix);
  parseVersionTag(input.from.version);
  parseVersionTag(input.to.version);

  const allowed = ALLOWED_TRANSITIONS.some(
    ([f, t]) => f === input.from.state && t === input.to.state,
  );
  if (!allowed) {
    throw new Error(
      `transitionState: illegal transition ${input.from.state} → ${input.to.state} (prefix=${catalog.prefix})`,
    );
  }

  const fromIdx = catalog.refEntries.findIndex(
    (e) => e.version === input.from.version && e.state === input.from.state,
  );
  if (fromIdx < 0) {
    throw new Error(
      `transitionState: from entry not found — prefix=${catalog.prefix} version=${input.from.version} state=${input.from.state}`,
    );
  }

  const next: VersionEntry[] = catalog.refEntries.map((e) => ({ ...e }));
  next[fromIdx] = { version: input.to.version, state: input.to.state };

  if (input.from.state === "candidate" && input.to.state === "stable") {
    for (let i = 0; i < next.length; i++) {
      if (i === fromIdx) continue;
      if (next[i].state === "stable") next[i] = { ...next[i], state: "retired" };
    }
  }

  // invariant: stable=1, candidate≤1
  const stableCount = next.filter((e) => e.state === "stable").length;
  const candidateCount = next.filter((e) => e.state === "candidate").length;
  if (stableCount !== 1) {
    throw new Error(`transitionState: invariant 위반 — stable count=${stableCount}`);
  }
  if (candidateCount > 1) {
    throw new Error(`transitionState: invariant 위반 — candidate count=${candidateCount}`);
  }

  const log: TransitionLog = {
    prefix: catalog.prefix,
    from: input.from,
    to: input.to,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    revision: input.revision ?? 1,
  };
  input.onTransition?.(log); // invariant 통과 후에만
  return { catalog: { ...catalog, refEntries: next }, log };
}
```

- [ ] **Step 3.3.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-service-catalog test transition-state
```

기대: 6 PASS.

`src/index.ts`에 추가:

```typescript
export { transitionState } from "./transition-state.js";
export type { TransitionInput, TransitionResult } from "./transition-state.js";
```

- [ ] **Step 3.3.5: Commit**

```bash
git add packages/sim-service-catalog/src/transition-state.ts \
        packages/sim-service-catalog/src/transition-state.test.ts \
        packages/sim-service-catalog/src/index.ts
git commit -m "feat(sim-service-catalog): transitionState — allowed transitions + invariant guard + audit hook"
```

---

### Task 3.4: getCurrentTopology(prefix) 구현 + 테스트

**Files:**
- Create: `packages/sim-service-catalog/src/get-current-topology.ts` (+ `.test.ts`)
- Modify: `packages/sim-service-catalog/src/index.ts`

spec 02 §5: *"`{ stable, candidate, retired }` — gateway/controller 부팅 시 sync. 응답 자체에 catalog revision이 박혀 있어 gateway가 이후 routing push와 정합성 비교 가능"*.

> **SSOT 결정**: refEntries의 *`entry.state`* 필드가 role assignment의 단일 진실이다. `version` 문자열(`"v1"`, `"v4-candidate"`)은 image tag/url interpolation 용도일 뿐 — `parseVersionTag("v1")` 결과 `state: "stable"`은 retired entry의 `state: "retired"`와 직교 차원. tag-string과 entry.state를 비교하는 drift check는 false-positive(spec §2.1 fixture의 retired 항목 `{ version: "v1", state: "retired" }` 자기 자신을 잡음)를 일으키므로 도입하지 않는다. state suffix 강제는 별도 게이트(`buildVersionTag` 검증)에서만 다룬다.

- [ ] **Step 3.4.1: 실패 테스트 작성**

`src/get-current-topology.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildServicePrefix } from "sim-identifier-grammar";
import { getCurrentTopology } from "./get-current-topology.js";
import type { CatalogPrefixDefinition } from "./types.js";

const PREFIX = buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" });

function makeCat(refEntries: { version: string; state: "retired" | "stable" | "candidate" }[]): CatalogPrefixDefinition {
  return { prefix: PREFIX, versionAxis: { kind: "version", capacity: 64 }, refEntries };
}

describe("getCurrentTopology (spec 02 §5)", () => {
  it("stable + candidate + 다수 retired → 모든 슬롯 분류 + revision 보존", () => {
    const t = getCurrentTopology(
      makeCat([
        { version: "v1", state: "retired" },
        { version: "v2", state: "retired" },
        { version: "v3", state: "stable" },
        { version: "v4-candidate", state: "candidate" },
      ]),
      { revision: 7 },
    );
    expect(t.stable).toEqual({ axis: "version", value: 3, state: "stable" });
    expect(t.candidate).toEqual({ axis: "version", value: 4, state: "candidate" });
    expect(t.retired.map((r) => r.value)).toEqual([1, 2]);
    expect(t.revision).toBe(7);
    expect(t.prefix).toEqual({ namespace: "sim", category: "svc", name: "approval" });
  });

  it("candidate 없음 → null, retired 0개 OK", () => {
    const t = getCurrentTopology(makeCat([{ version: "v1", state: "stable" }]), { revision: 0 });
    expect(t.candidate).toBeNull();
    expect(t.retired).toEqual([]);
    expect(t.stable.value).toBe(1);
  });

  it("invariant 위반 케이스 모두 throw", () => {
    expect(() => getCurrentTopology(makeCat([{ version: "v1", state: "retired" }]), { revision: 0 }))
      .toThrow(/stable/); // stable 0개
    expect(() => getCurrentTopology(makeCat([
      { version: "v3", state: "stable" },
      { version: "v5", state: "stable" },
    ]), { revision: 0 })).toThrow(/stable/); // stable 2개
    expect(() => getCurrentTopology(makeCat([
      { version: "v3", state: "stable" },
      { version: "v4-candidate", state: "candidate" },
      { version: "v5-candidate", state: "candidate" },
    ]), { revision: 0 })).toThrow(/candidate/); // candidate 2개
  });
});
```

- [ ] **Step 3.4.2: 테스트 실패 확인**

```bash
pnpm --filter sim-service-catalog test get-current-topology
```

기대: FAIL.

- [ ] **Step 3.4.3: 최소 구현**

`src/get-current-topology.ts`:

```typescript
import {
  parseServicePrefix,
  parseVersionTag,
  type VersionTag,
} from "sim-identifier-grammar";
import type { CatalogPrefixDefinition, Topology } from "./types.js";

export interface TopologyOptions {
  /** 호출 측(controller/gateway 부팅)이 관리하는 catalog revision. */
  revision: number;
}

export function getCurrentTopology(
  catalog: CatalogPrefixDefinition,
  options: TopologyOptions,
): Topology {
  const prefix = parseServicePrefix(catalog.prefix);
  const stables: VersionTag[] = [];
  const candidates: VersionTag[] = [];
  const retireds: VersionTag[] = [];

  for (const entry of catalog.refEntries) {
    // version 문자열은 grammar 통과 (parseVersionTag) — image tag 보간용 정규성 보장.
    // role assignment(stable/candidate/retired)는 *entry.state* 필드가 SSOT.
    // tag-string 자체의 state suffix와 entry.state 비교는 retired entry의
    // bare "v1" 표기를 false-positive로 잡으므로 도입하지 않는다 (위 SSOT 결정 참조).
    const parsed = parseVersionTag(entry.version);
    const tag: VersionTag = { axis: "version", value: parsed.value, state: entry.state };
    if (entry.state === "stable") stables.push(tag);
    else if (entry.state === "candidate") candidates.push(tag);
    else retireds.push(tag);
  }

  if (stables.length !== 1) {
    throw new Error(
      `getCurrentTopology: invariant — stable count=${stables.length} (정확히 1개, prefix=${catalog.prefix})`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `getCurrentTopology: invariant — candidate count=${candidates.length} (0 또는 1개, prefix=${catalog.prefix})`,
    );
  }

  retireds.sort((a, b) => a.value - b.value);
  return {
    prefix,
    stable: stables[0],
    candidate: candidates[0] ?? null,
    retired: retireds,
    revision: options.revision,
  };
}
```

- [ ] **Step 3.4.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-service-catalog test get-current-topology
```

기대: 3 PASS.

`src/index.ts`에 추가:

```typescript
export { getCurrentTopology } from "./get-current-topology.js";
export type { TopologyOptions } from "./get-current-topology.js";
```

- [ ] **Step 3.4.5: Commit**

```bash
git add packages/sim-service-catalog/src/get-current-topology.ts \
        packages/sim-service-catalog/src/get-current-topology.test.ts \
        packages/sim-service-catalog/src/index.ts
git commit -m "feat(sim-service-catalog): getCurrentTopology(catalog, { revision }) — invariant + retired sort"
```

---

### Task 3.5: contracts/service-version.catalog.ts 등록

**Files:**
- Create: `simulations/enterprise-pm/contracts/service-version.catalog.ts`

본 파일은 spec 02 §2.1의 `SIM_SERVICE_PREFIXES` 코드를 그대로 옮긴다. enterprise-pm 시뮬 service version 좌표의 SSOT — 후속 시뮬은 자기 contracts 디렉토리에 동일 패턴으로 추가한다.

- [ ] **Step 3.5.1: 콘텐츠 작성 (spec 02 §2.1 인용)**

`simulations/enterprise-pm/contracts/service-version.catalog.ts`:

```typescript
// enterprise-pm 시뮬 서비스 버전 catalog — qa-sdk catalog version axis 등록.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2.1
// state는 retired | stable | candidate 3종 고정.
// 같은 prefix 안에서 stable·candidate는 각각 0 또는 1개만 존재 (controller invariant).

import { buildServicePrefix } from "sim-identifier-grammar";
import type { CatalogPrefixDefinition } from "sim-service-catalog";

export const SIM_SERVICE_PREFIXES = {
  approvalApi: {
    prefix: buildServicePrefix({ namespace: "sim", category: "svc", name: "approval" }),
    versionAxis: { kind: "version", capacity: 64 } as const,   // 64 버전 헤드룸
    refEntries: [
      { version: "v1", state: "retired" },
      { version: "v2", state: "retired" },
      { version: "v3", state: "stable" },
      { version: "v4-candidate", state: "candidate" },
    ],
  } satisfies CatalogPrefixDefinition,
  // 다른 시뮬 서비스도 후속에 같은 패턴 (auth, pm, ...)
} as const;

export type SimServicePrefixId = keyof typeof SIM_SERVICE_PREFIXES;
```

> spec §2.1 원문은 candidate version을 `"v4"`(state suffix 없이)로 표기하나, sim-identifier-grammar canonical(Plan A Task 2.3)은 candidate suffix 포함 `"v4-candidate"`. 본 파일은 grammar canonical을 따르며, image tag에도 그대로 보간된다 (spec §1의 `qa-sdk/sim-approval-api:${APPROVAL_V2_TAG}` 패턴과 일치).

- [ ] **Step 3.5.2: 정합성 + 라운드트립 점검**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter sim-service-catalog build
npx tsx -e '
  import { SIM_SERVICE_PREFIXES } from "./simulations/enterprise-pm/contracts/service-version.catalog.ts";
  import { getServiceVersionTag, getCurrentTopology } from "sim-service-catalog";
  const v1 = getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "stable");
  const v2 = getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "candidate");
  const t = getCurrentTopology(SIM_SERVICE_PREFIXES.approvalApi, { revision: 0 });
  console.log({ v1, v2, retired: t.retired.length });
'
```

기대: `{ v1: "v3", v2: "v4-candidate", retired: 2 }` 출력.

- [ ] **Step 3.5.3: Commit**

```bash
git add simulations/enterprise-pm/contracts/service-version.catalog.ts
git commit -m "feat(sim/contracts): register sim.svc.approval prefix on catalog version axis (spec 02 §2.1)"
```

---

### Task 3.6: scripts/sim-build.sh에 catalog get-version 호출 통합

**Files:**
- Modify: `simulations/enterprise-pm/scripts/sim-build.sh`

spec 02 §2.2를 그대로 반영. catalog가 정한 version과 1:1 대응하는 image 태그만 build에 들어가게 하고, 외부에서 만든 태그(`latest`/`HEAD`)는 차단한다.

- [ ] **Step 3.6.1: 콘텐츠 작성 (spec 02 §2.2 그대로)**

`simulations/enterprise-pm/scripts/sim-build.sh`:

```bash
#!/usr/bin/env bash
# enterprise-pm 시뮬 카나리 빌드 — catalog 산출 version tag 주입.
# spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2.2

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
SIM_DIR="$ROOT_DIR/simulations/enterprise-pm"
cd "$ROOT_DIR"

# spec §5 단방향 의존: sim-service-catalog의 in-process API만 호출.
# (qa-sdk CLI에 catalog get-version subcommand 도입 시 그쪽으로 교체.)
APPROVAL_V1_TAG=$(npx tsx -e '
  import { SIM_SERVICE_PREFIXES } from "./simulations/enterprise-pm/contracts/service-version.catalog.ts";
  import { getServiceVersionTag } from "sim-service-catalog";
  process.stdout.write(getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "stable"));
')
APPROVAL_V2_TAG=$(npx tsx -e '
  import { SIM_SERVICE_PREFIXES } from "./simulations/enterprise-pm/contracts/service-version.catalog.ts";
  import { getServiceVersionTag } from "sim-service-catalog";
  process.stdout.write(getServiceVersionTag(SIM_SERVICE_PREFIXES.approvalApi, "candidate"));
')

if [ -z "$APPROVAL_V1_TAG" ] || [ -z "$APPROVAL_V2_TAG" ]; then
  echo "sim-build.sh: catalog get-version 실패 — V1=$APPROVAL_V1_TAG V2=$APPROVAL_V2_TAG" >&2
  exit 1
fi

echo "sim-build.sh: APPROVAL_V1_TAG=$APPROVAL_V1_TAG (stable), APPROVAL_V2_TAG=$APPROVAL_V2_TAG (candidate)"
export APPROVAL_V1_TAG APPROVAL_V2_TAG

cd "$SIM_DIR"
docker compose -f docker-compose.sim.yaml build \
  --build-arg APPROVAL_V1_TAG="$APPROVAL_V1_TAG" \
  --build-arg APPROVAL_V2_TAG="$APPROVAL_V2_TAG" \
  sim-approval-api-v1 sim-approval-api-v2
```

> spec §2.2 원문은 `qa-sdk catalog get-version --prefix=... --state=...` CLI 호출이지만, 본 plan 시점에서 `@qa-sdk/cli`에 `catalog get-version` subcommand가 없다. spec §5 *"`@qa-sdk/cli`의 `catalog` subcommand가 노출하는 RPC 또는 in-process API만 사용해 의존 방향을 단방향으로 유지"* 조항에 따라 in-process API(getServiceVersionTag)를 동등 호출로 사용한다.

- [ ] **Step 3.6.2: 실행 권한 + 빌드 실행**

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-build.sh
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-build.sh
```

기대: `APPROVAL_V1_TAG=v3 APPROVAL_V2_TAG=v4-candidate` 출력 후 docker buildx 진행.

- [ ] **Step 3.6.3: catalog 변조 시 빌드 차단 negative test**

```bash
# stable entry 일시 제거 → 빌드 차단 확인 (catalog invariant이 sim-build 진입 단계에서 throw).
git stash
sed -i.bak 's/state: "stable"/state: "retired"/' \
  /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/contracts/service-version.catalog.ts
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/sim-build.sh \
  && echo "FAIL — should have thrown" || echo "OK — build refused"
git stash pop
```

기대: `OK — build refused`.

- [ ] **Step 3.6.4: Commit**

```bash
git add simulations/enterprise-pm/scripts/sim-build.sh
git commit -m "feat(sim/scripts): sim-build.sh — inject APPROVAL_V1_TAG/V2_TAG from sim-service-catalog (spec 02 §2.2)"
```

---

### Task 3.7: pnpm sim:catalog:validate 스크립트 (4-way 정합성)

**Files:**
- Create: `simulations/enterprise-pm/scripts/validate-catalog.ts`
- Modify: `simulations/enterprise-pm/package.json`

catalog ↔ docker-compose image ↔ `.env.sim` ↔ 실제 service 디렉토리 4-way 정합성 게이트. 어느 하나라도 어긋나면 sim-up 진입 전에 빌드를 멈춘다.

- [ ] **Step 3.7.1: validate-catalog.ts 콘텐츠 작성**

`simulations/enterprise-pm/scripts/validate-catalog.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * sim:catalog:validate — 4-way 정합성 게이트.
 *   1) contracts catalog invariant
 *   2) docker-compose.sim.yaml의 sim-approval-api-v1/v2 image:${APPROVAL_V*_TAG} 라인
 *   3) .env.sim의 APPROVAL_V*_TAG 값이 catalog 산출과 일치
 *   4) filesystem: services/approval-api/Dockerfile 존재
 * spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2 §5
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildImageTag, parseServicePrefix } from "sim-identifier-grammar";
import { getCurrentTopology, getServiceVersionTag } from "sim-service-catalog";
import { SIM_SERVICE_PREFIXES } from "../contracts/service-version.catalog.ts";

const SIM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Failure { axis: "contracts" | "compose" | "env" | "filesystem"; detail: string; }
const failures: Failure[] = [];
const fail = (axis: Failure["axis"], detail: string) => failures.push({ axis, detail });
const parseValue = (tag: string): number => {
  const m = tag.match(/^v([1-9][0-9]*)/);
  if (!m) throw new Error(`parseValue: invalid tag ${tag}`);
  return Number(m[1]);
};

function printAndExit(stableTag?: string, candidateTag?: string | null): never {
  if (failures.length === 0) {
    console.log("sim:catalog:validate — OK (4-way 정합성 통과)");
    console.log(`  contracts.stable    = ${stableTag}`);
    console.log(`  contracts.candidate = ${candidateTag ?? "<none>"}`);
    process.exit(0);
  }
  console.error(`sim:catalog:validate — FAIL (${failures.length}건)`);
  for (const f of failures) console.error(`  [${f.axis}] ${f.detail}`);
  process.exit(1);
}

// (1) contracts
const approval = SIM_SERVICE_PREFIXES.approvalApi;
let stableTag: string;
let candidateTag: string | null = null;
try {
  const topology = getCurrentTopology(approval, { revision: 0 });
  stableTag = getServiceVersionTag(approval, "stable");
  candidateTag = topology.candidate ? getServiceVersionTag(approval, "candidate") : null;
} catch (err) {
  fail("contracts", `catalog invariant 위반: ${(err as Error).message}`);
  printAndExit();
}

// image tag grammar 통과 확인 (raw 보간 차단)
const prefix = parseServicePrefix(approval.prefix);
buildImageTag({
  registry: "qa-sdk",
  servicePrefix: prefix,
  versionTag: { axis: "version", value: parseValue(stableTag), state: "stable" },
});
if (candidateTag) {
  buildImageTag({
    registry: "qa-sdk",
    servicePrefix: prefix,
    versionTag: { axis: "version", value: parseValue(candidateTag), state: "candidate" },
  });
}

// (2) docker-compose
const composeRaw = readFileSync(resolve(SIM_ROOT, "docker-compose.sim.yaml"), "utf8");
const composeKeys = [...composeRaw.matchAll(
  /image:\s*qa-sdk\/sim-approval-api:\$\{(APPROVAL_V[12]_TAG)\}/g,
)].map((m) => m[1]);
if (!composeKeys.includes("APPROVAL_V1_TAG")) {
  fail("compose", "sim-approval-api-v1 image:${APPROVAL_V1_TAG} 라인 누락");
}
if (candidateTag && !composeKeys.includes("APPROVAL_V2_TAG")) {
  fail("compose", "candidate 존재하지만 sim-approval-api-v2 image:${APPROVAL_V2_TAG} 라인 누락");
}

// (3) .env.sim
const envPath = resolve(SIM_ROOT, ".env.sim");
if (!existsSync(envPath)) {
  fail("env", `.env.sim 부재: ${envPath} (sops decrypt 미실행)`);
} else {
  const envRaw = readFileSync(envPath, "utf8");
  const envV1 = envRaw.match(/^APPROVAL_V1_TAG\s*=\s*(.+)$/m)?.[1]?.trim();
  const envV2 = envRaw.match(/^APPROVAL_V2_TAG\s*=\s*(.+)$/m)?.[1]?.trim();
  if (!envV1) fail("env", "APPROVAL_V1_TAG 미설정");
  else if (envV1 !== stableTag) fail("env", `APPROVAL_V1_TAG=${envV1} ≠ catalog stable=${stableTag}`);
  if (candidateTag) {
    if (!envV2) fail("env", "APPROVAL_V2_TAG 미설정 (candidate 존재)");
    else if (envV2 !== candidateTag) fail("env", `APPROVAL_V2_TAG=${envV2} ≠ catalog candidate=${candidateTag}`);
  }
}

// (4) filesystem
const approvalRoot = resolve(SIM_ROOT, "services", "approval-api");
if (!existsSync(approvalRoot)) fail("filesystem", `service 디렉토리 부재: ${approvalRoot}`);
if (!existsSync(resolve(approvalRoot, "Dockerfile"))) {
  fail("filesystem", `Dockerfile 부재: ${resolve(approvalRoot, "Dockerfile")}`);
}

printAndExit(stableTag, candidateTag);
```

- [ ] **Step 3.7.2: package.json 스크립트 추가**

`simulations/enterprise-pm/package.json`의 `scripts` 블록에 추가:

```json
{
  "scripts": {
    "sim:catalog:validate": "tsx scripts/validate-catalog.ts"
  }
}
```

- [ ] **Step 3.7.3: 실행 + 정합성 통과 + axis별 negative test**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
sops decrypt .env.sim.enc > .env.sim   # sops 보유자만; 미보유자는 .env.sim.example 복사 후 수동 채움
echo "APPROVAL_V1_TAG=v3" >> .env.sim
echo "APPROVAL_V2_TAG=v4-candidate" >> .env.sim
pnpm sim:catalog:validate
```

기대: `OK (4-way 정합성 통과)`.

axis별 어긋남 negative test (각 case 후 원복):
- (a) docker-compose에서 v2 image 라인 주석 → `[compose]` 메시지 + exit 1
- (b) `.env.sim`의 `APPROVAL_V1_TAG=v3`을 `v99`로 변경 → `[env] ≠ catalog stable=v3` + exit 1
- (c) `services/approval-api/Dockerfile` 임시 rename → `[filesystem] Dockerfile 부재` + exit 1
- (d) contracts의 stable entry 제거 → `[contracts] catalog invariant 위반` + exit 1

- [ ] **Step 3.7.4: Commit**

```bash
git add simulations/enterprise-pm/scripts/validate-catalog.ts \
        simulations/enterprise-pm/package.json
git commit -m "feat(sim/scripts): sim:catalog:validate — 4-way (contracts/compose/env/fs) integrity gate"
```
