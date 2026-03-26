---
def:
  id: df-gate-integration
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision, gate]
  links:
    - target: df-observation-space
      type: depends_on
    - target: df-constraint
      type: refines
    - target: df-system
      type: implements
---
# GateEngine 연동

## 목적 ^purpose

decision prefix에 GateEngine 4-state 모델(active/inactive/open/reserved)을 적용하여, 의사결정 좌표의 encode/decode 허용 여부를 관리한다. deprecated된 flow_type이나 비활성화된 좌표 영역을 차단한다.

## 구성 ^overview

- **decision_event는 leaf prefix**: 4축 직접 axis (prefix_ref 없음). GateEngine이 가장 단순하게 처리
- **상태 전환**: entry 비활성화 → buildDimStateSpecs → inactive spec → recompute → inactiveRanges
- **checkGate**: address가 active/inactive/open/reserved 중 어디에 속하는지 O(log n) 판정
- **gate-service 연결**: consumedPrefixes에 decision 5개 prefix 등록. 서버 기동 시 자동 처리
- **테스트**: demo-tests/gate-engine-decision.test.ts 6건 통과

## decision prefix 5종 ^prefixes

`observe.ts`에서 정의하는 관찰 prefix. 각 prefix가 독립 WeightedIndex를 갖는다.

| Prefix | 축 구성 | 용도 |
|--------|---------|------|
| `decision_event` | flow_type(16) × cognitive_phase(16) × evidence_kind(16) × confidence_band(8) | 분기 선택 이벤트 |
| `decision_path` | flow_type(16) × decision_outcome(8) × scope_mode(8) | 플로우 완료 경로 |
| `escalation_event` | flow_type(16) × escalation_type(16) × cognitive_phase(16) | 에스컬레이션 |
| `model_apply` | mental_model(32) × reversibility(8) × magnitude(8) | 인지 모델 적용 |
| `forcing_response` | forcing_question(32) × evidence_kind(16) × confidence_band(8) | Forcing Question 응답 |

- 모든 축은 `vocabulary.ts`에서 정의. capacity는 `nextPowerOf2(entries.length * 2)` 이상
- prefix_ref 없음 — 4축 이하 직접 axis만 사용하므로 GateEngine이 가장 단순하게 처리

## GateEngine 4-state 모델 적용 ^four-state

decision prefix에 적용되는 GateEngine 상태:

- **active**: encode(좌표 인코딩) 허용 + decode(좌표 디코딩) 허용 — 정상 사용 가능
- **inactive**: encode 차단 + decode 허용 — deprecated된 flow_type/phase 등. 기존 좌표는 읽을 수 있지만 새 좌표 생성 불가
- **open**: encode 허용 + decode 차단 — 새로 추가된 entry가 아직 디코더에 반영 안 됨
- **reserved**: encode 차단 + decode 차단 — `inactive ∩ open → reserved` 자동 승격

## 상태 전환 흐름 ^state-transition

1. 축의 특정 entry를 비활성화 (예: `flow_type` 축에서 `investigation`을 deprecated)
2. `buildDimStateSpecs()` — 비활성 entry의 position을 inactive spec으로 변환
3. `recompute()` — inactive position을 포함하는 address 범위를 계산
4. `checkGate(address)` — O(log n) 이진 탐색으로 주어진 address가 어떤 상태인지 판정

composite AND 규칙: 어느 dim이라도 차단 → composite 좌표도 차단.

## FlowEngine과의 연동 ^engine-integration

FlowEngine 자체는 GateEngine을 직접 참조하지 않는다. 연동은 다음 경로:

1. `observe.ts`의 인코딩 함수가 WeightedIndex로 좌표 생성 — 이 시점에서 entry가 유효한지는 vocabulary에서 보장
2. 생성된 좌표(`address_context`)가 EventRecord에 포함되어 ingest-server로 전송
3. gate-service가 해당 prefix의 address를 소비할 때 4-state 판정 수행
4. `consumedPrefixes`에 decision 5개 prefix를 등록하면 gate-service 기동 시 자동 처리

## 좌표 인코딩 예시 ^encoding-example

```typescript
// 분기 선택 → decision_event 좌표
const event = encodeDecisionEvent("ceo_review", "decide", selection);
// → { prefix: "decision_event", address: 1234, timestamp: "...", raw: {...} }

// 직렬화 → SemanticAddress
const serialized = serializeObservedEvent(event);
// → "decision_event:v1:1234"

// 역방향: SemanticAddress → 원본 dim 값
const decoded = parseAndDecodeAddress("decision_event:v1:1234");
// → { flow_type: "ceo_review", cognitive_phase: "decide", ... }
```

gate-service가 `checkGate(1234)`를 호출하면 해당 주소가 active/inactive/open/reserved 중 어디인지 판정한다.
