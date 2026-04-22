---
def:
  id: definition-frontmatter-metadata-system
  type: design
  tier: layout
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, metadata, entry-point]
  links:
    - target: definition-management
      type: refines
    - target: definition-metadata-id
      type: refs
    - target: definition-metadata-type
      type: refs
    - target: definition-metadata-tier
      type: refs
    - target: definition-metadata-owner-system
      type: refs
    - target: definition-metadata-projection-plane
      type: refs
    - target: definition-metadata-intent-hierarchy
      type: refs
    - target: definition-metadata-scope-aspect
      type: refs
    - target: definition-metadata-depth
      type: refs
    - target: definition-metadata-lifecycle
      type: refs
    - target: definition-metadata-layer
      type: refs
    - target: definition-metadata-knowledge-kind
      type: refs
    - target: definition-metadata-links
      type: refs
    - target: definition-metadata-tags
      type: refs
    - target: definition-metadata-source-map
      type: refs
    - target: definition-frontmatter-metadata-system-cases
      type: traces_to
    - target: definition-frontmatter-metadata-system-test
      type: traces_to
---

# Definition Frontmatter Metadata System

## 목적 ^purpose

definition frontmatter의 개별 metadata option system들을 조망하는 catalog layout이다. 목표는 `tier`, `scope`, `aspect`, `depth`, `lifecycle`, `links` 같은 필드가 임의 옵션이 아니라 각자 의미와 검증 규칙을 가진 독립 정의 단위로 탐색되게 하는 것이다.

## 구성 ^overview

- `definition-metadata-id`: 문서 stable identity system.
- `definition-metadata-type`: design/spec/knowledge 기록 종류 system.
- `definition-metadata-tier`: E/C/I/S + L/P 책임 분리 system.
- `definition-metadata-owner-system`: 최종 책임 owner system.
- `definition-metadata-projection-plane`: intent/execution 출처 평면 system.
- `definition-metadata-intent-hierarchy`: core/auxiliary 의도 비중 system.
- `definition-metadata-scope-aspect`: 문서 좌표의 주제와 측면 system.
- `definition-metadata-depth`: 정의 상세도 system.
- `definition-metadata-lifecycle`: 문서 상태 system.
- `definition-metadata-layer`: 존재 이유 system.
- `definition-metadata-knowledge-kind`: knowledge 세부 종류 system.
- `definition-metadata-links`: 그래프 관계 system.
- `definition-metadata-tags`: 횡단 관심사와 structural hint system.
- `definition-metadata-source-map`: 코드/문서 책임 연결 system.

## 운영 원칙 ^constraint

- 새 metadata field를 추가하면 이 layout에 option system 문서를 먼저 추가한다.
- enum 값 추가는 `types.ts`, `frontmatter.ts`, 이 문서군, 관련 validator/test를 함께 갱신한다. parser implementation source는 option system 또는 parser-specific spec이 소유하고, 이 layout은 조망만 한다.
- 문서 작성 가이드는 이 system을 참조하고, option 의미를 장문 복제하지 않는다.
- field가 단순 설명을 넘어 상태 전이/관계/좌표 판단을 가진다면 별도 option system으로 분리한다.
- 하위 option system들은 모두 `tier: system`, `scope: data`, `aspect: system_data` 좌표를 공유한다. 이 co-location은 metadata option이라는 같은 상위 vocabulary 안에서 `id`별 독립 책임을 표현하기 위한 의도적 구조이므로 각 option 문서는 `coordinate-cluster` 태그로 duplicate-coordinate 경고를 억제한다.
