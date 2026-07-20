---
def:
  tier: component
  id: table-dimref-types
  address: def_document:v2:342204
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, structural, runtime]
  links:
    - target: table-schema-def
      type: depends_on
sources:
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/schema-sync.ts
  - packages/index-meta/src/schema-sync.test.ts
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/demo-catalog.test.ts
  - packages/demo-snapshot/src/catalog-builder.ts
  - packages/demo-snapshot/src/demo-accessors.ts
  - packages/demo-snapshot/src/demo-bridge.ts
  - packages/demo-snapshot/src/event-schema.test.ts
  - packages/demo-snapshot/src/table-ref-guide.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts

---
# DimRef 두 종류 — axis vs table_ref

## 목적 ^purpose

두 종류의 DimRef — axis(닫힌 어휘 참조)와 table_ref(외부 관계형 테이블 참조)의 차이와 사용 규칙.

## 구성 ^overview

- **DimRef 3종류**: axis(유한 열거값, 좌표 인코딩), prefix_ref(다른 좌표 공간 참조, 좌표 인코딩), table_ref(DB 테이블 참조, 좌표에서 제외)
- **테이블 시스템 필요성**: 좌표는 유한한 경우의 수만 인코딩하므로, 무한히 증가하는 런타임 엔티티(회원, 상품, 주문)는 table_ref로 분리
- **이벤트 3-slot 구조**: actor(누가) × action(무엇을) × target(어디에) 패턴으로, actor/target은 table_ref, action은 axis
- **shape 계산 규칙**: table_ref는 shape/encode/decode 산술에서 완전히 제외되며, axis와 prefix_ref만 주소 공간을 결정
- **런타임 인스턴스 분리**: 같은 좌표 주소(address) + 다른 refs = 같은 종류의 이벤트지만 다른 대상
- **온톨로지 대응**: actor→rdfs:domain, action→rdf:Property, target→rdfs:range로 RDF/OWL과 구조적으로 대응
- **불변조건**: table_ref 추가는 기존 prefix를 깨지 않으며, 구조 정보(labels/dims)에는 존재하되 좌표 산술에는 참여하지 않음

---

## 1. 왜 테이블 시스템이 필요한가

좌표 시스템은 **유한한 경우의 수**를 인코딩한다:

```
role 축:     [admin, developer, operator, viewer]   ← 4개
action 축:   [add, remove, checkout]                ← 3개
→ 조합:     4 × 3 = 12 좌표 주소
```

하지만 현실 시스템의 데이터는 유한하지 않다:

```
members 테이블:  수백만 행
items 테이블:    수십만 행
orders 테이블:   무한히 증가
```

**문제:** "회원 42번이 상품 1번을 장바구니에 넣었다"를 좌표로 표현하면?

- `action = add` → 축 값 (유한) → 좌표에 인코딩 가능
- `actor = member:42` → 테이블 행 (무한) → 좌표에 인코딩 불가
- `target = item:1` → 테이블 행 (무한) → 좌표에 인코딩 불가

**해법:** 좌표는 "무엇을 했는가"만 인코딩하고, "누가/무엇에" 대해 했는지는 테이블 참조로 분리한다.

---

## 2. DimRef 3종류

prefix의 각 차원은 `DimRef`로 참조 대상을 선언한다:

```typescript
type DimRef =
  | { kind: "axis";       axisId: string }    // 유한 열거값 → 좌표 인코딩
  | { kind: "prefix_ref"; prefixId: string }  // 다른 좌표 공간 → 좌표 인코딩
  | { kind: "table_ref";  table: string }     // DB 테이블 타입 → 좌표에서 제외
```

| DimRef | 인코딩 여부 | 유한/무한 | 역할 |
|---|---|---|---|
| `axis` | 좌표에 포함 | 유한 | 고정된 경우의 수 |
| `prefix_ref` | 좌표에 포함 | 유한 | 다른 좌표 공간의 주소 |
| `table_ref` | **좌표에서 제외** | 무한 | 런타임 엔티티 타입 선언 |

**설계 원칙:**

```
좌표에 인코딩되는 것 (고정 차원):
  axis:        action position     → 유한, 결정적, 버전 관리
  prefix_ref:  service address     → 유한, 좌표 공간 합성

좌표에 인코딩되지 않는 것 (타입 차원):
  table_ref:   actor_id, target_id → 무한, 런타임 데이터, 별도 저장
```

