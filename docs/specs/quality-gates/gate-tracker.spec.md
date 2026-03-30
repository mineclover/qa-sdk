---
def:
  id: gate-tracker-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing]
  links:
    - target: harness-architecture
      type: implements
    - target: harness-state-model
      type: depends_on
---


## 탐색 ^navigation

quality-gates-system > **gate-tracker-spec**

형제: `gate-kind-taxonomy` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

work-domain의 순수 게이트 FSM 함수(`transitionGate`, `deriveBundleState`)를 래핑하여, 게이트 상태 전이를 `gate.execution` / `bundle.observation` SDK 이벤트로 자동 수집한다. 게이트 실행의 관측 가능성을 보장하는 유일한 진입점.

## 사용 맥락 ^context

CLI `qa-sdk quality` 명령이나 CI에서 품질 게이트를 실행할 때 사용. `buildHarnessPlan()`으로 계획을 생성한 후 `createGateTracker()`로 트래커를 만들고, `applyEvent()`로 게이트를 진행한다.

## 인터페이스

### GateTrackerConfig

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| logger | GateLogger | O | SDK 로거 (event_key + address_context emit) |
| plan | HarnessPlan | O | buildHarnessPlan()으로 생성한 게이트 계획 |
| listener | BundleStateListener | X | Cross-Loop 연결용. BundleState 변경 시 호출 |

### BundleStateListener

`onBundleStateChanged(anchorId, prevState, newState)` — 번들 상태 변경 콜백. `createGateHarnessBridge()`가 이 인터페이스를 구현하여 ③→② 루프를 연결.

### emit 이벤트

| 이벤트 | prefix | 발생 조건 |
|--------|--------|----------|
| gate.execution | gate_execution | 모든 유효한 게이트 상태 전이 |
| bundle.observation | bundle_observation | BundleState 변경 시에만 |

## 주의사항 ^caveat

- 무효 전이(현재 상태에서 불가능한 이벤트)는 무시 — emit 없음
- BundleState는 파생값이므로 gate 전이 없이 직접 변경 불가
- address_context는 `gate_execution:v1:<kind>:<scope>:<state>` 형식

## 관련 소스

- `work-domain/src/gate-tracker.ts`
- `work-domain/src/gate-tracker.test.ts` — 6건
