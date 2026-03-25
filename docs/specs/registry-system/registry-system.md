---
def:
  id: registry-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: registry-service
  tags: [entry-point]
  links:
    - target: registry-api
      type: contains
    - target: registry-data-model
      type: contains
    - target: registry-version-lifecycle
      type: contains
    - target: registry-constraint
      type: contains
    - target: registry-services-api-spec
      type: contains
    - target: registry-events-spec
      type: contains
    - target: registry-client-spec
      type: contains
    - target: meta-registry-spec
      type: contains
---
# Registry 시스템

## 목적 ^purpose

Prefix DAG, 버전 라이프사이클, DraftWorkspace를 중앙에서 관리하는 서비스. 모든 서비스가 prefix/버전 정보를 등록하고, draft 파급 효과를 시뮬레이션하고, 배포 시점에 active 버전을 조회하는 단일 진입점.

## 구성 ^overview

4개 정의: REST API(prefix/version CRUD + DAG 질의), 데이터 모델(PrefixRecord/VersionRecord/DimRef), 버전 라이프사이클(draft→locked→released→active→deprecated), 제약(DAG 순환 금지, capacity 불변).
