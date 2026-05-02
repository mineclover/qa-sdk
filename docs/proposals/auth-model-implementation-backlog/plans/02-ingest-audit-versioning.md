# §4 Ingest Audit P1~P3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest 측 좌표 저장 스키마(`key_observations`, `key_observation_prefixes`, `event_records.address_context`)에서 version을 **암묵적 문자열**이 아닌 **타입·컬럼 단위 1급 시민**으로 격상한다. coordinate-storage.rule §1.1 준수 + version별 분석 가능.

**Architecture:**
- 현재 `packed_key`는 `${prefixId}:${version}:${address}` 포맷이지만 단일 `TEXT` 컬럼이라 version별 쿼리·집계 불가능. `address_context`도 같은 패턴의 `Record<string, string>` blob.
- **P2 먼저**: 마이그레이션 없는 타입 계약(zod) 추가 — `AddressContextV1` 정의 + SDK·ingest 양쪽에서 검증. 가장 안전한 진입점.
- **P1**: `key_observations`에 구조화된 `version` + `address` 컬럼 추가, dual-write로 backfill, packed_key는 유지(역호환). PK는 `(prefix_id, version, address)` 복합으로 전환.
- **P3**: `key_observation_prefixes`에 version 차원 추가, 집계 쿼리 분기 처리.
- ClickHouse 스키마는 본 plan 범위 외 (D1만 우선; ClickHouse 운영 도입 전).

**Tech Stack:**
- Drizzle ORM (`drizzle-orm` catalog), better-sqlite3
- zod (validator) — 이미 `@qa-sdk/otel`에서 사용 중
- vitest, TypeScript ES2023

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/ingest-server/src/db/address-context-schema.ts` | `AddressContextV1` 타입 + zod parser + parse helper (`parsePackedAddress`) |
| `packages/ingest-server/src/db/address-context-schema.test.ts` | zod schema unit tests |
| `packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts` | P1 마이그레이션 SQL: `ALTER TABLE` + backfill + new index |
| `packages/ingest-server/src/stores/migrations/0002_key_observation_prefixes_versioned.sql.ts` | P3 마이그레이션 SQL: prefix 집계 PK 확장 |
| `packages/ingest-server/src/stores/d1-key-observation-store.versioned.test.ts` | 신규 컬럼 동작 검증 (version 분리 저장·조회) |
| `packages/event-catalog/src/auto-track.contract.test.ts` | SDK 측 emit이 zod 통과하는지 contract test |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/ingest-server/src/db/json-types.ts` | `AddressContextJson` → `AddressContextV1` 재정의 + parse helper export |
| `packages/ingest-server/src/db/schema.ts` | `keyObservations`에 `version`, `address` 컬럼 + 복합 PK + 인덱스. `keyObservationPrefixes`에 `version` 컬럼 + 복합 PK |
| `packages/ingest-server/src/stores/d1-schema.sql.ts` | DDL 동기 갱신 |
| `packages/ingest-server/src/stores/d1-key-observation-store.ts` | observe/observeBatch에서 packed_key parse → version/address 분리 저장. prefix 집계도 version별 그룹 |
| `packages/ingest-server/src/stores/d1-key-observation-store.test.ts` | 기존 시나리오에 version 컬럼 검증 추가 |
| `packages/core/src/ports/key-observation-store.port.ts` | `KeyObservationEntry`/`KeyObservation`에 명시적 `version: string` + `address: number` 추가 (optional → required 단계적) |
| `packages/event-catalog/src/auto-track.ts` | emit 시 zod 검증 통과 확인 (실패 시 throw) |
| `packages/ingest-server/src/lib/decode-client.ts` | `parsePackedAddress` 공유 helper로 재구현 (현재 duplicate parse 로직 제거) |
| `docs/proposals/ingest-coordinate-storage-audit/README.md` | 결과 반영: P1~P3 완료, 결론 "준수"로 갱신 |
| `docs/specs/system/coordinate-storage.rule.md` | §관련 사례에 본 이행 결과 추가 |

---

## Task 0: 사전 검증 baseline

**목적**: 현재 ingest-server·event-catalog 테스트가 통과하는지 확인. 변경 후 동일 케이스가 그대로 통과해야 한다.

- [ ] **Step 1: 영향 범위 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server --filter event-catalog --filter @qa-sdk/core test 2>&1 | tail -30
```

Expected: 모든 테스트 통과. 실패 시 main이 깨진 상태이므로 stop.

- [ ] **Step 2: 영향 영역 grep으로 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "addressContext\b\|packedKey\b" packages/event-catalog/src packages/ingest-server/src --include="*.ts" | wc -l
```

기록: 호출 지점 수. 변경 후 누락 없는지 비교용.

---

## Task 1 (P2 part 1): `AddressContextV1` zod 타입 정의

**Files:**
- Create: `packages/ingest-server/src/db/address-context-schema.ts`
- Create: `packages/ingest-server/src/db/address-context-schema.test.ts`

`prefix:version:address` (또는 `catalogId:prefix:version:address`) 문자열 포맷을 1급 zod 스키마로. parse 결과는 `{ prefix, version, address, catalogId? }` 객체.

- [ ] **Step 1: 테스트 먼저 작성**

