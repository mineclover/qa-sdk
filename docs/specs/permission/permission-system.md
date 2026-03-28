---
def:
  id: permission-system
  address: def_document:v1:2144
  scope: constraint
  aspect: biz_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: auth
  tags: [structural, security, entry-point, tier-backend]
  links:
    - target: permission-model
      type: contains
    - target: permission-encoding
      type: contains
    - target: permission-constraint
      type: contains
    - target: masking-spec
      type: contains
    - target: perm-external-system
      type: contains
    - target: perm-codec-system
      type: contains
    - target: perm-migration-system
      type: contains
---

# 권한 엔진 시스템

## 목적 ^purpose

닫힌 권한 공간을 bitmask로 압축하고, 계층 상속과 외부 컨텍스트를 분리하는 권한 엔진. role → flat permission mask → scope 기반 해소 경로.

## 구성 ^overview

- `permission-model`: PermissionSet(권한 집합), TernaryMask(3진 마스크: allow/deny/unset), ScopedEngine(범위 해소)의 3개 코어 타입으로 구성된 권한 상태 모델.
- `permission-encoding`: 권한 데이터를 WeightedIndex(DB+범위 질의), BitIndex(인메모리 필터), IndexBridge(양쪽 호환)로 인코딩하는 데이터 구조.
- `permission-constraint`: 권한 시스템의 비즈니스 규칙과 제약.
- `masking-spec`: 클라이언트 측 payload의 민감정보를 마스킹해 전송 전 노출을 줄이는 보안 규칙과 적용 범위를 정의한다.
- `perm-external-system`: resource, service-ref, permission-code로 권한 엔진의 외부 식별자 계층을 분리한 subgroup overview.
- `perm-codec-system`: PermissionCodec의 3-tier codec stack과 PrefixCodec/MetaCodec 상호운용 계약을 분리한 subgroup overview.
- `perm-migration-system`: PermissionSet shape migration의 자동 재배치 규칙과 CoordMapper 보정 규칙을 분리한 subgroup overview.
