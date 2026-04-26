---
def:
  id: scaffold-governance-metadata
  type: spec
  tier: component
  level: leaf
  scope: data
  aspect: external_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, governance, metadata, openmetadata, lineage]
  links:
    - target: scaffold-system
      type: refines
    - target: scaffold-domain-schematic
      type: constrains
    - target: scaffold-openmetadata-storage
      type: contains
    - target: scaffold-cache-key-dsl
      type: contains
  sources:
    - packages/architecture-schematics/src/governance/openmetadata.ts
    - packages/architecture-schematics/src/governance/cache-key-dsl.ts
---

# scaffold governance metadata

## 목적 ^purpose

governance metadata 스펙은 `@qa-sdk/scaffold`가 도메인 코드뿐 아니라 OpenMetadata 연동에 필요한 데이터 자산, owner, glossary, lineage, 품질 테스트 skeleton을 빠르게 만들 수 있어야 한다는 생성 기준이다.

## 구성 ^overview

- bounded context는 OpenMetadata Domain/Team과 매핑된다.
- database table, outbox table, Kafka topic, sync worker, read DB artifact는 lineage 단위로 식별 가능해야 한다.
- Drizzle schema template은 PII 여부, owner, glossary term, data quality test 후보를 메타데이터 주석/설정으로 표현할 수 있어야 한다.
- deploy/codegen 단계는 active metadata injection으로 OpenMetadata API에 최신 service/entity/tag 정보를 전달할 수 있어야 한다.
- cache key namespace는 metadata manifest 안의 DSL로 정의하고 concrete key는 `prefix:version:id...` 형식으로 생성한다.

## 생성 대상 후보

- `metadata/openmetadata/*.seed.json`: domain/team/owner/glossary/lineage/data quality/cache key seed.
- schema template annotation: table/column owner, glossary term, PII tag, retention tag.

## 현재 상태

현재 구현은 Domain Slice Architecture scaffold, OpenMetadata/cache key manifest 타입과 검증 함수, read-model/BFF cache key seed 생성, metadata 누락 validator를 제공한다. OpenMetadata 운영 API active injection command는 후속 구현 대상이다.