`packages/ingest-server/src/db/address-context-schema.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import { describe, expect, it } from "vitest";

import {
  AddressContextV1Schema,
  parsePackedAddress,
  serializePackedAddress,
  type ParsedPackedAddress,
} from "./address-context-schema.js";

describe("parsePackedAddress", () => {
  it("3-part: prefix:version:address", () => {
    expect(parsePackedAddress("svc:v1:42")).toEqual({
      prefix: "svc",
      version: "v1",
      address: 42,
    });
  });

  it("4-part: catalogId:prefix:version:address", () => {
    expect(parsePackedAddress("cat-1:svc:v1:42")).toEqual({
      catalogId: "cat-1",
      prefix: "svc",
      version: "v1",
      address: 42,
    });
  });

  it("주소가 음수이거나 NaN인 경우 → null", () => {
    expect(parsePackedAddress("svc:v1:abc")).toBeNull();
    expect(parsePackedAddress("svc:v1:-1")).toBeNull();
  });

  it("part 수 부족 → null", () => {
    expect(parsePackedAddress("svc:v1")).toBeNull();
    expect(parsePackedAddress("")).toBeNull();
  });

  it("part 수 초과 (5+) → null", () => {
    expect(parsePackedAddress("a:b:c:d:e")).toBeNull();
  });
});

describe("serializePackedAddress", () => {
  it("3-part round-trip", () => {
    const parsed: ParsedPackedAddress = { prefix: "svc", version: "v1", address: 42 };
    const s = serializePackedAddress(parsed);
    expect(s).toBe("svc:v1:42");
    expect(parsePackedAddress(s)).toEqual(parsed);
  });

  it("4-part round-trip with catalogId", () => {
    const parsed: ParsedPackedAddress = {
      catalogId: "cat-1", prefix: "svc", version: "v1", address: 42,
    };
    expect(serializePackedAddress(parsed)).toBe("cat-1:svc:v1:42");
  });
});

describe("AddressContextV1Schema", () => {
  it("유효한 컨텍스트 통과", () => {
    const ctx = { svc: "svc:v1:1", pv: "pv:v2:5" };
    expect(AddressContextV1Schema.parse(ctx)).toEqual(ctx);
  });

  it("빈 객체 허용 (매핑 없는 이벤트)", () => {
    expect(AddressContextV1Schema.parse({})).toEqual({});
  });

  it("값 형식 위반 → ZodError", () => {
    const bad = { svc: "not-a-packed-key" };
    expect(() => AddressContextV1Schema.parse(bad)).toThrow();
  });

  it("값에 NaN address → ZodError", () => {
    const bad = { svc: "svc:v1:abc" };
    expect(() => AddressContextV1Schema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/ingest-server && pnpm test -- address-context-schema
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현 작성**

`packages/ingest-server/src/db/address-context-schema.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * AddressContextV1 — event_records.address_context의 1급 타입 계약.
 *
 * 포맷:
 *   3-part: "prefixId:version:address"
 *   4-part: "catalogId:prefixId:version:address"
 *
 * version은 문자열의 일부로 인코딩되어 있으나 본 모듈은 이를 구조화된 객체로
 * 노출해 SDK·ingest·decode 사이의 계약을 강제한다.
 *
 * 본 스키마는 coordinate-storage.rule §1.2 (range-distance 비음수 + version 동봉) 충족.
 */

import { z } from "zod";

export interface ParsedPackedAddress {
  catalogId?: string;
  prefix: string;
  version: string;
  address: number;
}

const PACKED_KEY_RE = /^(?:([^:]+):)?([^:]+):([^:]+):(\d+)$/;

export function parsePackedAddress(value: string): ParsedPackedAddress | null {
  if (!value || typeof value !== "string") return null;
  const m = PACKED_KEY_RE.exec(value);
  if (!m) return null;
  const [, catalogId, prefix, version, addrStr] = m;
  const address = Number(addrStr);
  if (!Number.isFinite(address) || address < 0) return null;
  if (!Number.isInteger(address)) return null;
  return catalogId
    ? { catalogId, prefix, version, address }
    : { prefix, version, address };
}

export function serializePackedAddress(p: ParsedPackedAddress): string {
  return p.catalogId
    ? `${p.catalogId}:${p.prefix}:${p.version}:${p.address}`
    : `${p.prefix}:${p.version}:${p.address}`;
}

const PackedKeySchema = z.string().refine(
  (v) => parsePackedAddress(v) !== null,
  { message: "packed key 포맷 위반: 'prefix:version:address' 또는 'catalogId:prefix:version:address'" },
);

/**
 * address_context 전체 계약. key는 prefix(또는 catalogId:prefix), value는 packed key.
 */
export const AddressContextV1Schema = z.record(z.string(), PackedKeySchema);

export type AddressContextV1 = z.infer<typeof AddressContextV1Schema>;
```

- [ ] **Step 4: 테스트 실행 → 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/ingest-server && pnpm test -- address-context-schema
```

Expected: 모든 케이스 PASS (3-part 1, 4-part 1, 음수 1, part 부족 1, part 초과 1, serialize 2, schema 4 = 11).

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/db/address-context-schema.ts packages/ingest-server/src/db/address-context-schema.test.ts && git commit -m "$(cat <<'EOF'
feat(ingest-server): AddressContextV1 zod 스키마 + parsePackedAddress helper

prefix:version:address 포맷을 1급 타입으로 격상.
SDK·ingest·decode 간 계약 검증 진입점.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 (P2 part 2): json-types.ts에 새 타입 통합 + decode-client 리팩터

**Files:**
- Modify: `packages/ingest-server/src/db/json-types.ts`
- Modify: `packages/ingest-server/src/lib/decode-client.ts`

기존 `AddressContextJson` (= `Record<string, string>`)을 새 타입과 호환 유지. `decode-client.ts`의 inline parse 로직을 `parsePackedAddress`로 교체.

- [ ] **Step 1: json-types.ts 수정**

`packages/ingest-server/src/db/json-types.ts` line 10-11 변경:

```ts
/** eventRecords.addressContext — prefix별 인코딩된 좌표 (계약: AddressContextV1) */
export type AddressContextJson = AddressContextV1;
```

파일 상단 import 추가:

```ts
import type { AddressContextV1 } from "./address-context-schema.js";
```

파일 하단 re-export 추가:

```ts
export {
  AddressContextV1Schema,
  parsePackedAddress,
  serializePackedAddress,
  type AddressContextV1,
  type ParsedPackedAddress,
} from "./address-context-schema.js";
```

- [ ] **Step 2: decode-client.ts 리팩터**

`packages/ingest-server/src/lib/decode-client.ts` 본문을 `parsePackedAddress` 사용으로 교체:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import { parsePackedAddress } from "../db/address-context-schema.js";

