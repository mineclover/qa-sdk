---
def:
  tier: component
  id: event-schema-spec
  address: def_document:v2:342177
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, contract]
  links:
    - target: coord-states-group
      type: depends_on
    - target: behavior-traversal-group
      type: depends_on
    - target: ontology-eval
      type: depends_on
---

# 이벤트 스키마 — 관계 정의로서의 이벤트

## 목적 ^purpose

이벤트 스키마는 온톨로지의 관계 정의와 같은 개념이다.
"누가(subject) 무엇을(predicate) 어디에(object) 했다"를 타입으로 선언한다.
prefix가 이 관계의 **고정된 구조**를 정의하고, table_ref가 **동적 엔티티 타입**을 연결한다.

**참고**: 이 문서의 내용은 좌표 결정 CORE가 아니라 PERIPHERAL 확장이다.
CORE(축 값 조합 → 유일한 정수)는 [coord-states-group.md](coord-states-group.md)에서 정의한다.
table_ref와 이벤트 패턴은 CORE 위에 구축되는 응용 계층이다.

## 구성 ^overview

- **이벤트 = 온톨로지 관계**: 이벤트를 (subject, predicate, object) 트리플, 즉 "누가(actor) 무엇을(action) 어디에(target) 했다"로 타입 선언하는 구조를 정의한다.
- **3-slot 구조**: 모든 이벤트는 actor(table_ref, 주체), action(axis, 행위), target(table_ref, 대상)의 3개 슬롯으로 구성된다.
- **인코딩 분리 원칙**: axis와 prefix_ref는 좌표에 인코딩하고, table_ref(actor_id, target_id)는 좌표 밖 런타임 데이터(refs)로 분리하여 좌표 공간을 유한하게 유지한다.
- **이벤트 패턴 확장**: 단항(actor만), 다항(target 여러 타입), 컨텍스트(prefix_ref 바인딩) 등 다양한 이벤트 구조를 동일한 prefix 체계로 표현한다.
- **EventInstance 인터페이스**: event_type(prefix ID), address(고정 차원 좌표), refs(타입 차원 런타임 ID), timestamp, context_id로 구성된 이벤트 인스턴스 구조를 명세한다.
- **관계 유형 분류**: 행위(action), 소유(ownership), 포함(containment), 상태 전이(transition) 등 모든 관계를 동일한 3-slot 구조로 표현할 수 있다.
- **책임 경계**: 이벤트 타입 정의와 인코딩 분리 규칙만 담당하며, 인스턴스 기록·관계 정의·상태 추적·제약·수집은 상위 계층의 책임이다.


---


## 참조

기반: [coord-states-group.md](coord-states-group.md) · [behavior-traversal-group.md](behavior-traversal-group.md) · [ontology-evaluation.md](ontology-evaluation.md)

## 이벤트 = 타입이 있는 관계

온톨로지에서 관계는 (subject, predicate, object) 트리플이다.
이벤트도 같은 구조다:

```
온톨로지 트리플:    (Member,  purchases,  Item)
이벤트:            (actor,   action,     target)

둘 다 "누가 무엇을 어디에 했다"의 타입 선언.
```

이미 좌표 타입 시스템에 이 구조가 있다:

```
relational prefix (기존):
  subjectKind × predicate × objectKind
  [user|role|group] × [has|can_access|belongs_to] × [role|permission|group|resource]
```

이벤트 스키마는 이 relational prefix를 **table_ref와 action axis로 확장**한 것이다.

---

## 이벤트 스키마의 3-slot 구조

모든 이벤트는 3개의 slot으로 정의된다:

```
Event = (actor, action, target)
         │       │       │
         │       │       └── 대상. 행위를 받는 엔티티 타입.
         │       └────────── 행위. 고정된 경우의 수 (axis).
         └────────────────── 주체. 행위를 수행하는 엔티티 타입.
```

