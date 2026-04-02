# TODO: Prefix Colocation — 선언 위치 기반 prefix 출처 관리

## 배경

현재: prefix 정의가 `DEMO_CATALOG` (demo-snapshot)에 중앙 집중.
문제: table 스키마, Enum, 이벤트 쿼리 등 **실제 개념이 정의되는 위치**와 prefix 선언이 분리되어 drift 발생.
목표: prefix 메타데이터를 소스 선언 위치에 colocate → codegen/정적분석으로 수집 → 카탈로그 자동 파생.

```
소스 선언 (.comment / JSDoc / annotation)
  ↓ 수집 (codegen / static analysis)
카탈로그 (DEMO_CATALOG — 여전히 SSOT, 자동 생성)
  ↓ 파생
DKG / 인코딩 / 서비스
```

## 원칙

- DEMO_CATALOG의 SSOT 지위 유지 — 다만 **입력 방식**이 수동→자동 파생으로 전환
- 기존 코드 하위 호환 — colocate annotation이 없는 스키마는 기존 중앙 선언 유지
- 점진적 전환 — 한번에 전부 옮기지 않음, 신규부터 colocation 사용

---

## Phase 1: Drizzle 스키마 → prefix 연결

### 1-1. `.comment()` 기반 prefix annotation 컨벤션 정의

- [ ] drizzle `sqliteTable` 정의에 `.comment({ prefix: "<prefixId>", dims: {...} })` 형식 컨벤션 설계
- [ ] table_ref dim이 참조하는 실제 drizzle table에 역방향 annotation 추가
- [ ] 예시: `members` table → `{ prefix: "cart_event", dim: "actor", role: "table_ref" }`

```ts
// 예시 — definition-service/src/db/schema.ts
export const prefixRegistry = sqliteTable("prefix_registry", {
  prefixId: text("prefix_id").primaryKey(),
  // ...
}).comment({ prefix: "def_document", role: "registry" });
```

### 1-2. 기존 17개 drizzle 스키마 → prefix 매핑 조사

- [ ] 각 스키마 파일이 어떤 prefix와 관련되는지 매핑 테이블 작성
- [ ] table_ref dim 사용하는 prefix 4종 확인 (cart_event.actor→members, cart_event.target→items 등)
- [ ] annotation 우선 대상 선정 (table_ref 관계가 있는 것부터)

### 1-3. prefix annotation extractor 유틸

- [ ] `extractPrefixAnnotations(schemaModule)` — drizzle 스키마 파일에서 `.comment()` 내 prefix 메타 추출
- [ ] AST 기반 또는 런타임 introspection 방식 결정
- [ ] 출력: `Array<{ table: string, prefixId: string, dimLabel?: string, role: string }>`

---

## Phase 2: Axis/Enum 선언 위치 colocation

### 2-1. axis entry 소스 annotation 컨벤션

- [ ] axis entries를 정의하는 위치(상수, enum, config)에 JSDoc 또는 데코레이터로 prefix/axis 메타 부착
- [ ] 예시: 서비스별 환경변수 enum → `@axis("env")` 또는 `/** @axis env */`

```ts
// 예시 — 서비스 코드에서
/** @axis cart_action @version v1 */
export const CART_ACTIONS = ["add", "remove", "update_qty", "clear"] as const;
```

### 2-2. enum → axis entry 파생 codegen

- [ ] annotation 달린 enum/const 선언 수집 → axis entries 자동 파생
- [ ] capacity 자동 계산: `nextPowerOf2(entries.length * 2)`
- [ ] 기존 DEMO_CATALOG axes와 교차 검증 (drift 감지)

---

## Phase 3: 쿼리 이벤트 → prefix 연결 (db-traffic-control)

### 3-1. 쿼리 `.comment()` prefix tag 컨벤션

- [ ] 쿼리 작성 시 `.comment({ prefix: "order_event", action: "create" })` 형식으로 prefix 의도 명시
- [ ] db-traffic-control drizzle-middleware가 이 태그를 수집하여 `QueryMetricEvent.tags`에 포함
- [ ] `TrafficMetricsCollector`가 prefix 태그 있는 이벤트를 별도 집계

### 3-2. 쿼리 prefix 수집 → event-catalog 브릿지

- [ ] db-traffic-control metrics에서 prefix 태그 추출 → event-catalog prefix-mapping과 교차 검증
- [ ] 쿼리에 prefix 태그가 있지만 event-catalog에 매핑 없으면 warning
- [ ] 자동 매핑 제안: 쿼리 패턴(table + operation) → prefix 후보 추천

---

## Phase 4: 수집 파이프라인 통합

### 4-1. prefix-source-collector 유틸 (신규)

- [ ] Phase 1~3의 수집기를 통합하는 단일 진입점
- [ ] 입력: drizzle 스키마 + enum 선언 + 쿼리 메트릭
- [ ] 출력: `PrefixSourceMap` — prefixId별 출처 목록 (파일, 라인, 역할)

### 4-2. catalog codegen 통합

- [ ] `generateCatalogTypes()` 확장 — colocated annotation 기반 catalog 자동 생성
- [ ] 기존 수동 DEMO_CATALOG entries와 자동 수집 entries 병합 전략
- [ ] 충돌 감지: 수동 선언 vs 자동 수집이 다를 때 warning

### 4-3. CLI 명령

- [ ] `qa-sdk prefix sources` — prefix별 소스 위치 조회
- [ ] `qa-sdk prefix drift` — 카탈로그 선언 vs 소스 annotation 불일치 리포트
- [ ] `qa-sdk prefix annotate <prefixId>` — 기존 prefix에 대한 annotation 코드 생성 제안

---

## 우선순위

| Phase | 가치 | 난이도 | 순서 |
|-------|------|--------|------|
| 1-1 컨벤션 정의 | 높음 (기준점) | 낮음 | **1st** |
| 1-2 매핑 조사 | 높음 (현황 파악) | 낮음 | **1st** |
| 3-1 쿼리 comment 컨벤션 | 높음 (DX 즉시 개선) | 낮음 | **2nd** |
| 1-3 extractor 유틸 | 중간 | 중간 | 3rd |
| 2-1 axis annotation 컨벤션 | 중간 | 낮음 | 3rd |
| 3-2 event-catalog 브릿지 | 중간 | 중간 | 4th |
| 2-2 enum codegen | 중간 | 높음 | 5th |
| 4-* 통합 | 높음 (장기) | 높음 | 6th |

## 제약

- DEMO_CATALOG SSOT 불변 — colocation은 입력 경로 개선이지 SSOT 이동이 아님
- drizzle `.comment()` 형식은 Drizzle 1.0 beta에서 `Record<string, string>` 지원 확인 필요
- AST 분석 vs 런타임 introspection 중 결정 필요 (codegen-core 패턴 참고)