---

## 3. 이벤트 prefix — table_ref의 대표 사용처

### 3.1 기본 형태: actor × action × target

```typescript
// DEMO_CATALOG.prefixes.cart_event
cart_event: {
  labels: ["actor", "action", "target"],
  dims: {
    actor:  { kind: "table_ref", table: "members" },   // 누가
    action: { kind: "axis",      axisId: "cart_action" }, // 무엇을
    target: { kind: "table_ref", table: "items" },      // 어디에
  },
  versions: [{ version: "v1", axisVersions: { action: "v1" } }],
}
```

이 prefix가 선언하는 것: **"members 타입이 cart_action을 items 타입에 수행한다"**

shape 계산 시 `table_ref`는 제외된다:

```
labels:   [actor, action, target]
고정 차원: [action]                ← table_ref 2개 제외
shape:    [32]                    ← cart_action capacity만
capacity: 32
```

### 3.2 단항 이벤트: actor만

```typescript
// auth_event: "회원이 로그인했다" — target 없음 (자동사)
auth_event: {
  labels: ["actor", "action"],
  dims: {
    actor:  { kind: "table_ref", table: "members" },
    action: { kind: "axis",      axisId: "auth_action" },
  },
}
// shape: [32] — auth_action만
```

### 3.3 다항 이벤트: prefix_ref + table_ref 혼합

```typescript
// order_event: "특정 서비스 환경에서 회원이 주문에 대해 행위를 했다"
order_event: {
  labels: ["service_ctx", "actor", "action", "order"],
  dims: {
    service_ctx: { kind: "prefix_ref", prefixId: "service" },  // 좌표 인코딩
    actor:       { kind: "table_ref",  table: "members" },     // 좌표 제외
    action:      { kind: "axis",       axisId: "order_action" }, // 좌표 인코딩
    order:       { kind: "table_ref",  table: "orders" },      // 좌표 제외
  },
}
// 고정 차원: [service_ctx, action]
// shape: [5, 32] = 160 — prefix_ref와 axis만
```

### 3.4 런타임 이벤트 인스턴스

prefix는 **타입**을 정의한다. 런타임에 발생하는 **인스턴스**는 좌표 주소와 테이블 참조를 분리한다:

```typescript
// 런타임 이벤트 (개념적 구조)
{
  event_type: "cart_event",           // prefix 참조
  address: 0,                        // axis + prefix_ref만 인코딩된 1D 주소
  refs: {
    actor: 42,                       // members.id → 런타임 데이터
    target: 1,                       // items.id → 런타임 데이터
  },
  timestamp: 1711000000000,
}
```

**같은 좌표 + 다른 refs = 같은 종류의 이벤트, 다른 대상:**

```typescript
// 회원 42가 상품 1을 추가
{ address: 0, refs: { actor: 42, target: 1 } }

// 회원 43이 상품 2를 추가
{ address: 0, refs: { actor: 43, target: 2 } }

// 두 이벤트의 address는 동일 (= "add" action)
// decode(0) → { action: "add" }
// refs만 다름 → 테이블에서 조회
```

---

## 4. 온톨로지 대응

이벤트 스키마의 3-slot 구조는 RDF/OWL 온톨로지와 대응한다:

| 이벤트 스키마 | RDF/OWL | 좌표 타입 시스템 |
|---|---|---|
| actor (타입) | rdfs:domain | table_ref → 테이블 |
| action | rdf:Property | axis → 고정 enum |
| target (타입) | rdfs:range | table_ref → 테이블 |
| 이벤트 정의 | Property 선언 | prefix 정의 |
| 이벤트 인스턴스 | Triple (s, p, o) | (address, refs, timestamp) |

---

## 5. 불변조건

1. **table_ref는 좌표 산술에 참여하지 않는다** — shape, encode, decode, resolve, decompose 모두 제외
2. **table_ref는 구조 정보에는 존재한다** — `getPrefixStructure()`에서 labels/dims에 포함
3. **table_ref 추가는 기존 prefix를 깨지 않는다** — 고정 차원(axis/prefix_ref)만 주소를 결정하므로

## 참조

- [event-schema.md](../event-schema.md) — 이벤트 = 관계 정의, 3-slot 구조, 관계 유형 분류
- [foundation.md](../foundation.md) — 좌표 시스템 근본 원리 (닫힌 공간, stride 공식)
