---
def:
  id: operational-ontology-registry-activation-evidence
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract, observability]
  links:
    - target: operational-ontology-registry-allocation
      type: refines
    - target: operational-ontology-registry-activation-cli
      type: refines
    - target: operational-ontology-registry-activation-result
      type: depends_on
    - target: programming-artifact-ontology-system
      type: depends_on
    - target: operational-ontology-registry-activation-cli-scenario-matrix
      type: traces_to
sources:
  - packages/cli/src/lib/activation-evidence-registry.ts
  - packages/cli/src/lib/activation-evidence-registry.ontology.test.ts
  - packages/cli/src/commands/ontology.ts
  - packages/cli/src/commands/ontology.test.ts
  - packages/operational-ontology/src/programming-artifacts.ts
  - packages/operational-ontology/src/programming-artifacts.test.ts
---

# Operational Ontology Registry Activation Evidence

## 목적 ^purpose

Local registry activation 성공 결과를 programming artifact registry evidence로 materialize하는 계약을 정의한다. 목표는 `--output`, `--artifact-registry`, `activation-evidence`, registry append/upsert, provider consumption behavior를 command surface와 result payload에서 분리하는 것이다.

## 구성 ^overview

Activation evidence is explicit local evidence persistence. `--output` writes the raw activation result sidecar. `--artifact-registry` appends or upserts a managed programming artifact registry record only after a successful sidecar write and successful activation result.

## CLI Evidence Flow ^defines

1. `qa-sdk ontology registry activate-pack <pack-id> --output <file>` writes the activation result sidecar.
2. `--output` alone does not create or mutate a programming artifact registry.
3. `--artifact-registry <registry>` requires `--output <file>`.
4. The CLI writes the sidecar first.
5. If `result.status === "succeeded"`, the CLI maps the sidecar and result into a `kind: "activation-evidence"` programming artifact registry record.
6. The registry append path upserts by deterministic record identity.
7. Append metadata is stdout-only. The sidecar remains the raw activation result payload.

## Registry Record Contract

The managed record uses existing programming artifact vocabulary:

| field | contract |
|-------|----------|
| `kind` | always `activation-evidence` |
| `artifactId` | deterministic `activation-evidence-<packId>-<ontologyId>` |
| `artifactRef`, `outputPath` | resolved sidecar path |
| `producedByRef` | command provenance for `qa-sdk ontology registry activate-pack <pack-id>` |
| `derivedFromRefs` | pack id and known pack import reference |
| `verifiesRefs` | pack, ontology, allocation, and registry allocation spec refs |
| `materializesOutputRefs` | sidecar path and `activation-result:<packId>:<ontologyId>` |
| `metadata` | status, namespace, allocation/sync/smoke summary, warning/error counts, generated timestamp |

The record does not add a relation kind and does not reuse `quality-status`, `deployment-output`, or `prompt-artifact` semantics.

## Failure And Upsert Behavior

- Failed activation results do not append managed evidence.
- Duplicate activation against the same store does not replace successful evidence with failed evidence.
- Output write failure does not append managed evidence.
- Registry append failure reports sanitized `activation-evidence-registry-append-error`, leaves the sidecar unchanged, and makes the command fail for automation.
- Successful reruns with the same pack, ontology id, output path, and registry identity upsert the same evidence record instead of creating duplicates.

## Provider Consumption

Existing artifact registry validate/list/provider behavior consumes activation evidence without a special provider.

- `ontology artifact registry validate --input <registry>` accepts `activation-evidence` records.
- `ontology artifact registry list --input <registry> --kind activation-evidence` filters these records.
- `ontology prompt extract-artifact <output-file> --artifact-registry <registry>` resolves the sidecar as `source.kind: "artifact-registry-hit"` when the registry record points at that sidecar.

Cross-pack evidence for `programming-artifact-ontology` and `authorization-ontology` may coexist in one local programming artifact registry when each activation uses its own isolated activation store and sidecar path.
