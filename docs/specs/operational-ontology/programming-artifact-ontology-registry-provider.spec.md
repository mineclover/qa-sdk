---
def:
  id: programming-artifact-ontology-registry-provider
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [contract, observability, testing]
  links:
    - target: programming-artifact-ontology-system
      type: refines
sources:
  - packages/cli/src/commands/ontology/artifact-registry.ts
  - packages/cli/src/commands/ontology/prompt-extract-artifact.ts
---

# Programming Artifact Ontology Registry Provider — provider lookup contract

## 목적 ^purpose

`ArtifactRegistryPromptArtifactContextProvider`가 local programming artifact registry record를 prompt extraction context로 변환하는 provider contract를 정의한다. 목표는 artifact ref lookup, relation vocabulary projection, fallback 전 direct hit 판정, related `quality-status` sidecar discovery를 하나의 provider 좌표로 고정하는 것이다.

## Registry Store Contract ^defines

provider가 요구하는 registry store surface는 아래 두 함수다.

```ts
interface ProgrammingArtifactRegistryStore {
  getArtifactByRef(artifactRef: string): ProgrammingArtifactRegistryRecord | undefined;
  listArtifacts?(): readonly ProgrammingArtifactRegistryRecord[];
}
```

`getArtifactByRef()`는 direct artifact lookup의 필수 경로다. `listArtifacts()`는 related `quality-status` discovery에만 필요하며, 없으면 provider는 direct hit만 처리한다.

현재 in-memory store는 record를 아래 ref로 index한다.

- `artifactRef`
- `artifactId`
- `outputPath`

CLI registry loader는 local JSON이 배열이면 그대로 record 목록으로 읽고, object면 `artifacts` 배열을 읽는다. 새 서버 저장소나 registry-service allocation lifecycle은 이 provider contract에 포함하지 않는다.

## Record Contract

`ProgrammingArtifactRegistryRecord`는 artifact identity와 relation vocabulary를 보존한다.

- `artifactId`, `artifactRef`, `kind`
- `producedByRef`
- `derivedFromRefs`
- `verifiesRefs`
- `ownerDefinitionId`
- `materializesOutputRefs`
- `sourceRefs`, `outputPath`, `verificationRefs`
- `contextDocs`, `relations`, `metadata`

`createProgrammingArtifactRegistryRecord()`는 write path가 같은 relation grammar를 쓰도록 돕는 factory다. 알려진 값만 보존하고 `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, `materializes_output` relation 배열을 정규화하며, field와 `relations[]` 양쪽에 같은 relation이 있으면 `kind/fromRef/toRef/evidenceRef` 기준으로 dedupe한다.

## Provider Resolution

`ArtifactRegistryPromptArtifactContextProvider`는 `PromptArtifactContextProvider`를 구현한다.

1. `targetKind === "artifact"`인 요청만 처리한다.
2. `store.getArtifactByRef(request.targetRef)`가 record를 반환할 때만 resolve한다.
3. record의 root doc은 `artifact:<artifactId>`로 투영한다.
4. `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, `materializes_output` relation은 definition-context child/outgoing link로 변환한다.
5. 변환 결과를 `extractPromptArtifactSourcesFromDefinitionContext()`에 전달한다.
6. 반환된 work area에 `artifact-kind:<kind>`, relation constraint, registry local instruction을 추가한다.

provider hit는 CLI JSON에서 `source.kind: "artifact-registry-hit"`로 노출된다. provider miss는 fallback 종류를 결정하지 않는다. CLI가 file/doc/search fallback을 선택한다.

## Related Quality Discovery

`findRelatedQualityStatusRecords(targetRefs)`는 `listArtifacts()`로 registry 전체를 읽을 수 있을 때만 related quality sidecar를 찾는다. matcher는 `kind === "quality-status"` record만 대상으로 하며 새 schema나 relation kind를 만들지 않는다.

matcher 입력 field는 아래 기존 registry field로 제한한다.

- `verifiesRefs`
- `materializesOutputRefs`
- `sourceRefs`
- `outputPath`
- `relations[]` 중 `verifies`, `materializes_output`

provider는 related quality record를 찾을 수 있지만, snapshot loading, quality-ledger fallback, freshness SLA, governance closure status 판정은 `programming-artifact-ontology-quality-evidence`가 소유한다.

## Prompt Evidence Merge

`appendQualityStatusEvidenceToPromptArtifactExtraction()`은 direct hit 또는 fallback extraction 결과에 related quality-status provider extraction을 additive로 병합한다.

- prompt source set의 `corridors`, `checkpointLattices`, `traversals`, `blueprints`, `governanceRuns`를 보강한다.
- work area `paths`, `constraints`, `localInstructions`를 보강한다.
- direct artifact lookup 결과를 대체하지 않는다.
- quality-status record 자신이 target인 경우 자기 자신을 중복 병합하지 않는다.

## 구현 참조

- 구현: `packages/operational-ontology/src/internal/programming-artifact-core.ts`
- public export: `packages/operational-ontology/src/programming-artifacts.ts`
- provider tests: `packages/operational-ontology/src/programming-artifacts.test.ts`
- registry JSON loader and local registry commands: `packages/cli/src/commands/ontology/artifact-registry.ts`
- CLI artifact provider orchestration: `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`

## Source Reference Boundary

The provider implementation remains in `operational-ontology`; registry file handling lives in the artifact registry command module, and prompt extraction provider orchestration lives in the artifact extraction command module.

Source boundaries:

| concern | source boundary |
|---------|------------------------|
| registry validate/list/append and local JSON load/save | `packages/cli/src/commands/ontology/artifact-registry.ts` |
| artifact source lookup and fallback integration | `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` |
| generic provider implementation | `packages/operational-ontology/src/internal/programming-artifact-core.ts` |

Existing split modules appear in frontmatter. Add source comments only if future bottom-up lookup from those files misses this leaf.
