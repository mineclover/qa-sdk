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

registry-service가 실행 중이지 않은 curl connection failure는 drift가 아니다. 운영 전제 미충족으로 보고 registry-service를 먼저 기동해야 한다.

## 설계 의도 ^intent

drift 진단과 assert gate를 하나의 운영 루프로 묶어 event taxonomy 구조를 안정적으로 유지한다.

## 피드백 규칙 ^feedback

- `adoption-missing`이 반복되면 adoption 대상 서비스 정책을 다시 점검한다.
- `adopted-prefixes-without-ownership`이 반복되면 외부 pack adoption과 service ownership을 함께 점검한다.
- `svc_log.<level>` fallback key가 gate에서 실패하면 명시 `eventKey` 주입 또는 별도 mapping pack/adoption 추가 중 하나로 정리한다.

## 관련 소스

- `skills/event-taxonomy-gate/SKILL.md`
- `scripts/registry-event-taxonomy-gate.sh`
- `docs/specs/event-vocab-system/service-event-adoption.rule.md`
- `docs/specs/observability-system/event-logging-lifecycle.rule.md`
