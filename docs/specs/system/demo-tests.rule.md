---
def:
  id: demo-tests-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: demo-tests
  tags: [testing, integration, contract]
  links:
    - target: demo-tests
      type: constrains
    - target: testing-patterns
      type: depends_on
  sources:
    - packages/demo-tests/src/schema-consistency.test.ts
    - packages/demo-tests/src/index-meta/invariants.test.ts
    - packages/demo-tests/src/merge-contract/error-parity.test.ts
---

# demo-tests — Consumption Rule

## 목적 ^purpose

`@qa-sdk/demo-tests`를 cross-package integration evidence로 사용할 때 fixture-controlled assertions와 SSOT-derived assertions를 구분한다.

## 규칙 ^constraint

- catalog cardinality, axis/prefix 목록, generated snapshot shape는 producer package에서 파생한다.
- protocol constants, HTTP status, 테스트가 직접 주입한 fixture row count는 명시 값으로 검증할 수 있다.
- compatibility/error parity는 package-local contract로 유지하고, producer runtime dependency graph를 바꾸는 근거로 사용하지 않는다.
- demo-tests는 verification suite capability surface다. runtime package ownership을 가져오지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/demo-tests test
```
