---
def:
  id: programming-artifact-ontology-system
  level: module
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, observability]
  links:
    - target: programming-artifact-ontology-plan
      type: contains
    - target: programming-artifact-ontology-todo
      type: contains
    - target: programming-artifact-ontology-development-guide
      type: contains
    - target: programming-artifact-ontology-cli
      type: contains
sources:
  - packages/operational-ontology/src/internal/programming-artifact-core.ts
  - packages/operational-ontology/src/programming-artifacts.ts
---

# Programming Artifact Ontology System — 산출물 pack schema

## 목적 ^purpose

프로그래밍 산출물을 파일 경로나 자유 문자열이 아니라 operational ontology pack으로 관리되는 context target으로 정의한다. 목표는 build output, generated source, quality status, deployment output, prompt artifact를 닫힌 vocabulary와 registry provider로 묶어 `PromptArtifactContextProvider` 기반 prompt extraction에 먼저 연결하는 것이다.

## 구성 ^overview

이 모듈은 `programming-artifact-ontology` pack schema와 artifact registry provider contract로 구성된다.

- `programming_artifact_kind` axis — 산출물 node 종류를 닫힌 vocabulary로 분류한다.
- `programming_artifact_relation_kind` axis — 산출물과 producer/source/definition/output 사이의 edge 의미를 닫힌 vocabulary로 분류한다.
- `programming-artifact` taxonomy — artifact node identity를 artifact kind 기준으로 좌표화한다.
- `programming-artifact-relation` taxonomy — artifact edge identity를 relation kind 기준으로 좌표화한다.
- `programming_artifact_relation` relation category — artifact relation edge grammar를 제공한다.
- `artifact_prompt_context` traversal — artifact ref에서 prompt extraction context까지 가는 route family를 고정한다.
- `ArtifactRegistryPromptArtifactContextProvider` — registry record를 `PromptArtifactDefinitionContextExtraction`으로 변환하고 관련 `quality-status` record를 sidecar governance evidence로 찾는다.
- `programming-artifact-ontology-development-guide` — 세션 시작 컨텍스트 확인 순서와 변경 유형별 개발 지침을 고정한다.
- `programming-artifact-ontology-cli` — `extract-artifact` registry 우선 조회와 fallback 품질 신호를 고정한다.

## Pack Schema ^defines

`programmingArtifactOntologyPack`은 `OperationalOntologyPack`으로 선언된다.

```ts
{
  packId: "programming-artifact-ontology",
  schema: {
    axes: [
      { id: "programming_artifact_kind", values: PROGRAMMING_ARTIFACT_KINDS, stable: true, capacity: 16 },
      { id: "programming_artifact_relation_kind", values: PROGRAMMING_ARTIFACT_RELATION_KINDS, stable: true, capacity: 16 },
    ],
    taxonomies: ["programming-artifact", "programming-artifact-relation"],
    relationCategories: ["programming_artifact_relation"],
    traversals: [{ purpose: "artifact_prompt_context" }],
  },
  blueprints: ["programming-artifact-registry-provider"],
}
```

축 추가 5Q 판정:

| axis | Q1 유한 | Q2 의사결정 | Q3 공유 | Q4 안정 | Q5 capacity |
|------|---------|-------------|---------|---------|-------------|
| `programming_artifact_kind` | 5개 값으로 열거 | provider fallback, quality gate, 출력 처리에 영향 | build/codegen/quality/deploy/prompt에서 공유 | 산출물 상위 종류라 안정 | 5 × 2 → 16 |
| `programming_artifact_relation_kind` | 5개 값으로 열거 | context traversal과 ownership 판단에 영향 | registry/provider/CLI/gate에서 공유 | relation role이라 안정 | 5 × 2 → 16 |

## Artifact Kind Vocabulary

| kind | 정의 |
|------|------|
| `build` | 빌드 명령이 생성한 bundle, package, compiled output |
| `generated-source` | codegen이나 schema materialization으로 만들어진 source file |
| `quality-status` | test, lint, gate, audit 결과를 담은 machine-readable status artifact |
| `deployment-output` | deployment URL, release bundle, infra output 같은 배포 결과 |
| `prompt-artifact` | `self_reflection`, `code_editing_rules`처럼 model prompt에 삽입되는 산출물 |

## Artifact Relation Vocabulary

| relation | 시작 | 끝 | 정의 |
|----------|------|----|------|
| `produced_by` | artifact | command/governance-run | 산출물을 만든 명령, gate, governance run을 가리킨다. |
| `derived_from` | artifact | artifact/source | 산출물이 의존해 파생된 입력 산출물이나 원본 source를 가리킨다. |
| `verifies` | artifact | definition/artifact/gate | 품질 상태나 prompt artifact가 검증한다고 주장하는 대상을 가리킨다. |
| `owned_by_definition` | artifact | definition | 산출물 변경 책임을 가진 definition 문서를 가리킨다. |
| `materializes_output` | artifact | definition/blueprint/output | 산출물이 구체화한 설계 출력, blueprint, release target을 가리킨다. |

