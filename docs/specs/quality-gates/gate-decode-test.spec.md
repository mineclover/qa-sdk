---
def:
  id: gate-decode-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: decode-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  storyId: DEC-QUALITY-001
  package: decode-service
  command: pnpm --filter @qa-sdk/decode-service test
  successPattern: exit_code=0
  references: [packages/decode-service/src/app.test.ts]
  suggestOnFail: [gate-decode-build]
---
# Decode Test Gate


## 탐색 ^navigation

quality-gates-system > decode-quality-bundle > **gate-decode-test**

형제: `decode-quality-contract` · `gate-decode-build` · `gate-decode-route`

## 목적 ^purpose

`decode-service`의 app/decoder-pool/route 동작이 테스트 수준에서 유지되는지 검증하는 게이트.