export interface DecodedAddress {
  prefix: string;
  version: string;
  address: number;
  entities: Record<string, string>;
}

export async function decodeAddressContext(
  baseUrl: string,
  addressContext: Record<string, string>,
): Promise<Record<string, DecodedAddress> | null> {
  try {
    const results: Record<string, DecodedAddress> = {};

    for (const [key, value] of Object.entries(addressContext)) {
      const parsed = parsePackedAddress(value);
      if (!parsed) continue;

      const res = await fetch(`${baseUrl}/decode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: parsed.address,
          prefix: parsed.prefix,
          version: parsed.version,
        }),
        signal: AbortSignal.timeout(3_000),
      });

      if (res.ok) {
        const body = (await res.json()) as { entities?: Record<string, string> };
        if (body.entities) {
          results[key] = {
            prefix: parsed.prefix,
            version: parsed.version,
            address: parsed.address,
            entities: body.entities,
          };
        }
      }
    }

    return Object.keys(results).length > 0 ? results : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: 영향 패키지 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck
```

Expected: 에러 없음. 만약 `AddressContextJson`을 다른 곳에서 `Record<string, string>`로 명시 사용 중이면 타입 호환 깨짐 — `AddressContextV1` 자체가 `Record<string, string>`의 subtype이므로 caller side는 그대로 호환.

- [ ] **Step 4: 회귀 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server test
```

Expected: 기존 테스트 모두 통과.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src && git commit -m "$(cat <<'EOF'
refactor(ingest-server): AddressContextJson을 AddressContextV1로 통합 + decode-client 리팩터

inline parse 로직 제거, parsePackedAddress 단일 진입점.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 (P2 part 3): SDK 측 emit zod 검증

**Files:**
- Create: `packages/event-catalog/src/auto-track.contract.test.ts`
- Modify: `packages/event-catalog/src/auto-track.ts`

SDK 측에서 emit 직전 `AddressContextV1Schema.parse`로 contract 검증. 실패 시 throw — 잘못된 좌표가 ingest까지 도달하지 못 하게 fail-fast.

**주의**: auto-track의 기존 동작은 인코딩 실패 prefix를 silent skip이지만, 포맷 위반은 systematic bug이므로 throw가 적절. 다만 hot path임을 고려해 dev/test에서만 검증할지 항상 검증할지 결정 필요. 본 plan은 **항상 검증**으로 가되 검증 비용이 무시할 수준임을 contract test에서 확인.

- [ ] **Step 1: contract 테스트 먼저**

`packages/event-catalog/src/auto-track.contract.test.ts`:

```ts
// @def.boundary event-catalog
// @def.doc event-catalog

import { AddressContextV1Schema } from "@qa-sdk/ingest-server/db/address-context-schema";
import { describe, expect, it, vi } from "vitest";

import { createAutoTracker } from "./auto-track.js";

describe("auto-track — emit address_context contract", () => {
  it("정상 emit은 AddressContextV1Schema 통과", () => {
    const captured: Array<{ key: string; ctx: Record<string, string> }> = [];
    const tracker = createAutoTracker({
      catalog: makeMinimalCatalog(),
      context: {
        get() { return { user_role: 1 }; },
      },
      emit: (key, ctx) => {
        captured.push({ key, ctx });
      },
      encodePrefixByValue: () => 7,
      latestPrefixVersion: () => "v1",
    });

    tracker.track("user_login", {});
    expect(captured).toHaveLength(1);
    expect(() => AddressContextV1Schema.parse(captured[0].ctx)).not.toThrow();
  });

  it("매핑 없는 이벤트 → 빈 컨텍스트, 검증 통과", () => {
    let received: Record<string, string> | null = null;
    const tracker = createAutoTracker({
      catalog: { prefixes: {}, mappings: {} } as any,
      context: { get() { return {}; } },
      emit: (_, ctx) => { received = ctx; },
      encodePrefixByValue: () => 0,
      latestPrefixVersion: () => "v1",
    });

    tracker.track("unknown_event", {});
    expect(received).toEqual({});
    expect(() => AddressContextV1Schema.parse(received!)).not.toThrow();
  });
});

// 최소한의 catalog mock — 실제 카탈로그 빌드 비용 회피
function makeMinimalCatalog(): any {
  return {
    prefixes: {
      svc: {
        versions: {
          v1: { axes: [{ id: "user_role", values: ["a", "b"] }] },
        },
      },
    },
    mappings: {
      user_login: {
        prefix: "svc",
        dimensions: { user_role: { source: "context", path: "user_role" } },
      },
    },
  };
}
```

(catalog mock은 `createAutoTracker`의 catalog dependency가 어떤 형태인지에 따라 조정. 본 테스트의 핵심은 **emit된 ctx가 schema에 부합하는지**이므로 mock은 빌더가 정상 통과되는 최소.)

- [ ] **Step 2: 테스트 실행 → 통과 (현재도 통과해야 함)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/event-catalog && pnpm test -- contract
```

Expected: 2 tests PASS — 현재 SDK가 이미 올바른 포맷으로 emit하므로 통과해야 한다. 실패 시 SDK 측 emit 포맷이 schema와 다르다는 뜻 → schema의 정규식이 잘못됐거나 SDK가 잘못된 포맷을 생성.

- [ ] **Step 3: auto-track.ts에 검증 가드 추가 (의도적 강화)**

`packages/event-catalog/src/auto-track.ts` 수정 — emit 직전 검증:

```ts
// 파일 상단 import 추가
import { AddressContextV1Schema } from "@qa-sdk/ingest-server/db/address-context-schema";

// emit(eventKey, addressContext, payload) 직전에:
const validation = AddressContextV1Schema.safeParse(addressContext);
if (!validation.success) {
  // dev에서는 throw, prod에서는 skip + log (silent corruption 방지)
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      `auto-track: addressContext schema 위반 — ${eventKey}: ${validation.error.message}`,
    );
  }
  // prod: 좌표 없이 emit (기존 fallback과 동일)
  emit(eventKey, {}, payload);
  return;
}
emit(eventKey, validation.data, payload);
```

**주의**: `event-catalog`이 `@qa-sdk/ingest-server`에 의존하는 건 의존 방향 위반 가능. CLAUDE.md 의존 체인:
> 플랫폼 의존 체인: `@qa-sdk/core → logger → codec → context → sdk`

ingest-server는 위 체인 외부의 서비스. event-catalog가 ingest-server를 import하면 안 됨.

**해결책**: `address-context-schema.ts`를 `@qa-sdk/core` 또는 별도 패키지(`@qa-sdk/coordinate-codec`)로 옮긴다. 본 plan에서는 `packages/core/src/coordinates/address-context-schema.ts`로 이동 (P2 1차 task 결과 재배치):

```bash
# Task 1의 파일을 옮긴다
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/core/src/coordinates
mv /Users/junwoobang/workflow/qa-sdk/packages/ingest-server/src/db/address-context-schema.ts \
   /Users/junwoobang/workflow/qa-sdk/packages/core/src/coordinates/address-context-schema.ts
mv /Users/junwoobang/workflow/qa-sdk/packages/ingest-server/src/db/address-context-schema.test.ts \
   /Users/junwoobang/workflow/qa-sdk/packages/core/src/coordinates/address-context-schema.test.ts
```

- [ ] **Step 4: 이동 후 import 경로 일괄 갱신**

`packages/ingest-server/src/db/json-types.ts`:

```ts
import type { AddressContextV1 } from "@qa-sdk/core/coordinates/address-context-schema";
// ... (기존 re-export 동일)
```

`packages/ingest-server/src/lib/decode-client.ts`:

```ts
import { parsePackedAddress } from "@qa-sdk/core/coordinates/address-context-schema";
```

`packages/event-catalog/src/auto-track.ts`:

```ts
import { AddressContextV1Schema } from "@qa-sdk/core/coordinates/address-context-schema";
```

`@qa-sdk/core`의 public exports에 `coordinates/address-context-schema` 추가 — `packages/core/src/index.ts` 또는 sub-path export.

`@qa-sdk/core/package.json`의 `exports` field에 sub-path 추가:

```json
"./coordinates/*": {
  "types": "./dist/coordinates/*.d.ts",
  "import": "./dist/coordinates/*.js"
}
```

- [ ] **Step 5: typecheck + 영향 빌드**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core build && pnpm --filter @qa-sdk/ingest-server --filter event-catalog typecheck
```

Expected: 에러 없음.

- [ ] **Step 6: 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/ingest-server --filter event-catalog test
```

Expected: 모두 통과 (core +11, ingest 회귀, event-catalog +2 contract).

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/core packages/ingest-server packages/event-catalog && git commit -m "$(cat <<'EOF'
feat(core,event-catalog): AddressContextV1 검증 게이트 — SDK emit 시 zod 검증

address-context-schema를 @qa-sdk/core/coordinates로 이동 (의존 방향 준수).
auto-track이 emit 직전 schema 검증 — dev throw, prod silent skip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 (P1 part 1): KeyObservationStore port에 명시적 version/address 필드

**Files:**
- Modify: `packages/core/src/ports/key-observation-store.port.ts`

기존 `KeyObservationEntry`에 optional `version`, `address` 추가. 다음 task에서 ingest 측이 packed_key를 parse해 채워준다. 이 단계는 옵셔널 → 호환성 유지.

- [ ] **Step 1: port 타입 갱신**

`packages/core/src/ports/key-observation-store.port.ts` 변경:

```ts
export interface KeyObservationEntry {
  packedKey: string;
  prefixId: string;
  /** packed_key에서 parse된 version. 신규 코드에서 명시 권장. */
  version?: string;
  /** packed_key에서 parse된 정수 address. 신규 코드에서 명시 권장. */
  address?: number;
  registered: boolean;
  timestamp: string; // ISO-8601
  payloadFields?: string[];
  samplePayload?: Record<string, unknown>;
}

export interface KeyObservation {
  packedKey: string;
  prefixId: string;
  version: string;     // 저장 시 항상 채움 (DB 컬럼화)
  address: number;     // 저장 시 항상 채움
  registered: boolean;
  count: number;
  firstSeen: string;
  lastSeen: string;
  payloadSummary: PayloadSummary;
}
```

- [ ] **Step 2: prefix 집계 타입에도 version 추가 (P3 준비)**

```ts
export interface PrefixObservationSummary {
  prefixId: string;
  version: string;     // P3로 추가 — version별 집계
  distinctKeys: number;
  totalCount: number;
  firstSeen: string;
  lastSeen: string;
}
```

- [ ] **Step 3: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core typecheck
```

Expected: 에러 없음 (port만 변경, 구현은 다음 task).

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/core/src/ports/key-observation-store.port.ts && git commit -m "$(cat <<'EOF'
feat(core): KeyObservationStore port에 version/address 명시 필드

KeyObservationEntry: optional (호환성), KeyObservation: required (저장 시 항상 채움).
PrefixObservationSummary에 version 차원 추가 (P3 준비).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 (P1 part 2): D1 schema 마이그레이션 — `key_observations`에 version/address 컬럼

**Files:**
- Create: `packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts`
- Modify: `packages/ingest-server/src/db/schema.ts`
- Modify: `packages/ingest-server/src/stores/d1-schema.sql.ts`

**전략**:
1. 새 컬럼 추가 (NULL 허용, 마이그레이션 호환)
2. backfill SQL: `parsePackedAddress` 로직을 SQL로 옮기되 SQLite 함수 한계로 `INSTR`/`SUBSTR` 조합 필요
3. backfill 후 NOT NULL 제약 추가 + 복합 인덱스
4. PK 변경은 SQLite의 `ALTER TABLE` 한계로 **table 재생성** 패턴 (CREATE NEW → INSERT SELECT → DROP OLD → RENAME)

- [ ] **Step 1: 마이그레이션 SQL 작성**

`packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * Migration 0001 — key_observations에 version/address 구조화 컬럼 추가.
 *
 * 절차:
 *   1. ALTER로 nullable 컬럼 추가
 *   2. UPDATE로 backfill (SUBSTR/INSTR 조합으로 packed_key parse)
 *   3. 임시 검증: NULL row 없는지 확인 (있으면 마이그레이션 abort)
 *   4. table 재생성으로 PK를 (prefix_id, version, address)로 전환 + NOT NULL
 *   5. 신규 인덱스 추가
 */

export const KEY_OBSERVATIONS_VERSIONED_MIGRATION = `
-- 1. nullable 컬럼 추가
ALTER TABLE key_observations ADD COLUMN version TEXT;
ALTER TABLE key_observations ADD COLUMN address INTEGER;

-- 2. backfill: packed_key가 'prefix:version:address' 또는 'catalog:prefix:version:address' 형식
--    파싱 규칙:
--      마지막 ':' 이후 = address (정수)
--      두 번째 마지막 ':' 사이 = version
--      나머지(앞부분) = prefix (catalogId 포함 가능)
UPDATE key_observations
SET
  version = SUBSTR(
    packed_key,
    LENGTH(packed_key) - INSTR(REVERSE(packed_key), ':') - INSTR(SUBSTR(REVERSE(packed_key), INSTR(REVERSE(packed_key), ':') + 1), ':') + 2,
    INSTR(SUBSTR(REVERSE(packed_key), INSTR(REVERSE(packed_key), ':') + 1), ':') - 1
  ),
  address = CAST(SUBSTR(packed_key, LENGTH(packed_key) - INSTR(REVERSE(packed_key), ':') + 2) AS INTEGER)
WHERE version IS NULL;

-- 3. 검증: NULL이 남아있으면 invalid packed_key가 있다는 뜻 → caller에서 abort 결정
-- (SQL만으로는 abort 어려움. application-level 가드는 store-factory에서)

-- 4. table 재생성 — SQLite는 ALTER로 PK 변경 불가
CREATE TABLE key_observations__new (
  prefix_id       TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  address         INTEGER NOT NULL,
  packed_key      TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (prefix_id, version, address)
);

INSERT INTO key_observations__new
  (prefix_id, version, address, packed_key, registered, count, first_seen, last_seen, payload_summary)
SELECT
  prefix_id, version, address, packed_key, registered, count, first_seen, last_seen, payload_summary
FROM key_observations
WHERE version IS NOT NULL AND address IS NOT NULL;

DROP TABLE key_observations;
ALTER TABLE key_observations__new RENAME TO key_observations;

-- 5. 인덱스 재생성
CREATE INDEX idx_key_obs_packed ON key_observations(packed_key);  -- 역호환 조회
CREATE INDEX idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX idx_key_obs_registered ON key_observations(registered);
`;
```

**SQLite REVERSE 주의**: SQLite 기본 빌드에는 `REVERSE` 함수가 없을 수 있음. 검증 필요. 없으면 application-level backfill loop로 대체:

```ts
export async function backfillKeyObservations(db: D1Db): Promise<{ updated: number; skipped: number }> {
  const rows = await db.select().from(keyObservations).where(/* version IS NULL */);
  let updated = 0, skipped = 0;
  for (const row of rows) {
    const parsed = parsePackedAddress(row.packedKey);
    if (!parsed) { skipped++; continue; }
    await db.update(keyObservations)
      .set({ version: parsed.version, address: parsed.address })
      .where(eq(keyObservations.packedKey, row.packedKey));
    updated++;
  }
  return { updated, skipped };
}
```

본 plan은 **application-level backfill 우선**으로 결정 — REVERSE 의존 회피. SQL 마이그레이션은 ALTER + 새 table 생성만 담당, parse는 코드로.

다음과 같이 마이그레이션 SQL을 단순화:

```ts
export const KEY_OBSERVATIONS_VERSIONED_DDL_NEW = `
CREATE TABLE IF NOT EXISTS key_observations__new (
  prefix_id       TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  address         INTEGER NOT NULL,
  packed_key      TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (prefix_id, version, address)
);
`;

export const KEY_OBSERVATIONS_FINALIZE_MIGRATION = `
DROP TABLE key_observations;
ALTER TABLE key_observations__new RENAME TO key_observations;
CREATE INDEX IF NOT EXISTS idx_key_obs_packed ON key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);
`;
```

- [ ] **Step 2: schema.ts 갱신 (Drizzle 정의)**

`packages/ingest-server/src/db/schema.ts`의 `keyObservations` 변경:

```ts
import { primaryKey } from "drizzle-orm/sqlite-core";

export const keyObservations = sqliteTable(
  "key_observations",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    address: integer("address").notNull(),
    packedKey: text("packed_key").notNull(),
    registered: integer("registered", { mode: "boolean" }).notNull().default(false),
    count: integer("count").notNull().default(1),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
    payloadSummary: text("payload_summary").notNull().default("{}"),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version, t.address] }),
    index("idx_key_obs_packed").on(t.packedKey),
    index("idx_key_obs_prefix_version").on(t.prefixId, t.version),
    index("idx_key_obs_last_seen").on(t.lastSeen),
    index("idx_key_obs_count").on(t.count),
    index("idx_key_obs_registered").on(t.registered),
  ],
);
```

- [ ] **Step 3: d1-schema.sql.ts (raw DDL)도 동일 갱신**

기존 `key_observations` 블록 교체:

```sql
CREATE TABLE IF NOT EXISTS key_observations (
  prefix_id       TEXT    NOT NULL,
  version         TEXT    NOT NULL,
  address         INTEGER NOT NULL,
  packed_key      TEXT    NOT NULL,
  registered      INTEGER NOT NULL DEFAULT 0,
  count           INTEGER NOT NULL DEFAULT 1,
  first_seen      TEXT    NOT NULL,
  last_seen       TEXT    NOT NULL,
  payload_summary TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (prefix_id, version, address)
);

