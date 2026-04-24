---
def:
  id: responsibility-closure-harness
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [structural, architecture, testing, observability]
  links:
    - target: definition-harness
      type: refines
    - target: responsibility-closure-harness-rule
      type: traces_to
    - target: responsibility-closure-harness-cases
      type: traces_to
    - target: responsibility-closure-harness-test
      type: traces_to
    - target: responsibility-closure-harness-todo
      type: traces_to
    - target: harness-architecture
      type: traces_to
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
  - packages/cli/src/commands/docs.ts:buildClosureResult
  - packages/cli/src/commands/docs.ts:collectClosureMissingItems
  - packages/cli/src/commands/docs.ts:deriveClosureState
---

# Responsibility Closure Harness — 코드 책임 폐쇄 하네스

## 목적 ^purpose

코드가 드러내는 책임이 System boundary로 구성되고, 그 책임이 convention, design, error, permission, observability, lifecycle 같은 횡단 규칙을 소비하며, test/evidence/doc으로 닫혔는지를 추적하는 하네스 목적을 정의한다. 목표는 코드가 어떤 기능을 완성할 책임을 지는지 기계적으로 식별하고, 그 책임이 문서/테스트/정책/관측 증거로 폐쇄되었는지 판단하는 것이다.

## 핵심 루프 ^defines

```text
Code reveals responsibility
  -> Responsibility forms System/Interface/Component/Entry/Layout boundary
  -> Boundary consumes conventions/policies/design/error/permission rules
  -> Behavior is verified by BDD/test/evidence
  -> Docs map and govern the boundary
  -> Harness detects closure, drift, and missing evidence
```

이 문서는 definition-harness의 목적을 "상태 추적"에서 한 단계 올려, **책임 폐쇄 여부**를 추적하는 관점으로 고정한다. 상태 머신은 수단이고, 실제 질문은 "이 코드 책임이 닫혔는가?"다.

## 책임 폐쇄 단위

Responsibility closure는 다음 5개 축이 모두 연결될 때 닫힌다.

| 축 | 질문 | 대표 evidence |
|----|------|----------------|
| code responsibility | 어떤 코드가 어떤 책임을 드러내는가 | source file, symbol, `@def.boundary`, `@def.doc` |
| system boundary | 그 책임은 E/C/I/S + L/P 중 어디에 속하는가 | `tier`, `scope`, `aspect`, links |
| consumed rule | 어떤 convention/policy/design/error/permission 규칙을 소비하는가 | `.rule.md`, policy spec, design guideline, permission model |
| verification | 어떤 behavior/test/evidence가 책임 완성을 증명하는가 | BDD contract, `.test.md`, test file, quality gate, event evidence |
| lifecycle state | 현재 닫힘/열림/drift 상태는 무엇인가 | harness state, work-lifecycle artifact state, completed/prune candidate |

## 횡단 규칙 소비

횡단 관심사는 별도 기능이 아니라 System 책임이 소비하는 규칙이다.

| concern | owner | closure condition |
|---------|-------|-------------------|
| convention | architecture/code/doc rule | 코드 구조와 문서 좌표가 같은 책임을 가리킨다 |
| design/opinion | ADR/design guideline | 선택한 형태의 근거와 non-goal이 문서화된다 |
| error | error taxonomy/envelope rule | failure mode, envelope, fail-open/fail-closed policy가 테스트된다 |
| permission | authorization policy/model | actor/resource/action/realm decision이 명시되고 테스트된다 |
| observability | event vocabulary/evidence mapping | event key, payload, audit/evidence path가 존재한다 |
| lifecycle | work-lifecycle/spec-lifecycle | plan/cases/todo/test/spec handoff가 중복 없이 닫힌다 |

## 하네스 판정 상태

Responsibility closure는 binary가 아니다. 하네스는 최소 다음 상태를 구분한다.

| state | 의미 | 조치 |
|-------|------|------|
| `unmapped` | code responsibility가 문서 boundary에 연결되지 않음 | `@def.boundary`/`@def.doc` 또는 source mapping 추가 |
| `mapped` | code와 문서가 연결됐지만 검증/규칙 소비가 부족 | BDD/test/rule/evidence 보강 |
| `partially-closed` | 일부 concerns는 닫혔지만 error/permission/observability 등 누락 | 누락 concern별 follow-up 작성 |
| `closed` | code, docs, rules, tests, evidence가 같은 책임을 가리킴 | 유지, drift watch |
| `drifted` | code/docs/test 중 하나가 변경되어 폐쇄 증거가 깨짐 | affected boundary 재검증 |

현재 구현은 이 상태를 하나의 새 FSM으로 강제하지 않는다. 기존 `doc-lifecycle`, `spec-impl`, `convention-compliance`, quality gate, work-lifecycle read model을 조합해 파생한다. 이때 event는 closure state를 대체하지 않고, closure 판정에 쓰이는 evidence로만 소비한다.

## E/C/I/S + L/P 해석

- Entry / Identity: 안정 식별자와 유한 값이 코드와 문서에서 같은 값을 가리키면 닫힌다.
- Component: data/state/evidence shape가 코드 타입/스키마와 문서 source mapping으로 닫힌다.
- Interface / DSL: public command/API/event/rule contract가 parser/descriptor/test와 닫힌다.
- System: behavior, transform, orchestration이 BDD/test/evidence로 닫힌다.
- Layout / Pack: refs 대상이 모두 존재하고, 조립만 하며 behavior/data ownership을 갖지 않으면 닫힌다.

## Work Lifecycle 연결

`work-lifecycle`의 plan/cases/todo/test/spec loop는 responsibility closure의 delivery surface다.

```text
plan      -> closure intent
cases     -> behavior truth
todo      -> execution slice
test      -> verification design
code      -> responsibility implementation
spec      -> current fact assimilation
evidence  -> closure proof
```

완료된 todo가 spec에 흡수되지 않았거나, spec이 source/test evidence를 가리키지 않으면 responsibility closure는 `partially-closed`로 남는다.

## 비목표

- 모든 코드 파일에 별도 문서를 강제하지 않는다.
- 모든 concern을 모든 System에 강제하지 않는다. 해당 책임이 소비하는 concern만 닫는다.
- 문서가 코드 내용을 복제하지 않는다. 코드는 SSOT, 문서는 책임/의도/경계/검증을 소유한다.
- 자동 write로 todo/spec을 변경하지 않는다. 하네스는 read-only 판정과 evidence 수집이 기본이다.

## 검증 ^consumes

최소 evidence bundle:

```bash
qa-sdk def find-by-file <source-file[:symbol]>
qa-sdk docs collect <system-doc-id> --family-only
qa-sdk docs bdd validate <system-doc-id> --family-only --json
pnpm --filter <pkg> test
```

구조 변경이면 `semantic-change` 절차에 따라 L1-L4 smoke를 함께 실행한다.

## 위임 ^delegates

- `responsibility-closure-harness-rule`: closed / partially-closed / drifted 판정 규칙.
- `responsibility-closure-harness-cases`: 새 System, code split, cross-cutting policy, Layout/Pack 변경 시나리오.
- `responsibility-closure-harness-test`: 현재 검증 가능한 test/evidence mapping.
- `responsibility-closure-harness-todo`: closure read model과 CLI 구현 gap.
