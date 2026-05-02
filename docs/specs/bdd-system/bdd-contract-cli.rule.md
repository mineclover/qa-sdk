---
def:
  id: bdd-contract-cli-rule
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing, contract]
  links:
    - target: bdd-contract-cli
      type: refines
    - target: docs-control-plane-rule
      type: depends_on
    - target: work-lifecycle
      type: depends_on
    - target: work-topic-schema-plan
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/lib/docs-control-plane/work-topic-extract.ts
---

# BDD Contract CLI — 소비 규칙

## 목적 ^purpose

`qa-sdk docs bdd`를 사용할 때 무엇이 authority이고 무엇이 preview/read model인지 구분하는 판별 기준을 정의한다. 이 문서는 BDD CLI가 behavior truth를 새로 만들지 않고, approved contract를 읽고 묶고 미리보기로 노출하는 소비 surface임을 고정한다.

이 rule은 command inventory를 다시 나열하지 않는다. 어떤 하위 명령이 있는지는 `bdd-contract-cli.spec`이, 남은 실행 작업은 `bdd-contract-system.todo`가 소유한다.

## Authority Rules

- `bdd_contract.id`가 behavior truth의 연결 키다. `docs bdd`는 이 id를 소비하지만 새 id를 발명하지 않는다.
- behavior truth는 `.cases.md` / `.test.md`의 BDD block과 관련 spec이 소유한다.
- `docs bdd` output은 read model 또는 preview다. source 문서, test file, implementation file을 자동 수정하지 않는다.
- `test-plan`과 `impl-plan`은 execution scaffold가 아니라 preview surface다. 실제 write는 별도 command/PRD authority가 생기기 전까지 금지한다.
- `compile` 결과의 `ScenarioSpec` / `PipeGraph`는 deterministic preview다. runtime state, LLM, DSPy를 authority로 사용하지 않는다.

## Family Consumption Rules

- `--family-only`는 same-family role docs와 direct module children만 읽는 소비 범위다.
- `list`, `validate`, `units`, `compile`, `test-plan`, `impl-plan`은 이 범위 안의 BDD block만 본다.
- 같은 contract id를 가진 `test_unit`과 `implementation_unit`은 family 단위에서 join된다.
- unresolved contract reference, cross-owner implementation unit, write-mode failure-path 누락은 validation issue로 보고하며 source truth를 자동 수정하지 않는다.

## Work Topic Adjacency Rules

- `work_topic`은 BDD contract를 대체하지 않는다. contract는 behavior truth이고, work topic은 delivery slice다.
- `work_topic` block은 `.plan.md` 또는 `.todo.md` 같은 execution artifact에 둔다. `.cases.md`의 BDD block에 섞어 behavior truth로 승격하지 않는다.
- `work_topic.contracts[]`는 기존 `bdd_contract.id`를 참조해야 한다. preview/planning surface가 새 contract vocabulary를 만들면 안 된다.
- `work_topic.contracts[]` resolution은 same-family 전용이 아니다. docs control-plane이 수집한 BDD contract id 전체에서 read-only로 확인하되, provider behavior ownership은 원래 `.cases.md` / `.test.md` family에 남긴다.
- `work_topic.source_targets`, `proof_surface`, `assimilation_target`은 execution/readiness 판단용 힌트다. 이 필드들이 존재해도 `docs bdd` 명령 자체가 파일 write authority를 얻지 않는다.
- lifecycle/work-topic summary는 `docs status`/`docs collect` 같은 control-plane inventory에서 읽고, `docs bdd`는 contract-oriented surface로 유지한다.

## Implementation Boundary Rules

- BDD core 의미는 `@qa-sdk/core` schema/type/compile layer가 소유한다.
- docs control-plane adapter는 fenced block extraction과 family validation을 소유한다.
- `docs bdd` command layer는 출력 조합, text/json rendering, exit code policy만 소유한다.
- lifecycle/work-topic projection은 docs control-plane sidecar read model이며 `docs bdd compile` semantics를 바꾸지 않는다.

## Consumer Checklist

- target family에 approved `.cases.md` 또는 `.test.md`가 있는가
- contract id가 test unit / implementation unit과 같은 id로 연결되는가
- write-mode contract에 failure path가 있는가
- `test-plan` / `impl-plan` 결과를 preview로만 다루고 있는가
- work topic이 있다면 contract id, source target, proof surface, assimilation target이 분리돼 있는가
- lifecycle summary가 필요하면 `docs status`/`docs collect`를 보고, contract summary가 필요하면 `docs bdd`를 보는가
