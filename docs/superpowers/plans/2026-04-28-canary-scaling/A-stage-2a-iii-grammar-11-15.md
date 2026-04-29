### Task 2.12: 식별자 #11 bitmap cache key (중점)

**Files:**
- Create: `packages/sim-identifier-grammar/src/cache-key.ts`
- Create: `packages/sim-identifier-grammar/src/cache-key.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

권한 비트맵 redis key. spec 03 §2.11 합성: `bitmap:${scope}:${id}:${servicePrefix-canonical}:${versionTag-canonical}` (canonical 예시 `bitmap:user:U001:sim.svc.approval:v3`). version을 key에 포함시켜 카나리 중 v3/v4 공존 시 충돌 방지, 구독자는 `bitmap:*:*:<servicePrefix>:<oldVersion>` SCAN+DEL로 일괄 invalidate. 따라서 builder/parser는 service prefix(#1, Task 2.2)·version tag(#2, Task 2.3) 빌더를 재사용 — 직접 문자열 조립 금지. spec 인용: scope ∈ `{user, role}`, `id` 정규식 `[A-Za-z0-9_-]+`, prefix는 `ServicePrefixSchema`, version은 `VersionTagSchema`.

- [ ] **Step 2.12.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/cache-key.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildBitmapCacheKey, parseBitmapCacheKey, type BitmapCacheKey } from "./cache-key.js";

const P = { namespace: "sim", category: "svc", name: "approval" } as const;
const V = { axis: "version", value: 3, state: "stable" } as const;
const ok = (over: Partial<BitmapCacheKey> = {}): BitmapCacheKey =>
  ({ scope: "user", id: "U001", prefix: P, version: V, ...over });

describe("bitmap cache key grammar (#11)", () => {
  it("builds spec §2.11 canonical bitmap:user:U001:sim.svc.approval:v3", () => {
    expect(buildBitmapCacheKey(ok())).toBe("bitmap:user:U001:sim.svc.approval:v3");
  });
  it("parses canonical key back to original shape", () => {
    const orig = ok({ scope: "role", id: "ops-admin" });
    expect(parseBitmapCacheKey(buildBitmapCacheKey(orig))).toEqual(orig);
  });
  it("rejects invalid scope", () => {
    expect(() => buildBitmapCacheKey(ok({ scope: "tenant" as never }))).toThrow();
  });
  it("rejects id with separator characters (':' / space)", () => {
    expect(() => buildBitmapCacheKey(ok({ id: "U:001" }))).toThrow();
  });
  it("rejects invalid prefix (#1 reuse: ServicePrefixSchema 위반)", () => {
    expect(() => buildBitmapCacheKey(ok({ prefix: { namespace: "app" as never, category: "svc", name: "approval" } }))).toThrow();
  });
  it("rejects invalid version (#2 reuse: state 외 값)", () => {
    expect(() => buildBitmapCacheKey(ok({ version: { axis: "version", value: 1, state: "draft" as never } }))).toThrow();
  });
  it("rejects parsing of legacy flat key (spec §2.11 잘못된 사용)", () => {
    expect(() => parseBitmapCacheKey("bitmap:user:U001:approval-v3")).toThrow();
  });
  it("roundtrip property (200 cases — scope × id × prefix × version)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("user", "role"),
        fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom("stable", "candidate", "retired"),
        (scope, id, name, value, state) => {
          const orig: BitmapCacheKey = {
            scope: scope as "user" | "role", id,
            prefix: { namespace: "sim", category: "svc", name },
            version: { axis: "version", value, state },
          };
          expect(parseBitmapCacheKey(buildBitmapCacheKey(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.12.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test cache-key
```
기대: FAIL (모듈 미존재).

- [ ] **Step 2.12.3: 최소 구현**

`packages/sim-identifier-grammar/src/cache-key.ts`:

