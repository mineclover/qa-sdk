### Task 2.7: 식별자 #6 outbox schemaHash (중점)

**Files:**
- Create: `packages/sim-identifier-grammar/src/schema-hash.ts`
- Create: `packages/sim-identifier-grammar/src/schema-hash.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

이벤트 페이로드 형태에 대한 결정론적 content hash. spec §2.6 인용: "결정론 보장: ① `canonicalJSON`은 키 정렬/공백 제거/숫자 정규화. ② `payloadShape`는 nullable/optional/required 명시. ③ 동일 shape는 항상 동일 hash, 타이브레이커 없음." 합성식: `sha256(canonicalJSON(payloadShape))[:16]`. parser는 hash로부터 원형을 복원할 수 없어 *없음* — 대신 `verifySchemaHash`가 같은 역할. eventName 검증은 Task 2.6 결과를 type-only로 import 하여 병렬 작성 시 의존을 차단한다.

> **fixture 주의** (follow-up #16): `eventName` fixture는 #5 event-name(Task 2.6)이 정의한 `EventName` type과 정확히 일치해야 한다 — `{ domain, aggregate, verbPast }` 키. `{ domain, entity, action }`처럼 spec 03 §2.5와 다른 키 이름을 쓰면 vitest runtime은 PASS이지만 `tsc --noEmit`은 7건 typecheck error 누적. schema-hash 모듈 자체는 eventName 형태를 검증하지 않지만 `SchemaHashInput.eventName: EventName` type으로 narrowed → fixture가 type-compatible이어야 한다.

- [ ] **Step 2.7.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/schema-hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildSchemaHash, verifySchemaHash, type SchemaHashInput } from "./schema-hash.js";

// EventName({ domain, aggregate, verbPast }) type 정합 — spec 03 §2.5.
// 잘못된 키({ entity, action })는 vitest runtime PASS이지만 tsc typecheck 실패.
const ev = { domain: "approval", aggregate: "request", verbPast: "submitted" } as const;
const mk = (payloadShape: SchemaHashInput["payloadShape"]) => buildSchemaHash({ eventName: ev, payloadShape });

describe("outbox schemaHash grammar (#6)", () => {
  it("builds 16-char hex hash for known shape", () => {
    expect(mk({ id: "string", amount: "number", note: "string?" })).toMatch(/^[0-9a-f]{16}$/);
  });
  it("is deterministic: same shape → same hash", () => {
    const s = { id: "string", amount: "number" };
    expect(mk(s)).toBe(mk(s));
  });
  it("is key-order independent (canonicalJSON sorts keys)", () => {
    expect(mk({ id: "string", amount: "number", note: "string?" })).toBe(
      mk({ note: "string?", amount: "number", id: "string" }),
    );
  });
  it("different shape → different hash", () => {
    expect(mk({ id: "string", amount: "number" })).not.toBe(mk({ id: "string", amount: "number", extra: "boolean" }));
  });
  it("strips undefined values before hashing", () => {
    expect(mk({ id: "string", amount: "number" })).toBe(mk({ id: "string", amount: "number", removed: undefined }));
  });
  it("preserves array order (arrays are not sorted)", () => {
    expect(mk({ tags: ["b", "a"] })).not.toBe(mk({ tags: ["a", "b"] }));
  });
  it("verifySchemaHash: true on match, false on mismatch", () => {
    const input: SchemaHashInput = { eventName: ev, payloadShape: { id: "string", amount: "number" } };
    const h = buildSchemaHash(input);
    expect(verifySchemaHash(input, h)).toBe(true);
    expect(verifySchemaHash(input, "0000000000000000")).toBe(false);
  });
  it("property: 200 random shapes hash deterministically and verify roundtrips", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.stringMatching(/^[a-z][a-z0-9_]{0,12}$/),
          fc.constantFrom("string", "number", "boolean", "string?", "number?"),
          { minKeys: 1, maxKeys: 8 },
        ),
        (shape) => {
          const input: SchemaHashInput = { eventName: ev, payloadShape: shape };
          const h = buildSchemaHash(input);
          expect(h).toMatch(/^[0-9a-f]{16}$/);
          expect(buildSchemaHash(input)).toBe(h);
          expect(verifySchemaHash(input, h)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.7.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test schema-hash
```

