---
def:
  id: table-system-spec
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  layer: domain
  links:
    - target: coord-foundation
      type: depends_on
    - target: event-schema-spec
      type: depends_on
    - target: schema-layer-spec
      type: depends_on
---
# 테이블 시스템 — 좌표 세계와 관계형 세계의 양방향 연결

## 목적 ^purpose

좌표 시스템(유한 조합의 정수 주소)과 관계형 데이터(테이블 행)를 **양방향으로 연결**하는 메타데이터 레이어.

좌표 시스템은 "의사결정의 경우의 수"를 인코딩하고, 테이블은 "런타임 엔티티"를 저장한다.
이 문서는 두 세계를 어떻게 연결하고, 그 연결로 무엇을 할 수 있는지 설명한다.

기반 문서: [foundation.md](foundation.md) · [event-schema.md](event-schema.md) · [schema-layer.md](schema-layer.md)
관련 스펙: [dimension-operations.md](dimension-operations.md) · [coordinate-query.spec.md](coordinate-query.spec.md)

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

이 분리를 타입 시스템으로 선언하는 것이 테이블 시스템의 역할이다.

---

## 2. 핵심 개념: 두 종류의 DimRef

prefix의 각 차원은 `DimRef`로 참조 대상을 선언한다. 3종류가 있다:

> 타입 정의: `packages/core/src/catalog/catalog.types.ts` — `DimRef`

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
// 개념 예시 — DEMO_CATALOG.prefixes.cart_event 구조
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
// 개념 예시 — auth_event: "회원이 로그인했다" — target 없음 (자동사)
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
// 개념 예시 — order_event: "특정 서비스 환경에서 회원이 주문에 대해 행위를 했다"
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

## 4. 테이블 스키마 — 관계형 세계의 구조 선언

### 4.1 ColumnRef 4종류

테이블의 각 컬럼이 무엇을 참조하는지 타입으로 선언한다:

> 타입 정의: `packages/core/src/catalog/catalog.types.ts` — `ColumnRef`

| ColumnRef | 의미 | 예시 |
|---|---|---|
| `scalar` | 일반 데이터 값 | `orders.amount: number` |
| `axis_ref` | 행의 값이 축 entry 중 하나 | `members.role → role 축` |
| `table_ref` | 다른 테이블 행 참조 (FK) | `orders.member_id → members` |
| `prefix_ref` | 좌표 주소를 저장하는 컬럼 | `orgs.region_addr → service prefix` |

### 4.2 DEMO_CATALOG의 테이블 정의

```typescript
// 개념 예시 — DEMO_CATALOG.tables 구조
tables: {
  members: {
    columns: {
      id:     { kind: "scalar",    type: "integer" },
      name:   { kind: "scalar",    type: "string" },
      role:   { kind: "axis_ref",  axisId: "role" },         // ← 축 연결
      org_id: { kind: "table_ref", table: "orgs" },          // ← FK
    },
  },
  orgs: {
    columns: {
      id:          { kind: "scalar",     type: "integer" },
      name:        { kind: "scalar",     type: "string" },
      region_addr: { kind: "prefix_ref", prefixId: "service" }, // ← 좌표 저장
    },
  },
  items: {
    columns: {
      id:             { kind: "scalar",     type: "integer" },
      name:           { kind: "scalar",     type: "string" },
      category:       { kind: "axis_ref",   axisId: "category" },
      warehouse_addr: { kind: "prefix_ref", prefixId: "service" },
    },
  },
  orders: {
    columns: {
      id:           { kind: "scalar",     type: "integer" },
      member_id:    { kind: "table_ref",  table: "members" },
      service_addr: { kind: "prefix_ref", prefixId: "service" },
      status:       { kind: "axis_ref",   axisId: "order_action" },
      amount:       { kind: "scalar",     type: "number" },
    },
  },
  carts: {
    columns: {
      id:        { kind: "scalar",    type: "integer" },
      member_id: { kind: "table_ref", table: "members" },
    },
  },
  cart_items: {
    columns: {
      cart_id: { kind: "table_ref", table: "carts" },
      item_id: { kind: "table_ref", table: "items" },
      qty:     { kind: "scalar",    type: "integer" },
    },
  },
}
```

---

## 5. 양방향 연결 — 그래프 탐색

테이블 스키마와 prefix 정의를 합치면 **좌표 세계와 관계형 세계를 오가는 그래프**가 된다.

### 5.1 연결 유형

```
좌표 → 테이블:   prefix의 table_ref 차원      (이벤트 → 엔티티 타입)
테이블 → 좌표:   컬럼의 prefix_ref             (엔티티 → 좌표 주소)
테이블 → 축:     컬럼의 axis_ref               (엔티티 → 축 값)
테이블 → 테이블: 컬럼의 table_ref              (FK)
```

### 5.2 그래프 시각화

