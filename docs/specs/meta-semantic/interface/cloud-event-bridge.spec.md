---
def:
  id: cloud-event-bridge
  level: leaf
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
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

## 완료

- [x] `toCloudEvent(record: EventRecord | EventRecordLike)` — 두 타입 모두 허용
- [x] `EventRecordLike`에 `address_context` 필드 추가 (EventRecord 호환)
- [x] `toCloudEvent`에서 address_context → subject 변환 (coordinate보다 우선)
- [x] `fromCloudEvent`에서 subject → address_context 복원
- [x] 기존 14 tests 수정 없이 통과
- [x] address_context 라운드트립 테스트 4건 추가 → 총 18 tests

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/cloud-events.ts` | 구현 (타입 강화 + address_context 지원) |
| `core/src/cloud-events.test.ts` | 테스트 (18 tests) |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/cloud-events.test.ts  # 18 tests
```
