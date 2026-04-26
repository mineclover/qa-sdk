---
def:
  id: scaffold-openmetadata-storage
  type: spec
  tier: component
  level: leaf
  scope: data
  aspect: external_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, governance, openmetadata, metadata]
  links:
    - target: scaffold-governance-metadata
      type: refines
  sources:
    - packages/architecture-schematics/src/governance/openmetadata.ts
    - simulations/enterprise-pm/metadata/openmetadata/assignment.seed.json
---

# scaffold OpenMetadata storage

## 목적 ^purpose

OpenMetadata storage 표준은 domain/team/owner/glossary/lineage/data quality seed를 repo-local JSON manifest로 저장하고, 이후 배포/CI 단계에서 OpenMetadata API로 active injection할 수 있게 하는 메타데이터 저장 계약이다.

## 구성 ^overview

- manifest 최상위는 `openmetadata`와 `cacheKeys`를 가진다.
- `openmetadata.domain`은 bounded context의 Domain/Team/Owner 매핑이다.
- `openmetadata.glossary`는 도메인 용어집 seed다.
- `openmetadata.lineage`는 write path, event path, read path, consumption path의 edge skeleton이다.
- `openmetadata.qualityTests`는 null count, accepted values, row count, custom SQL 같은 품질 테스트 seed다.
- `cacheKeys`는 cache/read model/idempotency/lock key namespace를 동일 manifest에서 관리한다.

## 저장 규칙

- 메타데이터 seed는 서비스 코드 주석보다 우선하는 repo-local SSOT다.
- 코드 주석/Drizzle schema annotation은 seed를 보조하거나 생성하는 입력으로만 사용한다.
- OpenMetadata API sync 결과는 runtime observation이며 seed를 대체하지 않는다.
- read model/projection cache key는 반드시 OpenMetadata entity FQN과 연결되어야 한다.

