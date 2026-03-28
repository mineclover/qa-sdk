---
def:
  id: shopping-backend-spec
  address: def_document:v2:68644
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: shopping-backend
  tags: [tier-backend]
  links:
    - target: system-infra
      type: refines
    - target: shopping-backend-api
      type: contains
    - target: shopping-backend-data
      type: contains
---
# Shopping Backend

## 목적 ^purpose

주문/결제/권한 등 비즈니스 핵심 로직을 처리하는 백엔드 서비스. order_event, permission, event, endpoint 4개 prefix를 소유하여 주문 흐름과 API 엔드포인트 이벤트를 생산한다.
