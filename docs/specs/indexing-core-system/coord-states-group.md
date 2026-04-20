---
def:
  id: coord-states-group
  level: module
  tier: system
  address: def_document:v2:205824
  scope: state
  aspect: domain_state
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural]
  links:
    - target: coord-states-taxonomy
      type: contains
    - target: coord-states-versioning
      type: contains
---

# 좌표 상태 그룹

## 목적 ^purpose

좌표 상태 모델을 분류 체계와 버전/합성 규칙으로 분리해 상태 해석과 운영 변경의 책임 경계를 명확히 한다.

## 구성 ^overview

- `coord-states-taxonomy`: CORE/EXTENSION/PERIPHERAL과 활성 영역 선언을 정리한 상태 분류 문서.
- `coord-states-versioning`: 버전 스냅샷, diff, composite, 불변식을 묶은 운영 문서.

원본: `docs/specs/indexing/coordinate-states.md` (`coordinate-states-spec`)
