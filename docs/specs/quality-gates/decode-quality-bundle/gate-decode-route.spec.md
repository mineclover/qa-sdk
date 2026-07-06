---
def:
  tier: component
  id: gate-decode-route
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:integration-test, work-domain:productivity]
  links:
    - target: decode-quality-contract
      type: depends_on
gate:
  kind: integration-test
  workDomain: productivity
  storyId: DEC-QUALITY-001
  package: decode-service
  command: pnpm --filter @qa-sdk/decode-service exec vitest run src/app.test.ts
  successPattern: exit_code=0
  references: [packages/decode-service/src/routes/decode.ts, packages/decode-service/src/app.test.ts]
sources:
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/app.test.ts
---
# Decode Route Gate


## 탐색 ^navigation

quality-gates-system > decode-quality-bundle > **gate-decode-route**

형제: `decode-quality-contract` · `gate-decode-build` · `gate-decode-test`

## 목적 ^purpose

`/decode` 경로가 실제 요청을 받아 decode schema와 address 해석 결과를 반환하는지 검증하는 통합 게이트.
