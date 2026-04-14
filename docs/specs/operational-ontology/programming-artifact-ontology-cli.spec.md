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
  [--artifact-registry-file <file>] \
  [--quality-ledger <path>] \
  [--quality-status-max-age-days <n>] \
  [--kind self_reflection|code_editing_rules|all] \
  [--use-case <usecase>] \
  [--persist-governance] \
  [--store <file>] \
  [--output <file|dir>] \
  [--json] \
  [--local|--server|--scan] \
  [--db <path>]
```

Registry 관리 command도 제공한다.

```bash
qa-sdk ontology artifact registry validate --input <file> [--json]
qa-sdk ontology artifact registry list --input <file> [--kind <kind>] [--json]
qa-sdk ontology artifact registry append --output <file> \
  (--input <record.json> | --kind <kind> --artifact-ref <ref>) \
  [--produced-by <command>] \
  [--derived-from <csv>] \
  [--verifies <csv>] \
  [--owner-definition <id>] \
  [--materializes-output <csv>] \
  [--output-path <path>] \
  [--source-ref <csv>|--source-refs <csv>] \
  [--verification-ref <csv>|--verification-refs <csv>] \
  [--metadata <json-object>] \
  [--json]
```

## Flag Contract

- `--artifact-registry` is the primary local registry file flag for `extract-artifact`, prompt artifact materialization, codegen, quality export, deployment output, and registry append workflows.
- `--artifact-registry-file` is accepted by `extract-artifact` as a compatibility alias for the read path.
- `--quality-ledger <path>` is an explicit artifact extraction input. The CLI validates/opens this SQLite quality ledger only while processing related `quality-status` records from `extract-artifact`; it never performs automatic `.qa-sdk/quality-ledger.sqlite` lookup and non-artifact prompt extraction ignores the flag.
- `--quality-status-max-age-days <n>` is an opt-in freshness SLA for `extract-artifact` quality-status evidence. `<n>` must be a positive integer. When absent, `generatedAt` and ledger `executedAt` timestamps do not make otherwise verified evidence stale.
- `--json` on `extract-artifact` includes `source.kind`, `source.registry`, fallback details, `source.qualityStatusRecords`, `source.governanceClosure`, and `source.qualitySignal`.
- `--json` on registry `validate` returns `{ input, valid, artifactCount, errors, warnings }`.
- `--json` on registry `list` returns `{ input, kind, artifacts }`.
- `--json` on registry `append` returns the append result from `appendProgrammingArtifactRegistryRecord()`, including the appended `record`, `registryPath`, and `recordCount`.
- `append --input <record.json>` preserves the supplied record shape and upserts it by artifact identity.
- `append --kind ... --artifact-ref ...` creates a record through `createProgrammingArtifactRegistryRecord()` and normalizes relation fields into the standard `relations[]` grammar.
- registry `validate`, `list --kind`, and `append --kind` share `PROGRAMMING_ARTIFACT_KINDS`: `build`, `generated-source`, `quality-status`, `deployment-output`, `prompt-artifact`, `activation-evidence`.
- `activation-evidence` records use the existing `produced_by`, `derived_from`, `verifies`, `owned_by_definition`, and `materializes_output` relation fields. Adding this kind does not add a relation kind or make activation proof behave like `quality-status` governance closure evidence.

## 처리 순서

`extract-artifact`는 다음 순서를 따른다.

1. `--artifact-registry` 또는 `--artifact-registry-file`이 있으면 JSON 파일을 읽는다.
2. JSON이 배열이면 그 배열을 registry record 목록으로 본다.
3. JSON이 object면 `artifacts` 필드를 registry record 목록으로 본다.
4. `ArtifactRegistryPromptArtifactContextProvider`가 `<artifact-ref>`를 `artifactRef`, `artifactId`, `outputPath` 중 하나로 resolve하면 registry 결과를 사용한다.
5. registry 결과가 있으면 `source.kind: "artifact-registry-hit"`와 `providerId`를 JSON 출력에 포함한다.
6. registry 결과 유무와 별개로, registry 안의 `quality-status` record가 요청 artifact/definition/work area를 `verifiesRefs`, `materializesOutputRefs`, `sourceRefs`, `outputPath`, `relations`로 가리키면 prompt source evidence에 병합한다.
7. matched `quality-status` record에 `outputPath`가 있으면 quality export JSON snapshot을 읽고, bundle/gate/claim summary와 snapshot-derived governance run을 추가한다.
8. snapshot 파일이 없거나 invalid JSON/shape이면 extraction은 계속 진행하고 `source.qualityStatusRecords.warnings[]`와 `source.warnings[]`에 structured warning을 남긴다.
9. quality gate descriptor input을 snapshot, metadata, record refs, direct gate refs, relation refs 순서로 모으고 `DefDataSource.get/getChildren`으로 `GateDescriptor[]`를 resolve한다.
10. `--quality-ledger`가 있고 snapshot evidence가 missing/invalid/incomplete이거나 verified closure surface가 없으면 resolved descriptors로 `QualityLedger.resolveBundleVerification()`을 호출해 ledger fallback evidence를 붙인다.
11. verified snapshot이 verified surface를 제공하면 snapshot이 authoritative이고 ledger fallback은 conflict를 만들지 않도록 시도하지 않는다.
12. snapshot과 ledger가 같은 resolved bundle surface에서 determinate하게 충돌하면 `quality-status-ledger-conflict` warning을 남기지만 snapshot outcome이 prompt quality/source closure를 계속 결정한다.
13. `--quality-status-max-age-days`가 있으면 verified snapshot은 snapshot `generatedAt`, ledger fallback은 `BundleVerification.gateStatuses[*].lastRun.executedAt` 중 가장 오래된 verified gate timestamp로 freshness를 판정한다.
14. matched quality record/snapshot/ledger evidence를 prompt quality evaluation evidence로 변환한다. 이 evidence는 `artifacts[].quality`의 `governance_closure` metric과 `issues[]`에 반영되고, CLI JSON source에는 `source.governanceClosure` 요약으로도 노출된다.
15. registry miss이면 기존 fallback으로 내려간다.
16. `<artifact-ref>`가 `packages/` 또는 `docs/`로 시작하면 `extract-file`에 위임한다.
17. `<artifact-ref>`가 definition doc id이면 `extract`에 위임한다.
18. 나머지는 definition candidate search로 synthetic artifact context를 만든다.

related quality matching은 `kind === "quality-status"` record만 대상으로 하며 새 artifact kind, relation kind, registry service, allocation lifecycle을 만들지 않는다. direct artifact lookup은 계속 `artifactRef`, `artifactId`, `outputPath` 기준으로 동작하고, related quality discovery는 그 결과를 보강하는 sidecar 단계다.

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
    "verificationRefs": ["packages/operational-ontology/src/programming-artifacts.test.ts"],
    "metadata": {
      "rootId": "operational-ontology-prompt-artifact-generation",
      "generatedAt": "2026-04-13T00:00:00.000Z",
      "bundleCount": 1,
      "bundleStates": {
        "operational-ontology-prompt-artifact-generation": "verified"
      },
      "totals": {
        "verifiedGateCount": 2,
        "totalGateCount": 2,
        "claimCount": 4,
        "verifiedClaimCount": 4
      },
      "bundles": [
        {
          "bundleId": "operational-ontology-prompt-artifact-generation",
          "bundleState": "verified",
          "verifiedGateCount": 2,
          "totalGateCount": 2,
          "claimCount": 4,
          "verifiedClaimCount": 4
        }
      ]
    }
  }
]
```

