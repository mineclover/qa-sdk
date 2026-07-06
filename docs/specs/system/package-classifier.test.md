---
def:
  id: package-classifier-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: package-classifier
  tags: [testing, package, governance]
  links:
    - target: package-classifier-spec
      type: refines
    - target: package-classifier-rule
      type: depends_on
sources:
  - packages/package-classifier/src/pkg-classifier.test.ts
  - packages/package-classifier/src/__tests__/usage-logic.test.ts
  - scripts/verify-analysis-os.ts
---

# package-classifier — Validation Mapping

## 목적 ^purpose

`package-classifier`의 package scope, dependency fan-in, repo package scan behavior를 어떤 테스트가 고정하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| package `private` 필드 기반 scope classification | `packages/package-classifier/src/pkg-classifier.test.ts` |
| repo 전체 내부 dependency fan-in 계산 입력 | `packages/package-classifier/src/__tests__/usage-logic.test.ts` |
| `packages/*` scan 결과가 현재 repo 규모와 맞는지 | `packages/package-classifier/src/__tests__/usage-logic.test.ts` |
| arch usage/verifier가 classifier 결과를 소비하는지 | `scripts/verify-analysis-os.ts` |

## 검증 명령

```bash
corepack pnpm --filter package-classifier test
corepack pnpm arch:verify
```
