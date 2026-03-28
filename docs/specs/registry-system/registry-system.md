---
def:
  id: registry-system
  level: unit
  address: def_document:v2:412687
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [structural, entry-point, tier-infra]
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

- `registry-api`: Prefix 등록/조회, 버전 생성/전이, DAG 관계 질의를 제공하는 REST 엔드포인트.
- `registry-data-model`: PrefixRecord(prefix 메타데이터), VersionRecord(버전별 상태/capacity/refs), DimRef(DAG 참조)의 3개 핵심 엔티티를 정의한다.
- `registry-version-lifecycle`: prefix 버전의 상태 전이 규칙.
- `registry-constraint`: Registry 시스템의 기술적 불변 조건.
- `registry-services-api-spec`: 서비스 디스커버리에 쓰이는 서비스 메타데이터를 등록, 조회, 수정하는 Registry API 계약과 검증 범위를 정의한다.
- `registry-events-spec`: 이벤트 정의 CRUD.
- `registry-client-spec`: 이벤트 레지스트리에 대한 검증 HTTP 클라이언트.
- `meta-registry-spec`: MetaRegistry — 주소 게이트웨이.
