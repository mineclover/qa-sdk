---
def:
  id: operational-ontology-package-architecture
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-runtime-interface
      type: depends_on
---

# Operational Ontology Package Architecture — plane별 공개 표면

## 목적 ^purpose

`operational-ontology` 패키지의 공개 API를 개념 plane 기준으로 묶어, 패키지 구조 자체가 아키텍처를 설명하게 만든다. 목표는 외부 사용자는 `schema / corridor / junction / checkpoint / topology / projectors / persistence` 경계로 패키지를 읽고, 내부 구현도 같은 plane을 따르는 core 파일로 분해되게 하는 것이다.

## 구성 ^overview

현재 공개 표면은 아래 grouped facade로 나뉜다. 이 문서는 패키지 public surface를 설명하는 leaf 문서이고, 각 plane의 개념 정의 자체는 별도 문서를 참조한다.

- `operationalOntologySchemaPlane`
- `operationalOntologyPackPlane`
- `operationalOntologyImplementationGovernancePlane`
- `operationalOntologyLineagePlane`
- `operationalOntologyCorridorPlane`
- `operationalOntologyJunctionPlane`
- `operationalOntologyCheckpointPlane`
- `operationalOntologyTopologyPlane`
- `operationalOntologyProjectors`
- `operationalOntologyPersistencePlane`

동시에 subpath import도 같은 경계를 반영한다.

- `operational-ontology/schema`
- `operational-ontology/pack`
- `operational-ontology/governance`
- `operational-ontology/runtime`
- `operational-ontology/lineage`
- `operational-ontology/corridor`
- `operational-ontology/junction`
- `operational-ontology/checkpoint`
- `operational-ontology/topology`
- `operational-ontology/projectors`
- `operational-ontology/projectors/event`
- `operational-ontology/projectors/pipe`
- `operational-ontology/projectors/path`
- `operational-ontology/projectors/snapshot`
- `operational-ontology/persistence`
- `@qa-sdk/operational-ontology-web`

## 정의 ^defines

### 왜 facade가 필요한가

패키지는 개념과 구현이 빠르게 확장되면서 한동안 `index.ts`에 많은 타입과 함수가 모여 있었다. 이 상태에서는 외부 사용자가 아키텍처를 이해하기 어렵고, 내부 변경도 경계 없이 섞이기 쉽다. 그래서 먼저 facade와 subpath import로 경계를 드러내고, 그 다음 내부 core도 같은 plane을 따라 분해한다.

이 facade는 단순 문서상의 분류가 아니라 실제 코드 소유권 경계를 고정하는 장치다.

### 각 plane의 역할

- **schema plane**
  taxonomy/schema validation
- **pack plane**
  도메인 ontology pack의 schema/governance/blueprint 일괄 검증과 pack registry 조회
- **implementation governance plane**
  승인된 schema에서 구조 좌표와 구현/검증 binding, 제약 gate를 매칭하는 구현 거버넌스 계약
- **corridor plane**
  corridor template와 corridor validation
- **lineage plane**
  schema-aware lineage projection과 lineage skeleton 추론
- **junction plane**
  branch/route decision template와 projector
- **checkpoint plane**
  checkpoint template와 event observation projector
- **topology plane**
  snapshot 조합과 상위 topology validation
- **projectors**
  current system inputs를 operational-ontology 결과로 투영하는 aggregate compatibility layer
- **persistence plane**
  object/facet/payload 저장 계약 검증
- **visualization web**
  store JSON을 읽는 read-only topology viewer

projector의 실제 책임 경계는 아래 subpath에 맞춘다.

- `projectors/event`
- `projectors/pipe`
- `projectors/path`
- `projectors/snapshot`

### 현재 내부 core 구조

현재 내부 구현은 아래 core 파일로 분해된다.

- `src/internal/schema-core.ts`
- `src/internal/schema-memory.ts`
- `src/internal/pack-core.ts`
- `src/internal/implementation-governance-core.ts`
- `src/internal/implementation-governance-types.ts`
- `src/internal/implementation-governance-taxonomy.ts`
- `src/internal/implementation-governance-evaluator.ts`
- `src/internal/implementation-governance-persistence.ts`
- `src/internal/runtime-core.ts`
- `src/internal/lineage-core.ts`
- `src/internal/corridor-core.ts`
- `src/internal/junction-core.ts`
- `src/internal/checkpoint-core.ts`
- `src/internal/topology-core.ts`
- `src/internal/projector-types.ts`
- `src/internal/projector-shared.ts`
- `src/internal/event-projector.ts`
- `src/internal/lineage-projector.ts`
- `src/internal/pipe-projector.ts`
- `src/internal/path-projector.ts`
- `src/internal/snapshot-projector.ts`
- `src/internal/projector-core.ts`
- `src/internal/persistence-core.ts`
- `src/internal/persistence-memory.ts`
- `src/internal/persistence-snapshot.ts`
- `src/internal/persistence-ingest.ts`
- `src/internal/persistence-query.ts`
- `src/internal/persistence-service.ts`
- `src/internal/projector-utils.ts`

이 구조에서 `src/index.ts`는 더 이상 구현 본체가 아니라 composition root 역할을 하며, 각 public submodule은 해당 internal core 또는 projector aggregator를 직접 재수출한다.
