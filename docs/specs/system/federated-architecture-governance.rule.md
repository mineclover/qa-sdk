---
def:
  id: federated-architecture-governance
  type: spec
  level: leaf
  tier: layout
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, architecture, governance, cross-scope, observability]
  links:
    - target: system-specs-rules-index
      type: refs
    - target: layer-separation
      type: refines
    - target: package-surface-separation-rule
      type: constrains
    - target: catalog-purity-bridge
      type: refines
    - target: system-packages
      type: refs
    - target: federated-connection-contract
      type: refs
    - target: federated-connection-runtime
      type: refs
    - target: definition-catalog-spec
      type: constrains
    - target: dkg-system
      type: constrains
    - target: spec-verification-system
      type: constrains
    - target: system-taxonomy
      type: refs
    - target: spec-definition-separation
      type: refs
    - target: spec-verification-system
      type: refs
sources:
  - packages/definition-catalog/src/catalog.ts
  - packages/definition-catalog/src/data-source.ts
  - packages/definition-data-source/src/factory.ts
  - packages/spec-schema/src/shared/graph-port.ts
  - packages/spec-analyzer/src/types.ts
  - packages/spec-tracker/src/types.ts
  - packages/spec-transition/src/transition-engine.ts
  - packages/spec-transition/src/output-applier.ts
  - packages/federated-connection/src/contract.ts
  - packages/federated-connection/src/keys.ts
  - packages/federated-connection/src/validate.ts
  - packages/federated-connection/src/registry.ts
  - packages/federated-connection/src/identifier-registry.ts
  - packages/federated-connection/__tests__/identifier-registry.test.ts
  - packages/federated-connection/src/source-adapter.ts
  - packages/federated-connection-runtime/src/runtime-contract.ts
  - packages/federated-connection-runtime/src/planner.ts
  - packages/federated-connection-runtime/src/store.ts
  - packages/federated-connection-runtime/src/runtime.ts
  - packages/quality-ledger/src/types.ts
  - packages/review-ledger/src/types.ts
  - packages/dkg/src/bootstrap-types.ts
  - packages/dkg/src/graph-registry.ts
  - packages/dkg-enrichment/src/enrich-dkg-graph.ts
  - packages/engine/src/reconstruction/reconstruct.ts
  - scripts/spec-verification-runner.ts
---

# Federated Connection System Governance Rule

## 목적 ^purpose

qa-sdk가 기존에 지향해온 원칙, 즉 여러 원본 시스템의 업무 기능을 재구현하지 않고 원본의 소유권과 독립적인 진화를 보존하면서 각 시스템의 식별자를 연결·해석·검증한다는 방향을 운영 경계로 명확히 고정한다. 이 문서는 새로운 제품 범위를 선언하는 설계서가 아니라, 각 기능이 무엇을 소유하고 무엇을 절대 소유하지 않는지 판정하는 system-level 운영 원칙이다.

이 규칙의 기본 명제는 다음과 같다.

> 원본 시스템은 최종 상태와 권위를 소유한다. qa-sdk는 그 상태를 관측하고, 유한한 계약과 좌표로 식별하며, typed relation과 정책을 바탕으로 설명 가능한 제안과 검증 증거를 만든다.

`qa-sdk`의 연결 그래프는 원본의 대체 저장소가 아니다. 연결 시스템이 소유하는 것은 원본 데이터의 전체 복제가 아니라 연결 식별자, source reference, 관계, 매핑, lineage, revision, 정책, 결정, 검증 증거다.

## 목표와 비목표 ^scope

### 목표

qa-sdk가 기존 방향성 안에서 담당하는 중간 연결 시스템(connection system)의 책임은 다음과 같다.

- 각 원본 시스템의 local ID와 ID 규칙을 source별 namespace로 보존한다.
- 서로 다른 source record를 연결하기 위한 qa-sdk 소유의 connection identity를 관리한다.
- source reference와 connection identity 사이의 mapping을 별도 기록한다.
- 연결된 대상 사이의 typed relation, lineage, revision, effective period를 관리한다.
- 변경을 관측하고 연결 관계에 미치는 영향과 검증 증거를 만든다.
- 원본에 대한 쓰기는 별도 adapter와 승인 계약으로 제한하고, 연결 시스템 자체의 판단과 원본의 실행을 분리한다.