```typescript
import { z } from "zod";
import { buildServicePrefix, parseServicePrefix, ServicePrefixSchema, type ServicePrefix } from "./service-prefix.js";
import { buildVersionTag, parseVersionTag, VersionTagSchema, type VersionTag } from "./version-tag.js";

export const BITMAP_SCOPES = ["user", "role"] as const;
export type BitmapScope = (typeof BITMAP_SCOPES)[number];

export interface BitmapCacheKey {
  scope: BitmapScope;
  id: string; // [A-Za-z0-9_-]+
  prefix: ServicePrefix;
  version: VersionTag;
}

export const BitmapCacheKeySchema = z.object({
  scope: z.enum(BITMAP_SCOPES),
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  prefix: ServicePrefixSchema,
  version: VersionTagSchema,
});

export function buildBitmapCacheKey(input: BitmapCacheKey): string {
  const v = BitmapCacheKeySchema.parse(input);
  return `bitmap:${v.scope}:${v.id}:${buildServicePrefix(v.prefix)}:${buildVersionTag(v.version)}`;
}

export function parseBitmapCacheKey(s: string): BitmapCacheKey {
  // prefix·version 모두 ':'를 포함하지 않으므로 ':' split → 정확히 5조각.
  const parts = s.split(":");
  if (parts.length !== 5 || parts[0] !== "bitmap") throw new Error(`invalid bitmap cache key: ${s}`);
  const [, scope, id, prefixStr, versionStr] = parts;
  if (!BITMAP_SCOPES.includes(scope as BitmapScope)) throw new Error(`invalid scope: ${scope}`);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`invalid id: ${id}`);
  return { scope: scope as BitmapScope, id, prefix: parseServicePrefix(prefixStr), version: parseVersionTag(versionStr) };
}
```

- [ ] **Step 2.12.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test cache-key
```
기대: 8 PASS. `src/index.ts`에 추가:

```typescript
export {
  buildBitmapCacheKey, parseBitmapCacheKey, BitmapCacheKeySchema, BITMAP_SCOPES,
  type BitmapCacheKey, type BitmapScope,
} from "./cache-key.js";
```

- [ ] **Step 2.12.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/cache-key.ts \
        packages/sim-identifier-grammar/src/cache-key.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #11 bitmap cache key (with #1/#2 composition)"
```

### Task 2.13: 식별자 #12 outbox idempotency key (중점)

