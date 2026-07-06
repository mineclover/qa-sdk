---
def:
  id: data-structure-profile-operations-rule
  type: spec
  tier: system
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: data-structure-profile
  tags: [operations, profile-isolation, validation, fixture]
  links:
    - target: data-structure-profile-system
      type: refines
    - target: data-structure-profile-profile-contract
      type: depends_on
    - target: data-structure-profile-validation
      type: depends_on
    - target: data-structure-profile-cli
      type: depends_on
    - target: data-structure-profile-system-test
      type: depends_on
sources:
  - packages/data-structure-profile/README.md
  - packages/data-structure-profile/src/validate.ts
  - packages/data-structure-profile/src/profile.test.ts
  - packages/data-structure-profile/src/cli-runner.ts
  - scripts/data-structure-profile-bridge-smoke.mjs
  - docs/taxonomies/data-structure-profile.yaml
---

# Data Structure Profile Operations Rule

## 목적 ^purpose

이 rule은 여러 Data Structure Profile을 운영하면서 profile-local graph, taxonomy vocabulary, adapter payload가 서로 섞이지 않도록 유지하는 절차를 고정한다.

## 운영 원칙 ^constraint

- Profile id는 artifact namespace다. validation report, lineage artifact, measurement report, DPM readiness report, quality-ledger bundle id, bench scenario id는 같은 profile id를 보존해야 한다.
- `structures[].parent`, `relationships[].from/to`, `transforms[].from/to`는 같은 profile의 `source.id` 또는 `structures[].id`만 참조한다.
- 다른 profile의 node id를 직접 참조하지 않는다. cross-profile composition이 필요하면 future registry/composition layer를 먼저 설계한다.
- 여러 profile을 한 소비 표면에 모을 때 node key는 `profile + node.id` composite로 다룬다.
- Taxonomy는 reusable finite vocabulary만 소유한다. concrete topic, JSONPath, table, target ref, measurement number, gate id는 profile-local artifact다.
- `quality-ledger`와 `@qa-sdk/bench`는 adapter output consumer다. `data-structure-profile` package runtime dependency로 추가하지 않는다.

## 새 Profile 추가 절차 ^defines

1. 기존 fixture 중 가장 가까운 shape를 복사해 새 `profile` id와 `source.id`를 부여한다.
2. `source.kind`, `structures[].kind`, `transforms[].kind`, `quality_gates[].risk`가 `docs/taxonomies/data-structure-profile.yaml`에 있는지 확인한다.
3. 필요한 값이 taxonomy에 없으면 먼저 5Q checklist로 reusable vocabulary인지 판정한다. profile-local 값이면 taxonomy에 추가하지 않는다.
4. 모든 `parent`, `relationship`, `transform` reference가 같은 profile 내부 id만 가리키는지 확인한다.
5. expected validation, lineage, measurement, DPM readiness JSON을 갱신한다.
6. package tests, CLI validate, bridge smoke를 실행한다.
7. 새 운영 의미가 생겼으면 이 rule 또는 관련 spec을 함께 갱신한다.

## 정합성 점검 명령 ^validation

- `pnpm --filter data-structure-profile test`
- `pnpm --filter data-structure-profile typecheck`
- `pnpm --filter data-structure-profile build`
- `node packages/data-structure-profile/dist/cli.js validate docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml --taxonomy docs/taxonomies/data-structure-profile.yaml`
- `node packages/data-structure-profile/dist/cli.js validate docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml --taxonomy docs/taxonomies/data-structure-profile.yaml`
- `pnpm --filter quality-ledger build`
- `pnpm --filter @qa-sdk/bench build`
- `node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/order-events.profile.yaml`
- `node scripts/data-structure-profile-bridge-smoke.mjs docs/proposals/data-structure-profile/fixtures/customer-orders.profile.yaml`
- `node packages/cli/dist/index.js def validate`
- `pnpm arch:feedback`
- `git diff --check`

## Failure Triage ^constraint

| Symptom | Likely boundary issue | Fix |
|---|---|---|
| `dsp-profile-ref-unknown` | profile-local graph가 다른 profile 또는 없는 node id를 참조함 | 같은 profile의 `source.id` 또는 `structures[].id`로 고치거나 composition layer를 설계한다 |
| `dsp-taxonomy-ref-unknown` | reusable vocabulary에 없는 kind/risk를 참조함 | taxonomy entry 추가 전 5Q checklist를 통과하거나 profile-local 값으로 되돌린다 |
| quality-ledger bundle id가 다른 profile id를 포함함 | adapter input report가 잘못된 profile에서 왔거나 profile id가 drift됨 | `validateProfile()` output의 `profile`과 CLI input path를 다시 확인한다 |
| bench scenario id가 겹침 | measurement report의 profile id가 고유하지 않음 | profile id를 고유하게 바꾸고 expected artifacts를 갱신한다 |
| bridge smoke를 위해 runtime dependency를 추가하려 함 | adapter bridge와 package runtime boundary가 섞임 | bridge smoke는 repo-level script에 유지한다 |

## 관련 소스

- `packages/data-structure-profile/README.md` — operator-facing command guide
- `packages/data-structure-profile/src/validate.ts` — profile-local reference validation
- `packages/data-structure-profile/src/profile.test.ts` — multi-profile isolation regression tests
- `packages/data-structure-profile/src/cli-runner.ts` — built CLI command behavior
- `scripts/data-structure-profile-bridge-smoke.mjs` — real consumer bridge smoke
