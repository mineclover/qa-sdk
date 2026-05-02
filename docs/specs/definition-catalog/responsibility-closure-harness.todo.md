---
def:
  id: responsibility-closure-harness-todo
  type: knowledge
  knowledge_kind: proposal
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [structural, testing, observability]
  links:
    - target: responsibility-closure-harness
      type: traces_to
    - target: responsibility-closure-harness-rule
      type: depends_on
    - target: responsibility-closure-harness-test
      type: traces_to
---

# Responsibility Closure Harness — TODO

## 목적 ^purpose

Responsibility Closure Harness를 실제 read-only 하네스로 운영하기 위해 남은 실행 작업만 추적한다. 구현된 개념과 판정 규칙은 spec/rule/cases/test 문서가 소유하고, 이 문서는 다음 implementation slice만 소유한다.

## 실행 항목

### Actionable — 실행 가능

- [x] Closure read model 1차 설계
  - [x] `ClosureState = unmapped | mapped | partially-closed | closed | drifted` 타입 정의
  - [x] code responsibility, boundary, consumed rules, evidence, missing fields shape 정의
  - [x] DocumentEnvelope metadata와 definition graph 입력 범위 확정

- [x] `docs closure` read-only CLI 추가
  - [x] `<doc-id>` target 지원
  - [x] `<source-file[:symbol]>` target 지원
  - [x] text/json output contract 정의
  - [x] no hidden write 보장

- [x] Missing evidence aggregation
  - [x] generic consumed-rule / verification-evidence / lifecycle-follow-up / diagnostic-error missing item
  - [x] error concern specific missing evidence
  - [x] permission concern specific missing evidence
  - [x] observability concern specific missing evidence
  - [x] lifecycle assimilation/prune candidate severity tuning
  - [x] positive evidence가 있으면 error/permission/observability missing이 사라지는 fixture

- [x] Test coverage
  - [x] CLI smoke tests
  - [x] doc-id target fixture
  - [x] source path target fixture
  - [x] concern-specific missing evidence fixtures
  - [x] source symbol-level mapping fixture
  - [x] concern-specific positive evidence fixtures

### Deferred — 조건부 대기

- [ ] Write workflow 연동
  - [ ] closure result에서 todo scaffold를 자동 생성하는 write mode는 별도 PRD 전까지 금지
  - [ ] spec promotion/todo prune materialization은 work-lifecycle write workflow가 생긴 뒤 판단

- [ ] New FSM integration
  - [ ] responsibility closure를 별도 state machine으로 만들지는 아직 보류
  - [ ] 기존 doc-lifecycle/spec-impl/convention-compliance/quality bundle 조합으로 충분한지 먼저 관찰
