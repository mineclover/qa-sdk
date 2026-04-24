---
def:
  id: responsibility-closure-harness-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [scenario, testing, structural, error-handling, authorization, observability]
  links:
    - target: responsibility-closure-harness
      type: refines
    - target: responsibility-closure-harness-rule
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
---

# Responsibility Closure Harness — Use Cases

## 목적 ^purpose

Responsibility Closure Harness가 실제 작업에서 어떤 시나리오를 판정해야 하는지 정의한다. 이 문서는 closure rule을 구체적인 작업 흐름으로 보여주고, 실패 시 어느 문서/코드/테스트를 고쳐야 하는지 명시한다.

## 시나리오 1: 새 System behavior를 구현한다 ^overview

**전제**: 새 기능이 public command나 runtime behavior를 가진다. 코드에는 System-like 함수 또는 orchestrator가 추가된다.

**동작**: 작업자가 System 문서, Interface 문서, Component 문서, BDD cases, test source를 연결한다.

**기대**:
- System 문서는 behavior ownership과 source boundary를 가진다.
- Interface 문서는 command/API/event contract만 소유한다.
- Component 문서는 data/state/evidence shape만 소유한다.
- `docs bdd validate <system> --family-only --json`이 통과한다.
- package test가 behavior를 검증한다.

**실패 시 수정 대상**: `responsibility-closure-harness-rule`, 해당 System family, BDD cases, test source.

## 시나리오 2: 코드가 이미 여러 파일로 모듈화되어 있다

**전제**: 하나의 behavior가 `types`, `traverse`, `rank`, `filter`, `summary` 같은 여러 source file로 구현되어 있다.

**동작**: 작업자가 파일 수만큼 문서를 만들지 않고, 독립 책임 단위별로 문서와 sources를 연결한다.

**기대**:
- data shape file은 Component 문서로 연결된다.
- behavior files는 하나의 System 문서 sources로 묶일 수 있다.
- facade/index file은 Layout/Pack 또는 root overview에서 `refs`로 조망된다.
- `sources`는 topology evidence이지 behavior ownership 복제가 아니다.

**실패 시 수정 대상**: `architecture-revealing-code-convention`, `def-split` skill, 해당 family의 source mapping.

## 시나리오 3: error handling policy가 추가된다

**전제**: System behavior가 실패 모드, error envelope, fail-open/fail-closed 결정을 가진다.

**동작**: 작업자가 error rule/spec을 연결하고, 실패 시나리오 test evidence를 추가한다.

**기대**:
- error concern이 consumed rule로 드러난다.
- BDD/cases 또는 test에서 failure path가 검증된다.
- `closed` 판정은 error evidence 없이는 나오지 않는다.

**실패 시 수정 대상**: error-handling convention, 해당 System test, responsibility closure rule.

## 시나리오 4: permission policy가 behavior에 영향을 준다

**전제**: System behavior가 actor/resource/action/realm에 따라 결과가 달라진다.

**동작**: 작업자가 authorization policy/model 문서를 연결하고 permission test evidence를 추가한다.

**기대**:
- permission rule/model이 consumed rule로 표시된다.
- actor/resource/action/realm 조합이 test 또는 cases에 등장한다.
- permission evidence 없이 `closed`가 되지 않는다.

**실패 시 수정 대상**: authorization ontology 문서, permission test, closure read model.

## 시나리오 5: Layout / Pack이 조립을 변경한다

**전제**: `index.ts`, package facade, pack manifest, docs inventory가 refs 대상 목록을 바꾼다.

**동작**: 작업자가 Layout/Pack 문서의 `refs`와 package exports/manifest를 맞춘다.

**기대**:
- Layout/Pack은 behavior/data ownership을 갖지 않는다.
- refs 대상이 모두 존재한다.
- export/registry test는 조립 누락만 검증한다.

**실패 시 수정 대상**: Layout/Pack 문서, facade/manifest source, package export test.

## 시나리오 6: 완료된 todo가 spec에 흡수되지 않았다

**전제**: todo checkbox가 완료됐지만 spec/source/test evidence가 아직 갱신되지 않았다.

**동작**: 하네스가 completed/prune candidate를 responsibility closure 상태와 함께 보여준다.

**기대**:
- 상태는 `partially-closed`로 남는다.
- spec assimilation 또는 memo/archive 결정이 follow-up으로 나온다.
- 자동 삭제나 자동 승격은 하지 않는다.

**실패 시 수정 대상**: work-lifecycle, docs-control-plane completed-record review, responsibility closure TODO.
