---
def:
  id: programming-artifact-ontology-quality-evidence
  level: leaf
  tier: component
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
  - packages/cli/src/commands/ontology/quality-status-evidence.ts
  - packages/cli/src/commands/ontology/quality-ledger-evidence.ts
  - packages/cli/src/commands/quality.ts
---

# Programming Artifact Ontology Quality Evidence — quality-status closure contract

## 목적 ^purpose

artifact extraction에서 related `quality-status` registry record, quality export snapshot, explicit quality ledger fallback, freshness SLA, governance closure를 해석하는 evidence contract를 정의한다. 목표는 registry provider lookup과 CLI command surface에서 품질 증거 판정을 분리해 future artifact work가 quality evidence 좌표를 직접 참조하게 만드는 것이다.

## Match Contract ^defines

quality evidence source는 registry 안의 `kind: "quality-status"` record다. matcher는 새 artifact kind나 relation kind를 만들지 않고 기존 field만 읽는다.

- `verifiesRefs` — target artifact, definition, work area를 검증하는 record.
- `materializesOutputRefs` — target artifact, definition, work area의 품질 상태를 구체화한 record.
- `sourceRefs` — target file/work area source와 연결된 record.
- `outputPath` — 요청 ref가 quality-status artifact 자체인 경우.
- `relations[]` — `verifies`, `materializes_output` edge의 `toRef`.

`appendQualityStatusEvidenceToPromptArtifactExtraction()`은 related quality provider extraction을 additive로 병합한다. direct registry hit, miss, file fallback, definition fallback, search fallback의 identity를 대체하지 않는다.

## Snapshot Evidence

matched `quality-status` record에 `outputPath`가 있으면 CLI artifact extraction은 quality export JSON snapshot을 읽는다.

- valid snapshot은 `rootId`, bundle ids, bundle state, verified/total gate counts, claim counts, `generatedAt`, source path를 `source.qualityStatusRecords.records[]`에 요약한다.
- valid snapshot은 bundle별 gate verification을 `quality-export-snapshot` governance run으로 변환한다.
- `quality export --artifact-registry`가 만든 record metadata도 `rootId`, `generatedAt`, bundle state/gate/claim counts, aggregate totals를 담는다.
- missing, invalid JSON, invalid shape, read failure는 extraction을 막지 않고 structured warning으로 남긴다.

snapshot warning code:

- `quality-status-snapshot-missing`
- `quality-status-snapshot-invalid-json`
- `quality-status-snapshot-invalid-shape`
- `quality-status-snapshot-read-failed`

## Descriptor Resolution

quality gate descriptor surface는 snapshot-first evidence와 ledger fallback의 공통 입력이다. CLI는 아래 우선순위로 ref를 모으고 중복 gate id를 제거한다.

1. snapshot `rootId` / `bundleIds`
2. registry metadata `rootId` / `bundles[].bundleId`
3. `verifiesRefs`
4. `materializesOutputRefs`
5. direct `verificationRefs`
6. `relations[]` 중 `verifies`, `materializes_output`

bundle/container ref는 `contains` topology를 따라 gate doc으로 확장하고, direct gate ref는 gate doc만 허용한다. descriptor가 없으면 `quality-status-ledger-no-gate-descriptors` warning을 남기고 fail-open으로 계속한다.

## Quality Ledger Fallback

artifact extraction은 snapshot-first policy를 따른다.

- verified snapshot이 complete verified bundle/gate surface를 제공하면 snapshot이 authoritative이고 ledger fallback을 시도하지 않는다.
- snapshot이 missing, invalid, incomplete이거나 verified surface가 없을 때만 explicit `--quality-ledger <path>` fallback을 시도한다.
- ledger fallback은 `QualityLedger.resolveBundleVerification()`과 resolved descriptor surface를 사용한다.
- `.qa-sdk/quality-ledger.sqlite` 자동 탐색은 하지 않는다.
- missing/read failure는 `quality-status-ledger-missing` 또는 `quality-status-ledger-read-failed` warning으로 fail-open 처리한다.
- incomplete ledger surface는 `quality-status-ledger-incomplete` warning으로 closure를 열어둔다.
- same-surface snapshot/ledger determinate conflict는 `quality-status-ledger-conflict` warning을 남기되 verified snapshot을 downgrade하지 않는다.

ledger warning code:

- `quality-status-ledger-missing`
- `quality-status-ledger-read-failed`
- `quality-status-ledger-no-gate-descriptors`
- `quality-status-ledger-incomplete`
- `quality-status-ledger-conflict`

## Freshness SLA

`--quality-status-max-age-days <n>`이 있을 때만 freshness SLA를 적용한다.

- snapshot evidence는 snapshot `generatedAt`을 기준으로 판단한다.
- ledger fallback evidence는 verified gates의 oldest `lastRun.executedAt`을 기준으로 판단한다.
- threshold보다 오래된 otherwise verified evidence는 `quality-status-generated-at-stale` warning과 `prompt-quality-status-evidence-stale` outcome을 만든다.
- required timestamp가 없거나 invalid date면 stale이 아니라 incomplete로 판정한다.
- generatedAt freshness stale은 quality-ledger docVersion stale이나 snapshot/ledger conflict와 별개다.

## Governance Closure

artifact extraction은 matched quality record, snapshot, ledger evidence를 `PromptArtifactQualityStatusEvidence`로 변환해 `evaluatePromptArtifactQuality()`에 전달한다.

- target을 `verifies`로 확인하고 fresh verified complete bundle/gate surface를 가진 evidence만 `governance_closure` score를 additive로 보강한다.
- failed, stale, invalid, incomplete evidence는 prompt quality issue를 남기고 score를 올리지 않는다.
- target mismatch와 partial gate surface는 incomplete closure다.
- artifact extraction이 quality-status evidence를 기대했지만 match가 없으면 `prompt-quality-status-evidence-missing`으로 confidence만 cap한다.
- 일반 `prompt extract`, `extract-file`, `extract-permission`은 artifact-source context가 없으면 이 optional evidence를 전달하지 않는다.

`extract-artifact --json`은 source-level closure summary를 노출한다.

- `quality-status-found`
- `quality-status-missing`
- `quality-status-invalid`
- `quality-status-incomplete`

모든 상태는 matched quality-status artifact refs/ids를 포함한다. found가 아니면 governance warning과 `close_governance_evidence` action을 포함한다. free-string search fallback warning은 `source.qualitySignal.warning`에 남고 governance closure warning과 섞이지 않는다.

prompt quality warning code:

- `prompt-quality-status-evidence-missing`
- `prompt-quality-status-evidence-target-missing`
- `prompt-quality-status-evidence-failed`
- `prompt-quality-status-evidence-stale`
- `prompt-quality-status-evidence-invalid`
- `prompt-quality-status-evidence-incomplete`

## 구현 참조

- quality-status source/snapshot evidence: `packages/cli/src/commands/ontology/quality-status-evidence.ts`
- artifact extraction source JSON and closure summary integration: `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`
- quality-ledger fallback, freshness, prompt evidence conversion, and governance run helpers: `packages/cli/src/commands/ontology/quality-ledger-evidence.ts`
- quality export registry metadata: `packages/cli/src/commands/quality.ts`
- provider sidecar merge: `packages/operational-ontology/src/internal/programming-artifact-core.ts`
- prompt quality closure: `packages/operational-ontology/src/internal/prompt-artifact-core.ts`

## Source Reference Boundary

Quality-status matching, snapshot candidate loading, descriptor resolution, snapshot summaries, and snapshot warnings live in `packages/cli/src/commands/ontology/quality-status-evidence.ts`. Quality-ledger loading, snapshot-first fallback decisions, freshness SLA, conflict warnings, prompt evidence conversion, and governance run helpers live in `packages/cli/src/commands/ontology/quality-ledger-evidence.ts`. Artifact extraction source JSON and source-level governance closure live in `packages/cli/src/commands/ontology/prompt-extract-artifact.ts`.

| concern | source boundary |
|---------|------------------------|
| quality-status record matching, snapshot candidate loading, descriptor resolution, snapshot warnings | `packages/cli/src/commands/ontology/quality-status-evidence.ts` |
| quality-ledger fallback, freshness SLA, conflict warnings, prompt evidence conversion | `packages/cli/src/commands/ontology/quality-ledger-evidence.ts` |
| artifact extraction source JSON and governance closure summary integration | `packages/cli/src/commands/ontology/prompt-extract-artifact.ts` |
| quality export metadata production | `packages/cli/src/commands/quality.ts` |

No source-map annotation is added here because frontmatter now points at the split source files.
