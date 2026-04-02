# TODO: Prefix Colocation — 선언 위치 기반 prefix 출처 관리

## 배경

현재: prefix 정의가 `DEMO_CATALOG` (demo-snapshot)에 중앙 집중.
문제: table 스키마, Enum, 이벤트 쿼리 등 **실제 개념이 정의되는 위치**와 prefix 선언이 분리되어 drift 발생.
목표: prefix 메타데이터를 소스 선언 위치에 colocate → codegen/정적분석으로 수집 → 카탈로그 자동 파생.

## 데이터 흐름 모델

```
┌─────────────────────────────────────────────────────────────┐
│  소스 선언 (colocation)                                      │
│                                                              │
│  drizzle 스키마 .comment()  ──→  table_ref dim               │
│  Enum/const 선언 annotation  ──→  axis entries               │
│  쿼리 .comment()            ──→  event-catalog               │
│  트랜잭션/transition 선언   ──→  PipeSpec transition scope   │
│                                    └→ event-catalog[] 하위    │
└──────────────────────┬──────────────────────────────────────┘
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
| 트랜잭션/transition 선언 | PipeSpec transition scope | 원자 전이 = event-catalog들의 상위 구성 단위 |

## 원칙

- DEMO_CATALOG의 SSOT 지위 유지 — **입력 방식**이 수동→자동 파생으로 전환
- 기존 코드 하위 호환 — annotation 없는 스키마는 기존 중앙 선언 유지
- 점진적 전환 — 신규부터 colocation 사용

---

## Phase 1: Drizzle 스키마 → table_ref 출처 선언

스키마가 `table_ref` dim의 출처가 된다. prefix에서 `{ kind: "table_ref", table: "members" }`로 참조할 때, `members` 테이블 정의 자체에 "나는 이 prefix의 이 dim으로 참조된다"를 선언.

### 1-1. `.comment()` 기반 table_ref annotation 컨벤션

- [ ] drizzle table 정의에 `.comment()` 형식 설계: 이 테이블이 어떤 prefix의 어떤 dim에 table_ref로 참조되는지 명시

```ts
// members 테이블이 cart_event.actor dim의 table_ref 출처임을 선언
export const members = sqliteTable("members", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
}).comment({ table_ref: "cart_event.actor" });

// 다중 참조
export const items = sqliteTable("items", {
  id: integer("id").primaryKey(),
}).comment({ table_ref: ["cart_event.target", "order_event.item"] });
```

- [ ] 역방향 검증: annotation ↔ DEMO_CATALOG table_ref dim 일치 확인

### 1-2. 기존 table_ref 매핑 조사

- [ ] DEMO_CATALOG에서 `kind: "table_ref"` 사용하는 prefix·dim 전수 조사
- [ ] 해당 table이 어떤 drizzle 스키마 파일에 정의되어 있는지 매핑
- [ ] annotation 우선 대상 선정 (table_ref 관계가 이미 있는 것부터)

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
db.insert(orders).values(data)
  .comment({ event_key: "order.create", domain: "commerce" });
```

- [ ] db-traffic-control drizzle-middleware가 `event_key` 태그를 `QueryMetricEvent.tags`에 포함
- [ ] event-catalog prefix-mapping에 해당 event_key 매핑 존재 여부 검증

### 3-2. 쿼리 event 수집 → event-catalog 교차 검증

- [ ] db-traffic-control metrics에서 `event_key` 태그 추출
- [ ] event-catalog prefix-mapping에 매핑 없으면 warning
- [ ] transition scope 내 event들이 event-catalog에 전부 등록되어 있는지 검증

---

## Phase 4: Transition 선언 시스템 — 제어 흐름 내 1급 전이 표현

### 동기

transition은 트레이싱/로깅의 부산물이 아니라 **설계 시점의 1급 선언**이어야 한다.

- DB 레벨: 트랜잭션 = 원자적 상태 변경의 경계
- 서비스 레벨: saga/choreography = 분산 상태 전이의 경계
- 두 경우 모두 "이 묶음이 하나의 전이다"를 **설계 시점에 명시적으로 선언**해야 함
- 런타임 트레이싱은 이 선언의 관측일 뿐, 선언 자체는 아님

### 기존 구조와의 관계

현재 시스템에 transition 관련 개념이 이미 있지만 파편화됨:

| 위치 | 표현 | 한계 |
|------|------|------|
| `PathSegment.transition` | `EventTransition { eventKey, prefixId? }` | 좌표 레벨 전이만. 이벤트 그룹핑 없음 |
| `BranchRoute.transition` | 축 값 조건별 분기 전이 | 단일 이벤트 대상만 |
| `PipeEmit` | `{ kind: "emit", eventKey }` | 단발 이벤트 발행. 전이 경계 표현 없음 |
| `PipeCompensate` | forward + compensate flow | 보상 로직은 있지만 "전이 단위" 선언 없음 |
| `db.transaction()` | 런타임 트랜잭션 | 코드에만 존재, 설계 선언 없음 |

**빠진 것**: "이 구간이 하나의 transition이다"라는 **1급 선언 + 하위 이벤트 소속 관계**.

### 4-1. PipeTransitionScope 타입 도입

PipeSpec 제어 흐름 안에서 transition 경계를 명시적으로 선언하는 새 flow kind.

- [ ] `PipeTransitionScope` 인터페이스 설계:

