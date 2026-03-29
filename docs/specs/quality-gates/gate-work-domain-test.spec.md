---
def:
  id: gate-work-domain-test
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: qa-sdk-cli
  tags: [testing, quality-gate, gate-kind:unit-test, work-domain:productivity]
  links:
    - target: work-domain-quality-contract
      type: depends_on
gate:
  kind: unit-test
  workDomain: productivity
  subDomainId: refactoring
  storyId: WD-001
  package: work-domain
  command: pnpm --filter work-domain test
  successPattern: exit_code=0
  references: [packages/work-domain/src/work-domain.test.ts]
  suggestOnFail: [gate-work-domain-build]
---
# Work Domain Test Gate

## 목적 ^purpose

`work-domain` 패키지의 registry, mapping, classification, gate-kind 로직이 테스트 수준에서 유지되는지 확인하는 단위 테스트 게이트.

## 구성 ^overview

빌드 산출물이 준비된 뒤 실행한다.
실패하면 바로 직전 build 게이트와 변경된 테스트 대상을 함께 점검한다.