```
                    좌표 세계                          관계형 세계
              ┌─────────────────┐               ┌─────────────────┐
              │  service prefix │◄──prefix_ref──│  orgs.region_addr│
              │  (env×region×   │               │                 │
              │   svc×namespace)│               │  orgs           │
              └────────┬────────┘               └────────▲────────┘
                       │                                 │ table_ref
              ┌────────▼────────┐               ┌────────┴────────┐
              │ order_event     │──table_ref───→│  members        │
              │  prefix         │               │  .role──axis_ref│──→ role 축
              │ (svc_ctx×action)│               │  .org_id        │
              └────────┬────────┘               └─────────────────┘
                       │
                       │ table_ref              ┌─────────────────┐
                       └───────────────────────→│  orders         │
                                                │  .member_id─────│──→ members
                                                │  .service_addr──│──→ service prefix
                                                │  .status──axis──│──→ order_action 축
                                                └─────────────────┘
```

### 5.3 경로 탐색 예시: 이벤트 → 엔티티 → 좌표

테스트(`event-schema.test.ts`)에서 증명된 전체 경로:

```
cart_event(add, actor:42, target:1)
    │
    │ decode address → action = "add"
    │
    │ refs.actor = 42
    ▼
members[42] { role: "admin", org_id: 7 }
    │
    │ role → axis_ref → role 축 → position 0 = "admin"
    │
    │ org_id = 7
    ▼
orgs[7] { region_addr: 40 }
    │
    │ region_addr → prefix_ref → service prefix
    ▼
service:40 → decode → { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }
```

**결과:** 하나의 이벤트에서 출발하여 테이블 FK를 따라가면 좌표 세계로 돌아온다.

```typescript
// 테스트 코드 (event-schema.test.ts, 259-291행)
const eventAddr = encodePrefixByValue(DEMO_CATALOG, "cart_event", "v1", { action: "add" });
const member42 = { id: 42, name: "홍길동", role: "admin", org_id: 7 };
const svcAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
  env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
});
const org7 = { id: 7, name: "쇼핑몰A", region_addr: svcAddr };

// 경로 추적
const eventDecoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", eventAddr);
// → { action: { value: "add" } }

const rolePos = DEMO_CATALOG.axes.role.versions.v1.entries.indexOf(member42.role);
// → 0 ("admin")

const serviceResolved = resolveAddress(DEMO_CATALOG, "service", "v1", org7.region_addr);
// → { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }
```

---

## 6. accessor API에서의 table_ref 처리

모든 accessor 함수는 `getFixedLabels()` 헬퍼로 `table_ref`를 제외한다.

소스: `packages/demo-snapshot/src/demo-accessors.ts`

> 함수 정의: `packages/core/src/catalog/runtime.ts` — `getFixedLabels()`

| API | table_ref 처리 |
|---|---|
| `getPrefixStructure()` | labels/dims에 **포함** (구조 정보) |
| `getPrefixShape()` | **제외** — shape/capacity에 반영 안 됨 |
| `getPrefixEntries()` | **제외** — entries에 반환 안 됨 |
| `encodePrefix()` | **제외** — positions에 넣지 않음 |
| `decodePrefix()` | **제외** — 결과에 나타나지 않음 |
| `resolveAddress()` | **제외** — dims에 포함 안 됨 |
| `decomposeAddress()` | **제외** — 분해 대상 아님 |
| `verifyRoundTrip()` | **제외** — 고정 차원만 라운드트립 검증 |

**구조(structure)에서는 보이지만, 산술(encoding)에서는 투명:**

```typescript
// 구조: table_ref 차원이 보인다
const s = getPrefixStructure(DEMO_CATALOG, "cart_event");
s.labels;        // ["actor", "action", "target"] ← 3개 전부
s.dims.actor;    // { kind: "table_ref", table: "members" }

// 산술: table_ref 차원이 사라진다
const shape = getPrefixShape(DEMO_CATALOG, "cart_event", "v1");
shape.shape;     // [32] ← action만

const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", 1);
decoded.actor;   // undefined ← table_ref는 decode 안 됨
decoded.action;  // { position: 1, value: "remove" }
```

---

## 7. 외부 레이어 전파 — MetaRegistry / PrefixCodec

테이블 시스템은 DEMO_CATALOG 내부의 메타데이터로만 존재하며, 하위 인코딩 레이어에 전파되지 않는다.

소스: `packages/demo-snapshot/src/demo-bridge.ts`

```
DEMO_CATALOG
├── axes          ──→ catalogToRegistryInput() ──→ MetaRegistry
├── prefixes      ──→ catalogToPrefixCodecInput() ──→ PrefixCodec
│   └── table_ref 차원 → **제외** (두 함수 모두)
└── tables        ──→ 전파 없음 (application layer의 메타데이터)
```

| 변환 함수 | table_ref 처리 | 이유 |
|---|---|---|
| `catalogToRegistryInput()` | 건너뜀 | MetaRegistry는 좌표 산술만 담당 |
| `catalogToPrefixCodecInput()` | 건너뜀 | PrefixCodec은 axis만 label로 등록 |

