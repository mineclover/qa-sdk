---
def:
  id: gateway-service-spec
  level: module
  tier: system
  address: def_document:v2:412678
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: gateway
  tags: [planned]
  links:
    - target: system-infra
      type: refines
    - target: gateway-config
      type: contains
    - target: gateway-routing
      type: contains
---
# Gateway Service

## 목적 ^purpose

외부 트래픽을 내부 서비스로 라우팅하는 API 게이트웨이. flow_point prefix를 소유하여 흐름 관측 포인트 이벤트를 생산한다. /v1 경로에서 prefix를 strip하여 내부 서비스에 전달한다.

## 구성 ^overview

Gateway Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
