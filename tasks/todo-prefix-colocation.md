# TODO: Prefix Colocation — 선언 위치 기반 prefix 출처 관리

## 배경

현재: prefix 정의가 `DEMO_CATALOG` (demo-snapshot)에 중앙 집중.
문제: table 스키마, Enum, 이벤트 쿼리 등 **실제 개념이 정의되는 위치**와 prefix 선언이 분리되어 drift 발생.
목표: prefix 메타데이터를 소스 선언 위치에 colocate → codegen/정적분석으로 수집 → 카탈로그 자동 파생.

## 데이터 흐름 모델

```
┌─────────────────────────────────────────────────────┐
│  소스 선언 (colocation)                              │
│                                                      │
│  drizzle 스키마 .comment()  ──→  table_ref dim       │
│  Enum/const 선언 annotation  ──→  axis entries       │
│  쿼리 .comment()            ──→  event-catalog       │
│  트랜잭션 묶음              ──→  transition 단위     │
│                                    └→ event-catalog[] │
└──────────────────────┬──────────────────────────────┘
                       ↓ 수집 (codegen / static analysis)
              카탈로그 (DEMO_CATALOG — SSOT)
                       ↓ 파생
              DKG / 인코딩 / 서비스
```

### 소스별 기대 타겟

| 소스 | 기대 타겟 | 관계 |
|------|----------|------|
| drizzle 스키마 `.comment()` | `table_ref` dim | 스키마 = table_ref가 가리키는 실체 |
| Enum/const annotation | axis entries | Enum 멤버 = axis의 유한 값 목록 |
| 쿼리 `.comment()` | event-catalog 매핑 | 쿼리 = 이벤트 발생 지점 |
| 트랜잭션 경계 | transition 단위 | 트랜잭션 = 상태 전이의 원자 단위, event-catalog들이 하위 소속 |

## 원칙

- DEMO_CATALOG의 SSOT 지위 유지 — **입력 방식**이 수동→자동 파생으로 전환
- 기존 코드 하위 호환 — annotation 없는 스키마는 기존 중앙 선언 유지
- 점진적 전환 — 신규부터 colocation 사용

---

## Phase 1: Drizzle 스키마 → table_ref 출처 선언

스키마가 `table_ref` dim의 출처가 된다. prefix에서 `{ kind: "table_ref", table: "members" }`로 참조할 때, `members` 테이블 정의 자체에 "나는 이 prefix의 이 dim으로 참조된다"를 선언.

### 1-1. `.comment()` 기반 table_ref annotation 컨벤션

- [ ] drizzle table 정의에 `.comment()` 형식 설계: 이 테이블이 어떤 prefix의 어떤 dim에 table_ref로 참조되는지 명시
- [ ] 컨벤션 예시:

```ts
// members 테이블이 cart_event.actor dim의 table_ref 출처임을 선언
export const members = sqliteTable("members", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  // ...
}).comment({ table_ref: "cart_event.actor" });

// items 테이블이 cart_event.target dim의 table_ref 출처임을 선언
export const items = sqliteTable("items", {
  id: integer("id").primaryKey(),
  // ...
}).comment({ table_ref: "cart_event.target" });
```

- [ ] 다중 참조 시: `{ table_ref: ["cart_event.target", "order_event.item"] }` 배열 형식
- [ ] 역방향 검증: annotation ↔ DEMO_CATALOG table_ref dim 일치 확인

### 1-2. 기존 table_ref 매핑 조사

- [ ] DEMO_CATALOG에서 `kind: "table_ref"` 사용하는 prefix·dim 전수 조사
- [ ] 해당 table이 어떤 drizzle 스키마 파일에 정의되어 있는지 매핑
- [ ] annotation 대상 선정 (table_ref 관계가 이미 있는 것부터)

### 1-3. table_ref annotation extractor

- [ ] `extractTableRefAnnotations(schemaModule)` — `.comment()` 내 `table_ref` 키 추출
- [ ] 출력: `Array<{ table: string, prefixId: string, dimLabel: string }>`
- [ ] DEMO_CATALOG과 교차 검증: annotation 있지만 catalog에 없으면 warning, 반대도 warning

---

## Phase 2: Axis/Enum 선언 위치 colocation

### 2-1. axis entry 소스 annotation 컨벤션

- [ ] axis entries 정의 위치(상수, enum, config)에 annotation으로 axis 메타 부착

```ts
/** @axis cart_action @version v1 */
export const CART_ACTIONS = ["add", "remove", "update_qty", "clear"] as const;
```

### 2-2. enum → axis entry 파생 codegen

- [ ] annotation 달린 enum/const 수집 → axis entries 자동 파생
- [ ] capacity 자동 계산: `nextPowerOf2(entries.length * 2)`
- [ ] DEMO_CATALOG axes와 교차 검증 (drift 감지)

---

## Phase 3: 쿼리 이벤트 → event-catalog 연결

쿼리 `.comment()`는 prefix에 직접 연결되지 않고 **event-catalog**로 연결된다.
event-catalog가 prefix-mapping을 통해 prefix와 연결하는 기존 구조를 유지.

