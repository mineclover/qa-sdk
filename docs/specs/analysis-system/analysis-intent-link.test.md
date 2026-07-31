---
def:
  id: analysis-intent-link-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [testing, observability, event, trace]
  links:
    - target: analysis-intent-link
      type: verifies
    - target: analysis-intent-link-rule
      type: depends_on
sources:
  - packages/dkg/src/skills/flow-trace.test.ts
  - packages/ingest-server/src/lib/convergence-pipeline.test.ts
  - packages/cli/src/commands/dkg.e2e.test.ts
---
# IntentLink — 검증 기준

## 목적 ^purpose

IntentLink의 event trace 판정과 observation lifecycle이 현재 구현과 함께
유지되는지 검증한다.

## 검증 매핑 ^defines

| 검증 표면 | 현재 테스트 |
|-----------|-------------|
| endpoint 누락 flow violation | `packages/dkg/src/skills/flow-trace.test.ts` |
| 정상 event context에서 위반 없음 | `packages/dkg/src/skills/flow-trace.test.ts` |
| 관측된 link의 과거 observation 회복 | `packages/dkg/src/skills/flow-trace.test.ts` |
| 미관측 link와 재발 violation의 해소 보류 | `packages/dkg/src/skills/flow-trace.test.ts` |
| runtime flow recovery가 metric 계산보다 선행 | `packages/ingest-server/src/lib/convergence-pipeline.test.ts` |
| self-check live flow trace 통합 | `packages/cli/src/commands/dkg.e2e.test.ts` + full self-check |

## 시나리오 ^scenarios

1. endpoint prerequisite가 누락된 event context는 결정적 `OBS-FLOW-*`를 만든다.
2. endpoint가 실제 관측되고 동일 실행에서 violation이 없으면 과거 observation은
   회복 후보가 된다.
3. link가 관측되지 않았거나 동일 violation이 재발하면 과거 observation을 유지한다.
