---
def:
  id: dkg-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: dkg-engine
  tags: [observability, entry-point, tier-system]
  links:
    - target: dkg-node-types
      type: contains
    - target: dkg-edge-types
      type: contains
    - target: dkg-queries
      type: contains
    - target: dkg-constraint
      type: contains
    - target: dkg-growth-spiral
      type: contains
    - target: dkg-skills-system
      type: contains
---

# DKG (Design Knowledge Graph) 시스템

## 목적 ^purpose

고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하고, 그 기능이 다시 고정 축이 되는 누적적 성장 나선을 추적하는 설계 시점 메타데이터 그래프. 매 회전에서 "왜 이것을 닫았는가"를 구조적으로 보존한다.

## 구성 ^overview

overview: 총 6개 멤버.
- `dkg-node-types`: DKG 그래프를 구성하는 16종 노드 타입.
- `dkg-edge-types`: DKG 노드 간 관계를 표현하는 18종 엣지 타입.
- `dkg-queries`: DKG 그래프에서 설계 시점 정보를 추출하는 질의 함수.
- `dkg-constraint`: DKG 그래프의 구조적 불변 조건 7종(CON-001~CON-007).
- `dkg-growth-spiral`: 고정 축 정의 → 운용 → 새 기능 발견 → 새 고정 축 순환의 성장 모델.
- `dkg-skills-system`: 종단 cascade, migrator 추론, VersionEvent 파생, Decision 템플릿, skill 카탈로그를 묶는 subgroup overview.