CREATE INDEX IF NOT EXISTS idx_key_obs_packed ON key_observations(packed_key);
CREATE INDEX IF NOT EXISTS idx_key_obs_prefix_version ON key_observations(prefix_id, version);
CREATE INDEX IF NOT EXISTS idx_key_obs_last_seen ON key_observations(last_seen);
CREATE INDEX IF NOT EXISTS idx_key_obs_count ON key_observations(count DESC);
CREATE INDEX IF NOT EXISTS idx_key_obs_registered ON key_observations(registered);
```

- [ ] **Step 4: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/ingest-server typecheck
```

Expected: 에러 없음. `keyObservations.$inferSelect`/`$inferInsert` 타입이 자동 갱신됨.

- [ ] **Step 5: 커밋 (구현은 다음 task에서)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src && git commit -m "$(cat <<'EOF'
feat(ingest-server): key_observations 스키마에 version/address 컬럼 + 복합 PK

Drizzle 정의·raw DDL 동시 갱신. 마이그레이션 SQL은 다음 커밋에서 store 구현과 함께.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 (P1 part 3): `D1KeyObservationStore` 구현 갱신

**Files:**
- Modify: `packages/ingest-server/src/stores/d1-key-observation-store.ts`
- Modify: `packages/ingest-server/src/stores/d1-key-observation-store.test.ts`
- Create: `packages/ingest-server/src/stores/d1-key-observation-store.versioned.test.ts`

