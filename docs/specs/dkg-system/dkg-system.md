---
def:
  id: dkg-system
  level: module
  address: def_document:v2:342022
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: dkg-engine
  tags: [external, external, structural, observability, entry-point]
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
    - target: dkg-service-topology
      type: contains
---

# DKG (Design Knowledge Graph) 시스템

## 목적 ^purpose

고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하고, 그 기능이 다시 고정 축이 되는 누적적 성장 나선을 추적하는 설계 시점 메타데이터 그래프. 매 회전에서 "왜 이것을 닫았는가"를 구조적으로 보존한다.

## 구성 ^overview

- `dkg-node-types`: DKG 그래프를 구성하는 16종 노드 타입.
- `dkg-edge-types`: DKG 노드 간 관계를 표현하는 18종 엣지 타입.
- `dkg-queries`: DKG 그래프에서 설계 시점 정보를 추출하는 질의 함수.
- `dkg-constraint`: DKG 그래프의 구조적 불변 조건 7종(CON-001~CON-007).
- `dkg-growth-spiral`: 고정 축 정의 → 운용 → 새 기능 발견 → 새 고정 축 순환의 성장 모델.
- `dkg-skills-system`: 종단 cascade, migrator 추론, VersionEvent 파생, Decision 템플릿, skill 카탈로그를 묶는 subgroup overview.
- `dkg-service-topology`: 마이크로서비스 prefix 소유권, 공유 계약, 의존 그래프, draining/해제 관리.
