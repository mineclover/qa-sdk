---
def:
  id: rlsc-monitor-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-monitor
      type: refines
---

## 목적 ^purpose

`createLayoutMonitor`의 브라우저 환경 가드와 debounce 동작을 검증한다.
`collector.js`를 mock하여 DOM 없이 실행 가능하다.

소스: `packages/rlsc/src/monitor.test.ts`

## 브라우저 가드

| 시나리오 | 기대 결과 |
|----------|----------|
| Node.js 환경 (`window === undefined`) | `createLayoutMonitor()` → "브라우저 환경에서만" 에러 throw |

## debounce

| 시나리오 | 기대 결과 |
|----------|----------|
| MutationObserver 콜백 3회 연속 호출 (50ms 이내) | `collectLayout` 추가 호출 0회 (debounce 보류 중) |
| 50ms 경과 후 | `collectLayout` 추가 1회만 호출 (합산 처리) |
| 콜백 호출 직후 `stop()` | 대기 중인 타이머 취소 → `collectLayout` 추가 호출 없음 |
