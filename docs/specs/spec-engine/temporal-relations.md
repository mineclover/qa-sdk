---
def:
  id: temporal-relations
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: deprecated
  tags: [tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
---

# Temporal Relations — 시간 순서와 데이터 흐름 수집

## 목적 ^purpose

현재 co-occurrence는 "같은 EventRecord에 함께 나타남"만 감지한다.
시간 순서("A 후에 B")와 데이터 흐름("A의 출력이 B의 입력")은 수집하지 않는다.
이 문서는 이 두 가지 관계를 어떻게 수집하고 분석할지 정의한다.

기반: [convergence-layer.md](convergence-layer.md) · [prefix-guide.md](prefix-guide.md)

---

## 현재 수집하는 것과 못하는 것

| 관계 유형 | 현재 | 예시 |
|---|---|---|
| **co-occurrence** | ✅ 수집 중 | "endpoint와 flow_point가 같은 레코드에 나타남" |
| **시간 순서** | ❌ 미수집 | "page_view 후에 endpoint가 호출됨" (선후 관계) |
| **데이터 흐름** | ❌ 미수집 | "endpoint의 주소가 flow_point로 이어짐" (입출력 연결) |
| **인과 방향** | ❌ 미수집 | "login → token_refresh" (원인 → 결과) |

---

## 시간 순서 수집

### 데이터 모델

```typescript
/** 시간 순서 관계 — trace 내에서 A 후에 B가 발생 */
interface TemporalSequence {
  /** 선행 이벤트의 prefix:version:address */
  readonly before: { prefix: string; address: string };
  /** 후행 이벤트의 prefix:version:address */
  readonly after: { prefix: string; address: string };
  /** 시간 차이 (ms) */
  readonly deltaMs: number;
  /** 관측 횟수 */
  readonly count: number;
  /** 이 순서가 발생한 trace ID 샘플 */
  readonly sampleTraces: readonly string[];
}
```

### 수집 방법

```
현재 AddressContextRecord에는 timestamp + trace_id가 있다.

같은 trace_id를 가진 레코드들을 시간순 정렬하면:
  trace-001:
    T=0ms   page_view:v1:3073  (checkout 화면 진입)
    T=200ms endpoint:v1:32     (POST api 호출)
    T=350ms flow_point:v1:3168 (checkout success)

이 순서에서:
  page_view → endpoint (delta=200ms)
  endpoint → flow_point (delta=150ms)
  page_view → flow_point (delta=350ms)

이것들이 TemporalSequence가 된다.
```

### 집계

```typescript
/** trace 단위로 시간 순서를 추출 */
function extractTemporalSequences(
  records: readonly AddressContextRecord[],
): TemporalSequence[];

/** 집계: 같은 before→after 쌍의 count를 합산 */
function aggregateSequences(
  sequences: readonly TemporalSequence[],
): TemporalSequence[];
```

### 분석

```
시간 순서에서 발견할 수 있는 것:

1. 표준 흐름 패턴
   page_view → endpoint → flow_point (90%의 trace에서 이 순서)
   → FlowDefinition과 비교하여 "실제 흐름이 정의와 일치하는가" 검증

2. 비정상 순서
   flow_point(success) → endpoint (성공 후에 API 호출?)
   → IntentLink invariant 위반 후보

3. 지연 감지
   endpoint → flow_point의 평균 delta가 300ms인데 갑자기 5000ms
   → 성능 저하 관측
```

---

## 데이터 흐름 수집

### 데이터 모델

```typescript
/** 데이터 흐름 — A의 주소가 B의 차원으로 사용됨 */
interface DataFlow {
  /** 생산자 prefix */
  readonly producer: { prefix: string; version: string };
  /** 소비자 prefix (producer의 주소를 dims로 참조) */
  readonly consumer: { prefix: string; version: string; dimLabel: string };
  /** 관측 횟수 */
  readonly count: number;
}
```

### 수집 방법

```
데이터 흐름은 prefix_ref 구조에서 이미 정적으로 정의되어 있다:

  endpoint.svc_ref → service  (service의 주소가 endpoint의 차원)
  permission.perm_svc → service
  flow_point.svc_ref → service

하지만 런타임에서 "실제로 어떤 service 주소가 endpoint에 들어갔는가"는
address_context를 분석해야 안다:

  같은 레코드에:
    service: service:v1:65536
    endpoint: endpoint:v1:32

  endpoint의 svc_ref 차원에 65536이 들어있으면 → 데이터 흐름 확인
  → service → endpoint 흐름 1회 관측
```

### 정적 vs 동적

```
정적 데이터 흐름 (DKG references 엣지):
  → DEMO_CATALOG의 prefix_ref 구조에서 파생
  → "endpoint는 service를 참조하도록 설계됨"
  → 이건 이미 있다

동적 데이터 흐름 (런타임 수집):
  → "실제로 service:v1:65536이 endpoint:v1:32에 들어감"
  → 이건 address_context 분석으로 수집해야 함
  → 정적 흐름과 동적 흐름을 비교하면:
    "설계된 흐름과 실제 흐름이 일치하는가?"
```

---

## FlowDefinition과의 연결

```
FlowDefinition:
  entry: page_view:v1:3073
  branches:
    success: flow_point:v1:3168
    failure: flow_point:v1:3200

TemporalSequence로 검증:
  page_view:3073 → flow_point:3168 (count=450, avg delta=400ms)
  page_view:3073 → flow_point:3200 (count=50, avg delta=350ms)
  → 정의된 success/failure 경로가 실제로 관측됨 ✅

  page_view:3073 → flow_point:UNKNOWN (count=5)
  → 정의에 없는 경로 → anomaly 후보 ⚠
```

---

## 구현 우선순위

```
Phase 1 (다음 구현):
  · trace_id 기반 시간 순서 추출 — extractTemporalSequences
  · FlowDefinition 검증 — 정의된 순서와 실제 순서 비교

Phase 2 (이후):
  · 데이터 흐름 동적 수집 — address_context 내 prefix_ref 값 추적
  · 지연 분석 — deltaMs 통계
  · anomaly 감지 — 정의에 없는 경로 자동 감지

Phase 3 (확장):
  · 시간 순서를 DKG 엣지로 추가 ("follows" 엣지)
  · TemporalSequence → IntentLink 자동 제안
```

---

## 수집 인프라 요구사항

```
현재 AddressContextRecord에 이미 있는 것:
  ✅ timestamp — 시간 순서의 기준
  ✅ trace_id — 같은 요청/흐름의 이벤트를 묶는 식별자
  ✅ session_id — 사용자/서비스 세션
  ✅ address_context — prefix 주소

추가 필요한 것:
  · trace 내 이벤트 정렬 — timestamp로 정렬 가능 (이미 있음)
  · trace 완결성 판단 — "이 trace의 모든 이벤트를 수집했는가"
    → ingest-server에서 trace 완결 기준 정의 필요
    → span의 start/end로 판단 가능 (EventRecord.record_kind === "span")
```

---

## 불변식

1. **TemporalSequence는 같은 trace 내에서만 생성된다.** 다른 trace의 이벤트를 시간순으로 연결하지 않는다.
2. **DataFlow는 prefix_ref 구조를 따른다.** 정적 정의에 없는 흐름이 동적으로 관측되면 anomaly로 분류한다.
3. **시간 순서는 집계 데이터다.** 개별 trace가 아닌 "이 순서가 N번 관측됨"으로 요약한다.
4. **FlowDefinition 검증은 읽기 전용이다.** 관측 결과가 정의를 수정하지 않는다. Observation으로 기록할 뿐이다.
