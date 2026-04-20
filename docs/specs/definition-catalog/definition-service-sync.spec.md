---
def:
  id: definition-service-sync
  type: design
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  lineage_facet: egress
  lineage_kind: settlement
  links:
    - target: definition-catalog-spec
      type: contains
---

# Definition Service Sync — 동기화 로직

## 목적 ^purpose

로컬 마크다운 문서의 메타데이터를 추출하여 데이터베이스로 동기화(Ingest)한다.

## 의도 설명 ^intent

1. 마크다운의 `id` 필드는 `ingress` (유입) 된다.
2. `core` 단계에서 중복 및 유효성 검증을 거친다.
3. 최종적으로 DB의 `doc_id` 컬럼에 `egress` (안착) 된다.

## 검증 ^verification

- `definition-service-sync` 로직은 로컬 파일과 DB 간의 1:1 대응을 보장해야 함.
- 보조 로직(`auxiliary`)인 로깅은 비즈니스 흐름에 영향을 주지 않아야 함.