`observe`에서 packed_key parse → version/address 자동 분리. `findByPrefix`/`summary` 등은 새 인덱스 활용. `findByVersion` 추가.

- [ ] **Step 1: 새 동작 테스트 먼저**

`packages/ingest-server/src/stores/d1-key-observation-store.versioned.test.ts`:

```ts
// @def.boundary ingest-system
// @def.doc ingest-system

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { D1KeyObservationStore } from "./d1-key-observation-store.js";
import { D1_SCHEMA_DDL } from "./d1-schema.sql.js";

describe("D1KeyObservationStore — version 컬럼 동작", () => {
  let store: D1KeyObservationStore;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const raw = new Database(":memory:");
    raw.exec(D1_SCHEMA_DDL);
    db = drizzle({ client: raw });
    store = new D1KeyObservationStore(db as any);
  });

  it("observe 시 packed_key parse → version/address 자동 분리 저장", async () => {
    await store.observe({
      packedKey: "svc:v1:42",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe("v1");
    expect(rows[0].address).toBe(42);
    expect(rows[0].packedKey).toBe("svc:v1:42");
  });

  it("같은 prefix·다른 version은 별도 row", async () => {
    await store.observe({
      packedKey: "svc:v1:5",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    await store.observe({
      packedKey: "svc:v2:5",
      prefixId: "svc",
      registered: true,
      timestamp: "2026-04-22T10:01:00Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.version))).toEqual(new Set(["v1", "v2"]));
  });

  it("같은 (prefix, version, address) 재관측 → count 증가", async () => {
    await store.observe({
      packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:00:00Z",
    });
    await store.observe({
      packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:01:00Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
  });

  it("invalid packed_key (포맷 위반) → 무시 + 카운트 0 (silent skip)", async () => {
    await store.observe({
      packedKey: "invalid-format", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:00:00Z",
    });
    const summary = await store.summary();
    expect(summary.totalKeys).toBe(0);
  });

  it("entry에 explicit version/address 주어지면 packed_key parse 무시", async () => {
    await store.observe({
      packedKey: "svc:v1:42",
      prefixId: "svc",
      version: "vX",      // explicit override
      address: 999,
      registered: true,
      timestamp: "2026-04-22T10:00:00Z",
    });
    const rows = await store.findByPrefix("svc");
    expect(rows[0].version).toBe("vX");
    expect(rows[0].address).toBe(999);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/ingest-server && pnpm test -- d1-key-observation-store.versioned
```