기대: FAIL.

- [ ] **Step 2.7.3: 최소 구현**

`packages/sim-identifier-grammar/src/schema-hash.ts`:

```typescript
import { createHash } from "node:crypto";
import type { EventName } from "./event-name.js"; // Task 2.6 결과 — type-only import

// payloadShape는 JSON Schema-like 객체. 값은 "string"/"number"/"string?" 등 정규화 토큰
// 또는 중첩 객체/배열. zod schema는 호출자가 normalized 표현으로 변환 후 전달한다.
export type CanonicalShape =
  | string | number | boolean | null
  | CanonicalShape[]
  | { [key: string]: CanonicalShape | undefined };

export interface SchemaHashInput {
  eventName: EventName;
  payloadShape: CanonicalShape;
}

// canonicalJSON: 키 사전순 정렬, undefined 제거, 배열 순서 유지. 패키지 내부 전용 재귀.
function canonicalJSON(value: CanonicalShape): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJSON(v ?? null)).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k] as CanonicalShape)}`).join(",")}}`;
}

export function buildSchemaHash(input: SchemaHashInput): string {
  // spec §2.6: hash는 payloadShape의 content hash. eventName 일치 검증은 catalog 등록 시 별도 단계.
  return createHash("sha256").update(canonicalJSON(input.payloadShape)).digest("hex").slice(0, 16);
}

export function verifySchemaHash(input: SchemaHashInput, expected: string): boolean {
  return buildSchemaHash(input) === expected;
}
```

- [ ] **Step 2.7.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test schema-hash
```

기대: 8 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildSchemaHash,
  verifySchemaHash,
  type SchemaHashInput,
  type CanonicalShape,
} from "./schema-hash.js";
```

- [ ] **Step 2.7.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/schema-hash.ts \
        packages/sim-identifier-grammar/src/schema-hash.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #6 outbox schemaHash (deterministic, 16-char)"
```

### Task 2.8: 식별자 #7 decision id

**Files:**
- Create: `packages/sim-identifier-grammar/src/decision-id.ts`
- Create: `packages/sim-identifier-grammar/src/decision-id.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

controller가 cycle마다 발행하는 결정의 ID. spec 03 §2.7에서 원형 `{ pass, cycleId }`, 합성 `${pass}-decision-${cycleId}`, 예시 `"safety-decision-01HVZ..."`, 린트 `pass ∈ {safety, resource}` + `cycleId = ULID`로 정의된다. cycleId는 Task 2.9 결과(`cycle-id.ts`)에 의존하나 본 task와 병렬 실행될 수 있으므로 ULID 검증은 inline regex로 처리한다.

- [ ] **Step 2.8.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/decision-id.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ulid } from "ulid";
import { buildDecisionId, parseDecisionId, type DecisionId } from "./decision-id.js";

