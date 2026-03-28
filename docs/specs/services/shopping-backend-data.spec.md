---
def:
  id: shopping-backend-data
  address: def_document:v1:2672
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: shopping-backend
  tags: [tier-backend]
  links:
    - target: shopping-backend-spec
      type: refines
---
# Shopping Backend — data/domain_data

## 목적 ^purpose

주문/결제/권한 비즈니스 데이터. order_event, permission, event, endpoint prefix의 이벤트 레코드 구조.