### 비목표

다음은 qa-sdk의 목표가 아니다.

- ERP, CRM, WMS 등 원본 업무 시스템 전체를 재구현하는 것
- 원본의 transaction, workflow, permission, business rule을 중앙에서 대체하는 것
- 모든 source payload를 중앙 DB에 복제하여 master data를 만드는 것
- source local ID를 하나의 전역 ID로 강제하거나 source의 독립적 진화를 막는 것
- 연결 관계만으로 원본 변경을 자동 실행하는 것

따라서 “연합형 시스템”은 모든 업무 시스템을 하나로 합친다는 뜻이 아니라, **각 시스템은 자기 영역을 운영하고 qa-sdk는 그 사이의 식별·관계·변경 연결을 운영한다**는 뜻이다.

## 시스템 경계 ^overview

```text
[원본 시스템]
  데이터 / local ID / revision / 권한 / 최종 상태 소유
          |
          | observe, fetch, snapshot, normalize, diff
          v
[qa-sdk 중간 연결 시스템]
  source namespace / connection identity / mapping / typed relation
  revision / lineage / impact evidence
          |
          v
[qa-sdk 그래프·관계 계층]
  typed node / typed edge / mapping / lineage / constraint
          |
          v
[qa-sdk 해석·정책 계층]
  drift / impact / compatibility / propagation plan 후보
          |
          v
[제안·승인 경계]
  사람 또는 명시된 승인 정책이 plan을 승인
          |
          v
[외부 실행 adapter]
  precondition 확인 후 approved plan만 적용
          |
          | re-fetch, compare expected revision/value/shape
          v
[검증·감사 계층]
  evidence / quality gate / review / audit
```

현재 qa-sdk에는 위 흐름을 구성할 여러 기반과 `federated-connection` contract/identifier registry, `federated-connection-runtime` 운영 조합 표면이 존재한다. source-specific adapter 실행, 외부 source write, 중앙 evidence/audit ledger 연동은 여전히 별도 경계이며, runtime은 이들을 대체하지 않는다. 따라서 구현된 orchestration과 비어 있는 외부 연결부를 구분해 사용한다.

## 책임 모델 ^responsibility

| 영역 | qa-sdk가 소유하는 것 | 현재 주요 표면 | 소유하지 않는 것 |
|---|---|---|---|
| 원본 관측 계약 | source adapter 경계, fetch/snapshot/diff 입력, 관측 이벤트 계약 | `federated-connection`의 `SourceAdapter`/`SourceSnapshot`/`observeSource` | source API client, webhook/polling 실행, 원본의 최종 데이터, 원본 ID 정책, 원본 권한 |
| 원본 관측 실행 | runtime 수집과 source별 adapter 연동 | `federated-connection-runtime` orchestration, `@qa-sdk/sdk`, browser/ingest/registry 계층 및 후속 source adapter | 원본의 최종 데이터, 원본 ID 정책, 원본 권한 |
| identity·계약·좌표 | 유한 vocabulary, definition envelope, address 계산, permission primitive | `taxonomy-engine`, `definition-catalog`, `spec-schema`, `weighted-index`, `index-meta`, `permission-engine`, `@qa-sdk/core` | 외부 시스템 ID의 대체, 주소 자체의 업무 의미 |
| 연결 identity·mapping | source namespace, source별 유한 identifier rule, connection identity, crosswalk, mapping revision/status | `federated-connection` contract/identifier registry + `federated-connection-runtime` state store | ERP master data, source ID 변경, 업무 entity의 최종 의미, source payload authority |
| 관계·지식 그래프 | typed node/edge, mapping 참조, lineage, constraint, decision knowledge | `GraphPort`, `GraphRegistry`, `dkg`, `dkg-enrichment`, definition graph | 원본 payload 전체, 실행 가능한 business logic, source authority |
| 해석·정책 | drift, impact, compatibility, 후보 plan, 결정론적 진단 | `federated-connection-runtime` planner, `spec-analyzer`, `engine`, `spec-transition`, DKG skills | 자동 source write, 승인 우회, 해석 결과의 암묵적 graph write |
| 실행 | 승인된 plan의 adapter 적용을 위한 계약과 precondition | `federated-connection-runtime` + 주입된 `SourceExecutionAdapter`, `spec-transition` output applier | 분석기·validator의 직접 mutation, 승인되지 않은 source 변경 |
| 검증·감사 | 재조회 결과, contract evidence, quality/review 결과, 상태와 audit trail | runtime execution record, `spec-tracker`, `quality-ledger`, `review-ledger`, verification runner | definition ownership, apply 성공의 자동 verified 판정 |

