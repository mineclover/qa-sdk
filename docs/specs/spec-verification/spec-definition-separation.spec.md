---
def:
  id: spec-definition-separation
  tier: layout
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, testing, observability, cross-scope]
  links:
    - target: spec-verification-system
      type: refs
    - target: spec-tracker-system
      type: refs
    - target: spec-analyzer-system
      type: refs
    - target: definition-catalog-spec
      type: refs
    - target: definition-harness
      type: refs
    - target: spec-definition-merge-validation
      type: refs
    - target: federated-architecture-governance
      type: refs
sources:
  - packages/spec-tracker/src/types.ts
  - packages/spec-tracker/src/collector.ts
  - packages/spec-tracker/src/reporter.ts
  - packages/spec-tracker/src/verification-artifact.ts
  - packages/spec-tracker/src/verification-artifact.test.ts
  - packages/spec-tracker/src/vitest-adapter.ts
  - packages/spec-analyzer/src/types.ts
  - packages/spec-analyzer/src/drift.ts
  - packages/definition-catalog/src/data-source.ts
  - packages/definition-catalog/src/harness-derive.ts
  - packages/cli/src/commands/def.ts
  - packages/cli/src/commands/def.test.ts
  - packages/cli/src/command-groups/def.commands.ts
  - packages/cli/src/lib/spec-definition-verification.ts
  - packages/cli/src/lib/spec-definition-verification.test.ts
  - packages/definition-data-source/src/scan-data-source.ts
  - packages/definition-data-source/src/body-hash.ts
  - scripts/spec-verification-runner.ts
  - scripts/spec-verification-runner.test.ts
  - .github/workflows/def-verification.yml
  - packages/cli/src/commands/quality.ts
---

# Spec Verification과 Definition Catalog의 분리 경계

## 목적 ^purpose

정의 구조와 스펙 검증 증거가 현재 어떤 책임으로 분리되어 있는지 기록한다. 이 문서는 두 영역을 하나의 런타임 시스템으로 통합하지 않으며, 현재 구현에서 실제로 소유하는 데이터와 연결되는 지점만 기준으로 삼는다.

## 현재 판정 ^overview

현재 구조에는 세 가지 정의·증거 생산 영역과, 이를 읽기만 하는 두 보조 조합 영역이 있다.

```text
definition-catalog
  정의 vocabulary, frontmatter/graph model, 순수 조회·검증

definition-service / sync workflow
  메타데이터 영속, lifecycle/version/revision의 권한 있는 write path

spec-analyzer
  markdown/소스 비교 → 정적 DriftReport

spec-tracker
  테스트/런타임 수집 → ContractEvidence → ContractReport
```

`definition-catalog`는 정의의 vocabulary와 graph model을 소유하고, definition-service와 sync workflow는 메타데이터를 영속·변경한다. `DefDataSource`는 이 상태를 읽는 공통 추상화다. `spec-analyzer`와 `spec-tracker`는 정의를 검증하는 서로 다른 증거 생산자다. 현재 두 검증 패키지의 결과가 definition graph의 동일한 evidence 레코드로 자동 합쳐지는 구조는 아니다.

## 책임 소유 ^defines

| 영역 | 소유 데이터 | 대표 구현 | 소유하지 않는 것 |
|---|---|---|---|
| definition-catalog | definition vocabulary, frontmatter/graph model, 순수 조회·검증 규칙 | `DefinitionEntry`, `DefDoc`, `validateGraph` | 메타데이터 DB 영속, 테스트 실행 결과, 런타임 증거 |
| definition-service / sync workflow | 메타데이터 DB, lifecycle/version/revision/links의 권한 있는 write path | definition-service, `syncDocsToLocalDb` | spec-tracker evidence의 직접 수집·집계 |
| spec-analyzer | 선언과 구현의 정적 비교 결과 | `DeclaredSymbol`, `DriftReport` | 문서 lifecycle 변경, 테스트 통과 판정 |
| spec-tracker | 테스트/런타임 계약 증거와 집계 | `ContractEvidence`, `ContractReport`, `SpecCollector` | 정의 문서 저장, graph link 변경 |
| definition harness | 여러 상태 머신의 상태 파생과 전이 | `deriveAllStates`, harness tracker | evidence 원본 수집기 자체 |
| quality CLI | source binding, quality gate, claim audit 결과 조합 | `quality.ts` | spec-tracker collector의 실행 lifecycle |

