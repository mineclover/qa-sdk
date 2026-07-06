---
def:
  id: definition-quality-contract
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: interface
  aspect: api_contract
  depth: specification
  svc: definition-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  sources:
    - packages/cli/src/commands/quality.ts
    - packages/cli/src/commands/quality.test.ts
    - packages/definition-catalog/src/contract.ts
    - packages/definition-catalog/src/contract.test.ts
    - packages/definition-catalog/src/contract-evidence.ts
    - packages/definition-catalog/src/contract-evidence.test.ts
  links:
    - target: definition-quality-gates
      type: refines
---
# Definition Quality Gates Contract

## 목적 ^purpose

`definition-quality-gates`가 외부 소비자에게 약속하는 quality bundle surface를 인터페이스 계약으로 고정한다.

## 구성 ^overview

핵심 계약은 `qa-sdk quality bundle`, `qa-sdk quality claims`, `qa-sdk quality run`, claim audit verdict 계산이다.