### 1. Source authority

원본 시스템은 다음을 계속 소유한다.

- 최종 business state와 source-local identifier
- source revision, permission, transaction, 삭제 정책
- source-specific schema와 business rule
- write 후 최종 상태에 대한 권위

qa-sdk가 보관하는 source record는 최소한 `sourceSystem`, `externalId`, `externalRevision` 또는 동등한 version, 관측 시각, snapshot/hash, authority 정보를 가진 참조 또는 evidence여야 한다. `graphNodeId`와 `externalId`를 같은 identity로 취급하지 않는다.

webhook 또는 change event는 변경 신호이지 최종 상태가 아니다. 가능한 경우 반드시 원본을 다시 조회하여 snapshot과 revision을 확정한 뒤 diff를 계산한다.

### 2. Coordinate와 semantic relation

coordinate kernel은 인코딩 가능한 유한 vocabulary와 주소 수학을 소유한다. semantic graph는 서로 다른 노드가 어떤 의미로 연결되는지를 소유한다.

- `address`는 identity authority가 아니라 좌표다.
- `prefix`와 `axis`는 유한한 분류 계약이지 source record 자체가 아니다.
- typed edge는 `owns`, `maps_to`, `derived_from`, `depends_on`, `invalidates`, `verifies`처럼 관계의 의미를 표현한다.
- `RELATED_TO` 같은 무의미한 일반 edge로 관계를 압축하지 않는다.

특히 definition address의 version을 identity로 해석할 때는 주의한다. 현재 v1 `def_document` 주소는 공유 분류 주소일 수 있어 전역 unique identity가 아니다. v1 주소만으로 source 또는 definition 문서를 복원하지 않으며, 실행 artifact는 run 시점의 `docId`와 binding 상태를 보존해야 한다. v2처럼 문서 identity가 좌표에 포함된 경우에만 address lookup을 identity resolution에 사용할 수 있다.

### 3. Graph, mapping, policy

세 개념은 서로 대체하지 않는다.

| 개념 | 질문 | 저장하는 것 |
|---|---|---|
| relation | 두 노드는 어떤 의미로 연결되는가? | typed edge와 source/target reference |
| mapping | 한 표현을 다른 표현으로 어떻게 대응시키는가? | transform version, field mapping, loss/ambiguity 정보 |
| policy | 변경을 어디까지 전파할 수 있는가? | mode, approval rule, precondition, invalidation rule |

edge에 실행 코드를 넣지 않는다. mapping transform과 propagation policy는 버전이 있는 별도 계약으로 다루며, interpreter가 graph snapshot과 함께 읽는다.

## 그래프 역할 분리 ^graph-boundary

qa-sdk에서 “그래프”라는 이름은 서로 다른 질문을 담을 수 있으므로, 저장소나 API를 통합한다는 이유만으로 의미를 합치지 않는다.

