---
def:
  id: programming-artifact-ontology-activation-evidence
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
    - target: programming-artifact-ontology-registry-provider
      type: depends_on
sources:
  - packages/cli/src/lib/activation-evidence-registry.ts
  - packages/cli/src/lib/activation-evidence-registry.ontology.test.ts
  - packages/cli/src/commands/ontology/activation.ts
  - packages/cli/src/commands/ontology/artifact-registry.ts
  - packages/cli/src/commands/ontology/prompt-extract-artifact.ts
  - packages/cli/src/commands/ontology.test.ts
  - packages/operational-ontology/src/internal/programming-artifact-core.ts
---

# Programming Artifact Ontology Activation Evidence — activation proof artifact kind

## 목적 ^purpose

`activation-evidence` artifact kind와 provider consumption contract를 정의한다. 목표는 ontology pack activation proof를 deployment, quality-status, prompt artifact 의미로 빌리지 않고 local registry에서 direct artifact evidence로 조회할 수 있게 하는 것이다.

## Artifact Kind Contract ^defines

`activation-evidence`는 ontology pack activation 성공을 증명하는 local activation result sidecar다.

- deployment URL이나 release bundle이 아니므로 `deployment-output`이 아니다.
- gate/audit verdict와 governance closure/freshness/ledger policy 대상이 아니므로 `quality-status`가 아니다.
- model prompt에 삽입되는 artifact payload가 아니므로 `prompt-artifact`가 아니다.
- activation proof record는 기존 relation vocabulary만 사용한다: `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, `materializes_output`.

5Q 판정:

| 질문 | 판정 |
|------|------|
| Q1 유한 | 닫힌 artifact kind vocabulary에 1개 값으로 열거된다. |
| Q2 의사결정 | activation proof와 build/deploy/prompt/quality output을 구분해 provider와 automation 판단을 바꾼다. |
| Q3 공유 | activation CLI sidecar, artifact registry validate/list/filter, provider lookup에서 공유된다. |
| Q4 안정 | ontology pack activation proof라는 상위 artifact 종류라 자주 바뀌지 않는다. |
| Q5 capacity | 전체 kind 수가 6개라 `nextPowerOf2(6 * 2) = 16` 안에 남는다. |

## Record Mapping

`buildActivationEvidenceRegistryRecord()`는 successful activation result와 resolved sidecar path를 registry record로 변환한다.

- `artifactId`: `activation-evidence-<packId>-<ontologyId>`
- `artifactRef`: resolved output sidecar path
- `outputPath`: resolved output sidecar path
- `kind`: `activation-evidence`
- `producedByRef`: `qa-sdk ontology registry activate-pack <pack-id>`
- `derivedFromRefs`: pack id와 known pack import ref
- `verifiesRefs`: pack id, ontology id, `operational-ontology-registry-allocation`
- `ownerDefinitionId`: `operational-ontology-registry-activation-cli`
- `materializesOutputRefs`: sidecar path와 `activation-result:<packId>:<ontologyId>`
- `metadata`: status, pack/ontology identity, namespace, allocation/sync/smoke summary, warning/error counts, generated timestamp

The raw sidecar remains the activation helper payload. The registry record is managed evidence that points at that sidecar.

## CLI Production Contract

`qa-sdk ontology registry activate-pack <pack-id> --output <file> --artifact-registry <registry>` appends/upserts activation evidence only after the sidecar write succeeds and only when the activation result status is `succeeded`.

- `--artifact-registry` requires `--output`; missing output returns `activation-evidence-output-required`.
- `activate-pack --output <file>` without `--artifact-registry` remains sidecar-only.
- failed activation, duplicate same-store activation, output write failure, and missing output do not append managed evidence.
- registry append failure is sanitized as `activation-evidence-registry-append-error` and leaves the sidecar unchanged.
- stdout JSON exposes append metadata under additive `activationEvidence`; the sidecar does not include that wrapper.

## Provider Consumption

Generic registry commands and provider lookup consume activation evidence as a normal programming artifact record.

- `ontology artifact registry validate` accepts `kind: "activation-evidence"`.
- `ontology artifact registry list --kind activation-evidence` filters activation proof records.
- `extract-artifact <activation-output-file> --artifact-registry <registry>` resolves the sidecar by `artifactRef` or `outputPath` as `artifact-registry-hit`.
- one registry can hold activation evidence for multiple packs; provider lookup resolves each sidecar to the matching pack record.

Activation evidence consumption does not create a related `quality-status` sidecar and does not invoke quality-ledger fallback or governance closure status logic.

## Boundary

This leaf only defines local programming artifact registry evidence for successful activation sidecars. Activation result payload semantics, no-rollback policy, and append/upsert lifecycle are detailed in `operational-ontology-registry-activation-result` and `operational-ontology-registry-activation-evidence`. REST activation endpoint, remote activation service, scoped prefix implementation, and pack authoring remain outside this contract.

## 구현 참조

- mapper: `packages/cli/src/lib/activation-evidence-registry.ts`
- mapper tests: `packages/cli/src/lib/activation-evidence-registry.ontology.test.ts`
- CLI producer: `packages/cli/src/commands/ontology/activation.ts`
- registry validation/list consumption: `packages/cli/src/commands/ontology/artifact-registry.ts`
- artifact extraction provider consumption: `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`
- CLI scenario tests: `packages/cli/src/commands/ontology.test.ts`

## Source Reference Boundary

The mapper, activation producer, registry validate/list consumption, and artifact extraction provider consumption sources are extracted and should remain in frontmatter.

Source boundaries:

| concern | source boundary |
|---------|------------------------|
| activation evidence record mapping | `packages/cli/src/lib/activation-evidence-registry.ts` |
| activation command producer and `--artifact-registry` orchestration | `packages/cli/src/commands/ontology/activation.ts` |
| registry validation/list consumption of `activation-evidence` kind | `packages/cli/src/commands/ontology/artifact-registry.ts` |
| sidecar lookup through artifact extraction | `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` |

All current activation evidence CLI consumption sources are now listed above.
