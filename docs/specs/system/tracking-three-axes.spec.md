---
def:
  id: tracking-three-axes
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural, entry-point]
  links:
    - target: meta-semantic-ir
      type: depends_on
    - target: meta-semantic-prefix-annotation
      type: depends_on
    - target: definition-taxonomy
      type: depends_on
---

# 추적 3축 체계 — 이벤트 × 패싯 × 데이터 분류

## 목적 ^purpose

시스템 관측의 3가지 직교 축을 정의한다. 같은 시스템을 다른 렌즈로 보는 것이며, 각각 독립적으로 수집되고 trace_id/session_id로 런타임에 연결된다.

## 정의 ^defines

- 축 1: 이벤트 (유저 시나리오 관점)
- 축 2: 패싯 (데이터 흐름 관점)
- 축 3: 데이터 분류 (비즈니스 vs UX — DefLayer로 표현)
- 3축의 독립성과 연결 지점

## 구성 ^overview

### 3축

| 축 | 관점 | 질문 | 정의 주체 | 수집 도구 |
|----|------|------|----------|----------|
| **이벤트** | 유저 시나리오 | "사용자가 무엇을 했는가" | 기획자/디자이너 | event-catalog, prefix-mapping, auto-track |
| **패싯** | 데이터 흐름 | "데이터가 어디서 어디로 가는가" | 개발자 | DataIR 4패싯, pipe-lineage, FieldLineage |
| **데이터 분류** | 존재 이유 | "이 데이터가 왜 있는가" | 기획+개발 | DefLayer (domain/experience/operation/mediation) |

### 각 축의 역할

**축 1: 이벤트** — 체크포인트와 트리거

```
사용자 행동 → event_key → prefix 차원 매핑 → 좌표 인코딩
  "cart.add" → cart_event prefix → address_context
  "payment.complete" → order_event prefix → 트리거
```

기획 문서의 유저 시나리오에서 파생. `event-catalog`의 카테고리(navigation, interaction, form, session, network, execution, outcome, quality, infrastructure)로 분류.

**축 2: 패싯** — 데이터 계보

```
데이터 정의(definition) → 관리(management) → 생산/소비(lifecycle) → 저장(storage)
  Order 스키마 → PaymentService가 관리 → CartService가 생산 → DB에 영구 저장
```

코드 구조에서 파생. `DataIR` 4패싯 + `FieldLineage`(필드별 변환 추적).

**축 3: 데이터 분류** — core vs UX

```
DefLayer = domain     → 비즈니스 필수 (삭제하면 시스템이 동작하지 않는 데이터)
DefLayer = experience → UX 편의 (삭제해도 핵심은 동작하지만 경험이 나빠지는 데이터)
DefLayer = operation  → 인프라 (로그, 캐시, 메트릭)
DefLayer = mediation  → 변환/중재 (API 응답 포맷, 검색 인덱스)
```

기획 단계에서 "이 데이터가 core인가 UX인가"를 결정하고, 스키마 정의 시 layer를 태깅.

---

## 독립성

3축은 서로 의존하지 않는다. 어떤 축을 제거해도 나머지가 동작한다.

| 제거 | 영향 |
|------|------|
| 이벤트 제거 | 유저 행동 추적 불가. 데이터 계보와 분류는 유지 |
| 패싯 제거 | 데이터 흐름 추적 불가. 이벤트와 분류는 유지 |
| 분류 제거 | core/UX 구분 불가. 이벤트와 계보는 유지 |

---

## 연결 지점

3축은 독립이지만, **런타임에서 연결**된다.

### trace_id / session_id

```
이벤트: cart.add (trace_id: T1, session_id: S1)
패싯:   Order.lifecycle.producedBy = CartService (trace_id: T1)
분류:   Order → layer: domain (core)

→ T1으로 묶으면: "세션 S1에서 사용자가 cart.add → CartService가 Order 생산 (core 데이터)"
```

### 시뮬레이션 / E2E

```
시뮬레이션:
  1. 이벤트 시나리오 정의 (cart.add → payment.complete)
  2. 패싯 검증 (Order가 정의→관리→생산→저장 4단계를 거치는가)
  3. 분류 확인 (core 데이터가 빠지지 않았는가)

E2E:
  1. 브라우저에서 유저 시나리오 실행
  2. ingest-server에서 이벤트 수집 (축 1)
  3. 서비스 간 데이터 흐름 추적 (축 2)
  4. 수집된 데이터의 layer 분포 확인 (축 3)
```

---

## DefLayer × 데이터 분류 매핑

| DefLayer | 숫자 | 데이터 성격 | 삭제 시 영향 | 예시 |
|----------|:----:|-----------|------------|------|
| `domain` | 0 | **core** — 비즈니스 필수 | 시스템 동작 불가 | 주문, 결제, 재고, 사용자 |
| `operation` | 1 | **infra** — 시스템 운영 | 성능 저하/관측 불가 | 로그, 캐시, 메트릭 |
| `mediation` | 2 | **bridge** — 변환/중재 | 외부 연동 불가 | API 응답 포맷, 검색 인덱스 |
| `experience` | 3 | **ux** — 유저 편의 | 경험 저하 | 최근 본 상품, 검색 히스토리, UI 상태 |

### 태깅 위치

| 위치 | 방법 |
|------|------|
| definition-catalog 문서 | `def.layer: domain` (frontmatter) |
| PrefixMeta | `meta.layer: 0` (카탈로그) |
| DataIR | `ModuleMeta.layer: "domain"` (IR) |
| 테이블 스키마 | 테이블 정의 시 layer 결정 (기획 단계) |

---

## 소스 코드

| 파일 | 축 | 역할 |
|------|:--:|------|
| `event-catalog/src/prefix-mapping.ts` | 1 | 이벤트 → prefix 차원 매핑 |
| `event-catalog/src/auto-track.ts` | 1 | event_key → 자동 인코딩 |
| `core/src/meta-semantic/ir-types.ts` | 2 | DataIR 4패싯 |
| `core/src/pipe/pipe-lineage.ts` | 2 | 필드별 계보 추적 |
| `core/src/pipe/data-contract.ts` | 2 | 스키마 호환 검증 |
| `definition-catalog/src/types.ts` | 3 | DefLayer 정의 |
| `definition-catalog/src/impact.ts` | 3 | layer별 영향 전파 규칙 |
