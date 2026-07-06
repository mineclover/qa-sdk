---
def:
  id: definition-cross-loop-bridge-rule
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [cross-scope, runtime, decision, observability]
  links:
    - target: definition-cross-loop-bridge
      type: refines
sources:
  - packages/definition-catalog/src/cross-loop-bridge.ts
  - packages/definition-catalog/src/cross-loop-bridge.test.ts
  - packages/definition-catalog/src/runtime.ts
  - packages/definition-catalog/src/harness-tracker.ts
  - packages/work-domain/src/gate-tracker.ts
  - packages/decision-flow/src/observe.ts
  - packages/index-meta/src/gate-aware-query.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/lib/convergence-pipeline.ts
  - packages/convergence/src/metric-registry.ts
  - packages/event-catalog/src/prefix-mapping.ts
---

# Cross-Loop Bridge — 소비 규칙

## 목적 ^purpose

6개 피드백 루프와 루프 간 브릿지를 소비할 때 확인해야 하는 루프 식별, 브릿지 함수, guard 의존 순서를 정의한다.

---

## 1. 6개 루프

| # | 루프 | 관측 prefix | 트래커 |
|---|------|------------|--------|
| ① | 사용자 행동 | page_view, tracking, endpoint, flow_point 등 | autoTrack (event-catalog) |
| ② | 상태 머신 (11-machine) | harness_transition, harness_guard, harness_process_step | harness-tracker.ts |
| ③ | 품질 게이트 | gate_execution, bundle_observation | gate-tracker.ts |
| ④| 수렴 분석 | convergence_event, pattern_match, metric_point 등 | convergence-pipeline.ts |
| ⑤ | 의사결정 | decision_path, model_apply | decision-flow/observe.ts |
| ⑥ | 인프라 생명주기 | version_point, gate_point, resource_lifecycle 등 | gate-aware-query.ts |

## 2. 루프 간 브릿지

| 연결 | 브릿지 | 사용법 |
|------|--------|--------|
| ③→② Gate→Harness | `createGateHarnessBridge()` | BundleState `complete` → convention `compliant` 자동 전이 |
| ②→⑤ Harness→Decision | `buildHarnessContext()` | 하네스 상태를 ContextProvider context에 주입 |
| ⑤→⑥ Decision→Infra | `createDecisionInfraBridge()` | verdict → doc-lifecycle 전이 제안 |
| ⑥→① Infra→User | `gateFilterRanges("encodable")` | inactive/reserved 주소 encode 차단 (fail-open) |
| ①→④ User→Convergence | HTTP ingest → recordStore → flush | 자동 (ingest-server 내장) |
| ④→⑥ Convergence→Infra | `metricsToObservations()` → DKG store | 자동 (convergence-pipeline 내장) |

## 3. guard 의존 순서

- convention → compliant 전이에는 `doc-lifecycle: approved` guard 필요
- 전체 루프 순서: **Decision success → Doc approved → Gate complete → Convention compliant**

## 구현 근거 ^evidence

- ③→②: `packages/work-domain/src/gate-tracker.ts`의 `BundleStateListener`와 `packages/definition-catalog/src/cross-loop-bridge.ts`의 `createGateHarnessBridge()`
- ②→⑤: `packages/definition-catalog/src/cross-loop-bridge.ts`의 `buildHarnessContext()`
- ⑤→⑥: `packages/definition-catalog/src/cross-loop-bridge.ts`의 `createDecisionInfraBridge()`
- ⑥→①: `packages/index-meta/src/gate-aware-query.ts`의 `gateFilterRanges()`
- ①→④: `packages/ingest-server/src/routes/ingest.ts`의 ingest 저장 경로와 phase-two/convergence 알림
- ④→⑥: `packages/ingest-server/src/lib/convergence-pipeline.ts`의 `flush()` 및 `packages/convergence/src/metric-registry.ts`의 `metricsToObservations()`

브릿지 초기화: `packages/definition-catalog/src/runtime.ts`
