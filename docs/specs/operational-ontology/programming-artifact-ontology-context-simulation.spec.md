---
def:
  id: programming-artifact-ontology-context-simulation
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: programming-artifact-ontology-system
      type: refines
    - target: programming-artifact-ontology-cli
      type: depends_on
    - target: programming-artifact-ontology-registry-provider
      type: depends_on
    - target: programming-artifact-ontology-quality-evidence
      type: depends_on
    - target: programming-artifact-ontology-activation-evidence
      type: depends_on
    - target: operational-ontology-prompt-artifact-generation
      type: depends_on
    - target: programming-artifact-ontology-context-simulation-plan
      type: traces_to
    - target: programming-artifact-ontology-context-simulation-todo
      type: traces_to
---

# Programming Artifact Ontology Context Simulation — context/dataflow 검증 계약

## 목적 ^purpose

프로그래밍 artifact ontology의 `extract-artifact` 흐름을 단일 CLI 동작이 아니라 context selection, registry topology, evidence interpretation, prompt consumption이 연결된 simulation framework로 정의한다. 목표는 작업자가 artifact ref에서 시작할 때 어떤 문서와 구현 evidence를 읽어야 하는지, quality-status sidecar가 어떤 data flow로 prompt governance closure를 닫는지 fixture 기반으로 검증하게 만드는 것이다.

## 구성 ^overview

simulation은 local artifact registry JSON과 CLI fixture를 입력으로 사용한다.

- context contract — 작업 유형별 required, optional, excluded context를 고정한다.
- data flow contract — Registry -> Topology -> Evidence -> Interpretation -> Governance Action -> Prompt Consumption projection을 단계별로 검증한다.
- scenario matrix — snapshot, ledger, freshness, conflict, non-quality artifact sidecar를 닫힌 case로 유지한다.
- implementation trace convention — 문서 `sources`, transform function, test title, warning/action code를 서로 추적 가능하게 둔다.

## Context Selection Contract

| 작업 유형 | required context | optional context | excluded boundary |
|-----------|------------------|------------------|-------------------|
| quality-status discovery | quality evidence spec, provider spec, `findRelatedQualityStatusRegistryRecords()`, `loadRelatedQualityStatusEvidence()` | prompt artifact generation spec | registry-service allocation lifecycle |
| quality-ledger fallback | quality evidence spec, `resolveQualityStatusRecordGateDescriptors()`, `QualityLedger.resolveBundleVerification()` | quality-gate topology helper tests | implicit `.qa-sdk/quality-ledger.sqlite` lookup |
| freshness SLA | quality evidence spec, freshness helper functions, snapshot/ledger timestamp fixture | quality-ledger docVersion stale tests | non-artifact prompt extraction |
| registry allocation boundary | system spec, context simulation plan/todo, adjacent registry allocation plan/todo | registry-service/index-meta docs | implementation of registry-service persistence |
| non-quality artifact sidecar | provider spec, activation evidence spec, build/generated/deploy/prompt/activation-evidence kind vocabulary, related quality-status record | generated/deployment/prompt follow-up scenarios, activation evidence persistence e2e test | 새 relation kind 추가 또는 scoped-prefix/REST activation 구현 |

## Data Flow Contract

| 계층 | 입력 shape | transform | 출력 shape | invariant | warning/action |
|------|------------|-----------|-------------|-----------|----------------|
| Registry | `artifactRef`, registry JSON | `ArtifactRegistryPromptArtifactContextProvider.resolve()` | direct record 또는 fallback source | direct hit와 sidecar evidence는 분리된다 | `create_programming_artifact_registry_record` |
| Topology | snapshot root/bundle refs, metadata refs, relation refs | `resolveQualityStatusRecordGateDescriptors()` | `GateDescriptor[]` | root direct gates와 bundle gates는 중복 없이 확장된다 | `quality-status-ledger-no-gate-descriptors` |
| Evidence | snapshot JSON, explicit ledger path | `loadQualityStatusSnapshotEvidence()` | record summary, warnings, governance runs | snapshot-first이고 ledger는 explicit fallback이다 | snapshot/ledger warning codes |
| Interpretation | record summary | `promptQualityStatusEvidenceFromArtifactExtraction()` | `PromptArtifactQualityStatusEvidence[]` | partial gate coverage는 `incomplete`, not `failed` | `prompt-quality-status-evidence-*` |
| Governance Action | prompt evidence | `governanceClosureSummary()` | `source.governanceClosure` | search fallback warning과 governance warning은 분리된다 | `close_governance_evidence` |
| Prompt Consumption | extraction sources + evidence | `evaluatePromptArtifactQuality()` | `artifacts[].quality.metrics` | complete verified target evidence만 `governance_closure`를 보강한다 | quality issue codes |

