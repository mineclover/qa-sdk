---
def:
  id: definition-gate-fsm
  level: leaf
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: []
  links:
    - target: definition-quality-gates
      type: refines
---
# Gate FSM — 품질 게이트 상태 머신

## 목적 ^purpose

단일 게이트의 9-state 상태 전이와, 하위 게이트 상태에서 파생되는 BundleState를 정의한다. 순수 함수로 구현되어 property testing에 적합.

## 정의 ^defines

- GateState 9종 + GateEvent 11종
- transitionGate() — 순수 전이 함수
- BundleState 6종 + deriveBundleState() — 파생 함수
- def-config.json quality-gates/quality-bundles 스키마

## 소비 ^consumes

- (없음 — 순수 FSM, 외부 의존 없음)

## GateState (9종) ^constraint

| 상태 | 의미 |
|------|------|
| idle | 문서 정의됨, 아직 스케줄되지 않음 |
| blocked | 선행 gate 미통과 |
| ready | 실행 가능 |
| gathering | 컨텍스트 수집 중 |
| running | 명령 실행 중 |
| passed | 검증 통과 |
| failed | 검증 실패 |
| stale | 이전 passed 무효 (소스 변경) |
| skipped | 의도적 건너뜀 |

## GateEvent (11종)

schedule, prereqs_met, prereqs_blocked, gather_start, gather_done, gather_invalid, exit(code), source_changed, retry, skip, reset

## BundleState (6종)

| 상태 | 파생 규칙 |
|------|----------|
| empty | 하위 gate 0건 |
| pending | 전부 idle/blocked/skipped |
| gathering | 1개 이상 gathering/running |
| partial | 1개 이상 passed, 나머지 미완 |
| complete | 전부 passed (또는 skipped) |
| degraded | 1개 이상 failed/stale |

연결: `complete` = 구조적 `verified`. `convention-compliance` 머신이 소비.

## 영속화

### def-config.json

```json
{
  "states": {
    "quality-gates": { "<gate-doc-id>": { "current": "passed", "updatedAt": "..." } },
    "quality-bundles": { "<bundle-id>": { "current": "degraded", "updatedAt": "..." } }
  }
}
```

## 관련 소스

- `work-domain/src/gate-fsm.ts` — transitionGate, deriveBundleState
- `quality-ledger/src/` — SQLite 영속화
