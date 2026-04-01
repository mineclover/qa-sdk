---
def:
  id: cloud-event-bridge
  level: leaf
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-data-contract
      type: depends_on
---

# toCloudEvent → EventRecord 타입 연결

## 목적 ^purpose

기존 `toCloudEvent()`/`fromCloudEvent()` 변환이 `unknown` 기반인 것을
실제 `EventRecord` 타입과 연결하여 타입 안전한 양방향 변환을 제공한다.

## 할 일

- [ ] `toCloudEvent(record: EventRecord)` 시그니처로 타입 강화
- [ ] `fromCloudEvent(ce: CloudEvent)` 반환 타입을 `EventRecord`로 명시
- [ ] CloudEvents 확장 속성(`qa_session_id`, `qa_trace_id` 등) 타입 정의
- [ ] 배치 변환 `toCloudEventBatch` → `EventRecord[]` 입력 타입 강화
- [ ] 기존 14 tests 수정 없이 통과 확인
- [ ] 통합 테스트: EventRecord → CloudEvent → EventRecord 라운드트립

## 현재 상태

- `core/src/cloud-events.ts`: `toCloudEvent(event: Record<string, unknown>)`
- `core/src/cloud-events.test.ts`: 14 tests 통과
- EventRecord 타입: `core/src/types/event-record.ts`

## 관련 소스

| 파일 | 변경 예상 |
|------|----------|
| `core/src/cloud-events.ts` | 시그니처 타입 강화 |
| `core/src/types/cloud-events.ts` | 확장 속성 타입 추가 |
| `core/src/cloud-events.test.ts` | 라운드트립 테스트 추가 |
