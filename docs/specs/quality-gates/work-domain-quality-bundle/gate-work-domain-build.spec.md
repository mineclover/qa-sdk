---
def:
  id: gate-work-domain-build
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [testing, quality-gate, gate-kind:build, work-domain:productivity]
  links:
    - target: work-domain-quality-contract
      type: depends_on
gate:
  kind: build
  workDomain: productivity
  subDomainId: refactoring
  storyId: WD-001
  package: work-domain
  command: pnpm --filter work-domain build
  successPattern: exit_code=0
  references: [packages/work-domain/package.json, packages/work-domain/tsup.config.ts]
  suggestOnPass: [gate-work-domain-test]
  suggestOnFail: [gate-work-domain-typecheck]
---
# Work Domain Build Gate


## 탐색 ^navigation

quality-gates-system > work-domain-quality-bundle > **gate-work-domain-build**

형제: `work-domain-quality-contract` · `gate-work-domain-typecheck` · `gate-work-domain-test`

## 목적 ^purpose

`work-domain` 패키지가 실제 배포 산출물(ESM/CJS/DTS)까지 정상 생성되는지 확인하는 빌드 게이트.

## 구성 ^overview

typecheck 통과 뒤 수행한다.
빌드 실패 시 보통 타입 또는 export surface가 어긋난 것이므로 앞선 정적 게이트로 되돌아간다.
