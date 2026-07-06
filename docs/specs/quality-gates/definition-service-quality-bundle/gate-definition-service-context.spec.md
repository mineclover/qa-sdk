---
def:
  tier: component
  id: gate-definition-service-context
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: definition-service-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: DEF-SVC-QUALITY-001
  package: definition-service
  command: pnpm --filter definition-catalog exec vitest run src/cli-tools-real.test.ts
  successPattern: exit_code=0
  references: [packages/definition-catalog/src/cli-tools-real.test.ts, packages/definition-service/src/modules/docs/docs.service.ts, packages/definition-service/src/modules/graphql/doc.resolver.ts]
sources:
  - packages/definition-catalog/src/cli-tools-real.test.ts
  - packages/definition-service/src/modules/docs/docs.service.ts
  - packages/definition-service/src/modules/graphql/doc.resolver.ts
---
# Definition Service Context Gate


## 탐색 ^navigation

quality-gates-system > definition-service-quality-bundle > **gate-definition-service-context**

형제: `definition-service-quality-contract` · `gate-definition-service-build` · `gate-definition-service-sync`

## 목적 ^purpose

문서 컨텍스트/영향/의존 조회가 실제 docs 그래프에서 기대한 결과를 반환하는지 검증하는 통합 게이트.
