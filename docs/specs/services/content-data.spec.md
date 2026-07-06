---
def:
  tier: component
  id: content-data
  address: def_document:v2:342019
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: content-service
  tags: [external]
  links:
    - target: content-service-spec
      type: refines
sources:
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/sdk-factory.ts
  - packages/demo-types/src/dims.ts
  - packages/demo-types/src/dsl.ts
  - packages/dkg/src/relational-instance.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
---
# Content Service — data/domain_data

## 목적 ^purpose

content, relational prefix 기반 콘텐츠/관계 모델 데이터. content는 콘텐츠 분류 좌표를, relational은 subjectKind/predicate/objectKind 관계 유형 주소를 정의한다.

## 구성 ^overview

Content Service — data/domain_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