---

## 8. 테이블 시스템으로 할 수 있는 것

### 8.1 이벤트 타입 선언

prefix로 "누가(actor) 무엇을(action) 어디에(target) 했다"를 타입으로 선언한다.

```
단항: auth_event  = actor × action           (회원이 로그인했다)
이항: cart_event  = actor × action × target  (회원이 상품을 추가했다)
다항: order_event = ctx × actor × action × order  (환경에서 회원이 주문을 취소했다)
```

### 8.2 좌표-엔티티 타입 안전 연결

`table_ref`는 "이 차원은 members 테이블의 행이다"를 타입으로 선언한다.
`axis_ref`는 "이 컬럼의 값은 role 축의 entry다"를 타입으로 선언한다.

이를 통해:
- 이벤트의 actor가 어떤 테이블 타입인지 정적으로 알 수 있다
- 테이블 행의 특정 컬럼이 어떤 축 값인지 정적으로 알 수 있다
- 테이블 행이 어떤 좌표 주소를 저장하는지 정적으로 알 수 있다

### 8.3 그래프 탐색 (추적성)

ColumnRef와 DimRef를 합치면 좌표↔테이블↔좌표를 오가는 그래프가 된다.

용도:
- **영향 분석:** "role 축에 entry를 추가하면 어떤 테이블이 영향받는가?" → `axis_ref`로 role을 참조하는 컬럼 탐색
- **데이터 흐름 추적:** "이 이벤트의 actor는 어떤 조직 소속이고, 그 조직은 어떤 리전에 있는가?" → `table_ref` FK → `prefix_ref` 좌표 decode
- **스키마 검증:** "cart_event의 target이 items 테이블을 참조하는데, items에 category axis_ref가 있으므로 장바구니 이벤트에서 상품 카테고리까지 추적 가능"

### 8.4 인코딩 분리 (좌표 공간 유한성 보장)

`table_ref`가 좌표에서 제외되므로:
- 좌표 공간은 유한하게 유지된다 (action 3가지 × service 100개 = 300 좌표)
- 엔티티는 무한히 참조 가능하다 (member 수백만, item 수백만)
- 같은 좌표 주소 + 다른 refs = "같은 종류의 이벤트, 다른 대상"

### 8.5 온톨로지 대응

이벤트 스키마의 3-slot 구조는 RDF/OWL 온톨로지와 대응한다:

| 이벤트 스키마 | RDF/OWL | 좌표 타입 시스템 |
|---|---|---|
| actor (타입) | rdfs:domain | table_ref → 테이블 |
| action | rdf:Property | axis → 고정 enum |
| target (타입) | rdfs:range | table_ref → 테이블 |
| 이벤트 정의 | Property 선언 | prefix 정의 |
| 이벤트 인스턴스 | Triple (s, p, o) | (address, refs, timestamp) |

---

## 9. 불변조건

1. **table_ref는 좌표 산술에 참여하지 않는다** — shape, encode, decode, resolve, decompose 모두 제외
2. **table_ref는 구조 정보에는 존재한다** — `getPrefixStructure()`에서 labels/dims에 포함
3. **ColumnRef는 메타데이터다** — 런타임 데이터 검증이나 FK 제약을 강제하지 않는다
4. **table_ref 추가는 기존 prefix를 깨지 않는다** — 고정 차원(axis/prefix_ref)만 주소를 결정하므로
5. **그래프 순환이 허용된다** — prefix → table → table → prefix 경로가 존재할 수 있다 (order_event → orders → members → orgs → service prefix)

---

## 10. 소스 위치

| 파일 | 역할 |
|---|---|
| `packages/demo-snapshot/src/demo-catalog.ts` | DimRef, ColumnRef, TableSchema 타입 + DEMO_CATALOG.tables 정의 |
| `packages/demo-snapshot/src/demo-accessors.ts` | `getFixedLabels()` + 모든 accessor에서 table_ref 제외 처리 |
| `packages/demo-snapshot/src/demo-bridge.ts` | MetaRegistry/PrefixCodec 변환 시 table_ref 건너뛰기 |
| `packages/demo-snapshot/src/catalog-builder.ts` | refEntries 파생 시 `table_ref` 제외 |
| `packages/demo-snapshot/src/event-schema.test.ts` | 인코딩 분리 증명 + 양방향 경로 탐색 증명 |

## 참조

- [event-schema.md](event-schema.md) — 이벤트 = 관계 정의, 3-slot 구조, 관계 유형 분류
- [schema-layer.md](schema-layer.md) — 4-Layer 아키텍처에서 table_ref의 위치 (Layer 2)
- [dimension-operations.md](dimension-operations.md) — 축 교차 선택, 환경 주입, 배포 시점 해석
- [foundation.md](foundation.md) — 좌표 시스템 근본 원리 (닫힌 공간, stride 공식)
