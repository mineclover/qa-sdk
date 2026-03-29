---
def:
  id: shopping-backend-data
  address: def_document:v2:342030
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: shopping-backend
  tags: []
  links:
    - target: shopping-backend-spec
      type: refines
---
# Shopping Backend — data/domain_data

## 목적 ^purpose

주문/결제/권한 비즈니스 데이터. order_event, permission, event, endpoint prefix의 이벤트 레코드 구조.

## 구성 ^overview

Shopping Backend — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
