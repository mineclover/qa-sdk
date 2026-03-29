---
def:
  id: work-domain-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
---
# Work Domain Public Contract

## 목적 ^purpose

`work-domain` 패키지가 외부 소비자에게 약속하는 공개 타입과 함수 surface를 한 문서로 고정하여, 개별 품질 게이트가 무엇을 검증하는지 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `WorkDomainId`, `GateKindId`, `QualityGate`, `QualityGateSpec`, `resolveQualityGates()`, `buildDocQuery()`, `classifyUserStory()`다.
validation gate 문서는 이 계약을 깨지 않았는지 각 범위에서 검증한다.
