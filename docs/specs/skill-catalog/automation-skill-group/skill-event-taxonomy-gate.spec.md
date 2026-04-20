---
def:
  tier: component
  id: skill-event-taxonomy-gate
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [operations, observability]
  links:
    - target: automation-skill-group
      type: refines
    - target: service-event-adoption-plan
      type: depends_on
---

## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-event-taxonomy-gate**

형제: `skill-e2e-test` · `skill-gform-parser` · `skill-spec-lifecycle`

## 목적 ^purpose

registry event taxonomy 운영 게이트를 실행하고, check/assert 결과를 해석해 adoption drift를 정리하는 절차를 제공한다.

## 사용 맥락 ^context

event-catalog pack/adoption 구성이 바뀌었거나, 배포 전 registry event taxonomy 정합성을 확인해야 할 때 사용한다.

## 설계 의도 ^intent

drift 진단과 assert gate를 하나의 운영 루프로 묶어 event taxonomy 구조를 안정적으로 유지한다.

## 피드백 규칙 ^feedback

- `adoption-missing`이 반복되면 adoption 대상 서비스 정책을 다시 점검한다.

## 관련 소스

- `skills/event-taxonomy-gate/SKILL.md`
