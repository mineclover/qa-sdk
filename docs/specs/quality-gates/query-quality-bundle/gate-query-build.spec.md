---
def:
  tier: component
  id: gate-query-build
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:build, work-domain:productivity]
  links:
    - target: query-quality-contract
      type: depends_on
gate:
  kind: build
  workDomain: productivity
  storyId: QRY-QUALITY-001
  package: query-service
  command: pnpm --filter query-service build
  successPattern: exit_code=0
  references: [packages/query-service/src/server.ts, packages/query-service/package.json]
  suggestOnPass: [gate-query-test]
  suggestOnFail: [gate-query-test]
sources:
  - packages/query-service/src/server.ts
  - packages/query-service/package.json
---
# Query Build Gate


## 탐색 ^navigation

quality-gates-system > query-quality-bundle > **gate-query-build**

형제: `query-quality-contract` · `gate-query-test` · `gate-query-gate-integration`

## 목적 ^purpose

`query-service`가 실행 가능한 서버 산출물과 타입을 정상 생성하는지 확인하는 빌드 게이트.
