---
def:
  id: context-bounded-execution-plan
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [architecture, context, contract, testing]
  links:
    - target: context-bounded-execution
      type: traces_to
    - target: context-bounded-execution-cases
      type: traces_to
    - target: context-bounded-execution-todo
      type: traces_to
    - target: platform-context-spec
      type: depends_on
    - target: work-lifecycle
      type: depends_on
sources:
  - docs/specs/platform-chain/platform-context-spec.md
  - docs/specs/definition-catalog/responsibility-closure-harness.spec.md
  - docs/specs/decision-flow/df-narrative-group/df-narrative-context.spec.md
  - docs/specs/connection-system/federated-connection-runtime.spec.md
---

# Context-Bounded Execution — 방향 계획

## 목적 ^purpose

qa-sdk를 정보 수집이나 대화 기록 시스템이 아니라, 제한된 컨텍스트 안에서 하나의 작업을 탐색·판단·실행·검증할 수 있게 만드는 실행 체계로 구체화한다.

## 현재 결정 ^decision-point

컨텍스트를 하나의 누적 버퍼로 취급하지 않는다. 모든 Task는 다음 두 단계로 실행한다.

```text
Discovery Context
  → 필요한 정보와 경로를 찾는다
  → Working Context에 필요한 Route만 선택한다

Working Context
  → authoritative Fact와 Evidence를 해소한다
  → 판단·실행·검증을 완결한다
```

기본 실행 프로파일은 다음 예산을 가진다.

| 예산 | 기본값 | 규칙 |
|------|--------|------|
| Discovery 상한 | 100K tokens | 탐색 단계가 넘을 수 없는 상한 |
| Working 예약량 | 100K tokens | Discovery가 빌릴 수 없는 최소 작업 공간 |
| 시스템/도구/출력 | 프로파일별 계산 | 두 예산을 침범하지 않도록 별도 예약 |

전체 모델 윈도우가 고정된 경우 Discovery 상한은 다음 중 작은 값으로 계산한다.

```text
min(100K, totalWindow - systemReserve - outputReserve - workingReserve)
```

`totalWindow < systemReserve + outputReserve + 200K`인 실행 프로파일은 이 기본 정책을 만족하지 못하므로 활성화하지 않는다.

## 책임 경계 ^boundary

첫 구현 slice는 `context-runtime`의 순수 read-mostly runtime으로 둔다.

- 소유: Context Contract, Discovery/Resolution Route, Budget, Envelope, Manifest, Closure, Handoff shape
- 소비: definition graph, decision-flow context, federated query port, source projection
- 비소유: 원본 업무 데이터, 원본 local ID, LLM prompt, 외부 시스템 transaction, 장기 대화 기록
- 기존 `@qa-sdk/context`: Catalog/서비스 identity/address_context 제공 책임을 유지한다.

## 단계 ^overview

1. `ContextBudgetProfile`과 두 종류의 Route를 정의한다.
2. Task에서 Discovery Plan을 결정론적으로 만든다.
3. 선택된 Route에서 Working Context를 다시 해소한다.
4. Closure를 판단하고, 초과·누락·오래된 Fact는 실행 전에 차단한다.
5. 결과는 대화 전문이 아니라 Typed Handoff와 Manifest로 다음 Task에 전달한다.

Stop Rules 확장:

```text
Route 후보
  → hard budget/bounds 확인
  → declared obligation coverage 확인
  → no-progress/source exhaustion 확인
  → freeze | decompose | block
```

Stop 판단은 LLM의 주관적 충분성 판정이 아니라, Route·Fact·Evidence obligation과 결정론적 progress 집합으로 계산한다. 상세 계약은 `context-stop-rules-todo`와 `context-bounded-execution-cases-stop-rules`가 소유한다.

## 비범위 ^constraint

- 이번 단계에서 100K에 맞춘 특정 LLM SDK나 tokenizer를 도입하지 않는다.
- Discovery 결과를 자동으로 업무 사실로 승격하지 않는다.
- context-runtime이 ERP/CRM 원본 시스템을 재구현하지 않는다.
- `address_context`를 prompt context나 본문 데이터 저장소로 사용하지 않는다.
- 새 axis/prefix 추가는 별도 5Q 및 catalog 결정 없이는 수행하지 않는다.

## 완료 판단 ^validation

다음 계약이 결정론적 fixture로 검증되면 1차 설계가 닫힌다.

- Discovery 상한을 넘을 때 Working 예약량이 보존된다.
- DiscoveryRoute와 ResolutionRoute가 서로 다른 입력·출력 계약을 가진다.
- ResolutionRoute가 없는 필수 Fact는 Working Context를 닫지 못한다.
- Authority/Freshness가 부족한 Fact는 실행 Context에 들어가지 않는다.
- 동일 snapshot과 manifest 입력이 동일한 Working Plan을 만든다.
- Handoff에는 선택된 ref, revision, evidence만 남고 대화 전문은 전달되지 않는다.