Expected: FAIL — 새 컬럼·기능이 store에 없음.

- [ ] **Step 3: store 구현 갱신**

`packages/ingest-server/src/stores/d1-key-observation-store.ts`의 `observeBatch` 수정:

```ts
import { parsePackedAddress } from "@qa-sdk/core/coordinates/address-context-schema";

// observeBatch 내부:
async observeBatch(entries: readonly KeyObservationEntry[]): Promise<void> {
  for (const entry of entries) {
    const parsed = entry.version !== undefined && entry.address !== undefined
      ? { prefix: entry.prefixId, version: entry.version, address: entry.address }
      : parsePackedAddress(entry.packedKey);

    if (!parsed) continue;  // invalid format → silent skip

    const { version, address } = parsed;

    // 기존 payloadSummary 조회 (PK 변경 — packed_key 대신 (prefix, version, address))
    const [existing] = await this.db
      .select({ payloadSummary: keyObservations.payloadSummary })
      .from(keyObservations)
      .where(and(
        eq(keyObservations.prefixId, entry.prefixId),
        eq(keyObservations.version, version),
        eq(keyObservations.address, address),
      ));

    const prevSummary = existing
      ? parseJsonColumn<PayloadSummaryJson>(existing.payloadSummary, EMPTY_PAYLOAD_SUMMARY)
      : EMPTY_PAYLOAD_SUMMARY;
    const merged = mergePayloadSummary(prevSummary, entry);

    await this.db
      .insert(keyObservations)
      .values({
        prefixId: entry.prefixId,
        version,
        address,
        packedKey: entry.packedKey,
        registered: entry.registered,
        count: 1,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        payloadSummary: JSON.stringify(merged),
      })
      .onConflictDoUpdate({
        target: [keyObservations.prefixId, keyObservations.version, keyObservations.address],
        set: {
          count: sql`${keyObservations.count} + 1`,
          lastSeen: entry.timestamp,
          registered: entry.registered,
          payloadSummary: JSON.stringify(merged),
        },
      });

    // key_observation_prefixes upsert — Task 7에서 version 차원 추가하면서 함께 갱신
    // (현 task에서는 기존 동작 유지)
    // ... 기존 코드
  }
}
```

