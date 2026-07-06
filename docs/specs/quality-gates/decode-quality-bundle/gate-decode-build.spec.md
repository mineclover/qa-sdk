---
def:
  tier: component
  id: gate-decode-build
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:build, work-domain:productivity]
  links:
    - target: decode-quality-contract
      type: depends_on
gate:
  kind: build
  workDomain: productivity
  storyId: DEC-QUALITY-001
  package: decode-service
  command: pnpm --filter @qa-sdk/decode-service build
  successPattern: exit_code=0
  references: [packages/decode-service/src/server.ts, packages/decode-service/package.json]
  suggestOnPass: [gate-decode-test]
sources:
  - packages/decode-service/src/server.ts
  - packages/decode-service/package.json
---
# Decode Build Gate


## 탐색 ^navigation

quality-gates-system > decode-quality-bundle > **gate-decode-build**

형제: `decode-quality-contract` · `gate-decode-test` · `gate-decode-route`

## 목적 ^purpose

`decode-service`가 실행 가능한 서버 산출물과 타입을 정상 생성하는지 확인하는 빌드 게이트.
