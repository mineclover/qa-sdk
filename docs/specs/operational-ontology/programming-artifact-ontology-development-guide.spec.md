---
def:
  id: programming-artifact-ontology-development-guide
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, testing]
sources:
  - docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md
  - docs/specs/operational-ontology/programming-artifact-ontology-registry-provider.spec.md
  - docs/specs/operational-ontology/programming-artifact-ontology-activation-evidence.spec.md
  - docs/specs/operational-ontology/programming-artifact-ontology-quality-evidence.spec.md
  - docs/specs/operational-ontology/programming-artifact-ontology-context-simulation.spec.md
  - packages/operational-ontology/src/internal/programming-artifact-core.ts
  - packages/cli/src/commands/ontology.ts
---

# Programming Artifact Ontology Development Guide — 지속 개발 컨텍스트 확인

## 목적 ^purpose

`programming-artifact-ontology`를 지속 개발할 때 세션마다 같은 문서와 코드 경계를 확인하게 만드는 표준 개발 지침을 정의한다. 목표는 artifact vocabulary, registry provider, prompt extraction CLI, plan/todo가 서로 다른 속도로 drift되는 것을 막고, 다음 세션 handoff가 바로 실행 가능한 상태를 유지하는 것이다.

## 컨텍스트 확인 순서 ^defines

작업 시작 전에는 아래 순서로 읽는다.

1. `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
   module entry다. 현재 vocabulary, pack schema, child document coordinates를 먼저 확인한다.
2. provider/evidence 작업이면 해당 leaf를 이어서 읽는다.
   - `docs/specs/operational-ontology/programming-artifact-ontology-registry-provider.spec.md`
   - `docs/specs/operational-ontology/programming-artifact-ontology-activation-evidence.spec.md`
   - `docs/specs/operational-ontology/programming-artifact-ontology-quality-evidence.spec.md`
3. `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
   장기 단계와 이번 단계의 위치를 확인한다. 새 작업이 단계 밖이면 plan부터 갱신한다.
4. `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
   이번 세션에서 완료할 체크박스를 고른다. 완료된 작업은 체크하고 남은 항목은 더 작게 쪼갠다.
5. simulation 작업이면 아래 세 문서를 이어서 읽는다.
   - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation-plan.plan.md`
   - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation-todo.todo.md`
   - `docs/specs/operational-ontology/programming-artifact-ontology-context-simulation.spec.md`
6. `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
   CLI surface와 registry JSON shape를 확인한다. command나 flag를 바꾸면 이 문서를 먼저 갱신한다.
7. `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
   artifact extraction이 prompt artifact plane에 어떻게 들어가는지 확인한다.
8. `packages/operational-ontology/src/internal/programming-artifact-core.ts`
   vocabulary, pack, registry store, provider 구현의 SSOT다.
9. `packages/operational-ontology/src/programming-artifacts.test.ts`
   pack validation과 provider behavior의 살아있는 예시다.
10. `packages/cli/src/commands/ontology.ts`
   `extract-artifact` CLI routing과 fallback 순서의 SSOT다.

Adjacent review:

- `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
- `docs/specs/operational-ontology/operational-ontology-registry-allocation.todo.md`

위 두 문서는 registry-service/index-meta allocation lifecycle의 scope다. programming-artifact governance closure 작업에서는 읽어서 boundary를 확인하되, ontology pack allocation 구현이 동반되지 않으면 변경하지 않는다.

## 문서 구조 보강 방식

문서 역할을 아래처럼 나눈다.

| 문서 | 역할 | 갱신 조건 |
|------|------|-----------|
| `programming-artifact-ontology-system.spec.md` | module entry, pack/vocabulary/child coordinate overview | 새 child 문서, 새 axis/relation |
| `programming-artifact-ontology-registry-provider.spec.md` | provider lookup, registry store, relation projection | provider lookup이나 registry relation projection 변경 |
| `programming-artifact-ontology-activation-evidence.spec.md` | activation-evidence kind, record mapping, provider consumption | activation proof registry semantics 변경 |
| `programming-artifact-ontology-quality-evidence.spec.md` | quality-status matching, snapshot, ledger, freshness, governance closure | quality evidence interpretation 변경 |
| `programming-artifact-ontology-development-guide.spec.md` | 세션 시작 컨텍스트 확인 순서와 개발 규칙 | 작업 순서, 검증 명령, handoff 규칙 변경 |
| `programming-artifact-ontology-cli.spec.md` | CLI surface와 registry 파일 계약 | command, flag, JSON shape, fallback 규칙 변경 |
| `programming-artifact-ontology-context-simulation.spec.md` | context/dataflow simulation matrix와 trace convention | fixture scenario, evidence interpretation, warning/action projection 변경 |
| `programming-artifact-ontology-plan.plan.md` | 장기 단계와 다음 milestone | 단계 순서나 목표 변경 |
| `programming-artifact-ontology-todo.todo.md` | 실행 체크박스 | 세션 단위 작업 추가/완료 |