`toKeyObservation` 함수 수정:

```ts
function toKeyObservation(row: typeof keyObservations.$inferSelect): KeyObservation {
  return {
    packedKey: row.packedKey,
    prefixId: row.prefixId,
    version: row.version,
    address: row.address,
    registered: !!row.registered,
    count: row.count,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    payloadSummary: parseJsonColumn<PayloadSummaryJson>(row.payloadSummary, EMPTY_PAYLOAD_SUMMARY),
  };
}
```

`and` import 추가:

```ts
import { count as countFn, desc, eq, lt, sql, sum, asc, and } from "drizzle-orm";
```

- [ ] **Step 4: 기존 테스트의 packed_key 형식 통일**

`packages/ingest-server/src/stores/d1-key-observation-store.test.ts`의 모든 `packedKey: "..."`가 valid format인지 확인. 이미 `"svc:v1:42"` 같은 형식 → OK.

- [ ] **Step 5: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/ingest-server && pnpm test -- d1-key-observation-store
```

Expected: 기존 테스트 통과 + 새 versioned 테스트 5건 통과.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server && git commit -m "$(cat <<'EOF'
feat(ingest-server): D1KeyObservationStore — version/address 분리 저장

observeBatch에서 packed_key parse → 구조화된 컬럼에 저장.
PK가 (prefix_id, version, address)로 변경. 같은 좌표 재관측은 count 증가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 (P3): `key_observation_prefixes`에 version 차원

**Files:**
- Modify: `packages/ingest-server/src/db/schema.ts`
- Modify: `packages/ingest-server/src/stores/d1-schema.sql.ts`
- Modify: `packages/ingest-server/src/stores/d1-key-observation-store.ts`
- Create: `packages/ingest-server/src/stores/migrations/0002_key_observation_prefixes_versioned.sql.ts`

prefix 집계가 version별로 분리. PK = `(prefix_id, version)`. P1과 같은 패턴.

- [ ] **Step 1: schema.ts에서 keyObservationPrefixes 갱신**

```ts
export const keyObservationPrefixes = sqliteTable(
  "key_observation_prefixes",
  {
    prefixId: text("prefix_id").notNull(),
    version: text("version").notNull(),
    distinctKeys: integer("distinct_keys").notNull().default(1),
    totalCount: integer("total_count").notNull().default(0),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefixId, t.version] }),
  ],
);
```

- [ ] **Step 2: raw DDL 동기**

`d1-schema.sql.ts`의 `key_observation_prefixes` 블록:

```sql
CREATE TABLE IF NOT EXISTS key_observation_prefixes (
  prefix_id      TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  distinct_keys  INTEGER NOT NULL DEFAULT 1,
  total_count    INTEGER NOT NULL DEFAULT 0,
  first_seen     TEXT    NOT NULL,
  last_seen      TEXT    NOT NULL,
  PRIMARY KEY (prefix_id, version)
);
```

- [ ] **Step 3: store의 prefix upsert에 version 추가**

`d1-key-observation-store.ts`의 `observeBatch` 끝 부분 수정 — prefix upsert가 version도 키로 사용:

```ts
// (앞부분: keyObservations upsert는 그대로)

// key_observation_prefixes upsert — version 차원 포함
await this.db
  .insert(keyObservationPrefixes)
  .values({
    prefixId: entry.prefixId,
    version,
    distinctKeys: 1,
    totalCount: 1,
    firstSeen: entry.timestamp,
    lastSeen: entry.timestamp,
  })
  .onConflictDoUpdate({
    target: [keyObservationPrefixes.prefixId, keyObservationPrefixes.version],
    set: {
      distinctKeys: sql`CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM ${keyObservations}
          WHERE ${keyObservations.prefixId} = ${entry.prefixId}
            AND ${keyObservations.version} = ${version}
            AND ${keyObservations.address} = ${address}
            AND ${keyObservations.count} > 1
        )
        THEN ${keyObservationPrefixes.distinctKeys} + 1
        ELSE ${keyObservationPrefixes.distinctKeys}
      END`,
      totalCount: sql`${keyObservationPrefixes.totalCount} + 1`,
      lastSeen: entry.timestamp,
    },
  });