또는:

```json
{
  "artifacts": []
}
```

Activation proof can be represented as a managed record with `kind: "activation-evidence"` once an explicit activation registry append path is provided. Until that follow-up is implemented, `qa-sdk ontology registry activate-pack --output <file>` remains a JSON sidecar materialization only; the generic registry append/list/validate commands can still validate manually created activation-evidence records.

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
    "recommendedManagementActions": ["create_programming_artifact_registry_record"],
    "qualityStatusRecords": {
      "total": 1,
      "warnings": [],
      "records": [
        {
          "artifactId": "quality-status-unmanaged-artifact",
          "artifactRef": "artifacts/quality-status-unmanaged-artifact.json",
          "outputPath": "artifacts/quality-status-unmanaged-artifact.json",
          "verifiesRefs": ["unmanaged-artifact"],
          "materializesOutputRefs": ["artifact:unmanaged-artifact"],
          "sourceRefs": ["packages/cli/src/commands/ontology.ts"],
          "relations": [
            {
              "kind": "verifies",
              "fromRef": "artifacts/quality-status-unmanaged-artifact.json",
              "toRef": "unmanaged-artifact"
            }
          ],
          "matchRefs": ["unmanaged-artifact", "artifact:unmanaged-artifact"],
          "matchReasons": [
            { "field": "verifiesRefs", "ref": "unmanaged-artifact" },
            { "field": "materializesOutputRefs", "ref": "artifact:unmanaged-artifact" }
          ],
          "qualityExportSnapshot": {
            "rootId": "programming-artifact-ontology-system",
            "bundleIds": ["programming-artifact-ontology-provider"],
            "bundles": [
              {
                "bundleId": "programming-artifact-ontology-provider",
                "bundleState": "verified",
                "verifiedGates": 2,
                "totalGates": 2,
                "claimCount": 4,
                "verifiedClaimCount": 3
              }
            ],
            "totals": {
              "verifiedGates": 2,
              "totalGates": 2,
              "claimCount": 4,
              "verifiedClaimCount": 3
            },
            "generatedAt": "2026-04-13T00:00:00.000Z",
            "sourcePath": "artifacts/quality-status-unmanaged-artifact.json"
          }
        }
      ]
    },
    "governanceClosure": {
      "status": "quality-status-found",
      "source": "quality-status",
      "matchedQualityStatusArtifactRefs": [
        "artifacts/quality-status-unmanaged-artifact.json"
      ],
      "matchedQualityStatusArtifactIds": [
        "quality-status-unmanaged-artifact"
      ],
      "recommendedManagementActions": []
    },
    "qualitySignal": {
      "code": "artifact-search-fallback",
      "grade": "degraded",
      "warning": "Artifact context was synthesized from free-string search instead of a managed registry record.",
      "recommendedManagementActions": ["create_programming_artifact_registry_record"]
    }
  }
}
```

`qualityStatusRecords.total`은 matched quality-status record 수이고, `records[]`는 prompt context에 병합된 품질 record의 구조화 요약이다. registry hit, registry miss, file fallback, definition fallback, search fallback 모두 같은 field를 출력한다. match가 없으면 `total: 0`, `records: []`, `warnings: []`다.

`records[].qualityExportSnapshot`은 matched quality record의 `outputPath` JSON이 로드될 때만 붙는 additive metadata다. exact TypeScript shape는 `packages/cli/src/commands/ontology.ts`가 SSOT이며, 공개 JSON에는 root id, bundle ids, per-bundle state/gate/claim counts, aggregate gate/claim counts, generated timestamp, resolved source path만 노출한다. snapshot load 실패는 `records[].qualityExportWarning`과 `qualityStatusRecords.warnings[]`로 구조화하며, warning code는 `quality-status-snapshot-missing`, `quality-status-snapshot-invalid-json`, `quality-status-snapshot-invalid-shape`, `quality-status-snapshot-read-failed` 중 하나다.

`records[].gateDescriptors`는 quality-status record에서 resolve된 quality gate surface다. descriptor input priority는 snapshot `rootId`/`bundleIds`, registry metadata `rootId`/`bundles[].bundleId`, `verifiesRefs`, `materializesOutputRefs`, direct `verificationRefs`, `relations[]`의 `verifies`/`materializes_output` 순서다. bundle/container refs는 `contains` graph를 따라 gate docs로 확장하고 direct `verificationRefs`는 gate docs만 허용한다. descriptor를 resolve하지 못하면 `records[].qualityGateDescriptorWarning`과 `quality-status-ledger-no-gate-descriptors` warning을 남긴다.

`records[].qualityLedgerEvidence`는 `--quality-ledger`가 제공되고 snapshot-first policy가 fallback을 허용할 때만 붙는다. 이 object는 additive JSON surface이며 `sourcePath`/`ledgerPath`, `bundleId`, `bundleIds`/`bundleRefs`, `totalGates`/`totalGateCount`, `verifiedGates`/`verifiedGateCount`, `verified`, `gateRefs`, `verifiedGateRefs`, `blockingGates`/`blockingGateStatuses`, `latestRunTimestamps`, `latestRunAt`, `oldestVerifiedGateExecutedAt`, optional `freshness`, and `timestampSummary`를 포함할 수 있다. `records[].qualityLedgerWarning`, `records[].qualityLedgerIncompleteWarning`, `records[].qualityLedgerConflictWarning`, `records[].qualityFreshnessWarning`은 각각 ledger open/read failure, incomplete ledger surface, snapshot/ledger conflict, freshness stale/incomplete evidence를 설명한다. 기존 `governanceClosure.status` enum은 확장하지 않는다.

ledger warning code:

- `quality-status-ledger-missing`
- `quality-status-ledger-read-failed`
- `quality-status-ledger-no-gate-descriptors`
- `quality-status-ledger-incomplete`
- `quality-status-ledger-conflict`

`--quality-status-max-age-days`가 제공된 경우에만 freshness SLA를 적용한다. snapshot evidence는 snapshot `generatedAt`을 사용하고, ledger fallback evidence는 verified gate들의 `lastRun.executedAt` 중 가장 오래된 timestamp를 사용한다. 기준보다 오래되면 evidence outcome은 `stale`이고 `quality-status-generated-at-stale` warning이 `source.warnings[]`와 `source.qualityStatusRecords.warnings[]`에 남는다. required verified gate timestamp가 없거나 날짜로 해석할 수 없으면 outcome은 `incomplete`이며 freshness stale warning을 만들지 않는다. 이 generatedAt freshness stale은 quality-ledger의 gate `docVersion` mismatch가 만드는 stale과 별개다.

`source.governanceClosure`는 quality-status evidence가 prompt governance closure를 왜 닫거나 닫지 못했는지 설명하는 JSON-only 요약이다. 상태는 아래 네 값 중 하나다.

- `quality-status-found` — target을 `verifies`로 확인한 quality-status evidence가 verified bundle 또는 gate를 보고했다.
- `quality-status-missing` — artifact extraction에 연결된 quality-status record가 없다.
- `quality-status-invalid` — matched quality-status evidence가 failed, stale, invalid snapshot/outcome을 보고했다. `stale`은 snapshot payload/docVersion stale일 수도 있고 opt-in generatedAt freshness stale일 수도 있으며 warning message로 구분한다.
- `quality-status-incomplete` — matched quality-status record는 있지만 target verification이 없거나 verified bundle/gate surface가 없다.

모든 상태는 `matchedQualityStatusArtifactRefs[]`와 `matchedQualityStatusArtifactIds[]`를 포함한다. `quality-status-found`가 아니면 `warning`과 `recommendedManagementActions[]`에 `close_governance_evidence` action을 포함한다. 이 warning은 governance closure 전용이며, free-string search fallback 경고는 계속 `source.qualitySignal.warning`에 별도로 남는다.

`qa-sdk quality export ... --artifact-registry=<file>`가 append하는 `quality-status` record도 같은 closure 최소 요약을 `metadata`에 담는다. metadata shape는 optional additive field이며 기존 registry JSON 배열/object envelope, provider lookup, relation mapping을 바꾸지 않는다.

Valid snapshot evidence는 prompt source governance evidence에도 추가된다. 생성된 prompt artifact의 `sourceRefs`에는 `governance-run:governance:<quality-artifact-id>:quality-export-snapshot`이 포함될 수 있으며, 이 run은 bundle별 gate pass/fail을 `validation_surface` verdict로 표현한다.

Artifact extraction으로 시작한 prompt quality evaluation은 matched quality status를 optional `qualityStatusEvidence` input으로도 받는다. `artifacts[].quality.metrics[]` 중 `dimension: "governance_closure"`는 target을 `verifies`로 확인한 quality-status evidence가 verified complete bundle/gate surface를 보고할 때만 additive로 상승한다. failed, stale, invalid, incomplete outcome, snapshot missing/invalid warning, partial ledger surface, mixed verified+incomplete target evidence는 `artifacts[].quality.issues[]`에 governance warning으로 남고 score 상승에 쓰지 않는다. match가 없어서 evidence 배열이 비어 있으면 `prompt-quality-status-evidence-missing` warning으로 confidence만 낮춘다. Freshness SLA는 `--quality-status-max-age-days`가 있을 때만 동작하며 registry command나 registry allocation lifecycle은 추가하지 않는다.

관련 warning code:

- `prompt-quality-status-evidence-missing`
- `prompt-quality-status-evidence-target-missing`
- `prompt-quality-status-evidence-failed`
- `prompt-quality-status-evidence-stale`
- `prompt-quality-status-evidence-invalid`
- `prompt-quality-status-evidence-incomplete`

## Registry Write Path

현재 write path 초안은 기존 생성 명령에 선택적 registry 파일 append를 붙인다.

```bash
qa-sdk codegen --output ./generated --artifact-registry artifacts/programming-artifacts.json
qa-sdk codegen --data-objects ./bindings.json --output ./generated --artifact-registry artifacts/programming-artifacts.json
qa-sdk quality export quality-gates-system --output=artifacts/quality-gates-system.json --artifact-registry=artifacts/programming-artifacts.json
infra deploy order-api prod --provider cloudflare --artifact-registry artifacts/programming-artifacts.json
qa-sdk ontology prompt extract-artifact dist/index.js --kind self_reflection --output artifacts/prompts/self-reflection.md --artifact-registry artifacts/programming-artifacts.json
qa-sdk ontology artifact registry append --output artifacts/programming-artifacts.json --kind build --artifact-ref packages/cli/dist/index.js --produced-by "pnpm --filter @qa-sdk/cli build"
```

관계 채움 규칙:

- codegen generated source: `produced_by=qa-sdk codegen`, `derived_from=catalog/registry/config`, `owned_by_definition=codegen-schema-output`, `materializes_output=apm-codegen-system + codegen-schema-output`.
- data object codegen: `produced_by=qa-sdk codegen --data-objects`, `derived_from=<bindingsPath>`, `owned_by_definition=data-object-codegen`, `materializes_output=data-object-codegen`.
- quality status: `produced_by=qa-sdk quality export <rootId>`, `derived_from=<rootId + bundleIds>`, `verifies=<rootId + bundleIds>`, `owned_by_definition=<rootId>`, `materializes_output=<rootId>`, `verificationRefs=<bundleIds>`, `metadata=<generatedAt + bundle state/gate/claim summary>`.
- deployment output: `produced_by=infra deploy <service> <env> --provider <provider>`, `derived_from=<configPath + service/env refs>`, `verifies=<service + endpoint refs when successful>`, `owned_by_definition=infra-engine-pipeline`, `materializes_output=<service + env + endpoint refs>`.
- prompt artifact: `produced_by=qa-sdk ontology prompt extract*`, `derived_from=<artifact.sourceRefs>`, `verifies=<workAreaId when valid>`, `owned_by_definition=<source definition when known>`, `materializes_output=<prompt artifact id + work area + source target>`.
- build output: `ontology artifact registry append --kind build`로 명시적 output path를 registry record로 기록한다. 실제 build 실행은 패키지 스크립트가 소유하고, CLI는 결과물을 registry에 관리 등록한다.

## Registry Command Behavior

local registry command는 구현된 최소 운영 surface다.

```bash
qa-sdk ontology artifact registry validate --input <file> [--json]
qa-sdk ontology artifact registry list --input <registry.json> [--kind <kind>] [--json]
qa-sdk ontology artifact registry append --output <registry.json> (--input <record.json> | --kind <kind> --artifact-ref <ref>) [--json]
```

`validate`는 배열 또는 `{ "artifacts": [...] }` envelope를 읽고 missing field, invalid kind, invalid relation을 error/warning으로 분리한다. `list`는 optional `--kind` filter를 적용한다. `append`는 새 파일이면 `{ "artifacts": [] }` envelope를 만들고, 기존 object envelope의 추가 field를 보존해 record를 upsert한다. 기존 registry가 배열이면 쓰기 시 object envelope로 정규화된다. `--output` 대신 `--artifact-registry`를 output alias로 받을 수 있다. 이 command들은 별도 서버 저장소가 생기기 전까지 local JSON registry의 validate/list/append를 담당하며, registry-service/index-meta allocation lifecycle은 시작하지 않는다.
