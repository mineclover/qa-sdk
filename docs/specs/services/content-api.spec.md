---
def:
  id: content-api
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: content-service
  tags: [tier-backend]
  links:
    - target: content-service-spec
      type: refines
---
# Content Service — interface/api_contract

## 목적 ^purpose

콘텐츠 서비스 API 계약. 콘텐츠 CRUD, 관계 모델 조회.
