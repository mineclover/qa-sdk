---
def:
  id: work-lifecycle-todo
  type: knowledge
  knowledge_kind: proposal
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [testing, structural]
  links:
    - target: work-lifecycle
      type: traces_to
    - target: work-lifecycle-plan
      type: traces_to
---

# Work Lifecycle — TODO

## 목적 ^purpose

`work-lifecycle`의 남은 실행 작업만 추적한다. 구현된 사실은 `work-lifecycle` spec과 관련 rule/test 문서가 소유한다.

## 실행 항목

### Actionable — 실행 가능

- [ ] Work topic accepted spec 승격
  - [ ] `work-topic-schema-plan`을 accepted spec/rule로 승격할지 결정
  - [ ] `work_topic` field dictionary owner 확정
  - [ ] validation severity model 확정

- [ ] Lifecycle warning integration
  - [ ] stale rules warning 연결
  - [ ] assimilation readiness warning 연결
  - [ ] todo prune candidate review surface 보강

### Deferred — 조건부 대기

- [ ] Write workflow 설계
  - [ ] todo prune materialization은 별도 PRD 전까지 금지
  - [ ] spec promotion materialization은 별도 PRD 전까지 금지