```ts
interface PipeTransitionScope {
  kind: "transition-scope";
  /** 전이 식별자 — event-catalog의 transition 단위와 1:1 */
  transitionId: string;
  /** 전이 본체 — 내부 flow가 원자적으로 실행됨 */
  body: PipeFlow;
  /** 이 전이가 발행하는 이벤트 목록 (body 내 emit들의 상위 그룹) */
  events: string[];
  /** 보상 로직 (선택) — 실패 시 rollback */
  compensate?: PipeFlow;
  /** 전이 완료 시 후속 이벤트 (PathSegment.transition과 동일 의미) */
  onComplete?: EventTransition;
}
```

- [ ] 기존 `PipeCompensate`와의 관계: transition-scope는 compensate를 포함할 수 있는 상위 개념
- [ ] 기존 `PipeEmit`과의 관계: scope 내부의 emit들은 자동으로 transition의 하위 이벤트로 소속

### 4-2. transition-scope ↔ event-catalog 연결

- [ ] event-catalog에 `TransitionDef` 추가:

```ts
interface TransitionDef {
  transitionId: string;
  /** 이 transition에 소속된 event_key 목록 */
  events: string[];
  /** 원자성 보장 수준 */
  atomicity: "db-transaction" | "saga" | "best-effort";
  /** 관련 prefix (PathSegment.transition과 동일) */
  prefixId?: string;
}
```

- [ ] PipeTransitionScope.events ↔ TransitionDef.events 교차 검증
- [ ] 쿼리 `.comment({ event_key, transition })` 의 transition 값이 TransitionDef에 존재하는지 검증

### 4-3. transition-scope ↔ PathSegment.transition 브릿지

- [ ] `PathSegment.transition`은 좌표 레벨 (주소 → 이벤트), `PipeTransitionScope`는 제어 흐름 레벨 (실행 경계 → 이벤트 그룹)
- [ ] 같은 `transitionId`를 공유하여 양쪽을 연결
- [ ] 검증: PipeSpec에 transition-scope가 있으면, 해당 prefix의 PathSegment에도 대응하는 transition이 있는지 확인

### 4-4. DB 트랜잭션 → transition-scope 연결

- [ ] 코드 레벨 `db.transaction()` 안의 `.comment({ transition })` 태그가 PipeTransitionScope.transitionId와 일치해야 함
- [ ] 정적 분석 또는 런타임 검증으로 코드 트랜잭션 ↔ 설계 transition 매핑 확인

### 4-5. 서비스 간 분산 transition

- [ ] 마이크로서비스 간 saga 패턴에서도 transition-scope 사용 가능
- [ ] `atomicity: "saga"` — 각 서비스의 PipeTransitionScope가 saga의 한 step
- [ ] saga coordinator가 여러 transition-scope를 순서대로 실행, 실패 시 compensate chain

---

## Phase 5: 수집 파이프라인 통합

### 5-1. prefix-source-collector (신규)

- [ ] Phase 1~4 수집기 통합 단일 진입점
- [ ] 입력: drizzle 스키마 (table_ref) + enum (axis) + 쿼리 메트릭 (event-catalog) + PipeSpec (transition)
- [ ] 출력: `PrefixSourceMap` — prefixId별 출처 목록 (파일, 라인, 역할)

### 5-2. catalog codegen 통합

- [ ] colocated annotation 기반 catalog 자동 파생
- [ ] 기존 수동 DEMO_CATALOG entries와 자동 수집 entries 병합 전략
- [ ] 충돌 감지: 수동 선언 vs 자동 수집 불일치 시 warning

### 5-3. CLI 명령

- [ ] `qa-sdk prefix sources` — prefix별 소스 위치 조회
- [ ] `qa-sdk prefix drift` — 카탈로그 선언 vs 소스 annotation 불일치 리포트
- [ ] `qa-sdk transition list` — 선언된 transition 목록 + 소속 이벤트 조회
- [ ] `qa-sdk transition validate` — transition 선언 ↔ 코드 트랜잭션 ↔ event-catalog 정합성 검증

---

## 우선순위

| Phase | 가치 | 난이도 | 순서 |
|-------|------|--------|------|
| 1-1 table_ref annotation 컨벤션 | 높음 (기준점) | 낮음 | **1st** |
| 1-2 table_ref 매핑 조사 | 높음 (현황 파악) | 낮음 | **1st** |
| 3-1 쿼리 event_key 컨벤션 | 높음 (DX 즉시 개선) | 낮음 | **2nd** |
| 4-1 PipeTransitionScope 타입 | 높음 (핵심 추상) | 중간 | **2nd** |
| 4-2 transition ↔ event-catalog | 높음 (연결 완성) | 중간 | **3rd** |
| 1-3 extractor 유틸 | 중간 | 중간 | 3rd |
| 2-1 axis annotation 컨벤션 | 중간 | 낮음 | 4th |
| 4-3 PathSegment 브릿지 | 중간 (일관성) | 중간 | 4th |
| 3-2 교차 검증 | 중간 | 중간 | 5th |
| 4-4 DB 트랜잭션 연결 | 중간 | 높음 | 5th |
| 2-2 enum codegen | 중간 | 높음 | 6th |
| 4-5 분산 transition | 낮음 (장기) | 높음 | 7th |
| 5-* 통합 | 높음 (장기) | 높음 | 8th |

## 제약

- DEMO_CATALOG SSOT 불변 — colocation은 입력 경로 개선이지 SSOT 이동이 아님
- drizzle `.comment()` 형식은 Drizzle 1.0 beta에서 `Record<string, string>` 지원 확인 필요
- AST 분석 vs 런타임 introspection 중 결정 필요 (codegen-core 패턴 참고)
- event-catalog prefix-mapping 구조 확장 시 기존 매핑 하위 호환 유지
- PipeTransitionScope는 기존 29종 flow kind에 추가 — pipe-flow-catalog 30번째 또는 메타 flow kind로 분류 결정 필요
