---
def:
  id: dkg-system
  tier: layout
  address: def_document:v2:342022
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: dkg
  tags: [external, external, structural, observability, entry-point]
  links:
    - target: dkg-node-types
      type: refs
    - target: dkg-edge-types
      type: refs
    - target: dkg-queries
      type: refs
    - target: dkg-constraint
      type: refs
    - target: dkg-growth-spiral
      type: refs
    - target: dkg-service-topology
      type: refs
    - target: dkg-state-store
      type: refs
    - target: federated-architecture-governance
      type: refs
sources:
  - packages/dkg/src/index.ts
  - packages/dkg/src/bootstrap.ts
  - packages/dkg/src/catalog-derive.ts
  - packages/dkg/src/graph-registry.ts
  - packages/dkg/src/dkg.types.ts
  - packages/dkg/src/service-topology.ts
  - packages/dkg-store/src/dkg-sqlite-store.ts
  - packages/dkg/src/doc-sync.test.ts
---

# DKG (Design Knowledge Graph) 시스템

## 목적 ^purpose

고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하고, 그 기능이 다시 고정 축이 되는 누적적 성장 나선을 추적하는 설계 시점 메타데이터 그래프. 매 회전에서 "왜 이것을 닫았는가"를 구조적으로 보존한다.

## 연결 시스템과의 경계 ^constraint

DKG는 qa-sdk의 기존 중간 연결 방향에서 **설계·결정·제약·소비자 지식**을 담당한다. source record 간 connection identity, crosswalk, source revision 또는 원본 업무 상태를 소유하지 않는다.

- DKG의 `DomainNode`, `ConsumerNode`, `IntentLinkNode`, `ConstraintNode`는 연결 시스템의 해석 context가 될 수 있지만, source mapping 자체가 아니다.
- source 간 대응 관계는 별도의 federation relation graph와 mapping 계약에서 관리한다.
- DKG와 연결 그래프 사이의 연결은 typed reference, decision evidence, adapter를 통해 명시한다.
- DKG graph를 확장할 때 source identity와 definition identity를 DKG node key로 합치지 않는다.

## 구성 ^overview

- `dkg-node-types`: DKG 그래프를 구성하는 16종 노드 타입.
- `dkg-edge-types`: DKG 노드 간 관계를 표현하는 18종 엣지 타입.
- `dkg-queries`: DKG 그래프에서 설계 시점 정보를 추출하는 질의 함수.
- `dkg-constraint`: DKG 그래프의 구조적 불변 조건 7종(CON-001~CON-007).
- `dkg-growth-spiral`: 고정 축 정의 → 운용 → 새 기능 발견 → 새 고정 축 순환의 성장 모델.
- `dkg-skills-system`: 종단 cascade, migrator 추론, VersionEvent 파생, Decision 템플릿, skill 카탈로그를 묶는 subgroup overview.
- `dkg-service-topology`: 마이크로서비스 prefix 소유권, 공유 계약, 의존 그래프, draining/해제 관리.
- `dkg-state-store`: 로컬 SQLite 상태 저장소와 usage/version/meta 테이블 구조.
