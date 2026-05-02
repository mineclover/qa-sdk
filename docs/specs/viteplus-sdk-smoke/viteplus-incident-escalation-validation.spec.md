---
def:
  tier: component
  id: viteplus-incident-escalation-validation
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, testing, observability]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-incident-escalation-implementation
      type: depends_on
    - target: viteplus-playbook-interaction
      type: depends_on
    - target: scenario-authoring-guide
      type: depends_on
---

# Vite+ Incident Escalation 검증

## 목적 ^purpose

incident escalation feature가 canonical template 위에서 invalid focus, success 전이, reopen, reset, qa-sdk logging을 함께 유지하는지 검증 단위로 고정한다.

## 구성 ^overview

- state machine 테스트로 공통 status 전이 계약을 확인한다.
- handler orchestration 테스트로 severity 기반 validation, submit success, reopen, reset을 확인한다.
- build/test 명령으로 Vite+ 번들 환경까지 함께 확인한다.

## 전제 ^preconditions

- `packages/viteplus-sdk-smoke/src/qa-bridge.ts`가 `NoopTransport` debug envelope를 제공한다.
- incident escalation feature는 `incident_escalation_*` 이벤트와 `incident_escalation_score` 메트릭을 기록한다.
- build는 `tsc && vp build` 기준으로 통과해야 한다.

## 스텝 ^steps

1. 빈 incident draft로 submit을 실행한다.
2. valid sev1 incident draft를 만들어 submit한다.
3. success 이후 field 하나를 수정한다.
4. reset으로 baseline draft로 되돌린다.
5. package `test`와 `build`를 실행한다.

## 검증 ^assertions

- invalid submit 시 `incidentTitle`부터 focus가 이동한다.
- valid submit 시 urgency score와 recommended route가 계산되고 상태가 `success`가 된다.
- success 이후 draft 수정 시 상태가 `editing`으로 복귀한다.
- reset 시 draft, validation, result, status가 baseline으로 복원된다.
- qa-sdk debug envelope에 `incident_escalation_*` 이벤트와 `incident_escalation_score` 메트릭이 남는다.

## 변형 ^variants

### V1: severity별 필수 필드 분기

- `severity=sev1`이면 `impactScope`와 `mitigationPlan`이 필수. 미입력 시 해당 field error가 추가된다.
- `severity=sev3`이면 `impactScope`만 필수. `mitigationPlan`은 선택.

### V2: async submitter 실패

- persist adapter가 예외를 던지면 상태가 `error`로 전이되고 `incident_escalation_submit_failed` 이벤트가 남는다.