| 그래프 | 답하는 질문 | 현재 책임 표면 | 연합 시스템과의 관계 |
|---|---|---|---|
| definition graph | qa-sdk가 어떤 정의·문서·계약을 가지고 있으며 서로 어떻게 연결되는가? | `definition-catalog`, definition-service/data-source, spec verification | definition metadata의 구조를 관리하며 source business record의 대체가 아님 |
| DKG / decision graph | 어떤 결정·제약·소비자·의도·스킬이 왜 연결되는가? | `dkg`, `dkg-enrichment`, decision-flow | 해석에 필요한 설계·판단 지식이며 source synchronization graph의 대체가 아님 |
| federation relation graph | 서로 다른 source record가 어떤 typed relation과 mapping으로 대응되고 어떻게 전파되는가? | 중간 연결 시스템이 소유해야 할 핵심 경계; `federated-connection`이 순수 contract/registry를 제공하고 persistent graph는 후속 경계 | source reference, lineage, mapping, policy를 연결하지만 source 업무 모델을 소유하지 않음 |

따라서 definition graph와 DKG는 서로를 직접 흡수하지 않는다. 필요한 경우 `refs`, `traces_to`, adapter 또는 evidence로 연결하고, federation relation graph가 생기더라도 source identity와 definition identity를 동일한 node key로 강제하지 않는다. 새 graph API를 추가할 때는 먼저 어느 질문을 소유하는지와 어떤 graph를 읽고 쓰는지 명시한다.

중간 연결 시스템의 최소 소유 모델은 다음과 같다.

```text
source_ref(source_system, entity_type, local_id, revision)
          |
          | mapping(status, confidence, effective_period, transform_version)
          v
connection_ref(connection_namespace, connection_id, version)
          |
          | typed_relation(relation_type, source, target, provenance)
          v
impact / propagation candidate / verification evidence
```

`connection_ref`는 source의 canonical replacement가 아니다. source가 여러 개의 local ID를 유지하거나 source 간 mapping이 일시적으로 모호한 경우에도 각 source reference와 mapping 상태를 그대로 보존해야 한다.

## 운영 흐름 ^workflow

한 변경의 기본 흐름은 다음 순서를 지킨다.

| 단계 | 의미 | 책임 경계 |
|---|---|---|
| Observe | 변경 신호와 source context 수집 | source adapter / ingest |
| Fetch | source의 현재 상태와 revision 재조회 | source adapter |
| Snapshot | 관측 상태를 revisioned read-only-by-contract 입력으로 고정 | observation contract |
| Normalize | source-specific 표현을 공통 입력으로 변환 | adapter / normalization |
| Diff | 이전 snapshot과 현재 snapshot의 차이 계산 | analyzer 또는 adapter |
| Interpret | 관계·정의·영향·호환성 해석 | `spec-analyzer`, `engine`, DKG skills |
| Policy | propagation mode와 승인 필요성 판정 | policy contract / governance |
| Propose | 설명 가능한 candidate plan과 evidence 생성 | interpreter / CLI |
| Approve | 사람 또는 명시된 승인 정책이 plan 승인 | approval boundary |
| Freeze | plan version, input identity/status/revision/hash, policy version 고정 | execution contract |
| Execute | precondition을 확인하고 approved action 적용 | 외부 execution adapter |
| Re-fetch | 적용 대상 source를 다시 조회 | source adapter |
| Verify | expected revision/value/shape와 실제 상태 비교 | `spec-tracker`, quality/review ledger |
| Audit | actor, relation, policy, action, result 기록 | audit/evidence surface |

`Interpret`와 `Execute`는 분리한다. 동일한 `change + graph snapshot + policy version + transform version` 입력은 동일한 candidate plan을 만들어야 하며, interpreter는 source write나 graph lifecycle mutation을 수행하지 않는다. `Execute`는 승인된 plan과 실행 직전 source identity/status/revision/payload hash가 일치할 때만 동작해야 한다. apply 성공은 verify 성공과 같지 않다.

## 전파 정책 ^policy

전파는 관계가 있다는 이유만으로 자동 실행되지 않는다. 최소 정책 모드는 다음과 같다.

