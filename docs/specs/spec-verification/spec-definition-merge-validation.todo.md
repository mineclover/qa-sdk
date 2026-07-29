---
def:
  id: spec-definition-merge-validation
  type: knowledge
  knowledge_kind: proposal
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  tags: [structural, testing, observability, cross-scope, roadmap]
  links:
    - target: spec-definition-separation
      type: traces_to
    - target: spec-verification-system
      type: depends_on
    - target: definition-harness-derive
      type: depends_on
    - target: spec-tracker-system
      type: depends_on
    - target: definition-quality-gates
      type: depends_on
    - target: definition-data-source
      type: depends_on
  sources:
    - packages/spec-tracker/src/types.ts
    - packages/spec-tracker/src/reporter.ts
    - packages/spec-tracker/src/verification-artifact.ts
    - packages/spec-tracker/src/verification-artifact.test.ts
    - packages/spec-analyzer/src/types.ts
    - packages/spec-analyzer/src/drift.ts
    - packages/definition-catalog/src/harness-derive.ts
    - packages/definition-catalog/src/harness-derive.test.ts
    - packages/cli/src/commands/def.ts
    - packages/cli/src/commands/def.state-verification.test.ts
    - packages/cli/src/command-groups/def.commands.ts
    - packages/cli/src/lib/spec-definition-verification.ts
    - packages/cli/src/lib/spec-definition-verification.test.ts
    - packages/definition-data-source/src/scan-data-source.ts
    - packages/definition-data-source/src/body-hash.ts
    - scripts/spec-verification-runner.ts
    - scripts/spec-verification-runner.test.ts
    - .github/workflows/def-verification.yml
    - packages/cli/src/commands/quality.ts
    - packages/spec-tracker/src/spec-tracker.test.ts
---

# Spec Definition 병합 및 검증 안정화 — TODO

## 목적 ^purpose

분리된 정의 구조, 정적 분석 결과, 실행 증거를 하나의 검증 read model로 조합할 때의 소유권과 병합 조건을 고정한다. 구현된 file transport·read model·CI wiring과 아직 승인되지 않은 graph write를 분리해 기록한다.

## 현재 판정 ^overview

```text
definition address  = 정의 문서의 불변 앵커
definition-catalog  = 정의 vocabulary/graph model
definition-service  = 메타데이터 영속과 권한 있는 write path
spec-analyzer       = 정적 drift evidence
spec-tracker        = 테스트/런타임 ContractEvidence
definition harness  = 명시적으로 받은 값의 순수 상태 파생
quality CLI         = source binding + quality gate 기반 별도 판정
```

현재 병합은 **소유권 병합이 아니라 상위 read model 조합**이어야 한다. 대상은 정의 식별·정적 drift·실행 증거의 상태 요약이며, 결과는 read-only snapshot 또는 harness 입력으로 제한한다. `DefDoc`, `ContractEvidence`, `DriftReport`의 원본과 `DefDoc.links`/lifecycle/graph는 변경하지 않는다.

`docId`는 현재 문서를 찾기 위한 사람이 읽는 라벨이며, 증거 귀속의 장기 앵커는 **v2 `DefDoc.address`**다. v1 address는 scope/aspect/depth 분류 좌표라 여러 문서가 공유하므로 historical anchor가 아니다. v1 binding은 `docIdAtRun`으로만 확인하고 `ambiguous-address`/`unverified`로 격리한다.

## 준비 상태 ^status

| 항목 | 현재 상태 | 병합 전 조건/잔여 범위 |
|---|---|---|
| 정의 identity | v2 `address`만 문서 단위 unique anchor, v1은 shared classification address; `docId`는 현재 조회 라벨, `specId`는 자유 문자열; binding resolver와 top-level producer/workflow가 구현됨 | v2 migration 전까지 v1 binding은 `ambiguous-address`로 read-only 격리 |
| 문서 version | `DefDoc` + `DefDocBody`에서 `docVersion`/`revision`/본문 hash를 조회하고, local DB/scan source가 동일 SHA-256으로 run-start binding을 캡처 | graph write 승격 전까지 binding은 file artifact에만 보존 |
| 실행 evidence | collector/reporter가 인메모리 생성되고 runner가 세 lane summary를 artifact로 저장; workflow가 14일 보존 | definition-service evidence 영속은 별도 write contract 필요 |
| harness derive | primitive input을 받는 순수 함수이며 CLI adapter가 유효한 입력일 때만 convention 상태에 반영 | 기본 경로의 `unverified` fallback 유지 |
| CLI fallback | report 미연결 시 `unverified`; fallback이 `compliant`를 만들지 않는 assertion 포함 | 추가 변경 없음 |
| graph materialize | 현재 없음 | 명시적 write contract와 별도 승인 |
| quality claim | source binding/gate 기반 별도 경로 | tracker evidence와 중복 집계하지 않는 정책 |