새 문서를 만들 때는 `programming-artifact-ontology-system`의 `contains`에 먼저 연결한다. leaf 문서가 150줄을 넘거나 두 개 이상의 개념을 다루면 module + leaf로 분할한다.

## 변경 유형별 필수 확인

| 변경 유형 | 필수 확인 |
|-----------|-----------|
| artifact kind 추가 | 5Q checklist, `PROGRAMMING_ARTIFACT_KINDS`, pack axis capacity, system spec vocabulary table, tests |
| artifact relation 추가 | 5Q checklist, `PROGRAMMING_ARTIFACT_RELATION_KINDS`, relation category, provider relation mapping, CLI spec |
| registry record field 추가 | `ProgrammingArtifactRegistryRecord`, CLI registry JSON contract, provider extraction, sample/test record |
| provider behavior 변경 | provider spec, `ArtifactRegistryPromptArtifactContextProvider`, prompt artifact generation spec, provider tests |
| CLI flag 변경 | `programming-artifact-ontology-cli`, command descriptor, help text, CLI tests if command parsing changes |
| export command integration | source command spec, produced_by/derived_from/verifies/owned_by_definition/materializes_output mapping, registry write test |
| governance closure 변경 | production factory spec, quality status source, persisted governance evidence, release verification use case |
| activation-evidence 변경 | activation evidence spec, activation mapper, activation CLI scenario tests, provider consumption proof |
| quality-status discovery 변경 | quality evidence spec, matcher target refs, JSON `qualityStatusRecords` summary, fallback source preservation, provider/CLI tests |
| quality export snapshot 로딩 변경 | `outputPath` path resolution, structured warning codes, governance run sourceRefs, valid/missing/invalid CLI tests |
| quality export registry metadata 변경 | `buildQualityStatusArtifactRegistryRecord`, metadata summary shape, verifies/materializes/verification refs, quality CLI tests |
| prompt quality closure 변경 | `PromptArtifactQualityStatusEvidence`, `governance_closure` score cap/bonus, ready/usable/degraded prompt quality tests |
| extract-artifact closure JSON 변경 | `source.governanceClosure` status/warning/action shape, search fallback warning separation, ontology CLI tests |
| quality-ledger fallback 변경 | `--quality-ledger` explicit input, descriptor resolution, snapshot-first authority, ledger warning codes, ontology CLI tests, quality-ledger tests |
| quality-status freshness SLA 변경 | `--quality-status-max-age-days`, snapshot `generatedAt`, ledger oldest verified gate `lastRun.executedAt`, stale vs incomplete warning policy, prompt quality tests |
| documentation closure 변경 | system/provider/evidence/CLI/plan/todo/development guide/prompt artifact generation spec 동기화, adjacent registry allocation plan/todo out-of-scope 확인 |

## Registry Record 표준

artifact registry record를 생성할 때는 가능한 한 아래 필드를 채운다.

- `artifactId` — stable kebab-case id. 파일명 변경과 독립되어야 한다.
- `artifactRef` — 사용자가 CLI에 넣을 수 있는 대표 ref.
- `kind` — `build`, `generated-source`, `quality-status`, `deployment-output`, `prompt-artifact`, `activation-evidence` 중 하나.
- `producedByRef` — 명령, gate, governance run ref. `produced_by` relation으로 변환된다.
- `derivedFromRefs` — 입력 source/artifact refs. `derived_from` relation으로 변환된다.
- `verifiesRefs` — 검증 대상 definition/gate/artifact. `verifies` relation으로 변환된다.
- `ownerDefinitionId` — 변경 책임 definition. `owned_by_definition` relation으로 변환된다.
- `materializesOutputRefs` — 구체화한 blueprint/output/release target. `materializes_output` relation으로 변환된다.
- `sourceRefs`, `outputPath`, `verificationRefs` — prompt extraction 품질과 governance closure를 높이는 보조 surface다.
- `metadata` — optional structured summary. `quality-status` record는 `rootId`, `generatedAt`, bundle별 state/gate/claim counts, aggregate totals를 담아야 한다. `activation-evidence` record는 activation result status, ontology/pack identity, allocation/sync/smoke summary, warning/error counts, generated timestamp를 담을 수 있다.

