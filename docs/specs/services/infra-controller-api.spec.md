---
def:
  tier: component
  id: infra-controller-api
  address: def_document:v2:412679
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [external]
  links:
    - target: infra-controller-spec
      type: refines
---
# Infra Controller — interface/api_contract

## 목적 ^purpose

인프라 컨트롤러 API. 배포 트리거, 헬스 보고, 패턴 감지 결과 조회.

## 구성 ^overview

Infra Controller — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
