---
def:
  id: payment-api
  address: def_document:v2:412683
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: payment
  tags: [external]
  links:
    - target: payment-service-spec
      type: refines
---
# Payment — interface/api_contract

## 목적 ^purpose

결제 서비스 API 계약. 결제 요청, 상태 조회, 웹훅 엔드포인트.

## 구성 ^overview

Payment — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
