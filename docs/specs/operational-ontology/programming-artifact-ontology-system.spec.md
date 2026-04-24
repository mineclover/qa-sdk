---
def:
  id: programming-artifact-ontology-system
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, observability, cross-scope]
  links:
    - target: programming-artifact-ontology-registry-provider
      type: contains
    - target: programming-artifact-ontology-activation-evidence
      type: contains
    - target: programming-artifact-ontology-quality-evidence
      type: contains
    - target: programming-artifact-ontology-plan
      type: contains
    - target: programming-artifact-ontology-todo
      type: contains
    - target: programming-artifact-ontology-development-guide
      type: contains
    - target: programming-artifact-ontology-cli
      type: contains
    - target: programming-artifact-ontology-context-simulation
      type: contains
    - target: programming-artifact-ontology-context-simulation-plan
      type: contains
    - target: programming-artifact-ontology-context-simulation-todo
      type: contains
    - target: operational-ontology-registry-activation-cli
      type: refs
    - target: operational-ontology-system
      type: depends_on
sources:
  - packages/operational-ontology/src/internal/programming-artifact-core.ts
  - packages/operational-ontology/src/programming-artifacts.ts
---

# Programming Artifact Ontology System — 산출물 pack schema

## 목적 ^purpose

프로그래밍 산출물을 파일 경로나 자유 문자열이 아니라 operational ontology pack으로 관리되는 context target으로 정의한다. 목표는 build output, generated source, quality status, deployment output, prompt artifact, activation evidence를 닫힌 vocabulary와 registry provider로 묶어 `PromptArtifactContextProvider` 기반 prompt extraction에 먼저 연결하는 것이다.

## 구성 ^overview

이 System은 `programming-artifact-ontology` pack schema와 하위 문서 좌표를 정의한다. provider lookup, activation evidence, quality-status evidence, CLI command contract는 각 세부 책임 문서가 소유한다.

- `programming_artifact_kind` axis — 산출물 node 종류를 닫힌 vocabulary로 분류한다.
- `programming_artifact_relation_kind` axis — 산출물과 producer/source/definition/output 사이의 edge 의미를 닫힌 vocabulary로 분류한다.
- `programming-artifact` taxonomy — artifact node identity를 artifact kind 기준으로 좌표화한다.
- `programming-artifact-relation` taxonomy — artifact edge identity를 relation kind 기준으로 좌표화한다.
- `programming_artifact_relation` relation category — artifact relation edge grammar를 제공한다.
- `artifact_prompt_context` traversal — artifact ref에서 prompt extraction context까지 가는 route family를 고정한다.
- `programming-artifact-ontology-registry-provider` — `ArtifactRegistryPromptArtifactContextProvider`와 generic registry lookup behavior를 고정한다.
- `programming-artifact-ontology-activation-evidence` — `activation-evidence` artifact kind와 activation sidecar provider consumption을 고정한다.
- `programming-artifact-ontology-quality-evidence` — `quality-status` sidecar, quality ledger fallback, freshness SLA, governance closure behavior를 고정한다.
- `programming-artifact-ontology-development-guide` — 세션 시작 컨텍스트 확인 순서와 변경 유형별 개발 지침을 고정한다.
- `programming-artifact-ontology-cli` — public CLI command, flag, JSON output contract를 고정한다.
- `programming-artifact-ontology-context-simulation` — context selection, data flow, evidence interpretation, prompt consumption을 fixture simulation 계약으로 고정한다.
- `programming-artifact-ontology-context-simulation-plan` — context selection, data flow, implementation trace를 fixture simulation으로 검증하기 위한 후속 방향을 고정한다.
- `programming-artifact-ontology-context-simulation-todo` — simulation matrix와 traceability convention 구현 항목을 추적한다.

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
| `programming_artifact_kind` | 6개 값으로 열거 | provider fallback, quality gate, activation proof 소비, 출력 처리에 영향 | build/codegen/quality/deploy/prompt/activation CLI와 artifact registry/provider flows에서 공유 | 산출물 상위 종류라 안정 | 6 × 2 = 12, nextPowerOf2(12) → 16 |
| `programming_artifact_relation_kind` | 5개 값으로 열거 | context traversal과 ownership 판단에 영향 | registry/provider/CLI/gate에서 공유 | relation role이라 안정 | 5 × 2 → 16 |

## Artifact Kind Vocabulary

| kind | 정의 |
|------|------|
| `build` | 빌드 명령이 생성한 bundle, package, compiled output |
| `generated-source` | codegen이나 schema materialization으로 만들어진 source file |
| `quality-status` | test, lint, gate, audit 결과를 담은 machine-readable status artifact |
| `deployment-output` | deployment URL, release bundle, infra output 같은 배포 결과 |
| `prompt-artifact` | `self_reflection`, `code_editing_rules`처럼 model prompt에 삽입되는 산출물 |
| `activation-evidence` | ontology pack activation 성공을 증명하는 local registry/index-meta activation result artifact |

`activation-evidence`의 5Q 판정과 provider consumption 세부는 `programming-artifact-ontology-activation-evidence`가 소유한다. `quality-status` governance closure, ledger fallback, freshness policy 세부는 `programming-artifact-ontology-quality-evidence`가 소유한다.

## Artifact Relation Vocabulary

| relation | 시작 | 끝 | 정의 |
|----------|------|----|------|
| `produced_by` | artifact | command/governance-run | 산출물을 만든 명령, gate, governance run을 가리킨다. |
| `derived_from` | artifact | artifact/source | 산출물이 의존해 파생된 입력 산출물이나 원본 source를 가리킨다. |
| `verifies` | artifact | definition/artifact/gate | 품질 상태나 prompt artifact가 검증한다고 주장하는 대상을 가리킨다. |
| `owned_by_definition` | artifact | definition | 산출물 변경 책임을 가진 definition 문서를 가리킨다. |
| `materializes_output` | artifact | definition/blueprint/output | 산출물이 구체화한 설계 출력, blueprint, release target을 가리킨다. |

## 개발 컨텍스트

지속 개발 세션은 `programming-artifact-ontology-development-guide`의 순서를 따른다. 기본 순서는 system spec → plan → todo → CLI spec → prompt artifact generation spec → provider source/test → CLI source다. 이 순서는 작업자가 바뀌어도 같은 context boundary에서 출발하게 만드는 운영 규칙이다.

## 구현 참조

- 구현: `packages/operational-ontology/src/internal/programming-artifact-core.ts`
- 공개 표면: `packages/operational-ontology/src/programming-artifacts.ts`
- 테스트: `packages/operational-ontology/src/programming-artifacts.test.ts`
