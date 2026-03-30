---
def:
  id: definition-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: definition-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: definition-quality-gates
      type: refines
---
# Definition Quality Gates Contract

## 목적 ^purpose

`definition-quality-gates`가 외부 소비자에게 약속하는 quality bundle surface를 인터페이스 계약으로 고정한다.

## 구성 ^overview

핵심 계약은 `qa-sdk quality bundle`, `qa-sdk quality claims`, `qa-sdk quality run`, claim audit verdict 계산이다.