### 3-1. 쿼리 `.comment()` → event-catalog 매핑 컨벤션

- [ ] 쿼리 작성 시 event_key를 명시하여 event-catalog 이벤트로 선언

```ts
// 쿼리가 event-catalog의 "order.create" 이벤트임을 선언
db.insert(orders).values(data)
  .comment({ event_key: "order.create", domain: "commerce" });

// select 쿼리도 이벤트로 선언 가능
db.select().from(orders).where(eq(orders.id, id))
  .comment({ event_key: "order.read", domain: "commerce" });
```

- [ ] db-traffic-control drizzle-middleware가 `event_key` 태그를 `QueryMetricEvent.tags`에 포함
- [ ] event-catalog prefix-mapping에 해당 event_key 매핑 존재 여부 검증

### 3-2. 트랜잭션 → transition 단위 (event-catalog 하위 구성)

트랜잭션으로 묶인 쿼리들은 **하나의 transition**(상태 전이)을 구성하며, 
각 쿼리의 event-catalog 이벤트가 그 transition의 하위 구성원이 된다.

- [ ] 트랜잭션 경계 annotation 컨벤션 설계

```ts
// 트랜잭션 = transition 단위
await db.transaction(async (tx) => {
  // 이 트랜잭션 전체가 "order.complete" transition
  // 하위 event-catalog 이벤트들이 소속됨

  await tx.update(orders).set({ status: "completed" })
    .where(eq(orders.id, orderId))
    .comment({ event_key: "order.status_change", transition: "order.complete" });

  await tx.insert(payments).values(paymentData)
    .comment({ event_key: "payment.confirm", transition: "order.complete" });

  await tx.update(inventory).set({ qty: sql`qty - ${amount}` })
    .comment({ event_key: "inventory.decrement", transition: "order.complete" });
});
```

- [ ] transition 단위 구조 정의:

```ts
interface TransitionUnit {
  transitionId: string;           // "order.complete"
  events: string[];               // ["order.status_change", "payment.confirm", "inventory.decrement"]
  atomicity: "all_or_nothing";    // 트랜잭션 보장
}
```

- [ ] event-catalog에 transition → events 계층 구조 반영
- [ ] prefix-mapping에서 transition 단위로 이벤트 그룹 해석 가능하게 확장

### 3-3. 쿼리 event 수집 → event-catalog 교차 검증

- [ ] db-traffic-control metrics에서 `event_key` 태그 추출
- [ ] event-catalog prefix-mapping에 매핑 없으면 warning
- [ ] transition 내 event들이 event-catalog에 전부 등록되어 있는지 검증

---

## Phase 4: 수집 파이프라인 통합

### 4-1. prefix-source-collector (신규)

- [ ] Phase 1~3 수집기 통합 단일 진입점
- [ ] 입력: drizzle 스키마 (table_ref) + enum (axis) + 쿼리 메트릭 (event-catalog)
- [ ] 출력: `PrefixSourceMap` — prefixId별 출처 목록 (파일, 라인, 역할)

### 4-2. catalog codegen 통합

- [ ] colocated annotation 기반 catalog 자동 파생
- [ ] 기존 수동 DEMO_CATALOG entries와 자동 수집 entries 병합 전략
- [ ] 충돌 감지: 수동 선언 vs 자동 수집 불일치 시 warning

### 4-3. CLI 명령

- [ ] `qa-sdk prefix sources` — prefix별 소스 위치 조회
- [ ] `qa-sdk prefix drift` — 카탈로그 선언 vs 소스 annotation 불일치 리포트
- [ ] `qa-sdk prefix annotate <prefixId>` — 기존 prefix에 대한 annotation 코드 생성 제안

---

## 우선순위

| Phase | 가치 | 난이도 | 순서 |
|-------|------|--------|------|
| 1-1 table_ref annotation 컨벤션 | 높음 (기준점) | 낮음 | **1st** |
| 1-2 table_ref 매핑 조사 | 높음 (현황 파악) | 낮음 | **1st** |
| 3-1 쿼리 event_key 컨벤션 | 높음 (DX 즉시 개선) | 낮음 | **2nd** |
| 3-2 트랜잭션 transition 구조 | 높음 (원자성 표현) | 중간 | **2nd** |
| 1-3 extractor 유틸 | 중간 | 중간 | 3rd |
| 2-1 axis annotation 컨벤션 | 중간 | 낮음 | 3rd |
| 3-3 교차 검증 | 중간 | 중간 | 4th |
| 2-2 enum codegen | 중간 | 높음 | 5th |
| 4-* 통합 | 높음 (장기) | 높음 | 6th |

## 제약

- DEMO_CATALOG SSOT 불변 — colocation은 입력 경로 개선이지 SSOT 이동이 아님
- drizzle `.comment()` 형식은 Drizzle 1.0 beta에서 `Record<string, string>` 지원 확인 필요
- AST 분석 vs 런타임 introspection 중 결정 필요 (codegen-core 패턴 참고)
- event-catalog prefix-mapping 구조 확장 시 기존 매핑 하위 호환 유지
