---
def:
  tier: component
  id: table-schema-usage-spec
  address: def_document:v2:342210
  scope: feature
  aspect: func_def
  depth: specification
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, observability]
  links:
    - target: table-schema-spec
      type: refines
---

# TableDef 사용 예시 및 레이어 위치

## 목적 ^purpose

defineTable/compileSchema의 실제 사용 패턴(leaf, composite, diff)과
스키마 선언 레이어가 전체 index-meta 파이프라인에서 차지하는 위치를 보여준다.

## 1. 사용 예시

```ts
import { defineTable, compileSchema } from "index-meta";

// ── leaf 테이블 ───────────────────────────────────────────

const roleTable = defineTable("role", {
  source: { kind: { type: "string_enum" } },
  versions: {
    v1: {
      capacity: 8,
      reserved: [
        { position: 1, token: "_" },  // null — 역할 미지정
        { position: 2, token: "~" },  // other — 분류 불가
      ],
    },
    v2: { capacity: 16 },  // 주소 공간 확장 → 새 버전
  },
});

const scoreTable = defineTable("score", {
  source: { kind: { type: "number_enum" } },
  versions: {
    v1: {
      capacity: 16,
      reserved: [
        { position: 1, token: "NaN" },  // 숫자가 아닌 값이 들어온 경우
      ],
    },
  },
});

const actionTable = defineTable("action", {
  source: { kind: { type: "string_enum" } },
  versions: {
    v1: { capacity: 4 },
  },
});

// ── composite 테이블 ──────────────────────────────────────

const permTable = defineTable("perm", {
  dims: [roleTable, actionTable],
  versions: {
    v1: {
      refs: {
        role:   { prefix: "role",   version: "v1" },  // capacity 8
        action: { prefix: "action", version: "v1" },  // capacity 4
      },
      // capacity 자동 계산: 8 × 4 = 32
    },
    v2: {
      refs: {
        role:   { prefix: "role",   version: "v2" },  // capacity 16 → 크기 변화
        action: { prefix: "action", version: "v1" },
      },
      // capacity 자동 계산: 16 × 4 = 64
    },
  },
});

// ── 컴파일 ────────────────────────────────────────────────

const schema = compileSchema([roleTable, actionTable, permTable]);
// roleTable, actionTable은 dims 체인으로 자동 수집되므로 생략 가능:
// compileSchema([permTable])  ← 동일한 결과

const permSpec = schema.getTable("perm")!;
// permSpec.kind === "composite"
// permSpec.versions.get("v1")!.capacity === 32
// permSpec.versions.get("v2")!.capacity === 64

// ── diff ──────────────────────────────────────────────────

const previousSchema = compileSchema([roleTable, actionTable]);
const diff = schema.diff(previousSchema);
// diff.added = [CompositeTableSpec("perm")]
```

---

## 2. 레이어 위치

```
defineTable / compileSchema   ← 이 스펙 (스키마 선언 레이어)
      ↓ 주소 공간 명세 (capacity, refs)
IndexMetaStore                ← ../../index-meta-system/index-meta-store-contract.spec.md (DB 저장 레이어)
      ↓ entries 저장/조회
MetaRegistry                  ← registry.spec.md (런타임 encode/decode)
      ↓ 1D 주소 계산
WeightedIndex                 ← ../../weighted-index-system/wi-math.spec.md (수학 레이어)
```

`compileSchema`의 출력(`CompiledSchema`)은 DB 마이그레이션 판단과 스키마 검증에 사용된다.
런타임 encode/decode가 필요하면 DB에서 entries를 읽어 `MetaRegistry`를 생성하고, `createCodec()`으로 특정 version의 `MetaCodec`을 얻는다.
