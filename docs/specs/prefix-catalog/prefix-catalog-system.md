---
def:
  id: prefix-catalog-system
  tier: layout
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
    - target: entity-prefix-group
      type: depends_on
    - target: policy-prefix-group
      type: depends_on
    - target: event-prefix-group
      type: depends_on
    - target: relation-prefix-group
      type: depends_on
    - target: observation-prefix-group
      type: depends_on
    - target: state-prefix-group
      type: depends_on
    - target: entity-prefix-group
      type: refs
    - target: policy-prefix-group
      type: refs
    - target: event-prefix-group
      type: refs
    - target: relation-prefix-group
      type: refs
    - target: observation-prefix-group
      type: refs
    - target: state-prefix-group
      type: refs
sources:
  - packages/definition-catalog/scripts/gen-prefix-docs.mjs
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/demo-catalog.test.ts
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/lifecycle.test.ts
---

## 목적 ^purpose

좌표 시스템의 모든 prefix 정의를 문서 관리 체계로 통합 관리한다.
DEMO_CATALOG이 코드 SSOT이고, 이 문서 체계는 탐색/조립/영향분석을 위한 파생 인덱스다.

## 구성 ^overview

- 총 68개 prefix
- 6개 도메인 그룹: entity, policy, event, relation, observation, state
- 자동 생성: scripts/gen-prefix-docs.mjs

## 검증 ^consumes

```bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
```