**Files:**
- Create: `packages/sim-identifier-grammar/src/idempotency-key.ts`
- Create: `packages/sim-identifier-grammar/src/idempotency-key.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

outbox publisher와 컨슈머 양쪽에서 중복 발행/처리를 방지하는 key. spec 03 §2.12에서 원형 `{ aggregateId, eventName, occurredAt }`, 합성 `${aggregateId}:${eventName}:${occurredAt.epoch}`, 예시 `"proj-001:approval.budget.submitted:1714250400000"`, 린트 `uniqueness 보장 + 결정성 (같은 입력 → 같은 출력)`로 정의된다. eventName은 Task 2.6 결과(`event-name.ts`)에 의존하나 본 task와 병렬 실행될 수 있으므로 eventName 검증은 inline regex(`^[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+$`)로 우회한다. occurredAt은 builder 입력에서 `Date | number` 둘 다 허용하고 epoch ms로 정규화한다.

- [ ] **Step 2.13.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/idempotency-key.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildIdempotencyKey,
  parseIdempotencyKey,
  type IdempotencyKeyInput,
} from "./idempotency-key.js";

describe("outbox idempotency key grammar (#12)", () => {
  it("builds canonical aggregateId:eventName:epoch", () => {
    const out = buildIdempotencyKey({
      aggregateId: "proj-001",
      eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    });
    expect(out).toBe("proj-001:approval.budget.submitted:1714250400000");
  });

  it("parses back to original shape (epoch ms)", () => {
    const orig: IdempotencyKeyInput = {
      aggregateId: "proj-001",
      eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    };
    expect(parseIdempotencyKey(buildIdempotencyKey(orig))).toEqual({
      aggregateId: "proj-001",
      eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    });
  });

  it("normalizes Date input to epoch ms", () => {
    const date = new Date(1714250400000);
    const out = buildIdempotencyKey({
      aggregateId: "proj-001",
      eventName: "approval.budget.submitted",
      occurredAt: date,
    });
    expect(out).toBe("proj-001:approval.budget.submitted:1714250400000");
  });

  it("rejects invalid aggregateId (uppercase)", () => {
    expect(() =>
      buildIdempotencyKey({
        aggregateId: "PROJ-001",
        eventName: "approval.budget.submitted",
        occurredAt: 1714250400000,
      }),
    ).toThrow();
  });

  it("rejects invalid eventName (current tense / 2-tier)", () => {
    expect(() =>
      buildIdempotencyKey({
        aggregateId: "proj-001",
        eventName: "approval.submit",
        occurredAt: 1714250400000,
      }),
    ).toThrow();
  });

  it("is deterministic — same input → same output (100x)", () => {
    const input: IdempotencyKeyInput = {
      aggregateId: "proj-001",
      eventName: "approval.budget.submitted",
      occurredAt: 1714250400000,
    };
    const first = buildIdempotencyKey(input);
    for (let i = 0; i < 100; i++) {
      expect(buildIdempotencyKey(input)).toBe(first);
    }
  });

  it("roundtrip property (200 cases)", () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^[a-z][a-z0-9-]+$/)
          .filter((s) => s.length >= 2 && s.length <= 24),
        fc.tuple(
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
          fc.stringMatching(/^[a-z][a-z0-9-]+$/).filter((s) => s.length >= 2 && s.length <= 16),
        ),
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (aggregateId, [d, a, v], epoch) => {
          const eventName = `${d}.${a}.${v}`;
          const orig: IdempotencyKeyInput = { aggregateId, eventName, occurredAt: epoch };
          const built = buildIdempotencyKey(orig);
          expect(parseIdempotencyKey(built)).toEqual({
            aggregateId,
            eventName,
            occurredAt: epoch,
          });
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.13.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test idempotency-key
```

기대: FAIL (모듈 없음).

- [ ] **Step 2.13.3: 최소 구현**

`packages/sim-identifier-grammar/src/idempotency-key.ts`:

```typescript
import { z } from "zod";

const AGGREGATE_ID_REGEX = /^[a-z][a-z0-9-]+$/;
// Task 2.6 (event-name)와 병렬 작성 우회: 3-tier kebab-case 형식만 검증한다.
const EVENT_NAME_REGEX =
  /^[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+$/;

export interface IdempotencyKeyInput {
  aggregateId: string;
  eventName: string;
  occurredAt: Date | number; // Date 또는 epoch ms
}

export interface IdempotencyKey {
  aggregateId: string;
  eventName: string;
  occurredAt: number; // epoch ms (정규화됨)
}

const NormalizedSchema = z.object({
  aggregateId: z.string().regex(AGGREGATE_ID_REGEX),
  eventName: z.string().regex(EVENT_NAME_REGEX),
  occurredAt: z.number().int().nonnegative(),
});

export const IdempotencyKeySchema = NormalizedSchema;

function normalize(input: IdempotencyKeyInput): IdempotencyKey {
  const epoch =
    input.occurredAt instanceof Date
      ? input.occurredAt.getTime()
      : input.occurredAt;
  return NormalizedSchema.parse({
    aggregateId: input.aggregateId,
    eventName: input.eventName,
    occurredAt: epoch,
  });
}

export function buildIdempotencyKey(input: IdempotencyKeyInput): string {
  const v = normalize(input);
  return `${v.aggregateId}:${v.eventName}:${v.occurredAt}`;
}

export function parseIdempotencyKey(s: string): IdempotencyKey {
  const m = s.match(
    /^([a-z][a-z0-9-]+):([a-z][a-z0-9-]+\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+):(\d+)$/,
  );
  if (!m) throw new Error(`invalid idempotency key: ${s}`);
  return NormalizedSchema.parse({
    aggregateId: m[1],
    eventName: m[2],
    occurredAt: Number(m[3]),
  });
}
```

- [ ] **Step 2.13.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test idempotency-key
```

기대: 7 PASS (property 1건 포함, fast-check numRuns=200).

`src/index.ts`에 추가:
```typescript
export {
  buildIdempotencyKey,
  parseIdempotencyKey,
  IdempotencyKeySchema,
  type IdempotencyKey,
  type IdempotencyKeyInput,
} from "./idempotency-key.js";
```

- [ ] **Step 2.13.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/idempotency-key.ts \
        packages/sim-identifier-grammar/src/idempotency-key.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #12 outbox idempotency key"
```

### Task 2.14: 식별자 #13 replication slot name (PG)

**Files:**
- Create: `packages/sim-identifier-grammar/src/replication-slot.ts`
- Create: `packages/sim-identifier-grammar/src/replication-slot.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

본 식별자는 PostgreSQL 논리 복제 슬롯 이름으로, `sim_${purpose}_slot` 합성 규칙을 갖는다. 다른 식별자에 의존하지 않는 단독 grammar이며, PG 명명 규칙(소문자/언더스코어/≤63자)을 만족해야 한다. purpose는 정적 enum(`read_replica` / `audit_stream`) 2종 고정. spec 03 §2.13 및 §6에 따라 catalog 위치는 `contracts/replication.catalog.ts`(신규)이며, 본 task에서는 builder/parser/Zod의 grammar 단위 정확성만 책임진다.

- [ ] **Step 2.14.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/replication-slot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildReplicationSlot,
  parseReplicationSlot,
  REPLICATION_PURPOSES,
  type ReplicationSlot,
} from "./replication-slot.js";

describe("replication slot name grammar (#13)", () => {
  it("builds sim_read_replica_slot from canonical input", () => {
    const out = buildReplicationSlot({ purpose: "read_replica" });
    expect(out).toBe("sim_read_replica_slot");
  });

  it("parses sim_audit_stream_slot back to original shape", () => {
    const orig: ReplicationSlot = { purpose: "audit_stream" };
    expect(parseReplicationSlot(buildReplicationSlot(orig))).toEqual(orig);
  });

  it("rejects purpose outside allowlist", () => {
    expect(() =>
      buildReplicationSlot({ purpose: "metrics_export" as never }),
    ).toThrow();
  });

  it("rejects parsing of camelCase simReadReplicaSlot (PG 규칙 위반)", () => {
    expect(() => parseReplicationSlot("simReadReplicaSlot")).toThrow();
  });

  it("output satisfies PG identifier rules (lowercase / underscores / ≤63 chars)", () => {
    for (const purpose of REPLICATION_PURPOSES) {
      const out = buildReplicationSlot({ purpose });
      expect(out).toMatch(/^[a-z_][a-z0-9_]*$/);
      expect(out.length).toBeLessThanOrEqual(63);
    }
  });

  it("roundtrip property over purpose allowlist", () => {
    fc.assert(
      fc.property(fc.constantFrom(...REPLICATION_PURPOSES), (purpose) => {
        const orig: ReplicationSlot = { purpose };
        expect(parseReplicationSlot(buildReplicationSlot(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
```

- [ ] **Step 2.14.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test replication-slot
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.14.3: 최소 구현**

`packages/sim-identifier-grammar/src/replication-slot.ts`:

```typescript
import { z } from "zod";

export const REPLICATION_PURPOSES = ["read_replica", "audit_stream"] as const;
export type ReplicationPurpose = (typeof REPLICATION_PURPOSES)[number];

export interface ReplicationSlot {
  purpose: ReplicationPurpose;
}

export const ReplicationSlotSchema = z.object({
  purpose: z.enum(REPLICATION_PURPOSES),
});

// PG 식별자 규칙: 첫 글자 [a-z_], 이후 [a-z0-9_], 전체 ≤ 63자
const SLOT_PATTERN = /^sim_(read_replica|audit_stream)_slot$/;
const PG_MAX_LENGTH = 63;

export const ReplicationSlotNameSchema = z
  .string()
  .max(PG_MAX_LENGTH)
  .regex(SLOT_PATTERN);

export function buildReplicationSlot(input: ReplicationSlot): string {
  const v = ReplicationSlotSchema.parse(input);
  const out = `sim_${v.purpose}_slot`;
  return ReplicationSlotNameSchema.parse(out);
}

export function parseReplicationSlot(s: string): ReplicationSlot {
  const m = SLOT_PATTERN.exec(s);
  if (!m || s.length > PG_MAX_LENGTH) {
    throw new Error(`invalid replication slot name: ${s}`);
  }
  return { purpose: m[1] as ReplicationPurpose };
}
```

- [ ] **Step 2.14.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test replication-slot
```

기대: 6 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildReplicationSlot,
  parseReplicationSlot,
  ReplicationSlotSchema,
  ReplicationSlotNameSchema,
  REPLICATION_PURPOSES,
  type ReplicationSlot,
  type ReplicationPurpose,
} from "./replication-slot.js";
```

- [ ] **Step 2.14.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/replication-slot.ts \
        packages/sim-identifier-grammar/src/replication-slot.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #13 PG replication slot"
```

### Task 2.15: 식별자 #14 decision category

**Files:**
- Create: `packages/sim-identifier-grammar/src/decision-category.ts`
- Create: `packages/sim-identifier-grammar/src/decision-category.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

본 식별자는 controller pass × 카테고리 매트릭스를 좌표화한 단독 grammar이며, `${pass}.${name}` 점 구분자가 특징이다. pass enum은 `safety` / `resource` 2종이며, name은 spec 01 §2 카테고리 표의 본 사이클 8개 — safety {perf, compatibility, decisionQuality, auditSafety, replicationHealth} + resource {loadPressure, resourceHeadroom, stability} — 로 고정된다. 본 task는 단순 enum 검증이 아니라 **pass별 허용 name 매트릭스**를 강제한다(예: `safety.loadPressure`는 reject). 카테고리 매트릭스는 본 모듈 내부 const SSOT로 관리한다.

- [ ] **Step 2.15.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/decision-category.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildDecisionCategory,
  parseDecisionCategory,
  CATEGORIES,
  type DecisionCategory,
} from "./decision-category.js";