```

`prefixSummary` 메서드도 갱신 — version별 row 반환:

```ts
async prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]> {
  const query = this.db.select().from(keyObservationPrefixes);
  const rows = prefixId
    ? await query.where(eq(keyObservationPrefixes.prefixId, prefixId))
    : await query;

  return rows.map((r) => ({
    prefixId: r.prefixId,
    version: r.version,
    distinctKeys: r.distinctKeys,
    totalCount: r.totalCount,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
  }));
}
```

- [ ] **Step 4: 테스트 보강 — version별 집계 검증**

`d1-key-observation-store.versioned.test.ts`에 추가:

```ts
it("prefixSummary는 version별로 분리된 row 반환", async () => {
  await store.observe({ packedKey: "svc:v1:1", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:00:00Z" });
  await store.observe({ packedKey: "svc:v1:2", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:01:00Z" });
  await store.observe({ packedKey: "svc:v2:1", prefixId: "svc", registered: true, timestamp: "2026-04-22T10:02:00Z" });

  const sums = await store.prefixSummary("svc");
  expect(sums).toHaveLength(2);
  const byVersion = Object.fromEntries(sums.map((s) => [s.version, s]));
  expect(byVersion["v1"].distinctKeys).toBe(2);
  expect(byVersion["v2"].distinctKeys).toBe(1);
});
```

- [ ] **Step 5: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/ingest-server && pnpm test -- key-observation-store
```

Expected: 모든 테스트 통과.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server && git commit -m "$(cat <<'EOF'
feat(ingest-server): key_observation_prefixes에 version 차원 추가 (P3)

prefix 집계가 version별로 분리 — distinct/total을 version-segregated로 보고.
shape 변경 시 통계 혼합 위험 제거.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ClickHouse 스키마 — defer 결정 명시

**Files:**
- Modify: `packages/ingest-server/src/stores/clickhouse-schema.sql.ts` (주석만)

ClickHouse도 동일하게 `version` 컬럼 추가가 권장되지만, ClickHouse 운영 도입이 PG 이행 후 단계라 본 plan에서는 보류.

- [ ] **Step 1: 보류 결정 주석 추가**

`packages/ingest-server/src/stores/clickhouse-schema.sql.ts` 상단:

```ts
// TODO(audit-versioning): D1 스키마는 (prefix_id, version, address)로 분리 완료(0001/0002 마이그레이션).
//   ClickHouse는 운영 도입 시점에 동일 패턴 적용 — version LowCardinality(String) + ORDER BY (prefix_id, version, packed_key).
//   현재는 실 운영 적용 전이라 D1과 동기 보류.
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/ingest-server/src/stores/clickhouse-schema.sql.ts && git commit -m "$(cat <<'EOF'
docs(ingest-server): ClickHouse 스키마 — version 차원 추가는 운영 도입 시 적용

D1은 P1+P3 완료. ClickHouse는 도입 시점에 동기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 감사 문서 결과 갱신 + rule 사례 추가

**Files:**
- Modify: `docs/proposals/ingest-coordinate-storage-audit/README.md`
- Modify: `docs/specs/system/coordinate-storage.rule.md`

- [ ] **Step 1: 감사 문서에 이행 결과 반영**

`docs/proposals/ingest-coordinate-storage-audit/README.md` §2.1·2.2·2.3에 "이행 완료" 노트 추가, §3 우선순위 섹션 끝에:

```markdown
---

## 이행 완료 (2026-04-22)

| 항목 | 상태 | 커밋 |
|---|---|---|
| P1 — `key_observations` version 컬럼 | ✅ 완료 | (PR/커밋 해시) |
| P2 — `address_context` JSON 스키마 계약 | ✅ 완료 (`AddressContextV1Schema` in `@qa-sdk/core/coordinates`) | (커밋 해시) |
| P3 — `key_observation_prefixes` version 차원 | ✅ 완료 | (커밋 해시) |

ClickHouse 스키마는 운영 도입 시점에 동기 (보류).

본 감사 결론 변경: "부분 준수" → "준수". 다음 재감사 트리거: 신규 좌표 저장 테이블 추가, ClickHouse 운영 도입.
```

- [ ] **Step 2: rule 문서에 사례 추가**

`docs/specs/system/coordinate-storage.rule.md` 끝에 "사례" 섹션이 있다면 추가:

```markdown
## 사례

- **2026-04-22**: ingest-server `key_observations`/`key_observation_prefixes` 이행. packed_key 단일 컬럼 → `(prefix_id, version, address)` 복합 PK + 구조화 컬럼. 감사: `docs/proposals/ingest-coordinate-storage-audit/README.md`
```

- [ ] **Step 3: def sync로 DB 동기**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def sync
```

Expected: 2 docs updated.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add docs && git commit -m "$(cat <<'EOF'
docs: ingest 좌표 저장 감사 P1~P3 이행 완료 — 결론 '준수'로 갱신

coordinate-storage.rule 사례에도 본 이행 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 회귀·gate 검증

- [ ] **Step 1: 영향 패키지 빌드**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/ingest-server --filter event-catalog build
```

Expected: 3 패키지 build 성공.

- [ ] **Step 2: 영향 패키지 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/ingest-server --filter event-catalog test
```

Expected: 모든 테스트 통과.

- [ ] **Step 3: 의존 패키지 회귀 (decision-service 등 ingest-server 의존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "...^@qa-sdk/ingest-server" test 2>&1 | tail -30
```

Expected: 회귀 없음.

- [ ] **Step 4: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def sync && pnpm --filter @qa-sdk/cli def validate
```

Expected: errors=0.

---

## Self-Review 체크리스트

- [ ] `parsePackedAddress` round-trip 테스트 통과 (3-part, 4-part)
- [ ] `AddressContextV1Schema`가 `@qa-sdk/core/coordinates`로 이전됨 (의존 방향 위반 없음)
- [ ] `key_observations` PK = `(prefix_id, version, address)`, packed_key는 secondary index만
- [ ] `key_observation_prefixes` PK = `(prefix_id, version)`
- [ ] `auto-track`이 emit 직전 schema 검증 (dev throw, prod skip)
- [ ] `decode-client`의 inline parse 제거됨 (parsePackedAddress 단일 진입점)
- [ ] 감사 문서 결론 "준수"로 갱신
- [ ] ClickHouse defer 명시
- [ ] CI gate errors=0

---

## Defer 항목

| 작업 | 사유 | 재개 트리거 |
|---|---|---|
| ClickHouse 스키마 동기 | 운영 도입 전 | ClickHouse store 활성화 |
| Backfill 마이그레이션 SQL (REVERSE 의존 회피판) | 본 plan은 application-level backfill 우선. 대규모 D1 데이터 발생 시 SQL 직접 backfill로 전환 필요 | D1 row 수 > 100K |
| `address_context` JSON migration (event_records 기존 row의 schema validation) | event_records는 append-only · 과거 row schema 위반 무시 가능 | (없음) |
| `auto-track` prod 모드 silent skip을 metric으로 | 위반 발생 빈도 모니터링 필요 시 | observability 통합 |

---

## 의존·후속

- **§1 Audit DB**: 독립. 두 plan을 같은 PR로 묶거나 별도로 머지 가능.
- **§6 coord-rule 자동화**: 본 plan의 패턴(`(prefix_id, version, address)` 강제)을 자동 검출하는 게 §6의 목표 — 본 plan 완료 후 §6의 검출기는 ingest-server를 false negative 대상으로 검증.
- **Phase 2 PG 이행**: 본 plan은 D1/SQLite 한정. PG 이행 시 동일 컬럼 구조 유지 + native primary key 지원으로 단순화.
- **Phase 4 시뮬 프로젝트**: 시뮬 트래픽으로 version 분리의 실 가치(여러 버전 공존 시 통계 정합) 검증.
