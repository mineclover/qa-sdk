---
def:
  id: responsibility-closure-harness-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [structural, architecture, testing, observability]
  links:
    - target: responsibility-closure-harness
      type: constrains
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: error-handling-convention
      type: depends_on
    - target: authorization-management-usage-rule
      type: depends_on
    - target: state-event-terminology
      type: depends_on
    - target: work-lifecycle
      type: depends_on
    - target: bdd-contract-system
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts:cmdClosure
  - packages/cli/src/commands/docs.ts:buildClosureResult
  - packages/cli/src/commands/docs.ts:collectClosureMissingItems
  - packages/cli/src/commands/docs.ts:collectClosureConcernSignals
  - packages/cli/src/commands/docs.ts:deriveClosureState
  - packages/cli/src/commands/docs.test.ts
---

# Responsibility Closure Harness — 판정 규칙

## 목적 ^purpose

Responsibility Closure Harness가 `unmapped`, `mapped`, `partially-closed`, `closed`, `drifted` 상태를 어떤 evidence로 판정하는지 정의한다. 목표는 코드 책임이 문서/규칙/테스트/증거로 닫혔는지 사람마다 다르게 판단하지 않도록 read-only 판정 기준을 고정하는 것이다.

## 판정 입력 ^defines

| 입력 | 필수성 | 수집 표면 |
|------|--------|-----------|
| code responsibility | 필수 | `sources`, `@def.boundary`, `@def.doc`, `def find-by-file` |
| boundary metadata | 필수 | `tier`, `scope`, `aspect`, `owner_system`, `svc`, links |
| consumed rules | 조건부 | `.rule.md`, convention/policy/design/error/permission 문서 |
| behavior contract | System behavior이면 필수 | `.cases.md`, BDD contract, `docs bdd validate` |
| test evidence | 구현된 책임이면 필수 | `.test.md`, `sources`, package tests, quality gates |
| lifecycle state | 필수 | work-lifecycle summary, spec/todo/prune state |

## 상태 판정

| state | 조건 | severity |
|-------|------|----------|
| `unmapped` | source file/symbol이 어느 definition boundary에도 연결되지 않음 | warning |
| `mapped` | code와 doc은 연결됐지만 consumed rule 또는 test/evidence가 없음 | warning |
| `partially-closed` | 일부 concern은 닫혔지만 필요한 behavior/error/permission/observability/lifecycle evidence 중 하나 이상 누락 | warning |
| `closed` | code, boundary, consumed rules, behavior contract, test/evidence, lifecycle state가 같은 책임을 가리킴 | pass |
| `drifted` | code/docs/test 중 하나가 변경됐지만 다른 surface가 갱신되지 않음 | warning 또는 error |

`info` severity missing item은 advisory다. deferred follow-up이나 completed record review 같은 info-only 항목은 출력에는 남기지만 `closed` 상태를 막지 않는다.

`drifted`는 write-mode를 실행하지 않는다. 하네스는 read-only로 원인과 필요한 follow-up을 제안한다.

## 책임별 폐쇄 규칙

### Entry / Identity

- stable id 또는 finite value가 코드 상수/enum과 문서에서 같은 이름을 가진다.
- 값 추가/삭제는 5Q checklist나 capacity 판단을 소비한다.
- behavior나 data shape를 직접 소유하면 Entry가 아니다.

### Component

- type/schema/state/evidence shape가 source에 존재한다.
- shape validation 또는 parser test가 있다.
- System behavior나 external IO를 직접 소유하지 않는다.

### Interface / DSL

- command/API/event/rule contract가 문서와 code descriptor/parser에 존재한다.
- accepted flags/input/output/error envelope이 test로 검증된다.
- behavior implementation은 System boundary로 위임한다.

### System

- System behavior가 BDD/cases/test 중 최소 하나의 결정론적 evidence를 가진다.
- consumed Component/Interface/Rule 링크가 존재한다.
- source boundary와 test boundary가 연결된다.
- error/permission/observability concern이 tags 또는 consumed rule로 드러나면 해당 evidence가 필요하다.

### Layout / Pack

- `refs` 대상이 존재한다.
- behavior/data ownership을 직접 갖지 않는다.
- facade/barrel/manifest가 조립만 하는지 확인한다.

## Cross-cutting concern 규칙

| concern | 닫힘 조건 |
|---------|-----------|
| convention | `architecture-revealing-code-convention` 또는 종속 rule을 소비하고 code/doc boundary가 일치 |
| design/opinion | ADR/design guideline/non-goal이 traces_to/refines로 연결 |
| error | error shape, failure mode, fail-open/fail-closed policy, test evidence 존재 |
| permission | actor/resource/action/realm policy와 authorization test evidence 존재 |
| observability | event key/payload/audit/evidence mapping과 최소 smoke evidence 존재 |
| lifecycle | plan/cases/todo/test/spec handoff가 중복 없이 정리되고 completed item이 spec으로 흡수 |

## Anti-pattern

- source file 하나가 세 개 이상의 독립 책임 문서를 file-level로 소유한다.
- `.rule.md`가 System behavior를 새로 정의한다.
- `.todo.md`가 완료된 현재 사실을 장기간 소유한다.
- Layout/Pack 문서가 implementation source를 자기 behavior로 소유한다.
- BDD contract와 test title의 contract id가 다르다.
- permission/error/observability tags가 있는데 관련 rule/test/evidence가 없다.

## 출력 권장 형태

향후 CLI read model은 다음 필드를 제공해야 한다.

```json
{
  "target": "doc-or-source",
  "state": "partially-closed",
  "responsibility": "System",
  "boundary": "docs-control-plane-graph",
  "consumedRules": ["architecture-revealing-code-convention"],
  "evidence": ["docs-control-plane-test", "graph-traverse.test.ts"],
  "missing": ["error-policy-evidence"],
  "nextFollowUps": []
}
```
