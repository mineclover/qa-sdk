---
def:
  id: analysis-convergence-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [testing, observability, metric, event, trace]
  links:
    - target: analysis-convergence
      type: verifies
    - target: analysis-convergence-rule
      type: depends_on
sources:
  - packages/convergence/src/smoke.test.ts
  - packages/ingest-server/src/lib/convergence-pipeline.test.ts
  - packages/spec-core/src/convergence/pipeline-e2e.test.ts
---
# Convergence — 검증 기준

## 목적 ^purpose

관측 event 집계, metric 계산, flow trace, observation 저장이 하나의 runtime
convergence pipeline에서 분리되지 않고 연결되는지 검증한다.

## 검증 매핑 ^defines

| 검증 표면 | 현재 테스트 |
|-----------|-------------|
| address context → UsageData 집계 | `packages/convergence/src/smoke.test.ts` |
| metric observation 생성·저장 | `packages/ingest-server/src/lib/convergence-pipeline.test.ts` |
| flow observation과 metric observation의 동시 저장 | `packages/ingest-server/src/lib/convergence-pipeline.test.ts` |
| runtime flow recovery의 metric 선행 반영 | `packages/ingest-server/src/lib/convergence-pipeline.test.ts` |
| encode → aggregate → convergence event 경로 | `packages/spec-core/src/convergence/pipeline-e2e.test.ts` |

## 시나리오 ^scenarios

1. 유효한 event record는 entry/address/co-occurrence usage로 집계된다.
2. metric 또는 flow violation은 결정적 observation으로 변환되어 DKG에 저장된다.
3. 현재 raw flow evidence가 회복을 증명할 때만 과거 observation이 metric 계산 전에
   해소되고, 미관측 flow는 유지된다.
