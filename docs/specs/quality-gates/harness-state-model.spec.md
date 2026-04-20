---
def:
  id: harness-state-model
  level: leaf
  tier: component
  scope: state
  aspect: system_state
  depth: specification
  svc: cli
  lifecycle: approved
  layer: operation
  tags: [testing, quality-harness, entry-point]
  links:
    - target: definition-harness
      type: depends_on
    - target: definition-state-model
      type: depends_on
  source: packages/definition-catalog/src/harness-state-model.ts
---
# Harness State Model


## 탐색 ^navigation

quality-gates-system > **harness-state-model**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

하네스 인프라를 문서/게이트 나열이 아니라 유한 상태 모델로 관리하기 위해, 개념과 계약과 검증을 상태로 정의하고 일반화된 전이 규칙을 고정한다.

## 구성 ^overview

상태는 `concept-defined → contract-bound → gate-bound → verified` 네 단계다.
`concept-defined`는 번들 경계가 정의된 상태, `contract-bound`는 인터페이스 계약이 연결된 상태, `gate-bound`는 validation gate가 계약을 검증하도록 연결된 상태, `verified`는 실행 증거까지 확보된 상태다.

## 상태 정의

### concept-defined

개념 번들 문서가 존재하고 관리 단위가 식별된다.
보통 `flow/process_flow/overview`와 `quality-bundle` 태그가 기준이 된다.

### contract-bound

번들 안에 interface 계약 문서가 존재한다.
기능 surface와 입출력 약속을 이 상태에서 고정한다.

### gate-bound

번들 안에 constraint/validation 문서가 존재하고, gate block으로 실행 가능한 검증 단위가 연결된다.
게이트 문서는 일반적으로 계약 문서에 `depends_on`으로 연결된다.

### verified

게이트 실행 증거가 축적되어 하네스가 닫힌 상태다.
현재 구현은 `quality-ledger`를 사용해 `gateDocId + docVersion` 기준으로 최신 실행 결과를 저장하고, 모든 gate가 같은 버전에서 `pass`이면 번들을 `verified`로 판정한다.

## 런타임 상태 계층과의 관계

이 모델(구조적 상태)과 별도로 게이트 실행의 런타임 상태가 존재한다:

| 계층 | 질문 | 상태 | 코드 SSOT |
|------|------|------|----------|
| **구조적** (이 문서) | "문서가 충분한가" | concept-defined → contract-bound → gate-bound → verified | `work-domain/harness-model.ts` |
| **런타임** | "게이트가 통과했는가" | idle → blocked → ready → gathering → running → passed/failed/stale | `work-domain/harness.ts` |

런타임 `BundleState === "complete"`는 게이트 실행이 끝났다는 신호다.
구조적 `verified` 승격은 그 신호만으로 확정하지 않고, `quality-ledger`의 최신 실행 결과가 각 `gateDocId + docVersion`에 대해 모두 `pass`인지 다시 확인한 뒤 결정한다.