| Slot | 참조 방식 | 고정/동적 | 예시 |
|---|---|---|---|
| **actor** | `table_ref` | 타입 고정, 인스턴스 동적 | member (타입) → member:42 (런타임) |
| **action** | `axis` | 고정 | add, remove, checkout |
| **target** | `table_ref` | 타입 고정, 인스턴스 동적 | item (타입) → item:1 (런타임) |

### 온톨로지 대응

| 이벤트 스키마 | RDF/OWL | 좌표 타입 시스템 |
|---|---|---|
| actor (타입) | rdfs:domain | table_ref → 테이블 |
| action | rdf:Property | axis → 고정 enum |
| target (타입) | rdfs:range | table_ref → 테이블 |
| 이벤트 정의 | Property 선언 (domain + predicate + range) | prefix 정의 |
| 이벤트 인스턴스 | Triple (s, p, o) | 런타임 데이터 (actor_id, action, target_id) |

---

## prefix로 이벤트 타입 정의

### 기본 형태

```typescript
// 이벤트 타입 = prefix
cart_event: {
  labels: ["actor", "action", "target"],
  dims: {
    actor:  { kind: "table_ref", table: "members" },
    action: { kind: "axis", axisId: "cart_action" },   // [add, remove, checkout]
    target: { kind: "table_ref", table: "items" },
  }
}
```

이 prefix가 선언하는 것: **"member 타입이 cart_action을 item 타입에 수행한다"**

### 이벤트 인스턴스 (런타임)

```typescript
// 이벤트 발생 시 기록
{
  event_type: "cart_event",           // prefix 참조
  action: "add",                      // axis position → 고정
  actor_id: 42,                       // members 테이블의 행 → 동적
  target_id: 1,                       // items 테이블의 행 → 동적
  timestamp: 1711000000000,
}
```

prefix의 좌표 주소는 **action만 인코딩**. actor_id와 target_id는 좌표 밖의 런타임 데이터.

---

## 확장: 다양한 이벤트 패턴

### 단항 이벤트 (actor만)

```typescript
// "회원이 로그인했다"
auth_event: {
  labels: ["actor", "action"],
  dims: {
    actor:  { kind: "table_ref", table: "members" },
    action: { kind: "axis", axisId: "auth_action" },   // [login, logout, token_refresh]
  }
}
```

target 없음. "누가 무엇을 했다" (자동사).

### 다항 이벤트 (target이 여러 타입)

```typescript
// "관리자가 주문의 결제를 취소했다"
payment_cancel_event: {
  labels: ["actor", "action", "order", "payment"],
  dims: {
    actor:   { kind: "table_ref", table: "members" },
    action:  { kind: "axis", axisId: "payment_action" },  // [cancel, refund, retry]
    order:   { kind: "table_ref", table: "orders" },
    payment: { kind: "table_ref", table: "payments" },
  }
}
```

관련 엔티티가 여러 개. 온톨로지의 N-ary relation과 동일.

### 컨텍스트가 있는 이벤트 (prefix_ref)

```typescript
// "특정 서비스 환경에서 설정을 변경했다"
config_change_event: {
  labels: ["service_ctx", "actor", "action"],
  dims: {
    service_ctx: { kind: "prefix_ref", prefixId: "service" },  // 어떤 서비스 환경인지
    actor:       { kind: "table_ref", table: "members" },
    action:      { kind: "axis", axisId: "config_action" },    // [create, update, delete, rollback]
  }
}
```

`prefix_ref`로 인프라 좌표(service prefix)를 이벤트에 바인딩. service_ctx는 좌표 주소에 인코딩된다.

---

## 이벤트 인스턴스의 구조

```typescript
interface EventInstance {
  // prefix 참조 (이벤트 타입)
  event_type: string;            // prefix ID

  // 고정 차원 (좌표 인코딩)
  address: number;               // axis + prefix_ref 차원만 인코딩된 좌표 주소

  // 타입 차원 (런타임 데이터)
  refs: Record<string, unknown>; // table_ref 차원의 실제 인스턴스 ID
  // ex: { actor: 42, target: 1 }

  // 메타
  timestamp: number;
  context_id?: string;           // trace/request 단위
}
```

### 인코딩 분리 원칙