| 모드 | 기본 의미 |
|---|---|
| `automatic` | 사전 승인된 저위험 변경만 자동 적용 |
| `auto_with_review` | 적용 후 또는 병렬 review가 필수 |
| `review_required` | 승인 전 실행 금지 |
| `notify_only` | 영향과 권고만 기록 |
| `validate_only` | 호환성/검증만 수행하고 변경하지 않음 |
| `blocked` | 명시적인 예외 결정 없이는 진행하지 않음 |

기본 보수성은 다음과 같다.

- 단순 값 변경은 policy가 허용하는 경우에만 조건부 전파한다.
- 구조 변경은 호환성 확인과 review 없이는 전파하지 않는다.
- 의미·business rule 변경은 수동 판단을 기본으로 한다.
- identity 변경과 삭제는 자동 전파하지 않는다.
- precondition 또는 identity/status/revision/payload hash가 불일치하면 plan을 stale/blocked로 만들고 재계산한다.

## qa-sdk 내 현재 경계 ^current-state

현재 구현을 연합형 운영 모델에 매핑하면 다음과 같다.

1. `definition-catalog`은 유한한 definition vocabulary와 순수 graph validation을 제공한다. DB와 네트워크를 소유하지 않는다.
2. `definition-service`와 `definition-data-source`는 metadata persistence와 local/server/scan bridge를 제공한다. catalog의 권위를 대체하지 않는다.
3. `taxonomy-engine`은 유한 vocabulary의 parse/validate/diff/codegen surface다. source federation graph나 decision-flow runtime을 소유하지 않는다.
4. `weighted-index`, `index-meta`, `permission-engine`, `@qa-sdk/core`는 좌표와 권한 primitive다. source relationship와 propagation policy의 SSOT가 아니다.
5. `GraphPort`, DKG, definition graph는 관계·결정·제약을 표현한다. 그래프 write 권한과 source write 권한을 자동으로 부여하지 않는다.
6. `spec-analyzer`와 `engine`은 drift, reconstruction, impact, verdict 같은 해석/관측 결과를 만든다. 결과는 proposal/evidence로 취급한다.
7. `spec-transition`은 transition contract와 명시적인 output application 경계를 제공하지만 임의의 source executor나 승인 시스템은 아니다.
8. `spec-tracker`는 contract 또는 suite evidence를 기록한다. suite-level evidence를 특정 contract의 verified로 과장하지 않는다.
9. `quality-ledger`와 `review-ledger`는 gate/review evidence와 feedback 상태를 기록한다. 두 ledger가 business approval authority라는 뜻은 아니다.
10. CLI와 CI는 read-only 조합·검증 경계다. 분석 결과가 자동으로 definition graph나 source를 materialize한다고 가정하지 않는다.
11. connection contract, source별 identifier rule, validation/registry의 SSOT는 `federated-connection`이고, connection state/plan/approval/execution metadata와 observation에 고정된 identifier rule version의 운영 조합은 `federated-connection-runtime`이 소유한다. source-specific adapter와 외부 source write는 별도 경계이며, 이를 `definition-catalog`, `dkg`, `engine` 중 한 곳의 부가 기능으로 임의 소유하지 않는다.

따라서 현재 상태는 “순수 contract/registry와 persistence·impact planner·approval·precondition·re-fetch/verify orchestration 및 connection audit/evidence sink 경계가 구현됨”이지, “source-specific adapter·source write·중앙 quality/review/audit ledger가 하나의 종단 runtime으로 통합됨”은 아니다. 외부 adapter와 ledger는 연결 runtime의 소비 확장 경계로 취급한다.

## 최소 vertical slice ^implementation

첫 구현 단위는 원본 업무 기능이 아니라 **식별자 연결과 관계 검증**이 닫히는 read-mostly 흐름으로 제한한다.

```text
SourceEntity
  -> SourceIdentifierRule / SourceIdentifierRegistry
  -> SourceRef
  -> ConnectionRef
  -> Mapping
  -> TypedRelation
  -> ImpactCandidate
  -> VerificationEvidence
```

원본 업무 시나리오의 종단 추적은 이 연결 흐름의 소비자 증명으로만 둔다.

