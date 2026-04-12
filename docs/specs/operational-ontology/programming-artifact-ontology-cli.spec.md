---
def:
  id: programming-artifact-ontology-cli
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [contract, testing, observability]
sources:
  - packages/cli/src/commands/ontology.ts
  - packages/cli/src/command-groups/ontology.commands.ts
---

# Programming Artifact Ontology CLI — artifact context extraction surface

## 목적 ^purpose

`programming-artifact-ontology`가 제공하는 registry provider를 CLI에서 일관되게 소비하는 surface를 정의한다. 목표는 artifact ref를 자유 문자열 검색으로만 처리하지 않고, registry record가 있으면 그 record의 relation vocabulary를 우선 사용해 prompt extraction context를 생성하게 만드는 것이다.

## 명령 ^defines

현재 구현된 command는 아래다.

```bash
qa-sdk ontology prompt extract-artifact <artifact-ref> \
  [--artifact-type <type>] \
  [--artifact-registry <file>] \
  [--kind self_reflection|code_editing_rules|all] \
  [--use-case <usecase>] \
  [--persist-governance] \
  [--store <file>] \
  [--json] \
  [--local|--server|--scan] \
  [--db <path>]
```

## 처리 순서

`extract-artifact`는 다음 순서를 따른다.

1. `--artifact-registry` 또는 `--artifact-registry-file`이 있으면 JSON 파일을 읽는다.
2. JSON이 배열이면 그 배열을 registry record 목록으로 본다.
3. JSON이 object면 `artifacts` 필드를 registry record 목록으로 본다.
4. `ArtifactRegistryPromptArtifactContextProvider`가 `<artifact-ref>`를 `artifactRef`, `artifactId`, `outputPath` 중 하나로 resolve하면 registry 결과를 사용한다.
5. registry 결과가 있으면 `source.kind: "artifact-registry-hit"`와 `providerId`를 JSON 출력에 포함한다.
6. registry miss이면 기존 fallback으로 내려간다.
7. `<artifact-ref>`가 `packages/` 또는 `docs/`로 시작하면 `extract-file`에 위임한다.
8. `<artifact-ref>`가 definition doc id이면 `extract`에 위임한다.
9. 나머지는 definition candidate search로 synthetic artifact context를 만든다.

## Registry JSON 계약

파일 shape는 두 가지를 허용한다.

```json
[
  {
    "artifactId": "quality-status-operational-ontology",
    "artifactRef": "artifacts/quality-status-operational-ontology.json",
    "kind": "quality-status",
    "producedByRef": "qa-sdk quality status operational-ontology",
    "ownerDefinitionId": "operational-ontology-prompt-artifact-generation",
    "derivedFromRefs": ["packages/operational-ontology/src/internal/prompt-artifact-core.ts"],
    "verifiesRefs": ["packages/operational-ontology/src/prompt-artifacts.test.ts"],
    "materializesOutputRefs": ["operational-ontology-prompt-artifact-generation"],
    "sourceRefs": ["packages/operational-ontology/src/internal/prompt-artifact-core.ts"],
    "outputPath": "artifacts/quality-status-operational-ontology.json",
    "verificationRefs": ["packages/operational-ontology/src/programming-artifacts.test.ts"]
  }
]
```

또는:

```json
{
  "artifacts": []
}
```

## Fallback 품질 신호

`extract-artifact --json`은 registry/fallback 출처를 `source` 객체로 출력한다.

- `artifact-registry-hit` — registry provider가 context를 생성했다.
- `artifact-registry-miss` — registry 파일은 있었지만 ref를 찾지 못했다.
- `artifact-file-fallback` — source/doc path로 위임했다.
- `artifact-definition-fallback` — definition id로 위임했다.
- `artifact-search-fallback` — 자유 문자열 검색으로 synthetic context를 만들었다.

`artifact-search-fallback`은 prompt extraction을 막지는 않지만, quality warning과 recommended management action으로 registry record 생성을 요구해야 한다.

```json
{
  "source": {
    "kind": "artifact-search-fallback",
    "registry": {
      "status": "miss",
      "path": "artifacts/programming-artifacts.json",
      "providerId": "programming-artifact-registry",
      "recordCount": 0
    },
    "fallback": {
      "kind": "search",
      "target": "unmanaged-artifact",
      "matchedDocs": []
    },
    "warnings": ["artifact-registry-miss", "artifact-search-fallback"],
    "recommendedManagementActions": ["create_programming_artifact_registry_record"]
  }
}
```

## Registry Write Path

현재 write path 초안은 기존 생성 명령에 선택적 registry 파일 append를 붙인다.

```bash
qa-sdk codegen --output ./generated --artifact-registry artifacts/programming-artifacts.json
qa-sdk codegen --data-objects ./bindings.json --output ./generated --artifact-registry artifacts/programming-artifacts.json
qa-sdk quality export quality-gates-system --output=artifacts/quality-gates-system.json --artifact-registry=artifacts/programming-artifacts.json
```

관계 채움 규칙:

- codegen generated source: `produced_by=qa-sdk codegen`, `derived_from=catalog/registry/config`, `owned_by_definition=codegen-schema-output`, `materializes_output=apm-codegen-system + codegen-schema-output`.
- data object codegen: `produced_by=qa-sdk codegen --data-objects`, `derived_from=<bindingsPath>`, `owned_by_definition=data-object-codegen`, `materializes_output=data-object-codegen`.
- quality status: `produced_by=qa-sdk quality export <rootId>`, `derived_from=<rootId + bundleIds>`, `verifies=<rootId + bundleIds>`, `owned_by_definition=<rootId>`, `materializes_output=<rootId>`.
- build output: 현재 `@qa-sdk/cli`에는 독립 `build export` surface가 없으므로 `createProgrammingArtifactRegistryRecord({ kind: "build" })` factory만 준비하고, CLI-owned build output path가 생길 때 command hook을 추가한다.

## 다음 CLI Surface

registry write path가 들어오면 아래 command를 검토한다.

```bash
qa-sdk ontology artifact registry validate --input <file> [--json]
qa-sdk ontology artifact registry append --input <record.json> --output <registry.json>
qa-sdk ontology artifact registry list --input <registry.json> [--kind <kind>] [--json]
```

위 command들은 아직 구현하지 않는다. 먼저 build/codegen/quality/deployment/prompt artifact 생성 경로가 registry record를 쓰는 최소 write API를 갖춘 뒤 추가한다.
