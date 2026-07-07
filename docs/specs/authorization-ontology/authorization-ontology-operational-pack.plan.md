---
def:
  id: authorization-ontology-operational-pack-plan
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [security, structural, observability]
  links:
    - target: authorization-ontology-system
      type: traces_to
    - target: operational-ontology-pack-interface
      type: traces_to
    - target: authorization-ontology-decision-observation
      type: traces_to
    - target: authorization-ontology-audit-layer
      type: traces_to
sources:
  - packages/authorization-ontology/src/index.ts
  - packages/authorization-ontology/src/index.test.ts
  - packages/authorization-ontology/package.json
---

# Authorization Ontology Operational Pack — 현황과 적용 계획

## 목적 ^purpose

이미 구현 중인 authorization ontology를 operational ontology pack 인터페이스에 맞춰 정리하는 계획이다. 목표는 기존 projector와 audit 코드는 유지하면서, schema와 governance blueprint를 pack 단위로 검증할 수 있게 만드는 것이다.

## 현황 ^overview

현재 authorization ontology는 다음 capability를 가진다.

- Cerbos resource policy projection
- Cerbos derived roles projection
- proxy route / application middleware enforcement projection
- permission-engine role·permission set bridge
- column lineage policy propagation
- decision observation projection
- graph merge, audit, diff, in-memory graph store
- authorization monitor web 분리 계획

## 계획 ^defines

1. `authorization-ontology` pack schema를 정의한다.
   - principal, resource, action, policy, decision, enforcement point, lineage policy 축
   - authorization/enforcement/audit/lineage relation category
   - decision audit traversal
2. governance blueprint를 작성한다.
   - decision observation checkpoint lattice
   - proxy route enforcement graph
   - application middleware enforcement graph
   - column lineage policy propagation
   - graph audit report
3. `validateOperationalOntologyPack()`으로 pack-level 검증을 추가한다.
4. 구현/검증 binding은 기존 `packages/authorization-ontology/src/index.ts`와 테스트 파일을 먼저 참조한다.
5. 이후 graph store/API와 monitor web live API가 준비되면 runtime projection binding으로 확장한다.

## 비범위

이 계획은 authorization ontology 런타임 코드를 재작성하지 않는다. 먼저 pack interface 위에 현재 구현을 얹어 검증 가능한 좌표와 governance blueprint를 확보한다.
