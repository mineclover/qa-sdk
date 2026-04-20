---
def:
  tier: component
  id: table-schema-def
  address: def_document:v2:342205
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, structural, runtime]
  links:
    - target: system-concepts
      type: depends_on
---
# TableDef — 관계형 세계의 구조 선언

## 목적 ^purpose

TableDef — 관계형 세계의 구조 선언. 컬럼, 타입, FK, 인덱스를 정의하고 양방향 그래프 탐색을 지원.

## 구성 ^overview

- **ColumnRef 4종**: `scalar`(일반 데이터), `axis_ref`(축 값 참조), `table_ref`(FK), `prefix_ref`(좌표 주소 저장) — 컬럼이 무엇을 참조하는지 타입으로 선언
- **DEMO_CATALOG 테이블**: members, orgs, items, orders, carts, cart_items 6개 테이블로 구성된 참조 구현
- **양방향 그래프 탐색**: 좌표→테이블(table_ref dim), 테이블→좌표(prefix_ref), 테이블→축(axis_ref), 테이블→테이블(FK) 4종 연결로 좌표 세계와 관계형 세계를 오가는 그래프 형성
- **경로 탐색 증명**: `cart_event → members[42] → orgs[7] → service:40` 경로로 이벤트에서 출발하여 FK를 따라 좌표 세계로 복귀하는 전체 경로를 테스트로 증명
- **불변조건**: ColumnRef는 메타데이터일 뿐 런타임 제약을 강제하지 않으며, prefix→table→table→prefix 순환 경로가 허용됨
- **소스 위치**: `demo-snapshot/demo-catalog.ts`(타입+정의), `demo-snapshot/event-schema.test.ts`(증명)

---

## 1. ColumnRef 4종류

테이블의 각 컬럼이 무엇을 참조하는지 타입으로 선언한다:

```typescript
type ColumnRef =
  | { kind: "scalar";     type: string }     // 일반 데이터 (int, string, number)
  | { kind: "axis_ref";   axisId: string }   // 축 값 참조 (행의 값이 축 entry)
  | { kind: "table_ref";  table: string }    // 다른 테이블 FK
  | { kind: "prefix_ref"; prefixId: string } // 좌표 공간 주소 저장
```

| ColumnRef | 의미 | 예시 |
|---|---|---|
| `scalar` | 일반 데이터 값 | `orders.amount: number` |
| `axis_ref` | 행의 값이 축 entry 중 하나 | `members.role → role 축` |
| `table_ref` | 다른 테이블 행 참조 (FK) | `orders.member_id → members` |
| `prefix_ref` | 좌표 주소를 저장하는 컬럼 | `orgs.region_addr → service prefix` |

---

## 2. DEMO_CATALOG의 테이블 정의

```typescript
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

## 3. 양방향 연결 — 그래프 탐색

테이블 스키마와 prefix 정의를 합치면 **좌표 세계와 관계형 세계를 오가는 그래프**가 된다.

### 3.1 연결 유형

```
좌표 → 테이블:   prefix의 table_ref 차원      (이벤트 → 엔티티 타입)
테이블 → 좌표:   컬럼의 prefix_ref             (엔티티 → 좌표 주소)
테이블 → 축:     컬럼의 axis_ref               (엔티티 → 축 값)
테이블 → 테이블: 컬럼의 table_ref              (FK)
```

### 3.2 그래프 시각화

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

### 3.3 경로 탐색 예시: 이벤트 → 엔티티 → 좌표

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

## 4. 불변조건

1. **ColumnRef는 메타데이터다** — 런타임 데이터 검증이나 FK 제약을 강제하지 않는다
2. **그래프 순환이 허용된다** — prefix → table → table → prefix 경로가 존재할 수 있다 (order_event → orders → members → orgs → service prefix)

## 5. 소스 위치

| 파일 | 역할 |
|---|---|
| `packages/demo-snapshot/src/demo-catalog.ts` | DimRef, ColumnRef, TableSchema 타입 + DEMO_CATALOG.tables 정의 |
| `packages/demo-snapshot/src/event-schema.test.ts` | 인코딩 분리 증명 + 양방향 경로 탐색 증명 |

## 참조

- [table-dimref-types](table-dimref-types.spec.md) — DimRef 종류와 사용 규칙
- [table-accessor-api](table-accessor-api.spec.md) — accessor API에서의 table_ref 처리
- [schema-layer.md](../indexing/schema-layer.md) — 4-Layer 아키텍처에서 table_ref의 위치 (Layer 2)
