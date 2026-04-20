---
def:
  tier: component
  id: operational-ontology-production-factory
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-schema-validation
      type: depends_on
    - target: operational-ontology-core-model
      type: depends_on
    - target: operational-ontology-persistence
      type: depends_on
    - target: operational-ontology-simulation
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/implementation-governance-core.ts
  - packages/operational-ontology/src/internal/implementation-governance-types.ts
  - packages/operational-ontology/src/internal/implementation-governance-taxonomy.ts
  - packages/operational-ontology/src/internal/implementation-governance-evaluator.ts
  - packages/operational-ontology/src/internal/implementation-governance-persistence.ts
  - packages/operational-ontology/src/governance.ts
---

# Operational Ontology Implementation Governance — 구조 좌표와 구현/검증 매칭 plane

## 목적 ^purpose

`operational-ontology`에서 정의한 구조 좌표와 그 좌표에 매칭되는 구현 및 검증을 반복적으로 구체화하는 구현 거버넌스 plane을 정의한다. 여기서 factory는 생성 패턴이나 코드 생성 API가 아니라, 설계 환경과 구현 환경에서 같은 구조 규범을 적용하고 검증하게 만드는 운영 규칙이다.

## 구성 ^overview

implementation governance plane은 schema plane과 instance/projection plane 사이에 위치한다.

- **ImplementationBlueprint**
  - 어떤 ontology 좌표가 어떤 구현/검증 단위로 실현되어야 하는지 정의하는 계약
- **ImplementationBinding**
  - 구조 좌표와 실제 코드/문서/런타임 표면을 연결하는 매칭
- **VerificationBinding**
  - 구현 단위와 gate, simulation, test surface를 연결하는 매칭
- **GovernanceRun**
  - 특정 구현 변경에 factory 규범을 적용한 기록
- **PromptArtifact**
  - governance run과 작업영역 evidence에서 생성되는 `self_reflection` / `code_editing_rules` 산출물
- **ConsistencyConstraint**
  - 구현 단위가 반드시 만족해야 하는 구조 규칙
- **AdjustmentPolicy**
  - 제약 때문에 구현이 불가능할 때 허용되는 완화/분할/보류/에스컬레이션 규칙
- **EvolutionPolicy**
  - 새 구현 결과가 기존 family와 어떤 관계를 맺는지 정하는 규칙

초기 taxonomy interface는 `unitKinds`, `implementationSurfaceKinds`, `verificationSurfaceKinds`, `constraintKinds`, `constraintSeverities`, `adjustmentActions`, `evolutionPolicies`를 닫힌 vocabulary로 둔다. evaluator는 blueprint와 binding이 이 vocabulary 밖의 값을 쓰면 governance violation으로 판정한다.

패키지 내부 구현은 types, taxonomy, evaluator, persistence 모듈로 분리한다. core 파일은 public re-export 경계로만 둔다.

## 정의 ^defines

### 왜 governance plane이 필요한가

schema plane은 vocabulary와 grammar를 안정화하지만, 그 자체로 반복 구현의 일관성을 보장하지 않는다. runtime projector는 현재 입력을 ontology shape로 투영하지만, 어떤 구현이 어떤 구조 좌표를 실현하는지, 어떤 검증이 그 구현을 닫는지, 제약 충돌이 발생했을 때 무엇을 조정해야 하는지까지 소유하지 않는다.

factory/governance plane은 이 빈칸을 맡는다.

```
Schema -> Validate -> Bind Implementation -> Bind Verification -> Check -> Adjust -> Persist -> Observe -> Evolve
```

따라서 factory는 code-level 생성 헬퍼가 아니라 ontology 운영 규범 단위다. 같은 구조 좌표를 실현하는 구현 결과는 같은 family에 속하고, binding, constraint verdict, adjustment record, evolution edge를 통해 반복 발전 이력을 남겨야 한다.

prompt artifact generation은 이 governance run을 agent 실행 환경으로 전달하는 파생 단계다. factory가 만든 blueprint, binding, constraint verdict, adjustment record를 작업영역별 prompt section으로 투영하여 agent가 같은 설계 경계와 검증 단위를 반복 사용하게 한다.

### binding과 factory의 경계

`ImplementationBinding`은 구조 좌표와 구현 표면의 매칭을 담당한다.

- 어떤 ontology coordinate를 구현하는가
- 구현 surface가 코드, 문서, 런타임 projection 중 무엇인가
- required facet과 relation grammar가 구현에 어떻게 나타나는가
- 검증 가능한 단위가 어디서 닫히는가

`Factory`는 반복 적용, 규범 강제, 제약 조정을 담당한다.

- 어떤 blueprint를 실행하는지
- 어떤 consistency constraint와 validation gate를 통과해야 하는지
- 구현 family key를 어떻게 만들지
- 제약 충돌 시 relax/split/defer/escalate 중 무엇을 허용하는지
- 이전 구현과 `evolves_from`, `supersedes`, `forks_from` 중 어떤 관계를 만들지
- 실패한 governance run을 observation log에 어떻게 남길지

