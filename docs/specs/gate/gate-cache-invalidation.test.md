---
def:
  id: gate-cache-invalidation-test
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: gate-service
  links:
    - target: gate-cache-invalidation
      type: verifies
source: packages/gate-service/src/services/cache-invalidation.test.ts
---

## 목적 ^purpose

`createCacheInvalidation`의 이벤트 구독 → recompute 트리거 → broadcast 흐름과
fail-open 에러 격리를 검증한다.

소스: `packages/gate-service/src/services/cache-invalidation.test.ts`

## 사전조건 ^preconditions

- `MemoryEventBus` 인스턴스
- mock `GateLookupService` (cascadeRecompute 호출 추적)
- mock `fetch` (broadcast HTTP 호출 추적)

## flag-change → recompute ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| flag-change 이벤트 publish | `cascadeRecompute(prefix, versionId)`가 호출된다 |
| flag-change 처리 완료 후 | `recompute-complete` 이벤트가 EventBus에 발행된다 |

## release → recompute ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| release 이벤트 publish | `cascadeRecompute(prefix, versionId)`가 호출된다 |
| release 처리 완료 후 | `recompute-complete` 이벤트에 `triggeredBy: "release"`가 포함된다 |

## recompute-complete → broadcast ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| targets 빈 배열 | HTTP 호출 없이 완료 |
| 단일 target 설정 | POST 요청 전송: Content-Type: application/json, body에 prefix/versionId 포함 |
| 2개 target 설정 | 두 대상 모두에 병렬로 broadcast, `completedBroadcasts` 1 증가 |
| 1번째 target 실패 + 2번째 성공 | 두 대상 모두 호출됨, onError 콜백으로 에러 보고 (fail-open) |

## recompute 실패 격리 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| cascadeRecompute가 throw | onError 콜백에 "recompute after flag-change" 컨텍스트가 전달된다 |

## close ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| close() 후 flag-change publish | cascadeRecompute가 호출되지 않는다 |

## 검증 항목 ^assertions

- 10 tests: flag-change→recompute(1), flag-change→recompute-complete 발행(1), release→recompute(1), release→triggeredBy(1), broadcast 빈 target(1), broadcast 단일 target(1), broadcast 병렬(1), broadcast fail-open(1), recompute 실패 격리(1), close 후 중단(1)