## Adapter 설계 ^interface

artifact 구조 검증, run-start binding capture, CLI file producer, CLI read-model adapter, CI runner/workflow는 구현되었다. producer 명령은 실제 top-level command tree에 등록되어 있고 입력/ datasource/파일 오류를 non-zero exit로 전파한다. workflow는 artifact를 보존하고 report/binding을 read model로 조합한다. 아래 경계는 구현과 후속 transport가 공유해야 하는 계약이다.

adapter는 다음의 transport-neutral artifact만 읽고, `spec-tracker`나 `definition-catalog`의 원본을 수정하지 않는다.

```text
VerificationArtifact
  schemaVersion, runStartedAt, runCompletedAt
  reports[]
    ContractReport
    binding? { definitionAddress, docIdAtRun, docVersion, revision, bodyHash, capturedAt }
    report.coverageBasis? = contract | suite

입력
  VerificationArtifact
  definition resolver snapshot(address, docId, docVersion, revision, bodyHash, lifecycle)

출력 Read Model
  reportStatus: reported | no-report
  bindingStatus: resolved | missing | unversioned | stale-revision | invalid
  convention derive input (reported + resolved일 때만)
  diagnostics(code, specId, definitionAddress, docIdAtRun, expected revision)
  optional DriftReport(specId 일치 검증)
  runtimeContractEvidence와 qualityClaim을 분리한 표시 필드
```

`binding`은 CI/CLI가 테스트를 시작하기 전에 resolver snapshot에서 만든다. 실행이 끝난 뒤 현재 문서를 다시 조회해 binding을 만들면, 중간 revision 변경을 검출할 수 없으므로 pinning으로 인정하지 않는다.

| bindingStatus | 판정 | harness 입력 |
|---|---|---|
| `resolved` | v2 address, docVersion, revision, bodyHash가 현재 snapshot과 모두 일치 | contract-level report만 convention derive input으로 변환 |
| `missing` | address/legacy alias가 현재 정의로 해석되지 않음 | 사용하지 않음 |
| `unversioned` | binding에 revision 또는 bodyHash가 없음 | 사용하지 않음 |
| `stale-revision` | 현재 revision 또는 bodyHash가 run snapshot과 다름 | 사용하지 않음 |
| `invalid` | artifact schema, count, timestamp, specId 중 하나가 불변조건을 위반 | 사용하지 않음 |
| `ambiguous-address` | v1 shared address라 문서 단위 anchor가 아님 | 사용하지 않음 |

정책:

1. `specId`를 찾지 못하면 evidence를 정의 문서에 귀속하지 않는다. legacy `specId` alias는 `address`로 해석하고, `docId` rename만으로 historical evidence를 잃지 않는다.
2. report가 없으면 `reportStatus: no-report`와 `unverified`를 반환하며 `partial` 또는 `compliant`로 추정하지 않는다.
3. revision 또는 bodyHash가 맞지 않으면 `stale-revision`으로 표시하며 현재 문서의 통과 증거로 사용하지 않는다.
4. revision 또는 bodyHash가 없는 binding은 `unversioned`로 표시하고, pinning 없는 검증임을 노출한다.
5. `ContractReport.coverage`는 0..1 ratio이고 `ConventionDeriveInput.coverage`는 0..100 percentage다. adapter는 `coverage * 100`으로만 변환하며, 직접 전달하지 않는다.
6. quality source/gate 결과는 `qualityClaim` 필드에만 남긴다. `evidenceCount`, `coverage`, `hasFailures`는 runtime `ContractReport`만으로 계산한다.
7. adapter는 graph link를 자동 생성하지 않는다. `verifies` materialize는 별도 write contract다.
8. `DriftReport`는 `specId`가 현재 read model과 일치할 때만 별도 `driftReport` 필드로 표시한다. drift coverage/missing은 runtime convention evidence를 변경하지 않는다.
9. `coverageBasis: suite`는 runner command의 lane health만 나타내며 `ConventionDeriveInput`으로 변환하지 않는다. `coverageBasis: contract` 또는 legacy contract report만 derive 대상이다.
10. `def_document:v1:*` address는 여러 문서가 공유할 수 있으므로 resolver가 unique anchor로 조회하지 않는다. 현재 문서가 `docIdAtRun`으로 확인되어도 `ambiguous-address`와 `unverified`를 반환한다.

