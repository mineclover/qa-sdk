---
def:
  tier: component
  id: content-api
  address: def_document:v2:412675
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: content-service
  tags: [external]
  links:
    - target: content-service-spec
      type: refines
sources:
  - packages/dkg/src/skills/service-explorer.ts
  - packages/dkg/src/service-topology.ts
  - packages/dkg/src/relational-instance.ts
  - packages/dkg/src/index.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
---
# Content Service — interface/api_contract

## 목적 ^purpose

콘텐츠 서비스의 현재 repo interface 계약. HTTP CRUD 표면이 아니라 DKG service/prefix 탐색과 relational prefix 인코딩/디코딩 헬퍼로 content-service 소유 prefix와 관계 모델을 조회한다.

## 구성 ^overview

Content Service — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