## 검증 흐름 ^flow-steps

```text
정의 문서
  └─ definition-catalog / DefDataSource
       ├─ def 상태 파생
       ├─ source boundary 조회
       └─ definition graph 조회

markdown + TypeScript 소스
  └─ spec-analyzer → DriftReport

테스트 실행 + 런타임 로그
  └─ spec-tracker → ContractEvidence → ContractReport

run-start binding + ContractReport
  └─ CLI producer → VerificationArtifact → def state read model

정의 graph + source binding + quality ledger
  └─ quality CLI → claim audit / quality status
```

각 화살표는 해당 영역의 출력 생성 관계다. `ContractReport`가 자동으로 `DefDoc.links`의 `verifies` 관계가 되거나, `DriftReport`가 문서 lifecycle을 직접 바꾸는 것을 의미하지 않는다.

## 식별자 규칙 ^constraint

현재 식별자는 다음 의미로 분리한다.

| 식별자 | 의미 | 현재 보장 범위 |
|---|---|---|
| `address` | 정의 문서 주소. v2만 문서 단위의 불변 앵커 | v2는 rename 뒤에도 evidence와 graph anchor를 유지. v1은 분류 주소라 여러 문서가 공유할 수 있음 |
| `docId` | 현재 정의 문서의 사람이 읽는 lookup 라벨 | datasource 조회와 현재 graph 표시에 사용. 변경 가능 |
| `specId` | spec-analyzer/spec-tracker가 사용하는 문서 연결 문자열 | tracker 내부 grouping key. 현재는 자유 문자열 |
| `docVersion` / `revision` / `bodyHash` | `DefDoc` + `DefDocBody`가 제공하는 version·개정·본문 식별값 | run-start binding과 현재 datasource snapshot의 정합성 비교 |
| `ContractReport.lastVerified` | tracker evidence가 마지막으로 집계된 시각 | 실행 report의 이력 메타데이터; definition 선택 조건으로 사용하지 않음 |

현재 `specId`는 운영 convention상 `docId`를 가리키도록 사용하지만, `ContractEvidence`에 `address`/`docVersion`/`revision`/`bodyHash`가 없으므로 특정 정의 개정에 고정된 추적을 제공하지 않는다. `def verification-bindings`가 run-start snapshot을 캡처하고, CLI adapter는 v2 binding만 address로 rename-safe하게 해석한다. v1 binding은 `docIdAtRun`으로만 현재 문서를 확인하고 `ambiguous-address`/`unverified`로 격리한다. 상세 계약은 [spec-definition-merge-validation](spec-definition-merge-validation.todo.md)에 둔다.

## 허용되는 연결 ^interface

- 테스트 또는 런타임 코드는 `spec-tracker`에 계약 증거를 기록할 수 있다.
- CLI/CI 같은 상위 조합 계층은 `definition-catalog`와 `spec-tracker` 결과를 함께 읽을 수 있다.
- `definition-catalog`는 `DefDataSource`를 통해 문서와 graph를 조회한다.
- 현재 adapter가 추가된 상태에서도 각 패키지의 원본 소유권은 유지한다. 병합 조건과 검증 시나리오는 [spec-definition-merge-validation](spec-definition-merge-validation.todo.md)에 둔다.
- `def verification-bindings`와 `def verification-artifact`는 top-level command tree에 등록된 file producer이며, 입력·datasource·파일 오류를 성공으로 숨기지 않는다.
- local DB와 read-only scan datasource는 동일한 SHA-256 definition body hash를 사용하므로 run-start binding은 두 경로에서 같은 fingerprint 의미를 갖는다.

## 현재 연결되지 않는 것 ^context