```
좌표에 인코딩되는 것 (고정 차원):
  axis:        action position
  prefix_ref:  service address

좌표에 인코딩되지 않는 것 (타입 차원):
  table_ref:   actor_id, target_id → refs에 별도 저장
```

이 분리 덕분에:
- 좌표 공간은 유한하게 유지 (action 3가지 × service 100개 = 300 좌표)
- 동적 데이터는 무한히 참조 가능 (member 수백만, item 수백만)
- 같은 좌표 주소 + 다른 refs = "같은 종류의 이벤트, 다른 대상"

---

## 관계 유형 분류

이벤트가 관계 정의라면, 관계의 유형을 분류할 수 있다:

| 관계 유형 | 구조 | 예시 |
|---|---|---|
| **행위** (action) | actor → action → target | "회원이 상품을 장바구니에 넣다" |
| **소유** (ownership) | owner → has → resource | "회원이 장바구니를 소유한다" |
| **포함** (containment) | container → contains → item | "장바구니가 상품을 포함한다" |
| **상태 전이** (transition) | entity → becomes → state | "주문이 결제완료 상태가 되다" |

모두 같은 3-slot 구조 `(subject, predicate, object)`로 표현 가능. action axis의 entries가 관계 유형을 결정.

---

## QA 시스템과의 연결

이벤트 스키마가 정의되면 QA 시스템이 수집해야 할 것이 명확해진다:

```
QA 시스템이 수집하는 것:
  1. 어떤 이벤트 타입이 발생했는가 (prefix → event_type)
  2. 어떤 행위인가 (axis → action position → 좌표 주소)
  3. 누가 했는가 (table_ref → actor_id)
  4. 무엇에 대해 했는가 (table_ref → target_id)
  5. 언제 (timestamp)
  6. 어떤 맥락에서 (context_id)
```

이 수집 데이터가 쌓이면 behavioral-traversal의 경로 추적이 가능해진다:

```
cart_event(add, member:42, item:1)     → 장바구니에 넣음
  ↓ causal
order_event(create, member:42, cart:7) → 주문 생성
  ↓ causal
payment_event(pay, member:42, order:8) → 결제
```

---

## 이 문서의 책임 경계

이 문서(이벤트 스키마)는 **타입 계층**에 속한다. 이벤트의 **구조(타입)**를 정의하는 것이 책임이며, 이벤트의 발생/기록/연결/상태 관리는 상위 계층의 책임이다.

| 이 문서가 하는 것 | 이 문서가 하지 않는 것 |
|---|---|
| 이벤트 타입 정의 (prefix + axis + table_ref) | 이벤트 인스턴스 기록 (→ 인스턴스 계층) |
| action 어휘 고정 (axis entries) | 이벤트 간 관계 정의 (→ 관계 계층) |
| actor/target 타입 선언 (table_ref) | 이벤트 전/후 상태 추적 (→ 상태 계층) |
| 인코딩 분리 규칙 (고정 차원 vs 타입 차원) | 허용/금지 규칙 (→ 제약 계층) |
| | 런타임 이벤트 수집 (→ 수집 계층 / QA 시스템) |

## 완료/미완성 현황

| 항목 | 상태 | 비고 |
|---|---|---|
| DimRef에 `table_ref` 추가 | ✅ 구현 완료 | `demo-catalog.ts` |
| 이벤트 prefix 정의 (cart_event, auth_event, order_event) | ✅ 구현 완료 | `demo-catalog.ts` |
| table_ref가 shape/encode/decode에서 제외 | ✅ 구현 완료 | `demo-accessors.ts` |
| 인코딩 분리 증명 (테스트) | ✅ 62 tests pass | `event-schema.test.ts` |
| EventInstance 정식 타입 | ○ 미구현 | 인스턴스 계층 |
| Edge/Relation 타입 | ○ 미구현 | 관계 계층 |
| State before/after | ○ 미구현 | 상태 계층 |
| Constraint/Policy | ○ 미구현 | 제약 계층 |
| QA 수집기 | ○ 미구현 | 수집 계층 |
