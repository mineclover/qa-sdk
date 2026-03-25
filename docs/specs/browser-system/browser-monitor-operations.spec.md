---
def:
  id: browser-monitor-operations
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: browser-monitor-spec
      type: refines
    - target: browser-lifecycle-spec
      type: depends_on
---

# 브라우저 모니터 운영 규칙

## 목적 ^purpose

브라우저 monitor의 내부 파라미터, 오류 처리, 빌드 산출물, 사용 예시를 분리해 운영 중 변경 규칙을 정리한다.

## 운영 규칙

- 고정 내부 파라미터는 외부 config가 아니라 SDK 내부 안전장치로 취급해야 한다.
- 오류 처리는 브라우저 앱을 멈추지 않는 fail-open 전략을 기본으로 한다.
- 빌드 출력과 사용 예시는 lifecycle 규칙을 어기지 않는 초기화 패턴을 보여주는 문서 역할을 한다.