- `spec-tracker`가 `DefDataSource`를 직접 호출하여 `specId` 존재 여부를 보장하지 않는다.
- raw `ContractReport` 단독으로는 현재 정의 문서의 revision과 일치하는지 판정하지 않는다. run-start `VerificationArtifact`가 있을 때만 상위 CLI adapter가 판정한다.
- `ContractReport`가 definition graph의 `verifies` 또는 `traces_to` 링크로 자동 materialize되지 않는다.
- `definition harness`의 `convention-compliance`는 tracker를 내부에서 호출하지 않는다. 기본 CLI 경로는 tracker 미연동 상태를 `unverified`로 표현하고, artifact 경로도 v2 binding과 contract-level report가 모두 확인될 때만 derive한다.
- `quality`의 claim audit는 source binding과 quality gate 상태를 조합하며, 실제 `ContractEvidence` 수집 결과를 기본 입력으로 사용하지 않는다.
- `VerificationArtifact`, run-start binding capture(`def verification-bindings`), CLI file producer(`def verification-artifact`), CLI read-model adapter(`def state --verification-artifact`), 세 lane runner와 active workflow가 구현되어 있다. definition graph materialize는 아직 없으며, 현재 `ContractReport`만으로는 revision pinning이나 document rename 보존을 보장하지 않고 producer는 run-start binding file을 함께 받아야 한다. v1 shared address는 `ambiguous-address`, suite-level report는 `coverageBasis: suite`로 각각 convention derive에서 제외된다.

## 경계 불변조건 ^invariants

1. 정의 문서의 lifecycle/version/revision은 definition-service 또는 권한 있는 sync workflow만 변경한다. `DefDataSource`의 읽기 계약, `definition-catalog`의 순수 모델·검증 함수, spec-tracker는 이를 변경하지 않는다.
2. 테스트/런타임 evidence의 수집과 집계는 `spec-tracker`가 변경한다.
3. 정적 drift 판정은 `spec-analyzer`가 변경한다.
4. harness 상태는 입력된 관측값에서 파생하며, 입력되지 않은 tracker evidence를 추정하지 않는다.
5. 상위 CLI/CI만 여러 결과를 조합하며, 조합 결과를 원본 evidence나 정의 graph의 소유 데이터로 거꾸로 저장하지 않는다.
6. `specId`를 `docId`와 동일하게 취급하는 코드는 이 convention을 명시해야 하며, rename-safe historical binding에는 v2 `address`와 run-start snapshot을 사용한다. v1 address는 historical anchor로 사용하지 않는다.
7. quality claim과 runtime contract evidence는 한 read model에 함께 표시할 수 있어도, evidence count/coverage/failure를 서로 계산하지 않는다.
8. definition body hash는 datasource별로 재정의하지 않고 공통 SHA-256 helper를 사용한다. binding producer가 실패하면 CLI는 non-zero exit를 반환한다.

## 비범위 ^non-goals

- `spec-tracker`에 database/network 의존성을 추가하지 않는다.
- `ContractEvidence` 스키마를 이 문서에서 변경하지 않는다.
- spec-tracker와 definition graph를 하나의 저장 모델로 합치지 않는다.
- definition graph materialize와 definition-service evidence write는 이 문서의 구현 완료로 표시하지 않는다. 현재 CI job은 file artifact와 read-only state만 생성한다.

## 관련 소스 ^sources

- `packages/definition-catalog/src/data-source.ts` — 정의 문서와 datasource 계약
- `packages/spec-tracker/src/types.ts` — 실행 증거와 리포트 타입
- `packages/spec-tracker/src/collector.ts` — 인메모리 evidence 수집
- `packages/spec-analyzer/src/drift.ts` — 정적 drift 판정
- `packages/definition-catalog/src/harness-derive.ts` — 상태 파생 함수
- `packages/cli/src/commands/def.ts` — 현재 harness CLI의 tracker 미연동 경로
- `packages/cli/src/command-groups/def.commands.ts` — top-level def command registration
- `packages/definition-data-source/src/scan-data-source.ts` — read-only scan snapshot
- `packages/definition-data-source/src/body-hash.ts` — local/scan 공통 body fingerprint
- `packages/cli/src/commands/quality.ts` — source binding/quality claim 조합 경로