## 구현 경계와 단계 계획 ^implementation-plan

### 소유권 결정

- `spec-tracker`는 순수한 `VerificationArtifact` 타입과 artifact 구조 검증만 소유한다. `DefDataSource`, DB, 네트워크를 import하지 않는다.
- CI/CLI 조합 계층은 테스트 시작 전에 `def verification-bindings`로 definition snapshot을 읽고, `scripts/spec-verification-runner.ts`가 세 검증 lane의 `VerificationSummary`를 생성한 뒤, 실행 종료 후 `def verification-artifact`로 summary와 binding을 artifact JSON으로 생성·저장한다. 두 명령은 `DEF_COMMAND_DESCRIPTORS`를 통해 top-level CLI에서 호출되며, Phase 1의 저장소는 CI artifact 또는 사용자가 지정한 파일이고 definition-service DB에는 쓰지 않는다.
- `packages/cli`의 adapter만 `VerificationArtifact`와 `DefDataSource`를 함께 읽어 read model 및 `ConventionDeriveInput`을 만든다.
- definition-service와 definition graph는 이 단계에서 read-only consumer다. lifecycle과 graph write 권한은 변하지 않는다.

### 구현 단위

| 단계 | 변경 단위 | 상태 | 완료 조건 |
|---|---|---|---|
| A. artifact 계약 | `packages/spec-tracker/src/verification-artifact.ts`와 단위 테스트 | 구현됨 | run 시작 snapshot, report/binding 1:1, timestamp/count/schema validation을 순수하게 검증 |
| B. resolver adapter | `packages/cli/src/lib/spec-definition-verification.ts`와 fake `DefDataSource` 테스트 | 구현됨 | address binding, rename, missing, unversioned, stale-revision, invalid을 결정론적으로 분류 |
| C. harness 연결 | `packages/cli/src/commands/def.ts`의 명시적 `--verification-artifact` 입력 | 구현됨 | resolved artifact면 `ConventionDeriveInput`을 주입하고 artifact/binding이 없으면 기본 경로는 `unverified` |
| D. read model 출력 | optional `--verification-drift`를 포함한 CLI JSON/text 출력과 테스트 | 구현됨 | runtime contract·static drift·quality claim을 별도 필드로 보이고, graph/lifecycle write가 없음을 보장 |
| E. 운영 승격 | run-start binding capture, CI 호출 가능한 artifact file producer/CLI consumer, runner/workflow, 문서와 tests 갱신 | 구현됨 | `verification-bindings` → runner summary → `verification-artifact` → `state` file transport, top-level command registration, scan body hash, producer failure exit code, artifact 보존까지 구현 |

Phase A~E의 저장소 및 CI 구현 범위는 하나의 변경 묶음으로 완료되었고, 각 단계의 테스트와 실제 CLI smoke 경로를 통과했다. 이 TODO는 definition graph materialize와 definition-service evidence 저장을 포함하지 않으므로 draft로 유지하며, 해당 write contract는 별도의 proposal과 승인을 거쳐야 한다.

## 검증 시나리오 ^flow-steps