## Scenario Matrix

| scenario | fixture location | expected projection |
|----------|------------------|---------------------|
| verified snapshot | `ontology.test.ts`, quality export snapshot test | `quality-status-found`, no governance action |
| partial snapshot | `ontology.test.ts`, partial snapshot test | `quality-status-incomplete`, not failed |
| missing snapshot | `ontology.test.ts`, missing/invalid snapshot test | snapshot warning + incomplete/invalid closure |
| invalid snapshot | `ontology.test.ts`, missing/invalid snapshot test | `prompt-quality-status-evidence-invalid` |
| verified ledger fallback | `ontology.test.ts`, ledger fallback test | ledger evidence fills verified bundle/gate surface |
| incomplete ledger fallback | `ontology.test.ts`, incomplete ledger fallback test | `quality-status-ledger-incomplete` |
| snapshot/ledger conflict | `ontology.test.ts`, conflict test | conflict warning without snapshot override |
| stale snapshot generatedAt | `ontology.test.ts`, max-age snapshot stale test | generatedAt freshness stale, not docVersion stale |
| missing ledger timestamp | `ontology.test.ts`, missing timestamp test | freshness `incomplete`, not stale |
| build artifact sidecar | `ontology.test.ts`, non-quality build sidecar test | build registry hit consumes quality-status sidecar |

`activation-evidence` now has CLI persistence coverage: `ontology registry activate-pack ... --output <file> --artifact-registry <registry>` writes the record, validates/lists it, and resolves the activation sidecar through the same direct registry hit/provider projection as other non-quality artifacts. The simulation matrix does not need a new relation row because activation proof still uses existing `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, and `materializes_output` relations.

## Implementation Trace Convention

새 simulation fixture는 아래 네 이름을 함께 맞춘다.

- 문서 `sources`에는 소비자 코드와 targeted test 파일을 모두 넣는다.
- test title은 scenario 이름과 expected interpretation을 함께 포함한다.
- warning/action code는 CLI JSON field명과 같은 문자열을 assert한다.
- transform function을 바꾸면 이 문서의 Data Flow Contract와 provider/quality evidence/CLI leaf 중 해당 소유 문서를 함께 갱신한다.

## Relation Vocabulary Review

현재 simulation 결과로는 `verifies`가 quality-status evidence의 “target verification” 의미를 충분히 감당한다. 상태 보고는 relation이 아니라 evidence outcome과 `source.governanceClosure.status`가 담당하므로 새 relation은 추가하지 않는다. `activation-evidence`도 pack/ontology/allocation proof target을 `verifies`로 표현하고, command provenance와 sidecar materialization은 `produced_by`와 `materializes_output`으로 표현한다. `build`, `generated-source`, `deployment-output`, `prompt-artifact`, `activation-evidence`별 sidecar scenario가 모두 쌓인 뒤에도 target verification과 status reporting이 분리되지 않으면 그때 새 relation 후보를 5Q checklist로 분리한다.

## 비범위

- registry-service/index-meta allocation lifecycle 구현.
- 새 relation kind 또는 추가 axis.
- Additional activation evidence relation kinds or REST/scoped-prefix activation behavior.
- implicit quality-ledger discovery.
- production registry persistence 또는 artifact evidence provider 공통 interface 추출.
