---
def:
  id: shopping-backend-api
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: shopping-backend
  tags: [tier-backend]
  links:
    - target: shopping-backend-spec
      type: refines
---
# Shopping Backend — interface/api_contract

## 목적 ^purpose

쇼핑 백엔드 API 계약. 주문 생성, 결제 처리, 권한 확인 엔드포인트.