필드를 모르면 빈 문자열로 채우지 않는다. 모르는 값은 생략하고, todo에 relation 보강 항목을 남긴다.

현재 concrete write path는 `qa-sdk codegen --artifact-registry <file>`, `qa-sdk quality export ... --artifact-registry=<file>`, `infra deploy ... --artifact-registry <file>`, `qa-sdk ontology prompt extract* --output <file|dir> --artifact-registry <file>`, `qa-sdk ontology registry activate-pack <pack-id> --output <file> --artifact-registry <file>`, `qa-sdk ontology artifact registry append --kind build ...`이다. `activation-evidence`는 successful activation sidecar를 managed registry record로 append/upsert하는 구현된 write path를 가진다.

## Quality-status Discovery 검증

`extract-artifact --artifact-registry <file>`가 직접 artifact record를 찾지 못해도 관련 `quality-status` record는 sidecar evidence로 붙어야 한다. 변경 시 아래를 확인한다.

- direct registry hit의 `source.kind`는 계속 `artifact-registry-hit`이어야 한다.
- miss/file/definition/search fallback의 `source.kind`, `warnings`, `recommendedManagementActions`는 기존 의미를 유지해야 한다.
- JSON `source.qualityStatusRecords`는 항상 `{ total, records, warnings }` 구조로 출력한다.
- matcher는 quality record의 `kind`, `verifiesRefs`, `materializesOutputRefs`, `sourceRefs`, `outputPath`, `relations`만 읽는다.
- prompt artifact `sourceRefs`에는 관련 quality record에서 파생된 `governance-run:governance:artifact:<quality-id>:definition-context`가 포함되어야 한다.
- matched quality record의 `outputPath` JSON이 존재하면 `records[].qualityExportSnapshot`에 root id, bundle ids, bundle state, gate counts, claim counts, generated timestamp를 노출해야 한다.
- `quality export --artifact-registry`가 만든 quality record 자체의 `metadata`에도 같은 최소 closure summary가 있어야 하며, provider read path는 metadata 없이도 기존 필드로 계속 동작해야 한다.
- snapshot load 실패는 extraction을 중단하지 않고 `qualityStatusRecords.warnings[]`, `records[].qualityExportWarning`, `source.warnings[]`에 structured warning code를 남겨야 한다.
- `records[].gateDescriptors`는 snapshot → metadata → verifies refs → materializes refs → direct `verificationRefs` → relation refs 순서로 resolved gate surface를 담아야 한다.
- descriptor가 없으면 extraction을 중단하지 않고 `quality-status-ledger-no-gate-descriptors` warning을 남겨야 한다.
- `--quality-ledger`는 artifact-source context에서만 validate/open하고, missing/read failure는 `quality-status-ledger-missing`/`quality-status-ledger-read-failed` warning으로 fail-open 처리해야 한다.
- verified snapshot이 complete verified surface를 제공하면 ledger fallback은 시도하지 않아야 한다.
- snapshot evidence가 missing/invalid/incomplete이거나 verified surface가 없으면 explicit ledger fallback이 `records[].qualityLedgerEvidence`를 붙여야 한다.
- incomplete ledger fallback은 `quality-status-ledger-incomplete`, same-surface determinate snapshot/ledger disagreement는 `quality-status-ledger-conflict` warning을 남기되 기존 closure status enum을 확장하지 않아야 한다.
- `--quality-status-max-age-days` freshness는 structural snapshot/ledger authority 판정 후 적용해야 하며, stale timestamp warning은 `quality-status-generated-at-stale`만 사용해야 한다.
- ledger freshness는 verified gates의 oldest `lastRun.executedAt`을 기준으로 하고, missing/invalid verified gate timestamp는 stale이 아니라 incomplete로 처리해야 한다.
- valid snapshot은 `governance-run:governance:<quality-artifact-id>:quality-export-snapshot` source ref를 추가해야 한다.
- artifact extraction에서 나온 quality-status match는 `evaluatePromptArtifactQuality()`의 optional `qualityStatusEvidence`로도 전달해야 한다.
- target을 `verifies`로 확인하고 complete verified bundle/gate surface를 보고한 fresh evidence만 `governance_closure` bonus로 쓴다.
- failed/stale/invalid/incomplete evidence, missing evidence, partial surface, mixed verified+incomplete target evidence는 extraction을 막지 않고 prompt quality governance warning과 confidence cap으로 표현한다.
- `source.governanceClosure.status`는 `quality-status-found`, `quality-status-missing`, `quality-status-invalid`, `quality-status-incomplete`를 모두 구분해야 한다.
- `source.governanceClosure`에는 matched quality-status artifact refs/ids가 항상 있어야 하며, found가 아닌 상태는 governance warning과 `close_governance_evidence` action을 포함해야 한다.
- free-string search fallback 경고는 `source.qualitySignal.warning`에 남겨 `source.governanceClosure.warning`과 섞지 않는다.
- 직접 `prompt extract`/`extract-file`/`extract-permission` 호출은 artifact-source context가 없으면 기존 quality evaluation 동작을 유지해야 한다.