describe("decision category grammar (#14)", () => {
  it("builds safety.compatibility from canonical input", () => {
    const out = buildDecisionCategory({ pass: "safety", name: "compatibility" });
    expect(out).toBe("safety.compatibility");
  });

  it("parses resource.loadPressure back to original shape", () => {
    const orig: DecisionCategory = { pass: "resource", name: "loadPressure" };
    expect(parseDecisionCategory(buildDecisionCategory(orig))).toEqual(orig);
  });

  it("rejects pass outside allowlist", () => {
    expect(() =>
      buildDecisionCategory({ pass: "performance" as never, name: "perf" }),
    ).toThrow();
  });

  it("rejects name outside global allowlist", () => {
    expect(() =>
      buildDecisionCategory({ pass: "safety", name: "errorBudget" as never }),
    ).toThrow();
  });

  it("rejects safety.loadPressure (matrix 위반: name이 다른 pass 소속)", () => {
    expect(() =>
      buildDecisionCategory({ pass: "safety", name: "loadPressure" as never }),
    ).toThrow();
  });

  it("rejects parsing of safety:compatibility (separator 위반)", () => {
    expect(() => parseDecisionCategory("safety:compatibility")).toThrow();
  });

  it("roundtrip property over all matrix combinations", () => {
    const pairs = (Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>)
      .flatMap((pass) => CATEGORIES[pass].map((name) => ({ pass, name })));
    fc.assert(
      fc.property(fc.constantFrom(...pairs), (orig) => {
        expect(parseDecisionCategory(buildDecisionCategory(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
```

- [ ] **Step 2.15.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test decision-category
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.15.3: 최소 구현**

`packages/sim-identifier-grammar/src/decision-category.ts`:

```typescript
import { z } from "zod";

export const CATEGORIES = {
  safety: ["perf", "compatibility", "decisionQuality", "auditSafety", "replicationHealth"],
  resource: ["loadPressure", "resourceHeadroom", "stability"],
} as const;

export type DecisionPass = keyof typeof CATEGORIES;
export type DecisionCategoryName =
  | (typeof CATEGORIES)["safety"][number]
  | (typeof CATEGORIES)["resource"][number];

export interface DecisionCategory {
  pass: DecisionPass;
  name: DecisionCategoryName;
}

export const DecisionCategorySchema = z
  .object({
    pass: z.enum(["safety", "resource"]),
    name: z.string(),
  })
  .superRefine((v, ctx) => {
    const allowed = CATEGORIES[v.pass as DecisionPass] as readonly string[];
    if (!allowed.includes(v.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `name "${v.name}" not allowed for pass "${v.pass}"`,
      });
    }
  });

const CATEGORY_PATTERN = /^(safety|resource)\.([a-zA-Z]+)$/;

export function buildDecisionCategory(input: DecisionCategory): string {
  const v = DecisionCategorySchema.parse(input);
  return `${v.pass}.${v.name}`;
}

export function parseDecisionCategory(s: string): DecisionCategory {
  const m = CATEGORY_PATTERN.exec(s);
  if (!m) throw new Error(`invalid decision category: ${s}`);
  const parsed = DecisionCategorySchema.parse({ pass: m[1], name: m[2] });
  return parsed as DecisionCategory;
}
```

- [ ] **Step 2.15.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test decision-category
```

기대: 7 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildDecisionCategory,
  parseDecisionCategory,
  DecisionCategorySchema,
  CATEGORIES,
  type DecisionCategory,
  type DecisionPass,
  type DecisionCategoryName,
} from "./decision-category.js";
```

- [ ] **Step 2.15.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/decision-category.ts \
        packages/sim-identifier-grammar/src/decision-category.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #14 decision category (8개 매트릭스)"
```

### Task 2.16: 식별자 #15 decision signal (중점)

**Files:**
- Create: `packages/sim-identifier-grammar/src/decision-signal.ts`
- Create: `packages/sim-identifier-grammar/src/decision-signal.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

본 식별자는 spec 03 §2.15 decision signal과 spec 01 §2 신호 매트릭스를 1:1로 구현한다. 원형 `{ category, signal }`, 합성 `${category}.${signal}` (예: `compatibility.schemaCompatRate`, `perf.errorRate`). 카테고리 어휘는 #14(Task 2.15)와 같지만, 본 task는 병렬 작성 가능하도록 inline allowlist로 의존을 차단한다(향후 controller-config.yaml metric registry 도입 시 외부 catalog로 이관). 핵심 정합성 조건은 `(category, signal)` 매트릭스 — 카테고리별 signal이 한정되며 `perf.RPS` 같은 cross-category 조립은 builder/parser 양쪽에서 거부된다.

- [ ] **Step 2.16.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/decision-signal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildDecisionSignal, parseDecisionSignal,
  SIGNALS_BY_CATEGORY, ALL_SIGNAL_PAIRS,
  type DecisionSignal, type SignalCategory,
} from "./decision-signal.js";

describe("decision signal grammar (#15)", () => {
  it("builds canonical names + roundtrips", () => {
    expect(buildDecisionSignal({ category: "compatibility", signal: "schemaCompatRate" }))
      .toBe("compatibility.schemaCompatRate");
    expect(buildDecisionSignal({ category: "perf", signal: "errorRate" })).toBe("perf.errorRate");
    const orig: DecisionSignal = { category: "decisionQuality", signal: "denyRateDelta" };
    expect(parseDecisionSignal(buildDecisionSignal(orig))).toEqual(orig);
  });

  it("rejects unknown category", () => {
    expect(() => buildDecisionSignal({ category: "unknown" as never, signal: "errorRate" })).toThrow();
    expect(() => parseDecisionSignal("unknown.errorRate")).toThrow();
  });

  it("rejects signal not in matrix for given category (perf.RPS reject)", () => {
    // RPS는 loadPressure 전용. perf 카테고리에 끼워 넣으면 거부.
    expect(() => buildDecisionSignal({ category: "perf", signal: "RPS" as never })).toThrow();
    expect(() => parseDecisionSignal("perf.RPS")).toThrow();
    expect(() => parseDecisionSignal("perf.schemaCompatRate")).toThrow();
  });

  it("rejects malformed (separator/segment count)", () => {
    expect(() => parseDecisionSignal("perf:errorRate")).toThrow();
    expect(() => parseDecisionSignal("perf")).toThrow();
    expect(() => parseDecisionSignal("perf.errorRate.extra")).toThrow();
  });

  it("roundtrip over every pair in matrix", () => {
    for (const [category, signal] of ALL_SIGNAL_PAIRS) {
      expect(parseDecisionSignal(buildDecisionSignal({ category, signal })))
        .toEqual({ category, signal });
    }
  });

  it("property: 200 random pairs roundtrip + cross-category reject", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_SIGNAL_PAIRS), ([category, signal]) => {
        expect(parseDecisionSignal(buildDecisionSignal({ category, signal })))
          .toEqual({ category, signal });
        for (const other of Object.keys(SIGNALS_BY_CATEGORY) as SignalCategory[]) {
          if (other === category) continue;
          if ((SIGNALS_BY_CATEGORY[other] as readonly string[]).includes(signal)) continue;
          expect(() => buildDecisionSignal({ category: other, signal: signal as never })).toThrow();
        }
      }),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.16.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test decision-signal
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.16.3: 최소 구현**

`packages/sim-identifier-grammar/src/decision-signal.ts`:

```typescript
import { z } from "zod";

// spec 01 §2 신호 매트릭스 — 카테고리별 허용 signal 어휘 const 고정.
// #14(Task 2.15)와 병렬 작성 가능하도록 카테고리 allowlist는 inline.
export const SIGNALS_BY_CATEGORY = {
  perf: ["errorRate", "p95LatencyDelta"],
  compatibility: ["schemaCompatRate"],
  decisionQuality: ["denyRateDelta", "avgConfidenceDelta"],
  auditSafety: ["criticalAnomalyRate"],
  replicationHealth: ["replicationLagMs"],
  loadPressure: ["RPS", "p95LatencyDelta"],
  resourceHeadroom: ["CPU", "dbPoolUtilization"],
  stability: ["timeSinceLastReplicaChange"],
} as const satisfies Record<string, readonly string[]>;

export type SignalCategory = keyof typeof SIGNALS_BY_CATEGORY;
export type SignalName = (typeof SIGNALS_BY_CATEGORY)[SignalCategory][number];

export const SIGNAL_CATEGORIES = Object.keys(SIGNALS_BY_CATEGORY) as readonly SignalCategory[];
export const ALL_SIGNAL_PAIRS: ReadonlyArray<readonly [SignalCategory, string]> =
  SIGNAL_CATEGORIES.flatMap((c) =>
    (SIGNALS_BY_CATEGORY[c] as readonly string[]).map((s) => [c, s] as const),
  );

export interface DecisionSignal { category: SignalCategory; signal: SignalName }

function isAllowed(category: string, signal: string): category is SignalCategory {
  if (!(category in SIGNALS_BY_CATEGORY)) return false;
  return (SIGNALS_BY_CATEGORY[category as SignalCategory] as readonly string[]).includes(signal);
}

export const DecisionSignalSchema = z
  .object({
    category: z.enum(SIGNAL_CATEGORIES as unknown as [SignalCategory, ...SignalCategory[]]),
    signal: z.string(),
  })
  .refine((v) => isAllowed(v.category, v.signal), { message: "signal not registered for given category" });

const SIGNAL_PATTERN = /^([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)$/;
export const DecisionSignalStringSchema = z.string().regex(SIGNAL_PATTERN);

export function buildDecisionSignal(input: DecisionSignal): string {
  const v = DecisionSignalSchema.parse(input);
  return DecisionSignalStringSchema.parse(`${v.category}.${v.signal}`);
}

export function parseDecisionSignal(s: string): DecisionSignal {
  const m = SIGNAL_PATTERN.exec(s);
  if (!m) throw new Error(`invalid decision signal: ${s}`);
  const [, category, signal] = m;
  if (!isAllowed(category, signal)) throw new Error(`decision signal not in matrix: ${category}.${signal}`);
  return { category, signal: signal as SignalName };
}
```

- [ ] **Step 2.16.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test decision-signal
```

기대: 6 PASS. `src/index.ts`에 추가:
```typescript
export {
  buildDecisionSignal, parseDecisionSignal,
  DecisionSignalSchema, DecisionSignalStringSchema,
  SIGNALS_BY_CATEGORY, SIGNAL_CATEGORIES, ALL_SIGNAL_PAIRS,
  type DecisionSignal, type SignalCategory, type SignalName,
} from "./decision-signal.js";
```

- [ ] **Step 2.16.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/decision-signal.ts \
        packages/sim-identifier-grammar/src/decision-signal.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #15 decision signal (11개 매트릭스)"
```
