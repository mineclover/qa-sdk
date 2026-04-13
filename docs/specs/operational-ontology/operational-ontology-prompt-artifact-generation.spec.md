---
def:
  id: operational-ontology-prompt-artifact-generation
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  tags: [cross-scope, contract, testing]
  links:
    - target: operational-ontology-production-factory
      type: refines
    - target: operational-ontology-flow-corridor
      type: depends_on
    - target: operational-ontology-checkpoint
      type: depends_on
    - target: operational-ontology-traversal-coordinate
      type: depends_on
    - target: operational-ontology-package-architecture
      type: implements
sources:
  - packages/operational-ontology/src/internal/prompt-artifact-core.ts
  - packages/operational-ontology/src/prompt-artifacts.ts
  - packages/cli/src/commands/ontology.ts:cmdPromptExtract
  - packages/cli/src/commands/ontology.ts:cmdPromptExtractFile
---

# Operational Ontology Prompt Artifact Generation — 작업영역별 prompt 규칙 산출

## 목적 ^purpose

작업 영역이 분할된 상황에서 `operational-ontology`가 `self_reflection`과 `code_editing_rules` 같은 prompt artifact를 생성하는 규칙을 정의한다. 목표는 prompt 문구를 수동으로 복사하는 것이 아니라, corridor, checkpoint, traversal, governance run에 남은 설계 증거를 작업영역별 XML-like prompt section으로 투영하는 것이다.

## 구성 ^overview

prompt artifact generation은 implementation governance plane의 파생 산출물이다.

- **입력**
  - `PromptArtifactWorkArea` — 작업영역 id, root, editable path, stack, local instruction
  - `PromptArtifactUseCase` — 작업 의도별 context 수집 profile
  - `FlowCorridor` — 작업영역이 통과해야 하는 데이터/계약 통로
  - `CheckpointLattice` / `CheckpointObservation` — 관측 지점과 validation 상태
  - `TraversalObservation` — work area 외부 의존이나 경계 횡단 근거
  - `ImplementationBlueprint` / `GovernanceRun` — 구현 좌표, 검증 surface, constraint verdict
- **출력**
  - 모든 artifact는 root tag로 kind를 사용하고, `artifact_metadata`, `source_evidence`, `context_collection_contract`, `quality_gate` 공통 section을 먼저 가진다.
  - `self_reflection` — context boundary, bounded context gathering, tool reflection, completion check
  - `code_editing_rules` — work area boundary, editing principles, ontology binding, verification
- **검증**
  - artifact root tag가 artifact kind와 일치해야 한다.
  - 공통 section과 kind별 required section이 모두 있어야 한다.
  - 각 section은 최소 1개 rule line을 가져야 한다.
  - `content`는 `sections`에서 렌더링한 XML-like 구조와 일치해야 한다.
  - ontology source ref가 work area 외에 없으면 warning을 남긴다.
- **품질 평가**
  - `source_coverage` — work area 외 source ref가 충분한가
  - `boundary_clarity` — root, purpose, editable path가 명확한가
  - `corridor_contract_coverage` — corridor endpoint, contract, link가 채워졌는가
  - `checkpoint_observability` — checkpoint definition/observation이 관측 지점을 증명하는가
  - `traversal_grounding` — 경계 횡단이나 외부 의존이 traversal evidence로 설명되는가
  - `governance_closure` — blueprint, governance run, verdict, adjustment가 닫혔는가
  - `verification_surface` — test/gate/simulation/review surface가 연결됐는가
  - `content_consistency` — validator가 artifact content를 신뢰할 수 있는가
  - `qualityStatusEvidence` — artifact extraction에서 온 optional quality-status evidence. target verification과 verified bundle/gate evidence가 있을 때만 `governance_closure`를 additive로 보강한다.

OpenAI GPT-5 prompting guide는 XML-like delimiter, bounded context gathering, agentic persistence, 코드 편집 시 명확하고 유지보수 가능한 code output을 권장한다. 이 문서는 그 지침을 qa-sdk의 설계 좌표로 변환해, 프롬프트 품질을 사람이 작성한 단일 문구가 아니라 운영 증거에서 재생성되는 artifact로 관리한다.

