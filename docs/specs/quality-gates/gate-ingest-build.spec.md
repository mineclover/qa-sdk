---
def:
  id: gate-ingest-build
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:build, work-domain:productivity]
  links:
    - target: ingest-quality-contract
      type: depends_on
gate:
  kind: build
  workDomain: productivity
  storyId: ING-QUALITY-001
  package: ingest-server
  command: pnpm --filter @qa-sdk/ingest-server build
  successPattern: exit_code=0
  references: [packages/ingest-server/package.json, packages/ingest-server/src/server.ts]
  suggestOnPass: [gate-ingest-test]
  suggestOnFail: [gate-ingest-test]
---
# Ingest Build Gate


## 탐색 ^navigation

quality-gates-system > ingest-quality-bundle > **gate-ingest-build**

형제: `ingest-quality-contract` · `gate-ingest-test` · `gate-ingest-sdk-bridge`

## 목적 ^purpose

`ingest-server`가 실행 가능한 서버 산출물(dist/server.js, types)을 정상 생성하는지 확인하는 빌드 게이트.
