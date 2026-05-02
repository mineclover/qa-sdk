---
def:
  id: work-lifecycle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [structural, scenario, testing]
  links:
    - target: work-lifecycle
      type: refines
    - target: work-topic-schema-plan
      type: depends_on
    - target: skill-bdd-contract
      type: traces_to
    - target: automation-skill-group
      type: traces_to
---

# Work Lifecycle — Use Cases

## 목적 ^purpose

`plan / cases / todo / test / spec`의 표준 작업 순서가 실제 작업에서 어떻게 쓰이는지 예시로 정의한다. 이 문서는 `work-lifecycle`의 authority 규칙을 구체적인 delivery 시나리오로 보여준다.

## UC-001: 새 behavior를 추가할 때 skill이 예시 artifact가 되는 경우 ^overview

### 상황

작업자는 새로운 기능이나 계약을 구현하기 전에, 먼저 `bdd-contract` skill로 behavior contract를 만들고, 필요하면 `e2e-test`와 `spec-lifecycle`을 연결해 전체 delivery loop를 닫고 싶다.

### artifact 배치

| 단계 | artifact | 예시 |
|------|----------|------|
| 방향 | `plan` | `docs/specs/system/work-lifecycle.plan.md` |
| 행동 계약 | `cases` | `docs/specs/definition-catalog/docs-control-plane.cases.md` |
| 실행 slice | `todo` | `docs/specs/bdd-system/bdd-contract-system.todo.md` |
| 증거 설계 | `test` | `packages/cli/src/commands/docs.test.ts` + `.test.md` contract refs |
| 현재 사실 | `spec` | `docs/specs/bdd-system/bdd-contract-cli.spec.md` |
| 운영 예시 | `skill` / guide | `skills/bdd-contract/SKILL.md`, `docs/skills/automation-workflows.md` |

### 기대

- skill 문서는 lifecycle 자체의 주권 문서가 아니다.
- 하지만 **예시 artifact**로서 “작업자가 이 표준을 어떻게 실제로 쓰는가”를 가장 잘 보여줄 수 있다.
- `skills/bdd-contract/SKILL.md`는 `cases`와 `test_unit`/`implementation_unit` 추출 예시 역할을 하고,
- `docs/skills/automation-workflows.md`는 `bdd-contract → e2e-test → spec-lifecycle` 운영 순서를 보여주는 실행 플레이북 역할을 한다.

### 실패 시 수정 대상

- `work-lifecycle`이 artifact authority를 모호하게 정의했거나
- skill 문서가 `plan/cases/todo/test/spec` 중 무엇을 소유하는지 혼동되게 만들었을 때

## UC-002: plan은 목표를, cases는 behavior를 소유해야 한다

### 상황

작업자가 “BDD system read-only surface를 닫는다”는 목표를 문서화한다.

### 올바른 분리

- `plan`에는 목표, 범위, 단계, risk가 들어간다.
- `cases`에는 Given/When/Then, success/failure path, contract id가 들어간다.

### 잘못된 분리

- `plan`에 test assertion이나 implementation unit을 적는다.
- `cases` 없이 `todo`에서 바로 구현 파일을 나열한다.

### 기대

- plan은 “왜 / 어디까지 / 어떤 순서”를 말한다.
- cases는 “무엇이 맞는 동작인가”를 말한다.
- todo는 cases에서 뽑아낸 실행 단위만 가진다.

## UC-003: todo는 남은 실행 항목만 유지한다

### 상황

BDD system에서 `qa-sdk docs bdd list|validate|units|compile|test-plan|impl-plan`이 이미 구현되었다.

### 기대

- 구현된 사실은 `bdd-contract-system.spec`, `bdd-contract-schema.spec`, `bdd-contract-cli.spec`가 소유한다.
- `bdd-contract-system.todo`에는 docs smoke, dependency-contract ownership policy, `def validate` integration 같은 **남은 실행 작업만** 남는다.
- completed list가 길어지면 lifecycle이 아니라 history가 되므로 축소 또는 memo/spec 흡수 대상이다.

### 실패 시 수정 대상

- `bdd-contract-system.todo.md`에 현재 사실이 오래 남아 있을 때
- `spec`와 `todo`가 같은 사실을 중복 소유할 때

## UC-004: test와 implementation은 같은 contract id를 공유해야 한다

### 상황

`docs-control-plane.bdd.cli.list-contracts.v1` 같은 contract를 구현한다.

### 기대

- test title은 `[contract:docs-control-plane.bdd.cli.list-contracts.v1]`를 포함한다.
- `test_unit.contract`와 `implementation_unit.contract`는 같은 contract id를 참조한다.
- `qa-sdk docs bdd units`가 같은 id로 둘을 묶어 보여준다.

### 실패 시 수정 대상

- `bdd-contract-extract.ts` family validation
- `docs-control-plane.cases.md`
- test title convention

## UC-005: skill 문서는 execution 예시지만 truth는 아니다

### 상황

작업자가 `skills/bdd-contract/SKILL.md`를 보고 바로 production code를 작성하려 한다.

### 기대

- skill은 workflow와 예시를 제공하지만, behavior truth는 `cases`와 `spec`가 소유한다.
- skill이 stale이면 먼저 `cases`/`spec`를 기준으로 갱신한다.
- skill은 실행 surface이지 시스템 truth가 아니다.

### 실패 시 수정 대상

- skill-catalog 문서가 skill과 spec의 권한 경계를 흐릴 때
- `work-lifecycle`이 skill의 역할을 과대평가할 때
