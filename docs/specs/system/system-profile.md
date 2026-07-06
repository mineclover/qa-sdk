---
def:
  id: system-profile
  tier: layout
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [profile, data-structure, structural, entry-point]
  links:
    - target: data-structure-profile-system
      type: refs
    - target: package-surface-separation-rule
      type: refs
    - target: system-packages
      type: refs
sources:
  - scripts/package-surfaces.mjs
  - scripts/report-package-surfaces.mjs
  - scripts/data-structure-profile-bridge-smoke.mjs
  - packages/data-structure-profile/package.json
  - packages/data-structure-profile/src/index.ts
  - packages/data-structure-profile/src/profile.test.ts
  - packages/quality-ledger/package.json
  - packages/review-ledger/package.json
  - packages/bench/package.json
  - packages/viz-web/package.json
  - packages/viz-web/src/data-structure-profile/sample-lineage.test.ts
---

# Profile Capability

## 목적 ^purpose

profile YAML, validation report, lineage artifact, measurement dry-run, evidence adapter, preview를 다루는 기능군의 operator entry다. 이 문서는 profile capability를 taxonomy tooling이나 generic product demo surface와 섞지 않고, 실제 운영자가 어느 패키지를 보면 되는지 가리킨다.

## 구성 ^overview

| Surface id | 패키지 | 실제 usecase | 소유하지 않는 것 |
|------------|--------|--------------|------------------|
| `profile-contract-tooling` | `data-structure-profile` | profile parse/validate/compile/measure/DPM readiness, quality-ledger와 bench adapter payload 생성 | ledger persistence, benchmark runner runtime, preview UI state |
| `quality-evidence-ledgers` | `quality-ledger`, `review-ledger` | gate/review 실행 결과 저장과 조회 | profile schema, lineage transform semantics, row multiplier 계산 |
| `measurement-tooling` | `@qa-sdk/bench` | adapter가 만든 measurement report input 소비, benchmark report 생성 | profile source-path parsing, taxonomy vocabulary 관리 |
| `profile-preview-surfaces` | `@qa-sdk/viz-web` | compiled lineage/graph artifact를 읽는 preview consumer | profile YAML 작성, validation rule, ledger write |

## 사용 경로 ^method

- profile fixture를 검증하거나 여러 profile이 섞이지 않는지 볼 때는 `data-structure-profile`을 본다.
- validation 결과를 quality gate ledger로 넘길 때는 adapter payload를 만든 뒤 `quality-ledger` consumer smoke로 확인한다.
- measurement dry-run 결과를 리포트로 볼 때는 `@qa-sdk/bench` adapter smoke를 확인한다.
- 사람이 lineage/graph를 볼 때는 `@qa-sdk/viz-web`을 preview consumer로 사용한다.

## 경계 규칙 ^constraint

- `data-structure-profile`은 `taxonomy-engine` parse 결과를 lookup input으로 사용할 수 있지만, taxonomy decision bridge나 taxonomy web preview를 runtime dependency로 끌어오지 않는다.
- 여러 profile을 함께 소비할 때는 `profile + node.id` composite key를 사용한다. bare node id는 profile 내부에서만 유일하다.
- ledger, bench, preview는 profile artifact를 소비한다. 이들이 profile schema나 vocabulary SSOT가 되면 안 된다.
- 새 profile 관련 패키지를 추가하면 먼저 하나의 profile surface에 배정하고, adapter smoke나 consumer test가 생기기 전까지 제품 core로 승격하지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter data-structure-profile test
corepack pnpm --filter data-structure-profile typecheck
corepack pnpm --filter data-structure-profile build
corepack pnpm --filter quality-ledger build
corepack pnpm --filter @qa-sdk/bench build
node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml
node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
