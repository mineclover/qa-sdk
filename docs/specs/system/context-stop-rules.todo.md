---
def:
  id: context-stop-rules-todo
  type: knowledge
  knowledge_kind: proposal
  tier: system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [architecture, context, contract, testing]
  links:
    - target: context-bounded-execution
      type: refines
    - target: context-bounded-execution-cases-stop-rules
      type: traces_to
sources:
  - packages/context-runtime/src/discovery.ts
  - packages/context-runtime/src/stop-rules.ts
  - packages/context-runtime/src/stop-rules.test.ts
  - packages/context-runtime/src/working-context.ts
  - packages/context-runtime/src/closure.ts
  - packages/cli/src/lib/context-runtime/definition-document-context.ts
---

# Context Stop Rules — 구현 계약 및 잔여 범위

## 목적 ^purpose

특정 주제에 대해 설정된 Route를 따라 Context를 수집할 때, 예산이 남아 있다는 이유만으로 탐색을 계속하지 않도록 **안전 중단**과 **주제 충분성 중단**을 하나의 결정 가능한 계약으로 정의한다.

이 문서는 Stop Rules의 결정 규칙과 V1 구현 경계를 기록한다. 현재 구현된 stop 조건은 `context-bounded-execution`과 `context-runtime`이 소유하고, V2에서 확장할 semantic source/verification 판정만 잔여 범위로 남긴다.

## 현재 구현과 다음 범위 ^boundary

현재 구현에는 다음 안전 중단이 있다.

- Discovery token cap과 Working reserve 보호
- route expansion·object·relation 제한
- route bounds와 cycle policy 검증
- missing route·Fact·authority·revision·evidence·freshness·Working budget에 대한 fail-closed
- 초과 Route의 명시적 skip/decomposition

V1 구현은 여기에 주제 단위의 stop 판단을 추가했다.

- declared topic obligation이 모두 충족되면 추가 Route를 읽지 않고 freeze
- 연속된 Route 확장에서 새 Fact/Evidence가 발생하지 않으면 no-progress로 중단
- 필요한 Fact/Evidence가 충족되지 않은 채 후보가 소진되면 unresolved 상태로 반환
- 중단 사유와 다음 행동을 결과에 보존

## StopPolicy ^defines

StopPolicy는 LLM의 자유 판단이나 임의의 token 비율이 아니라, Task가 선언한 유한한 obligation과 runtime 측정값으로 판정한다.

| 규칙 | 판정 시점 | 성공/중단 결과 |
| --- | --- | --- |
| `budget` | Discovery plan 전·후 | cap 초과 Route를 skip하고 `decompose` 또는 `freeze` |
| `route_bounds` | Route 후보 검증/확장 | depth·fan-out·items·cycle 제한 초과를 명시적으로 중단 |
| `coverage` | 후보 선택 후, Working compile 전 | 모든 required obligation 충족 시 `freeze` |
| `no_progress` | Route 확장 단위마다 | 선언된 횟수만큼 새 Fact/Evidence가 없으면 `no-progress` |
| `source_exhausted` | 더 이상 후보 Route가 없을 때 | obligation 미충족 목록과 함께 `blocked` 또는 `decompose` |
| `closure` | Working compile | authority·freshness·revision·evidence 미충족 시 Manifest 없이 `blocked` |

### Obligation vocabulary ^constraint

주제 충분성은 다음 세 종류의 명시적 obligation으로만 표현한다.

- `route`: 반드시 선택·freeze되어야 하는 Route key
- `fact`: Working Context에서 authoritative Fact로 해소되어야 하는 Fact key
- `evidence`: 해소된 Fact가 보존해야 하는 Evidence reference 또는 evidence kind

obligation이 비어 있으면 semantic coverage stop을 적용하지 않는다. 이 경우에도 예산·bounds·closure stop은 계속 적용한다.

`coverage-satisfied`는 선언된 obligation이 모두 충족된 경우에만 성립한다. 임의의 `80% 충분` 같은 threshold는 이번 범위에서 허용하지 않는다.

### Progress 정의 ^constraint

한 번의 Route 확장이 다음 중 하나를 추가하면 progress로 간주한다.

- 새로운 Route key
- 새로운 Fact key
- 새로운 Evidence reference

확장 결과가 기존 집합만 반환하면 progress가 아니다. `noProgressLimit`은 Task profile이 선언하며, 기본값은 2회다. limit에 도달하면 runtime은 더 이상의 동일 경로 확장을 수행하지 않고 `no-progress`와 미충족 obligation을 반환한다.

### Stop decision ^decision-point

모든 stop 결과는 다음을 보존한다.

```yaml
stop:
  reason: coverage-satisfied | budget-exhausted | route-expansion-limit |
    object-limit | relation-limit | no-progress | source-exhausted |
    cycle-detected | missing-required-fact | authority-insufficient |
    freshness-failed
  action: freeze | decompose | block
  satisfied_obligations: []
  unresolved_obligations: []
  progress: { new_routes: 0, new_facts: 0, new_evidence_refs: 0 }
```

`coverage-satisfied`만 Working compile을 계속 진행할 수 있는 정상 semantic stop이다. `budget`·`bounds` stop은 남은 독립 Route가 있으면 `decompose`, 없으면 `block`으로 전환한다. `missing-required-fact`, `authority-insufficient`, `freshness-failed`는 항상 `block`이며 Manifest를 만들지 않는다.

## V1 구현 범위 ^overview

V1에서 구현한 범위는 아래와 같다.

1. `StopPolicy`와 `StopDecision`의 순수 타입·검증기
2. Discovery plan에서 `coverage-satisfied`, `source-exhausted`, `no-progress`를 결정하는 evaluator
3. Working compile에서 unresolved obligation을 `blocked` diagnostics로 연결
4. stop reason/progress/obligation을 bounded JSON·observation metadata에 투영
5. 결정론적 unit/contract test

다음은 V1 비범위다.

- LLM이 topic coverage를 추론하는 자동 judge
- 확률적 evidence score 또는 임의 threshold
- `context_stage` catalog axis/prefix 추가
- Verification Context의 실제 source/result 비교 로직

## V1 완료 조건 ^validation

- [x] obligation이 모두 충족되면 추가 Route를 선택하지 않고 `coverage-satisfied`로 freeze한다.
- [x] no-progress limit 도달 시 원인과 미충족 obligation을 반환한다.
- [x] source exhausted 상태에서 Working Context를 성공으로 위장하지 않는다.
- [x] stop decision은 동일 snapshot·Route·obligation 입력에 대해 결정론적이다.
- [x] 기존 budget/bounds/closure stop보다 semantic stop이 우선되지 않도록 hard-cap precedence를 적용한다.
- [x] BDD family 검증과 runtime unit/consumer test가 통과한다.

## V2 잔여 범위 ^constraint

- source adapter가 실제 expansion round별 Fact/Evidence progress를 보고하는 공통 port
- cycle/authority/freshness 전용 StopDecision reason의 adapter projection
- Verification Context의 source/result 비교와 `verified|failed` 전환