| ID | 상태 | Given / When / Then |
|---|---|---|
| V1 순수 derive | 구현됨 | `evidenceCount=0`이면 `unverified`; failed 우선 `violated`, 0..100 coverage 기준 `partial/compliant` |
| V2 CLI fallback | 현재 동작 | report 미연결 시 `evidenceCount=0`을 사용하고 `unverified` 반환; `compliant/partial` 추정 금지 |
| V3 known resolve | 구현됨 | run-start binding의 `address`로 resolve 후 일치하는 revision/bodyHash report만 derive input으로 변환 |
| V4 renamed doc | 구현됨 | run 뒤 `docId`가 변경돼도 address가 같으면 `resolved`; diagnostic에는 `docIdAtRun`과 현재 docId를 함께 노출 |
| V5 unknown ID | 구현됨 | 존재하지 않는 address/legacy `specId`는 `missing` 진단; graph 병합 금지 |
| V6 stale revision | 구현됨 | report binding의 revision/bodyHash가 현재 문서와 다르면 `stale-revision`; 현재 문서의 `compliant`에 사용 금지 |
| V7 coverage 변환 | 구현됨 | report coverage `1`과 failed `0`은 percentage `100`으로 변환되어 `compliant`; ratio 직접 주입 회귀를 차단 |
| V8 stable definition | 구현됨 | run-start binding의 address/revision/bodyHash가 현재 snapshot과 일치하면 report timestamp와 무관하게 convention derive input으로 사용 |
| V9 malformed artifact | 구현됨 | 음수 count, 불가능한 coverage, 빈 specId, 역전된 timestamp는 `invalid`; derive 입력으로 변환 금지 |
| V10 원본 불변 | 구현됨 | read-only adapter 조합 전후 `DefDoc`, `DefDocBody`, `ContractReport`, `DriftReport`가 동일해야 함; graph write API는 입력 경계에 없음 |
| V11 quality 비중복 | 구현됨 | quality source/gate 결과가 runtime evidence count/coverage/failure에 영향을 주지 않음 |
| V12 drift 비중복 | 구현됨 | 다른 `specId`의 `DriftReport`는 invalid; 일치하는 drift는 별도 필드에만 표시 |
| V13 CLI transport | 구현됨 | top-level command tree에서 producer가 resolve되고, scan source도 bodyHash binding을 생성하며, 필수 입력/producer 오류는 exit code 1을 반환 |
| V14 suite health 분리 | 구현됨 | runner report는 `coverageBasis: suite`로 기록되고, binding이 resolved여도 convention은 `unverified`; contract evidence만 derive |

## 병합 gate ^gates

다음 조건을 모두 만족하기 전에는 이 TODO를 approved spec이나 자동 graph write로 승격하지 않는다.

- [x] run-start snapshot에서 `address`/revision/bodyHash binding을 캡처하고 `VerificationArtifact`에 담는 구현
- [x] binding `address` resolver와 current `docId` fallback, missing/invalid 진단 구현
- [x] coverage ratio → percentage 변환과 `ConventionDeriveInput` 테스트
- [x] stale-revision/unversioned는 compliant로 승격되지 않는 assertion
- [x] rename 뒤에도 address binding이 보존되는 assertion
- [x] read-only adapter 경계와 실행 전후 definition snapshot/evidence 불변 assertion
- [x] quality claim과 runtime evidence 중복 집계 방지 테스트
- [x] `DriftReport` specId 정합성과 runtime evidence 분리 테스트
- [x] CI 호출 가능한 artifact file producer와 CLI consumer 구현; definition-service DB write 없음 확인
- [x] producer 명령이 top-level command tree에 등록되고 실제 executable 경로에서 resolve됨
- [x] local DB와 scan source의 bodyHash 알고리즘이 공유되고 scan-mode binding이 검증됨
- [x] 필수 flag, datasource, summary/binding, 파일 쓰기 오류가 non-zero exit로 전파됨
- [x] runner가 세 검증 lane을 실행해 `VerificationSummary`를 생성하고 suite 실패를 최종 exit code로 전파함
- [x] runner suite 결과와 contract coverage를 `coverageBasis`로 구분하고 suite-level report를 convention derive에서 제외함
- [x] v1 shared address를 unique resolver에서 제외하고 `ambiguous-address` 회귀 assertion을 추가함
- [x] active workflow가 artifact 보존과 read-only state 생성을 명시함

`.github/workflows/def-verification.yml`은 `verification-bindings` → runner → `verification-artifact` → `state`를 실행하고, suite 실패 시 artifact를 남긴 뒤 non-zero로 종료한다. 이 TODO의 남은 범위는 graph/materialize와 definition-service evidence write이며, 둘 다 별도 write contract와 승인이 필요하다.

## 남은 설계 작업 ^follow-up

- [x] active workflow에서 runner summary와 세 CLI 명령을 연결하고 artifact를 14일 보존한다.
- [ ] graph `verifies` materialize 또는 definition-service evidence 영속: 별도 write contract와 승인된 proposal 필요.
- v1 → v2 unique document address migration: migration 완료 전에는 `ambiguous-address`를 유지하고 자동 승격하지 않음.
- graph write 승인이 완료되기 전까지 이 TODO는 draft로 유지하고, 완료된 항목만 대응 spec으로 흡수한다.

## 비범위 ^non-goals

- `spec-tracker`에 definition datasource 의존성 추가
- `ContractReport`를 자동으로 `DefDoc.links.verifies`로 저장
- quality gate를 runtime ContractEvidence로 재분류
- 문서 lifecycle을 evidence 수집만으로 자동 전이
- artifact를 definition-service DB의 새 evidence 테이블로 영속
