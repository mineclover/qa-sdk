---
def:
  id: gate-work-domain-typecheck
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:typecheck, work-domain:productivity]
  links:
    - target: work-domain-quality-contract
      type: depends_on
gate:
  kind: typecheck
  workDomain: productivity
  subDomainId: refactoring
  storyId: WD-001
  package: work-domain
  command: pnpm --filter work-domain typecheck
  successPattern: exit_code=0
  references: [packages/work-domain/src/types.ts, packages/work-domain/src/gate-kind.ts]
  suggestOnPass: [gate-work-domain-build]
---
# Work Domain Typecheck Gate

## 목적 ^purpose

`work-domain` 패키지의 공개 타입과 게이트 taxonomy가 TypeScript 수준에서 깨지지 않는지 먼저 검증하는 정적 품질 게이트.

## 구성 ^overview

가장 값싼 검증부터 수행한다.
실패하면 이후 build/test보다 먼저 타입 불일치를 정리한다.
