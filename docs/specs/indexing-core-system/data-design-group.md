---
def:
  id: data-design-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: data-design-compression
      type: contains
    - target: data-design-catalog
      type: contains
---

# 좌표 시스템 데이터 설계 그룹

## 목적 ^purpose

좌표 시스템의 데이터 설계를 주소 압축/범위 제어와 카탈로그 운영 원칙으로 나눠 재사용 가능한 단위로 정리한다.

## 구성 ^overview

overview: 총 2개 멤버.
- `data-design-compression`: 닫힌 조합 공간을 정수 주소로 압축하고 상위 차원에 편입하는 원리.
- `data-design-catalog`: entity 이름, prefix 카탈로그, 설계 원칙을 운영 관점에서 정리한 문서.

원본: `docs/specs/indexing/data-design.md` (`data-design-spec`)