## Registry Provider Contract

`ProgrammingArtifactRegistryStore`는 최소 조회 표면만 가진다.

```ts
interface ProgrammingArtifactRegistryStore {
  getArtifactByRef(artifactRef: string): ProgrammingArtifactRegistryRecord | undefined;
  listArtifacts?(): readonly ProgrammingArtifactRegistryRecord[];
}
```

`ProgrammingArtifactRegistryRecord`는 artifact identity와 vocabulary relation을 보존한다.

- `artifactId`, `artifactRef`, `kind`
- `producedByRef`
- `derivedFromRefs`
- `verifiesRefs`
- `ownerDefinitionId`
- `materializesOutputRefs`
- `sourceRefs`, `outputPath`, `verificationRefs`
- `contextDocs`, `relations`, `metadata`

`ArtifactRegistryPromptArtifactContextProvider`는 `PromptArtifactContextProvider`를 구현한다.

1. `targetKind === "artifact"`인 요청만 처리한다.
2. `artifactRef`, `artifactId`, `outputPath` 기준으로 registry record를 찾는다.
3. record의 relation vocabulary를 definition-context 형태의 root/children/outgoingLinks로 변환한다.
4. 변환 결과를 `extractPromptArtifactSourcesFromDefinitionContext()`에 전달한다.
5. 반환된 work area에 `artifact-kind:*`, relation constraints, artifact registry local instruction을 덧붙인다.
6. `listArtifacts()`가 있으면 `kind === "quality-status"`인 record 중 요청 artifact/definition/work area와 연결된 record를 추가로 찾는다.

관련 `quality-status` matching은 새 schema나 relation kind를 만들지 않는다. matcher는 quality record의 기존 필드만 읽는다.

- `verifiesRefs` — target artifact, definition, work area를 검증하는 품질 record.
- `materializesOutputRefs` — target artifact, definition, work area의 품질 상태를 구체화한 record.
- `sourceRefs` — target file/work area source와 연결된 품질 record.
- `outputPath` — 요청 ref가 품질 상태 artifact 자체인 경우.
- `relations` — 기존 relation vocabulary의 `verifies`, `materializes_output` edge만 사용한다.

`appendQualityStatusEvidenceToPromptArtifactExtraction()`은 직접 registry hit/fallback extraction에 관련 quality record의 provider extraction을 병합한다. 이 병합은 prompt source set의 `corridors`, `checkpointLattices`, `traversals`, `blueprints`, `governanceRuns`를 추가하는 additive closure이며, direct artifact record lookup 결과를 대체하지 않는다.

CLI extraction은 matched `quality-status` record에 `outputPath`가 있으면 해당 quality export JSON을 추가로 읽는다. 읽은 snapshot은 `rootId`, bundle id 목록, bundle state, gate count, claim count, `generatedAt`만 요약해 source metadata에 붙이고, bundle별 gate verification을 `quality-export-snapshot` governance run으로 변환한다. 파일이 없거나 JSON이 깨졌거나 quality export shape가 아니면 extraction은 계속 진행하고 structured warning만 JSON source에 남긴다. 이 로딩은 새 artifact kind, relation kind, provider schema, registry allocation lifecycle을 만들지 않는다.

`createProgrammingArtifactRegistryRecord()`는 export command가 동일한 관계 채움 규칙을 쓰게 하는 factory다. 입력에서 알려진 값만 보존하고, `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, `materializes_output` relation 배열을 정규화한다. 같은 relation이 field와 `relations` 양쪽에서 들어오면 `kind/fromRef/toRef/evidenceRef` 기준으로 dedupe한다.

CLI 연결은 두 방향이다.

- read path: `qa-sdk ontology prompt extract-artifact <artifact-ref> --artifact-registry <file>`가 registry record를 먼저 사용하고, 없으면 file/doc/search fallback으로 내려간다.
- write path: `qa-sdk codegen ... --artifact-registry <file>`와 `qa-sdk quality export ... --artifact-registry=<file>`가 생성 산출물 record를 append한다.

registry JSON은 배열 또는 `{ "artifacts": [...] }` 형태를 허용한다.

## 개발 컨텍스트

지속 개발 세션은 `programming-artifact-ontology-development-guide`의 순서를 따른다. 기본 순서는 system spec → plan → todo → CLI spec → prompt artifact generation spec → provider source/test → CLI source다. 이 순서는 작업자가 바뀌어도 같은 context boundary에서 출발하게 만드는 운영 규칙이다.

## 구현 참조

- 구현: `packages/operational-ontology/src/internal/programming-artifact-core.ts`
- 공개 표면: `packages/operational-ontology/src/programming-artifacts.ts`
- CLI 연결: `packages/cli/src/commands/ontology.ts:cmdPromptExtractArtifact`
- 테스트: `packages/operational-ontology/src/programming-artifacts.test.ts`
