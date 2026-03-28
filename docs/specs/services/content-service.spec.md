---
def:
  id: content-service-spec
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: content-service
  tags: [tier-frontend]
  links:
    - target: system-infra
      type: refines
    - target: content-api
      type: contains
    - target: content-data
      type: contains
---
# Content Service

## 목적 ^purpose

콘텐츠 플랫폼 관리 서비스. content, relational 2개 prefix를 소유하여 콘텐츠 엔티티와 관계 모델 이벤트를 생산한다.