## Handoff 규칙

다음 세션 prompt는 다음 구조로 남긴다.

```text
programming-artifact-ontology 기준으로 계속 진행해줘.

먼저 아래 순서로 context를 확인해:
1. programming-artifact-ontology-system.spec.md
2. programming-artifact-ontology-registry-provider.spec.md
3. programming-artifact-ontology-activation-evidence.spec.md
4. programming-artifact-ontology-quality-evidence.spec.md
5. programming-artifact-ontology-plan.plan.md
6. programming-artifact-ontology-todo.todo.md
7. programming-artifact-ontology-context-simulation-plan.plan.md
8. programming-artifact-ontology-context-simulation-todo.todo.md
9. programming-artifact-ontology-context-simulation.spec.md
10. programming-artifact-ontology-cli.spec.md
11. programming-artifact-ontology-development-guide.spec.md

이번 세션 목표:
- <todo 항목 1>
- <todo 항목 2>

검증:
- pnpm --filter operational-ontology typecheck
- pnpm --filter operational-ontology test
- pnpm --filter operational-ontology build
- CLI 영향은 `@qa-sdk/cli typecheck`와 관련 CLI 테스트를 함께 실행한다.
```

## 검증 명령

기능 변경 후 기본 검증은 아래 순서로 실행한다.

```bash
pnpm --filter operational-ontology typecheck
pnpm --filter operational-ontology test
pnpm --filter operational-ontology build
pnpm --filter @qa-sdk/cli typecheck
pnpm --filter @qa-sdk/cli test
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
```

quality export snapshot 로딩을 바꾸는 경우에는 전체 CLI test 전에 아래 targeted test를 먼저 실행한다.

```bash
pnpm --filter @qa-sdk/cli test -- ontology.test.ts
```

quality export registry metadata를 바꾸는 경우에는 전체 CLI test 전에 아래 targeted test를 먼저 실행한다.

```bash
pnpm --filter @qa-sdk/cli test -- quality.test.ts
```

quality-ledger fallback이나 freshness SLA를 바꾸는 경우에는 아래 targeted tests를 함께 실행한다.

```bash
pnpm --filter @qa-sdk/cli test -- ontology
pnpm --filter @qa-sdk/cli test -- quality
pnpm --filter quality-ledger test
```

prompt quality closure scoring을 바꾸는 경우에는 아래 targeted test도 먼저 실행한다.

```bash
pnpm --filter operational-ontology test -- prompt-artifacts.test.ts
```

US-008 문서 closure 검증 기준은 아래 명령이다.

```bash
pnpm --filter operational-ontology test
pnpm --filter operational-ontology typecheck
pnpm --filter @qa-sdk/cli test -- ontology
pnpm --filter @qa-sdk/cli test -- quality
pnpm --filter @qa-sdk/cli typecheck
pnpm --filter quality-ledger test
```