### consistency constraint

factory가 강제하는 제약은 구현 단위와 검증 단위가 닫히도록 만들어야 한다.

- `unit_boundary` — 이 구현이 어느 node/corridor/checkpoint family 안에서 닫히는가
- `required_facets` — identity, grammar, route 같은 필수 facet이 채워졌는가
- `allowed_relations` — relation category grammar를 벗어난 edge가 없는가
- `validation_surface` — 이 단위를 어떤 gate나 simulation으로 검증할 수 있는가
- `evolution_rule` — 새 결과가 이전 결과와 어떤 관계로 이어지는가

핵심은 "정확한 구조를 강제한다"가 아니라 "정의 가능한 단위와 검증 가능한 단위로 구현되게 강제한다"이다.

### 최소 데이터 모델
`ImplementationBlueprint`는 `blueprintId`, `coordinateRef`, `unitKind`, `requiredSchemas`, `implementationBinding`, `verificationBinding`, `constraints`, `adjustmentPolicy`, `evolutionPolicy`를 가진다. `GovernanceRun`은 `runId`, `blueprintId`, `implementationRefs`, `verificationRefs`, `familyKey`, `constraintVerdicts`, `adjustmentRecords`를 가진다. `ImplementationGovernanceTaxonomy`는 이 값들이 속해야 하는 닫힌 vocabulary를 제공한다.

저장은 object/facet bundle을 따른다. `ImplementationBlueprint`는 `schema`, `grammar`, `validation` facet을, `GovernanceRun`은 `evidence`, `status`, `aggregate`, `projection_meta` facet을 가질 수 있다. 저장 helper는 `persistImplementationGovernanceBlueprint()`와 `persistImplementationGovernanceRun()`으로 나뉘며, invalid blueprint는 명시적으로 허용하지 않으면 저장하지 않는다.

### adjustment policy
제약이 구현 불가능한 상태를 만들면 factory는 실패만 반환하지 않고 조정 후보를 만들어야 한다.

- `relax` — optional facet, optional edge, capacity 같은 비핵심 제약을 낮춘다.
- `split` — 단위가 너무 커서 검증 불가능하면 더 작은 구현/검증 target으로 나눈다.
- `defer` — 구조 일관성을 깨지 않는 enrichment를 후속 run으로 미룬다.
- `escalate` — required facet, identity axis, relation grammar 같은 core 제약 변경은 사람 결정으로 올린다.

조정 후보는 `targetRef`, 구조화된 `proposedChange`, `requiresDecision`을 포함해 다음 실행자가 후속 작업을 판단할 수 있어야 한다.

core evaluator가 모르는 custom constraint는 자동 통과시키지 않는다. extension evaluator가 없으면 unsupported constraint로 실패시킨다.

### evolution policy

반복 구현이 의미 있으려면 구현 결과 간 관계가 명시되어야 한다.

- `append_only` — 이전 구현 결과를 보존하고 새 run을 누적한다.
- `supersede` — 새 구현 결과가 이전 구현 결과를 대체한다.
- `fork` — 같은 blueprint에서 다른 입력/정책으로 갈라진 family를 만든다.
- `merge` — 여러 family의 구현 결과를 하나의 상위 bundle로 합친다.

이 관계는 relation taxonomy의 `trace` 또는 `lifecycle` 계열 category와 연결될 수 있다. 다만 factory 내부에서는 먼저 evolution policy와 adjustment policy로 판단하고, edge assertion은 그 결과를 graph fact로 남긴다.

### runtime projector와의 관계

projector는 외부 입력을 operational ontology shape로 바꾼다. factory는 projector 결과와 구현 surface를 같은 구조 좌표에 묶고, 그 매칭이 blueprint의 일관성 제약을 만족하는지 확인한다.

예를 들어 event projector는 `EventRecord`에서 checkpoint lattice를 만든다. factory는 그 lattice가 어떤 구조 좌표와 구현/검증 binding을 실현하는지 기록하고, required checkpoint/facet이 빠졌다면 완화 가능한 누락인지, 단위 분할이 필요한지, core 제약 에스컬레이션인지 판단한다.

### 검증 순서

governance run은 최소한 아래 순서를 지켜야 한다.

1. blueprint가 승인된 schema와 relation category만 참조하는지 검증한다.
2. implementation binding이 구조 좌표와 구현 표면을 연결하는지 검증한다.
3. consistency constraint를 적용해 구현/검증 단위가 닫히는지 확인한다.
4. 실패가 비핵심 제약이면 adjustment policy로 relax/split/defer 후보를 만든다.
5. core 제약 충돌이면 단독 변경하지 않고 에스컬레이션한다.
6. persistence plane에는 binding, constraint verdict, adjustment record를 함께 저장한다.
7. observation log에는 성공/실패와 drift 후보를 append-only로 기록한다.