describe("decision id grammar (#7)", () => {
  it("builds safety-decision-<ULID>", () => {
    const cycleId = "01HVZABCDEFGHJKMNPQRSTVWXY";
    const out = buildDecisionId({ pass: "safety", cycleId });
    expect(out).toBe(`safety-decision-${cycleId}`);
  });

  it("builds resource-decision-<ULID>", () => {
    const cycleId = ulid();
    const out = buildDecisionId({ pass: "resource", cycleId });
    expect(out).toBe(`resource-decision-${cycleId}`);
  });

  it("parses safety-decision-<ULID> back to original shape", () => {
    const orig: DecisionId = { pass: "safety", cycleId: ulid() };
    expect(parseDecisionId(buildDecisionId(orig))).toEqual(orig);
  });

  it("rejects unknown pass", () => {
    expect(() =>
      buildDecisionId({ pass: "rollout" as never, cycleId: ulid() }),
    ).toThrow();
  });

  it("rejects invalid ULID (lowercase)", () => {
    expect(() =>
      buildDecisionId({ pass: "safety", cycleId: "01hvzabcdefghjkmnpqrstvwxy" }),
    ).toThrow();
  });

  it("rejects parse on underscore separator", () => {
    expect(() => parseDecisionId("resource_decision_42")).toThrow();
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("safety", "resource"),
        fc.constant(null).map(() => ulid()),
        (pass, cycleId) => {
          const orig: DecisionId = { pass: pass as "safety" | "resource", cycleId };
          expect(parseDecisionId(buildDecisionId(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.8.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test decision-id
```

기대: FAIL.

- [ ] **Step 2.8.3: 최소 구현**

`packages/sim-identifier-grammar/src/decision-id.ts`:

```typescript
import { z } from "zod";

export const DECISION_PASSES = ["safety", "resource"] as const;
export type DecisionPass = (typeof DECISION_PASSES)[number];

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export interface DecisionId {
  pass: DecisionPass;
  cycleId: string; // ULID
}

export const DecisionIdSchema = z.object({
  pass: z.enum(DECISION_PASSES),
  cycleId: z.string().regex(ULID_REGEX),
});

export function buildDecisionId(d: DecisionId): string {
  const v = DecisionIdSchema.parse(d);
  return `${v.pass}-decision-${v.cycleId}`;
}

export function parseDecisionId(s: string): DecisionId {
  const m = s.match(/^(safety|resource)-decision-([0-9A-HJKMNP-TV-Z]{26})$/);
  if (!m) throw new Error(`invalid decision id: ${s}`);
  return DecisionIdSchema.parse({ pass: m[1], cycleId: m[2] });
}
```

- [ ] **Step 2.8.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test decision-id
```

기대: 7 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildDecisionId,
  parseDecisionId,
  DecisionIdSchema,
  DECISION_PASSES,
  type DecisionId,
  type DecisionPass,
} from "./decision-id.js";
```

- [ ] **Step 2.8.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/decision-id.ts \
        packages/sim-identifier-grammar/src/decision-id.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #7 decision id (pass-decision-ULID)"
```

### Task 2.9: 식별자 #8 cycle id

**Files:**
- Create: `packages/sim-identifier-grammar/src/cycle-id.ts`
- Create: `packages/sim-identifier-grammar/src/cycle-id.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

이 식별자는 spec 03 §2.8 cycle id를 구현한다. 원형은 `{ controllerId, cycleAt }`이고 합성은 ULID 26-char Crockford base32 문자열(`/^[0-9A-HJKMNP-TV-Z]{26}$/`)이다. spec은 "controllerId가 시간 prefix 영역에 임베드된다"고 기술하지만 ULID 표준 timestamp(48bit) 영역은 epoch ms 전용이므로 본 task에서는 단순화한다 — 합성 문자열은 `ulid(cycleAt)` 결과(순수 ULID)만 반환하고, `controllerId`는 원형 객체에만 보존한다. 정렬성은 ULID timestamp 영역만으로 보장되며, controllerId 검증은 별도 메타 비교로 수행한다 (spec drift는 18-spec-drift.md에 보고).

- [ ] **Step 2.9.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/cycle-id.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { decodeTime } from "ulid";
import { buildCycleId, parseCycleId, type CycleId } from "./cycle-id.js";

describe("cycle id grammar (#8)", () => {
  it("builds a 26-char ULID", () => {
    const out = buildCycleId({ controllerId: "CTRL0001", cycleAt: 1714291200000 });
    expect(out).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("encodes cycleAt into ULID timestamp segment (decodeTime roundtrip)", () => {
    const cycleAt = 1714291200000;
    const id = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    expect(decodeTime(id)).toBe(cycleAt);
  });

  it("produces different randomness for the same cycleAt", () => {
    const cycleAt = 1714291200000;
    const a = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    const b = buildCycleId({ controllerId: "CTRL0001", cycleAt });
    expect(a).not.toBe(b);
    expect(decodeTime(a)).toBe(decodeTime(b));
  });

  it("parses back to cycleAt + randomness segments", () => {
    const cycleAt = 1714291200000;
    const id = buildCycleId({ controllerId: "CTRL0002", cycleAt });
    const parsed = parseCycleId(id);
    expect(parsed.cycleAt).toBe(cycleAt);
    expect(parsed.randomness).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  it("rejects non-ULID strings", () => {
    expect(() => parseCycleId("not-a-ulid")).toThrow();
    expect(() => parseCycleId("01HVZABCDEFGHJKMNPQRSTVWX")).toThrow(); // 25 chars
  });

  it("rejects negative or non-finite cycleAt", () => {
    expect(() => buildCycleId({ controllerId: "CTRL0001", cycleAt: -1 })).toThrow();
    expect(() => buildCycleId({ controllerId: "CTRL0001", cycleAt: Number.NaN })).toThrow();
  });

  it("roundtrip property over varied timestamps", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 281_474_976_710_655 }), // ULID 48bit max
        (cycleAt) => {
          const id = buildCycleId({ controllerId: "CTRL0001", cycleAt });
          const parsed = parseCycleId(id);
          expect(parsed.cycleAt).toBe(cycleAt);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.9.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test cycle-id
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.9.3: 최소 구현**

`packages/sim-identifier-grammar/src/cycle-id.ts`:

```typescript
import { z } from "zod";
import { ulid, decodeTime } from "ulid";

export interface CycleId {
  controllerId: string; // 8 chars, [0-9A-Z]
  cycleAt: number;      // epoch ms
}

export const CycleIdInputSchema = z.object({
  controllerId: z.string().regex(/^[0-9A-Z]{8}$/),
  cycleAt: z.number().int().nonnegative().finite(),
});

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const CycleIdStringSchema = z.string().regex(ULID_PATTERN);

export function buildCycleId(input: CycleId): string {
  const v = CycleIdInputSchema.parse(input);
  // controllerId는 합성 문자열에 임베드하지 않고 원형 메타로만 보존 (spec drift §18 참조).
  return ulid(v.cycleAt);
}

export function parseCycleId(s: string): { cycleAt: number; randomness: string } {
  const id = CycleIdStringSchema.parse(s);
  return {
    cycleAt: decodeTime(id),
    randomness: id.slice(10), // ULID: 10-char timestamp + 16-char randomness
  };
}
```

- [ ] **Step 2.9.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test cycle-id
```

기대: 7 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildCycleId,
  parseCycleId,
  CycleIdInputSchema,
  CycleIdStringSchema,
  type CycleId,
} from "./cycle-id.js";
```

- [ ] **Step 2.9.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/cycle-id.ts \
        packages/sim-identifier-grammar/src/cycle-id.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #8 cycle id (ULID with controllerId metadata)"
```

### Task 2.10: 식별자 #9 label key (compose / k8s)

**Files:**
- Create: `packages/sim-identifier-grammar/src/label-key.ts`
- Create: `packages/sim-identifier-grammar/src/label-key.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

이 식별자는 spec 03 §2.9 label key를 구현한다. 원형은 `{ namespace, key }`이고 합성은 `${namespace}.${key}` (예: `sim.role`, `sim.version`, `sim.replica-of`). namespace는 `sim` 단일 리터럴이며 key는 본 사이클 한정 3종 어휘(`role`, `version`, `replica-of`)만 허용한다. 다른 식별자에 의존하지 않는 단독 grammar이며, allowlist는 const enum으로 패키지 내부에 고정한다(향후 `contracts/label-vocabulary.catalog.ts` 도입 시 catalog로 이관 예정).

- [ ] **Step 2.10.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/label-key.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildLabelKey,
  parseLabelKey,
  LABEL_KEYS,
  type LabelKey,
} from "./label-key.js";

describe("label key grammar (#9)", () => {
  it("builds sim.role from canonical input", () => {
    expect(buildLabelKey({ namespace: "sim", key: "role" })).toBe("sim.role");
  });

  it("builds sim.version", () => {
    expect(buildLabelKey({ namespace: "sim", key: "version" })).toBe(
      "sim.version",
    );
  });

  it("builds sim.replica-of (multi-segment key)", () => {
    expect(buildLabelKey({ namespace: "sim", key: "replica-of" })).toBe(
      "sim.replica-of",
    );
  });

  it("parses sim.version back to original shape", () => {
    const orig: LabelKey = { namespace: "sim", key: "version" };
    expect(parseLabelKey(buildLabelKey(orig))).toEqual(orig);
  });

  it("rejects namespace outside allowlist", () => {
    expect(() =>
      buildLabelKey({ namespace: "app" as never, key: "version" }),
    ).toThrow();
    expect(() => parseLabelKey("app.version")).toThrow();
  });

  it("rejects key outside allowlist", () => {
    expect(() =>
      buildLabelKey({ namespace: "sim", key: "owner" as never }),
    ).toThrow();
    expect(() => parseLabelKey("sim.owner")).toThrow();
    expect(() => parseLabelKey("app.kubernetes.io/version")).toThrow();
  });

  it("roundtrip property over allowlist combinations", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LABEL_KEYS), (key) => {
        const orig: LabelKey = { namespace: "sim", key };
        expect(parseLabelKey(buildLabelKey(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
```

- [ ] **Step 2.10.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test label-key
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.10.3: 최소 구현**

`packages/sim-identifier-grammar/src/label-key.ts`:

```typescript
import { z } from "zod";

export const LABEL_KEYS = ["role", "version", "replica-of"] as const;
export type LabelKeyName = (typeof LABEL_KEYS)[number];

export interface LabelKey {
  namespace: "sim";
  key: LabelKeyName;
}

export const LabelKeySchema = z.object({
  namespace: z.literal("sim"),
  key: z.enum(LABEL_KEYS),
});

const LABEL_KEY_PATTERN = /^(sim)\.(role|version|replica-of)$/;
export const LabelKeyStringSchema = z.string().regex(LABEL_KEY_PATTERN);

export function buildLabelKey(input: LabelKey): string {
  const v = LabelKeySchema.parse(input);
  const out = `${v.namespace}.${v.key}`;
  return LabelKeyStringSchema.parse(out);
}

export function parseLabelKey(s: string): LabelKey {
  const m = LABEL_KEY_PATTERN.exec(s);
  if (!m) throw new Error(`invalid label key: ${s}`);
  return {
    namespace: m[1] as "sim",
    key: m[2] as LabelKeyName,
  };
}
```

- [ ] **Step 2.10.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test label-key
```

기대: 7 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildLabelKey,
  parseLabelKey,
  LabelKeySchema,
  LabelKeyStringSchema,
  LABEL_KEYS,
  type LabelKey,
  type LabelKeyName,
} from "./label-key.js";
```

- [ ] **Step 2.10.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/label-key.ts \
        packages/sim-identifier-grammar/src/label-key.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #9 label key (compose/k8s)"
```

### Task 2.11: 식별자 #10 redis pub/sub channel

**Files:**
- Create: `packages/sim-identifier-grammar/src/pubsub-channel.ts`
- Create: `packages/sim-identifier-grammar/src/pubsub-channel.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

본 식별자는 다른 식별자에 의존하지 않는 단독 grammar이며, `${namespace}:${topic}` 콜론 구분자가 특징이다. namespace는 `"sim"` 단일 리터럴, topic은 정적 enum(`bitmap.invalidate` / `routing.update` / `controller.heartbeat`) 3종 고정. spec 03 §2.10 및 §6에 따라 catalog 위치는 `grammar-registry.ts` 내부 enum(정적, PR-only)이며, 본 task에서는 builder/parser/Zod의 grammar 단위 정확성만 책임진다.

- [ ] **Step 2.11.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/pubsub-channel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildPubsubChannel,
  parsePubsubChannel,
  PUBSUB_TOPICS,
  type PubSubChannel,
} from "./pubsub-channel.js";

describe("redis pub/sub channel grammar (#10)", () => {
  it("builds sim:bitmap.invalidate from canonical input", () => {
    const out = buildPubsubChannel({
      namespace: "sim",
      topic: "bitmap.invalidate",
    });
    expect(out).toBe("sim:bitmap.invalidate");
  });

  it("parses sim:routing.update back to original shape", () => {
    const orig: PubSubChannel = { namespace: "sim", topic: "routing.update" };
    expect(parsePubsubChannel(buildPubsubChannel(orig))).toEqual(orig);
  });

  it("rejects namespace outside allowlist", () => {
    expect(() =>
      buildPubsubChannel({
        namespace: "app" as never,
        topic: "bitmap.invalidate",
      }),
    ).toThrow();
  });

  it("rejects topic outside allowlist", () => {
    expect(() =>
      buildPubsubChannel({
        namespace: "sim",
        topic: "user.created" as never,
      }),
    ).toThrow();
  });

  it("rejects parsing of sim/bitmap-invalidate (separator 위반)", () => {
    expect(() => parsePubsubChannel("sim/bitmap-invalidate")).toThrow();
  });

  it("roundtrip property over allowlist combinations", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PUBSUB_TOPICS), (topic) => {
        const orig: PubSubChannel = { namespace: "sim", topic };
        expect(parsePubsubChannel(buildPubsubChannel(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
```

- [ ] **Step 2.11.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test pubsub-channel
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.11.3: 최소 구현**

`packages/sim-identifier-grammar/src/pubsub-channel.ts`:

```typescript
import { z } from "zod";

export const PUBSUB_TOPICS = [
  "bitmap.invalidate",
  "routing.update",
  "controller.heartbeat",
] as const;
export type PubsubTopic = (typeof PUBSUB_TOPICS)[number];

export interface PubSubChannel {
  namespace: "sim";
  topic: PubsubTopic;
}

export const PubSubChannelSchema = z.object({
  namespace: z.literal("sim"),
  topic: z.enum(PUBSUB_TOPICS),
});

const CHANNEL_PATTERN =
  /^sim:(bitmap\.invalidate|routing\.update|controller\.heartbeat)$/;
export const PubSubChannelNameSchema = z.string().regex(CHANNEL_PATTERN);

export function buildPubsubChannel(input: PubSubChannel): string {
  const v = PubSubChannelSchema.parse(input);
  const out = `${v.namespace}:${v.topic}`;
  return PubSubChannelNameSchema.parse(out);
}

export function parsePubsubChannel(s: string): PubSubChannel {
  const m = CHANNEL_PATTERN.exec(s);
  if (!m) throw new Error(`invalid pubsub channel: ${s}`);
  return { namespace: "sim", topic: m[1] as PubsubTopic };
}
```

- [ ] **Step 2.11.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test pubsub-channel
```

기대: 6 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildPubsubChannel,
  parsePubsubChannel,
  PubSubChannelSchema,
  PubSubChannelNameSchema,
  PUBSUB_TOPICS,
  type PubSubChannel,
  type PubsubTopic,
} from "./pubsub-channel.js";
```

- [ ] **Step 2.11.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/pubsub-channel.ts \
        packages/sim-identifier-grammar/src/pubsub-channel.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #10 redis pub/sub channel"
```

