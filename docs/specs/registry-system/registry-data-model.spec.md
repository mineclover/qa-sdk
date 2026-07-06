---
def:
  tier: component
  id: registry-data-model
  address: def_document:v2:342191
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [data, persistence, structural]
  links:
    - target: system-concepts
      type: depends_on
sources:
  - packages/registry-service/src/types/index.ts
  - packages/registry-service/src/db/schema.ts
  - packages/registry-service/src/lib/registry-service.ts
  - packages/registry-service/src/stores/prefix-owner-store.ts
  - packages/registry-service/src/stores/event-schema-store.ts
  - packages/registry-service/src/modules/services/service.types.ts
---
# Registry 데이터 모델

## 목적 ^purpose

PrefixOwnerRecord(prefix 메타데이터), ExtendedVersionRecord(버전별 상태/capacity/refs), DimRef(DAG 참조), EventSchemaRecord, ServiceRecord의 핵심 엔티티를 정의한다.

## 구성 ^overview

PrefixOwnerRecord: prefix, owner, kind, numberType, createdAt, meta, labels.
ExtendedVersionRecord: prefix, versionId, status, baseVersionId, capacity, deactivationMode, refs(composite), shape, stride, product.
DimRef: prefix, versionId, capacity (composite의 leaf 참조).
EventSchemaRecord: catalogId, serviceId, eventKey, eventVersion, displayName, recordKind, status, timestamps.
ServiceRecord: serviceId, name, tier/team/url, ownedPrefixes, consumedPrefixes, gatewayPath, runtime metadata.

## 상태 정의 ^state-def

ExtendedVersionRecord.status:
- draft: 편집 가능, capacity/entries 변경 가능
- locked: capacity 변경 차단, readiness gate 대기
- released: stride 확정, 배포 가능
- active: 현재 운영 중
- deprecated: 사용 중단, 기존 데이터 읽기만
