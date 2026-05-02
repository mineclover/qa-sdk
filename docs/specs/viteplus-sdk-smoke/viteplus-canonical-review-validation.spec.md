---
def:
  tier: component
  id: viteplus-canonical-review-validation
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
    - target: viteplus-canonical-review-implementation
      type: depends_on
    - target: viteplus-playbook-interaction
      type: depends_on
    - target: scenario-authoring-guide
      type: depends_on
---

# Vite+ Canonical Review 검증

## 목적 ^purpose

canonical review feature의 구현 단위와 qa-sdk logging이 함께 유지되는지 테스트 단위로 고정한다.

## 구성 ^overview

- pure state machine 테스트로 상태 전이 계약을 고정한다.
- handler orchestration 테스트로 invalid focus, success, reopen, reset을 고정한다.
- package build/test로 Vite+ 번들 환경까지 함께 검증한다.

## 전제 ^preconditions

- `packages/viteplus-sdk-smoke/src/qa-bridge.ts`가 `NoopTransport` debug envelope를 제공한다.
- canonical review feature는 `canonical_review_*` 이벤트와 `canonical_review_score` 메트릭을 기록한다.
- build는 `tsc && vp build` 기준으로 통과해야 한다.

## 스텝 ^steps

1. 빈 draft로 submit을 실행한다.
2. valid draft를 만들어 submit을 다시 실행한다.
3. success 이후 field 하나를 수정한다.
4. reset으로 baseline draft로 되돌린다.
5. package `test`와 `build`를 실행한다.

## 검증 ^assertions

- invalid submit 시 `validationIssues`가 채워지고 first invalid field로 focus가 이동한다.
- valid submit 시 result가 계산되고 상태가 `success`로 전이된다.
- success 이후 draft 변경 시 상태가 `editing`으로 복귀하고 stale result가 제거된다.
- reset 시 draft, validation, result, status가 baseline으로 복원된다.
- qa-sdk debug envelope에 validation failure, submit success, reset 이벤트가 남는다.

## 변형 ^variants

### V1: high risk + 짧은 rollback

- `riskLevel=high`이고 rollback 문장이 짧으면 `rollbackPlan` field error가 추가된다.

### V2: async submitter 실패

- persist adapter가 예외를 던지면 상태가 `error`로 전이되고 `canonical_review_submit_failed` 이벤트가 남는다.

## 실행 명령

```bash
pnpm --filter @qa-sdk/viteplus-sdk-smoke test
pnpm --filter @qa-sdk/viteplus-sdk-smoke build
```
