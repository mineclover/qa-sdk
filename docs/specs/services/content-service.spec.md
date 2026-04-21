---
def:
  id: content-service-spec
  tier: system
  address: def_document:v2:68616
  scope: feature
  aspect: domain_service_func
  depth: overview
  lifecycle: approved
  layer: domain
  svc: content-service
  tags: [external, cross-scope]
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

## 구성 ^overview

Content Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
