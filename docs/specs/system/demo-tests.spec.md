---
def:
  id: demo-tests
  type: spec
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: demo-tests
  tags: [testing, integration]
  links:
    - target: e2e-suite-spec
      type: refines
    - target: demo-tests-rule
      type: traces_to
    - target: demo-tests-test
      type: traces_to
    - target: testing-patterns
      type: depends_on
sources:
  - packages/demo-tests/package.json
  - packages/demo-tests/src/schema-consistency.test.ts
  - packages/demo-tests/src/index-meta/invariants.test.ts
  - packages/demo-tests/src/registry-service-e2e.test.ts
  - packages/demo-tests/src/permission-engine/scenario.test.ts
  - packages/demo-tests/src/merge-contract/error-parity.test.ts
---

# @qa-sdk/demo-tests — 데모 cross-package 통합 테스트

## 목적 ^purpose

데모 카탈로그와 서비스 흐름을 cross-package로 묶어 검증하는 통합 테스트 스위트. weighted-index/bit-index 인코딩, demo-snapshot 파생, browser codec 경로, ingest pipeline 연동이 동일 repo 내에서 일관되게 동작하는지 확인.

## 기능 경계 ^constraint

- 이 패키지는 repo-local integration/contract 테스트만 소유한다. runtime API, schema, catalog SSOT는 각 producer package가 소유한다.
- 테스트는 `validation-layer-group`의 검증 증거로 남되, package surface promotion 기준은 `package-surface-separation-rule`을 따른다.
- 테스트 fixture 데이터와 expected constant는 테스트 안에서 통제되는 값만 하드코딩할 수 있다. catalog cardinality, prefix 목록, DKG graph 크기는 SSOT에서 파생한다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/demo-tests test
qa-sdk docs closure demo-tests
```
