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
sources:
  - packages/dkg/src/service-topology.ts
  - packages/demo-types/src/dsl.ts
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/sdk-factory.ts
  - packages/dkg/src/relational-instance.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
---
# Content Service

## 목적 ^purpose

콘텐츠/관계 모델의 DKG/demo 서비스 경계. content-service는 content, relational prefix를 소유하고 dsl-content, dsl-access-control에 결합되어 콘텐츠 분류와 관계 유형 좌표를 제공한다.

## 구성 ^overview

Content Service의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