## 정의 ^defines

### prompt artifact

prompt artifact는 model system prompt에 삽입 가능한 구조화 문구이지만, 원천은 prompt 파일이 아니라 operational ontology evidence다.

- `artifactId` — 재생성 가능한 산출물 식별자
- `kind` — `self_reflection` 또는 `code_editing_rules`
- `useCase` — 수집 context profile
- `workAreaId` — 적용되는 작업영역
- `sourceRefs` — work area, corridor, checkpoint lattice, traversal, blueprint, governance run 참조
- `sections` — XML-like tag와 rule line 목록
- `content` — 실제 prompt block 문자열
- `validation` — artifact shape 검증 결과

### self_reflection 생성 규칙

`self_reflection`은 agent가 작업 중 스스로 확인해야 하는 질문을 고정한다.

1. 먼저 작업영역 경계와 목적을 확인한다.
2. context gathering은 exact file, definition, coordinate를 특정할 수 있을 때 멈춘다.
3. tool call 결과마다 corridor/checkpoint/traversal/governance evidence가 계획을 바꾸는지 확인한다.
4. 완료 전에는 source ref, verification 상태, 남은 gap을 명시한다.
5. core coordinate, required facet, governance taxonomy 변경은 local edit로 처리하지 않고 에스컬레이션한다.

### code_editing_rules 생성 규칙

`code_editing_rules`는 작업영역에서 허용되는 코드 변경 방식을 고정한다.

1. editable path와 rootRef를 작업영역 boundary로 사용한다.
2. traversal 또는 governance adjustment가 외부 의존을 명명하지 않으면 boundary 밖을 직접 수정하지 않는다.
3. 구현은 blueprint coordinate와 corridor contract를 보존해야 한다.
4. 관측 좌표는 builder/projector가 소유하면 하드코딩하지 않는다.
5. verification surface가 있으면 실행하고, 없으면 governance gap으로 기록한다.

### 품질 지표 해석

`evaluatePromptArtifactQuality()`는 artifact를 model prompt로 쓰기 전에 ontology completeness probe로 평가한다.

- `85-100 ready` — 바로 사용 가능
- `60-84 usable` — 사용 가능하지만 ontology enrichment 권장
- `40-59 degraded` — artifact는 만들 수 있으나 governance warning 필요
- `0-39 blocked` — operational ontology 관리 후 재추출 필요

품질이 낮을 때는 `recommendedManagementActions`를 반환한다.

- `add_ontology_source_refs` — source ref가 부족하다.
- `define_work_area_boundary` — 작업영역 boundary가 불명확하다.
- `enrich_corridor_contracts` — corridor 계약이 비어 있거나 약하다.
- `add_checkpoint_observability` — 관측 지점이 부족하다.
- `record_traversal_grounding` — 경계 횡단 근거가 부족하다.
- `close_governance_evidence` — blueprint/run/verdict/adjustment가 닫히지 않았다.
- `bind_verification_surface` — 완료 조건을 검증할 surface가 없다.
- `repair_prompt_artifact_content` — generator나 저장 artifact content가 sections와 drift됐다.

`qualityStatusEvidence`는 artifact extraction 경로에서만 명시적으로 전달되는 optional input이다. 전달하지 않으면 기존 definition/file/permission prompt quality behavior가 유지된다. 전달된 evidence가 target을 `verifies`로 확인하고 verified bundle 또는 verified gate count를 보고하면 `governance_closure`는 기존 governance run score 위에 additive bonus를 받는다. failed, stale, invalid, incomplete outcome이나 verified bundle/gate가 없는 evidence는 score를 올리지 않고 `prompt-quality-status-evidence-*` governance warning을 남긴다. artifact extraction이 quality-status evidence를 기대했지만 match가 없으면 extraction은 막지 않고 `prompt-quality-status-evidence-missing` warning과 governance confidence cap으로 표현한다.

### 사용 방법

