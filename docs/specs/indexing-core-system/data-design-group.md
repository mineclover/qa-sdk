---
def:
  id: data-design-group
  tier: system
  address: def_document:v2:342020
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, cross-scope]
  links:
    - target: data-design-compression
      type: contains
    - target: data-design-catalog
      type: contains
    - target: indexing-core-system
      type: depends_on
---

# 좌표 시스템 데이터 설계 그룹

## 목적 ^purpose

좌표 시스템의 데이터 설계를 주소 압축/범위 제어와 카탈로그 운영 원칙으로 나눠 재사용 가능한 단위로 정리한다.

## 구성 ^overview

- `data-design-compression`: 닫힌 조합 공간을 정수 주소로 압축하고 상위 차원에 편입하는 원리.
- `data-design-catalog`: entity 이름, prefix 카탈로그, 설계 원칙을 운영 관점에서 정리한 문서.

원본: `docs/specs/indexing/data-design.md` (`data-design-spec`)
