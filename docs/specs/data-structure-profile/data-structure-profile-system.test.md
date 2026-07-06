---
def:
  id: data-structure-profile-system-test
  type: spec
  tier: system
  level: leaf
  scope: flow
  aspect: quality_flow
  depth: validation
  lifecycle: approved
  layer: operation
  svc: data-structure-profile
  tags: [testing, fixture, smoke, bridge]
  links:
    - target: data-structure-profile-system
      type: refines
sources:
  - packages/data-structure-profile/src/profile.test.ts
  - packages/data-structure-profile/src/cli-runner.test.ts
  - packages/viz-web/src/data-structure-profile/lineage-view.test.ts
  - packages/viz-web/src/data-structure-profile/sample-lineage.test.ts
  - scripts/data-structure-profile-bridge-smoke.mjs
  - docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml
  - docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml
---

# Data Structure Profile Verification

## 목적 ^purpose

Data Structure Profile 검증 표면은 fixture-first contract가 drift되지 않도록 profile package, CLI, viz preview, consumer bridge smoke를 같은 artifact family로 묶는다.

## Verified Surfaces ^defines

- `profile.test.ts`는 order-event fixture와 relational customer-orders fixture가 validation, lineage, measurement, DPM readiness expected JSON과 일치하는지 검증한다.
- `profile.test.ts`는 두 profile을 같은 taxonomy와 같은 test process에서 연속 처리해 artifact `profile`, lineage node, quality-ledger bundle/gate id, bench scenario id, DPM policy ref가 profile별로 분리되는지 검증한다.
- `profile.test.ts`는 missing stream safety evidence와 taxonomy unknown ref가 stable `dsp-*` diagnostic code를 내는지 검증한다.
- `profile.test.ts`는 quality-ledger adapter payload와 bench adapter payload의 deterministic shape를 검증한다.
- `cli-runner.test.ts`는 `validate`, `compile`, `measure`, `dpm-readiness`, adapter flags, invalid invocation exit behavior를 검증한다.
- `viz-web` data-structure-profile tests는 compiled lineage artifact를 D3/Mermaid/SVG preview shape로 변환하는 read-only 소비 표면을 검증한다.
- `scripts/data-structure-profile-bridge-smoke.mjs`는 built `quality-ledger`와 `@qa-sdk/bench` public API가 각 profile의 adapter payload를 실제로 소비할 수 있는지 repo-level smoke로 검증한다.

## Verification Commands ^validation

- `pnpm --filter data-structure-profile test`
- `pnpm --filter data-structure-profile typecheck`
- `pnpm --filter data-structure-profile build`
- `pnpm --filter quality-ledger build`
- `pnpm --filter @qa-sdk/bench build`
- `node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml`
- `node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml`
- `pnpm --filter @qa-sdk/viz-web test`
- `pnpm --filter @qa-sdk/viz-web build`
- `node packages/cli/dist/index.js def validate`
- `pnpm arch:feedback`

## 관련 소스

- `packages/data-structure-profile/src/profile.test.ts` — package artifact and adapter regression tests
- `packages/data-structure-profile/src/cli-runner.test.ts` — CLI contract tests
- `packages/viz-web/src/data-structure-profile/lineage-view.test.ts` — preview transform tests
- `packages/viz-web/src/data-structure-profile/sample-lineage.test.ts` — sample drift guard
- `scripts/data-structure-profile-bridge-smoke.mjs` — built consumer bridge smoke