```ts
import { operationalOntologyPromptArtifactPlane } from "operational-ontology/prompt-artifacts";

const artifact = operationalOntologyPromptArtifactPlane.generatePromptArtifact({
  kind: "self_reflection",
  useCase: "event_inventory",
  workArea,
  sources: { corridors, checkpointLattices },
});
const quality = operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality({
  artifact,
  workArea,
  sources: { corridors, checkpointLattices },
});
```
`quality.grade`가 `blocked`면 `recommendedManagementActions`가 지목한 plane을 먼저 관리한 뒤 artifact를 재추출한다.
CLI에서는 `qa-sdk ontology prompt extract <doc-id> --use-case feature_modification --kind all`로 definition context 기반 artifact를 추출한다.
코드 파일에서 시작할 때는 `qa-sdk ontology prompt extract-file <code-path[:symbol]> --use-case feature_modification --kind all`로 authoritative definition boundary를 먼저 해석한다.
권한 기준에서 시작할 때는 `qa-sdk ontology prompt extract-permission <permission-ref> --kind all`로 authorization ontology의 permission 관련 context를 묶는다.
산출물 기준에서 시작할 때는 `qa-sdk ontology prompt extract-artifact <artifact-ref> --artifact-type <type> --artifact-registry <file> --kind all`로 registry record를 먼저 조회하고, 없으면 파일/doc/품질 게이트 후보 검색으로 내려간다.
`--artifact-registry`가 제공되면 direct artifact lookup 결과와 별개로 관련 `quality-status` record를 찾는다. quality record가 요청 artifact, definition, work area를 `verifiesRefs`, `materializesOutputRefs`, `sourceRefs`, `outputPath`, `relations`로 가리키면 그 record에서 파생된 corridor/checkpoint/traversal/blueprint/governance run을 prompt source evidence에 병합한다. quality record의 `outputPath`가 quality export JSON이면 root id, bundle id, bundle state, verified/total gate counts, claim counts, generated timestamp를 source metadata로 붙이고 bundle gate status를 `quality-export-snapshot` governance run으로 추가한다. 파일이 없거나 invalid JSON이면 prompt extraction은 계속 진행하고 structured warning을 JSON source에 남긴다. 이 병합은 fallback 종류를 바꾸지 않고 `source.qualityStatusRecords` JSON 요약으로 노출된다.
artifact extraction으로 생성된 prompt artifact quality evaluation은 같은 quality-status match를 `qualityStatusEvidence`로 넘긴다. registry hit/search fallback은 항상 evidence 배열을 넘겨 match 없음도 confidence cap으로 보이고, file/doc fallback에 위임된 경우에는 hidden artifact-source context가 있을 때만 이 evidence를 넘겨 일반 prompt extraction의 backward compatibility를 보존한다.
prompt artifact를 파일로 보존할 때는 `--output <file|dir>`를 사용하고, `--artifact-registry <file>`를 함께 주면 생성된 prompt block도 `kind=prompt-artifact` registry record로 남긴다.
programming/artifact ontology는 `PromptArtifactContextProvider`를 구현한 provider로 주입한다. provider는 artifact registry record를 `PromptArtifactDefinitionContextExtraction`으로 변환하고, 일반 provider contract는 `definition`, `code`, `permission`, `artifact` target을 같은 출력 형태로 맞춘다.
usecase에서 필수가 아닌 품질 차원은 `applicable: false`로 표시하고 score 계산과 management action에서 제외한다.
`close_governance_evidence`가 남으면 `--persist-governance --store <file>`로 synthetic governance evaluation을 운영 store에 기록하고 재추출한다.

### usecase별 수집 차이
- `test_exploration_and_edit` — test files, fixtures, scenario docs, verification bindings
- `feature_modification` — implementation entrypoints, corridor contracts, traversal blast radius, governance constraints
- `event_inventory` — event keys, payload fields, `address_context`, checkpoint observations
- `incident_investigation` — failed checkpoints, route decisions, failed verdicts, traversal terminals
- `schema_governance_review` — schema ids, blueprint coordinates, constraint verdicts, adjustment records
- `release_verification` — release gates, verification refs, checkpoint coverage, unresolved adjustments

## 구현 참조
- 구현: `packages/operational-ontology/src/internal/prompt-artifact-core.ts`; 공개 표면: `packages/operational-ontology/src/prompt-artifacts.ts`; 테스트: `packages/operational-ontology/src/prompt-artifacts.test.ts`
