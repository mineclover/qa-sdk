---
def:
  id: scope-nesting-procedure-test
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: scope-nesting-procedure
      type: depends_on
---

# Scope Nesting 변경 절차 테스트 명세

## 목적 ^purpose

scope 추가·순서 변경·제거 절차가 validateScopeNesting과 mount flow 검증에 맞게 동작하는지 검증한다.

## 전제 ^preconditions

- fullNesting: 4-scope playbook (qa-bridge→feature-context→handlers→view)
- graph: validate-input→compute-result→log-event 3-pipe graph
- bindings: 3 pipe → handlers scope 매핑

## 스텝 ^steps

1. [추가] 새 scope를 handlers 앞에 삽입 → validateScopeNesting → valid 확인
2. [추가] 새 scope를 잘못된 위치에 삽입 → missing-provider error 확인
3. [순서 변경] 독립 scope 교환 → checkSwapSafety null → 교환 적용 → validateMountFlow valid
4. [순서 변경] 의존 scope 교환 → checkSwapSafety error 반환 → 교환 미적용
5. [제거] qa-bridge 제거 → descentPaths.consumedBy로 영향 확인 → validateScopeNesting error
6. [제거] optional로 전환 후 제거 → valid (warning만)

## 검증 ^assertions

- 추가: 올바른 위치 삽입 시 valid, 잘못된 위치 시 missing-provider
- 순서 변경: 안전한 교환 후 mount flow도 valid
- 제거: required consumer 있으면 error, optional 전환 후 warning만
