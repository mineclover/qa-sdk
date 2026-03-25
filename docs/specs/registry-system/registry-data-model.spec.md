---
def:
  id: registry-data-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: system-concepts
      type: depends_on
---
# Registry 데이터 모델

## 목적 ^purpose

PrefixRecord(prefix 메타데이터), VersionRecord(버전별 상태/capacity/refs), DimRef(DAG 참조)의 3개 핵심 엔티티를 정의한다.

## 구성 ^overview

PrefixRecord: id, name, description, ownedBy, createdAt.
VersionRecord: prefix, versionId, status, baseVersionId, capacity, deactivationMode, refs(composite), shape, stride, product.
DimRef: prefix, versionId, capacity (composite의 leaf 참조).

## 상태 정의 ^state-def

VersionRecord.status:
- draft: 편집 가능, capacity/entries 변경 가능
- locked: capacity 변경 차단, readiness gate 대기
- released: stride 확정, 배포 가능
- active: 현재 운영 중
- deprecated: 사용 중단, 기존 데이터 읽기만
