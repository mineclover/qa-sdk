---
def:
  id: analysis-system
  tier: system
  type: spec
  address: def_document:v2:68609
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, observability, entry-point]
  links:
    - target: analysis-prefix
      type: contains
    - target: analysis-self-check
      type: contains
    - target: analysis-convergence
      type: contains
    - target: analysis-intent-link
      type: contains
    - target: analysis-cooccurrence
      type: contains
    - target: analysis-transition
      type: contains
    - target: analysis-path-observation
      type: contains
    - target: tracking-three-axes
      type: contains
sources:
  - packages/cli/src/commands/dkg.ts
  - packages/convergence/src/index.ts
  - packages/convergence/src/usage-aggregator.ts
  - packages/convergence/src/self-check-analyzer.ts
  - packages/convergence/src/smoke.test.ts
  - packages/convergence/src/self-check-analyzer.test.ts
  - packages/ingest-server/src/lib/convergence-pipeline.ts
  - packages/ingest-server/src/lib/convergence-pipeline.test.ts
  - packages/ingest-server/src/lib/convergence-e2e.test.ts
  - packages/ingest-server/src/insights-store.e2e.test.ts
  - packages/dkg/src/skills/flow-trace.ts
  - packages/dkg/src/skills/flow-trace.test.ts
  - packages/spec-transition/src/transition-engine.ts
  - packages/spec-transition/src/transition-engine.test.ts
---

# 분석 시스템

## 목적 ^purpose

수집된 이벤트 데이터를 기반으로 시스템 건강 상태, 좌표 수렴, prefix 공출현 패턴, 상태 전이를 분석하는 관측 레이어.

## 구성 ^overview

- `analysis-prefix`: 분석 시스템에서 prefix가 어떻게 분류되고, DSL Bundle/IntentLink/Domain 3개 조직 레이어 위에서 그룹핑되는지를 정의한다.
- `analysis-self-check`: 좌표 시스템의 건강 상태를 자동 점검하는 기능.
- `analysis-convergence`: prefix 간 중복이나 낭비를 감지하는 수렴 분석.
- `analysis-intent-link`: 특정 prefix들이 함께 관측되어야 하는 조건(IntentLink)을 정의하고, 위반 시 invariant violation을 감지한다.
- `analysis-cooccurrence`: 세션 단위로 어떤 prefix가 함께 나타나는지 Jaccard 분석.
- `analysis-transition`: 이벤트로 인해 엔티티의 상태가 어떻게 전이되는지를 정의하는 스펙.

## 실행 진입점 ^runtime

- CLI: `packages/cli/src/commands/dkg.ts`의 `dkg self-check`, `dkg converge`, `dkg discover-links`가 운영자 진입점이다.
- Ingest runtime: `ConvergencePipelineRunner`가 Phase 2 이후 address_context 레코드를 모아 convergence metric, observation, IntentLink flow 검증을 실행한다.
- Insights API: `/v1/insights/prefixes`, `/v1/insights/service-prefixes`, `/v1/insights/correlations`가 prefix 사용량과 공출현 분석을 노출한다.
- Transition runtime: `spec-transition`의 `TransitionEngine`이 이벤트 시퀀스에 상태 전이 의미를 부여한다.

`dkg converge`와 `dkg discover-links`는 기본 실행에서 저장하지 않는다. DKG store에 결과를 기록하려면 `dkg converge --persist`처럼 명시적 persist 옵션을 사용한다.

## 검증 명령 ^validation

```bash
pnpm --filter @qa-sdk/convergence test
pnpm --filter @qa-sdk/ingest-server exec vitest run src/lib/convergence-pipeline.test.ts src/lib/convergence-e2e.test.ts src/insights-store.e2e.test.ts
pnpm --filter dkg exec vitest run src/skills/flow-trace.test.ts
pnpm --filter spec-transition exec vitest run src/transition-engine.test.ts
node packages/cli/dist/index.js dkg converge
node packages/cli/dist/index.js dkg discover-links
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
