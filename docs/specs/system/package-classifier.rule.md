---
def:
  id: package-classifier-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: package-classifier
  tags: [package, boundary, governance, contract]
  links:
    - target: package-classifier-spec
      type: constrains
    - target: package-surface-separation-rule
      type: depends_on
sources:
  - packages/package-classifier/src/pkg-classifier.ts
  - scripts/analyze-package-usage.ts
  - scripts/check-dependency-boundaries.ts
  - scripts/package-surfaces.mjs
---

# package-classifier — Consumption Rule

## 목적 ^purpose

`package-classifier`를 architecture tooling에서 사용할 때 raw package classification과 surface governance 판정이 섞이지 않도록 consumption rule을 정의한다.

## 규칙 ^constraint

- `scanAndClassify(root)`의 입력 root는 repo root여야 하며, scanner는 `packages/*`만 순회한다.
- dependency 해석은 package `name`과 scope 제거 `displayName`을 모두 허용하지만, 반환 `deps`는 displayName 기준으로 둔다.
- tier/runtime/scope 값은 heuristic signal이다. package promotion, quarantine, archive 여부를 단독 결정하지 않는다.
- surface verdict와 disposition은 `scripts/package-surfaces.mjs`와 `arch:usage`가 결합해 판정한다.
- consumer script가 API manifest, boundary report, tier violation report를 생성하더라도 classifier package가 그 output format을 소유하지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter package-classifier test
corepack pnpm arch:usage
corepack pnpm arch:verify
qa-sdk docs closure package-classifier-spec
```
