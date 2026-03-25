---
def:
  id: browser-session-patterns
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: browser-lifecycle-spec
      type: refines
---

# 브라우저 세션 패턴

## 목적 ^purpose

브라우저 세션 생명주기와 표준 사용 패턴을 분리해 앱이 QaMonitor를 일관되게 초기화하고 종료하도록 돕는다.

## 사용 패턴

- 세션은 탭 범위와 사용자 행동 범위를 혼동하지 않도록 명시적 시작/복원 규칙을 가져야 한다.
- 표준 사용 패턴은 앱 부팅, 페이지 전환, 종료 직전 flush 순서를 반복 가능한 형태로 제시해야 한다.
- 예제는 단순하지만, 세션 재사용과 신규 세션 생성 경계를 분명히 드러내야 한다.
