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
    - target: dkg-skills-spec
      type: contains
---
# DKG (Design Knowledge Graph) 시스템

## 목적 ^purpose

고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하고, 그 기능이 다시 고정 축이 되는 누적적 성장 나선을 추적하는 설계 시점 메타데이터 그래프. 매 회전에서 "왜 이것을 닫았는가"를 구조적으로 보존한다.

## 구성 ^overview

5개 정의: 노드 16종(prefix/axis/domain/service 등), 엣지 18종(composes/observes/contains 등), 설계 시점 질의(listAllDiagrams/collectMetrics), 불변식(7개 CON 규칙), 성장 나선 모델(발견→닫힘→관측→새 발견).