```text
UseCase
  -> ApiOperation
  -> DomainCommand
  -> Database Schema
  -> Tracking Event
  -> TestCase
```

여기에 연결 시스템의 다음 입력과 출력만 추가한다.

- source adapter가 source ID와 revision을 포함한 snapshot을 제공한다.
- qa-sdk graph가 source reference와 typed relation을 저장하거나 읽는다.
- interpreter가 impact와 propagation candidate를 만든다.
- policy가 `validate_only` 또는 `review_required`를 기본으로 선택한다.
- approval 전에는 source mutation이 없다.
- verify 단계가 재조회와 expected revision 비교를 수행한다.
- evidence와 audit가 같은 run/plan/revision을 가리킨다.

이 vertical slice의 identifier contract/registry는 `federated-connection`, persistence·planner·approval·execute/re-fetch/verify orchestration 및 connection audit/evidence sink 경계는 `federated-connection-runtime`으로 구현되었다. 다음 단계에서도 connection 전용 책임을 기존 `definition-catalog`, `dkg`, `engine` 중 편의상 한 곳에 흡수하지 않는다. source-specific adapter, external source write, central quality/review/audit ledger consumer가 실제로 필요할 때 각각 별도 연결 시스템 경계로 확장한다. 원본별 업무 기능은 해당 source 시스템에 남겨둔다.

## 금지되는 지름길 ^invariants

- webhook payload를 source final state로 저장하지 않는다.
- source local ID를 graph node ID로 덮어쓰지 않는다.
- coordinate address를 semantic relation 또는 authority로 해석하지 않는다.
- `relation`, `mapping`, `policy`, `approval`을 하나의 edge나 boolean으로 합치지 않는다.
- interpreter/analyzer/validator에서 source write 또는 자동 graph lifecycle mutation을 호출하지 않는다.
- approval과 relation을 같은 상태로 표현하지 않는다.
- apply 성공만으로 `verified`를 만들지 않는다.
- `ContractReport`를 source 또는 graph의 자동 권위 링크로 간주하지 않는다.
- definition graph 자동 materialize가 구현되지 않은 상태에서 자동 동기화를 주장하지 않는다.
- `validator green`을 전체 시스템 정상의 증거로 확대하지 않는다. workflow smoke와 source re-fetch evidence가 필요하다.
- context 경계를 넘는 import/export 없이 다른 source의 내부 모델을 직접 참조하지 않는다.
- 중앙 그래프에 source payload 전체를 복제하여 중앙 소유권을 만들어내지 않는다.

## 운영 체크리스트 ^validation

새 source 연동, graph edge, mapping, propagation rule 또는 executor를 추가할 때 다음 질문에 모두 답한다.

- [ ] 원본 시스템과 최종 권위 필드가 정해졌는가?
- [ ] source-local ID, graph ID, definition address가 구분되는가?
- [ ] snapshot/revision/hash와 관측 시각을 보존하는가?
- [ ] webhook과 re-fetch의 역할이 구분되는가?
- [ ] edge가 typed relation으로 의미를 표현하는가?
- [ ] mapping transform과 propagation policy에 version이 있는가?
- [ ] 변경 수준별 기본 mode와 approval boundary가 정해졌는가?
- [ ] interpreter output이 immutable plan 후보로 남는가?
- [ ] 실행 직전 identity/status/revision/payload hash precondition을 확인하는가?
- [ ] 실행 후 re-fetch와 verify evidence가 존재하는가?
- [ ] actor, source, relation, policy, plan, action, result를 audit에서 추적할 수 있는가?
- [ ] 기존 package surface의 소유권을 침범하지 않는가?

권장 품질 확인:

```bash
node packages/cli/dist/index.js def scan-audit
node packages/cli/dist/index.js def validate
corepack pnpm arch:feedback
corepack pnpm arch:usage
```

이 문서가 `approved`로 승격되기 전까지는 기존 연결 시스템 방향을 정리한 설계 근거로 사용하되, ERP 구현 완료나 자동화 보증의 근거로 사용하지 않는다.
