---
def:
  id: browser-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: shopping-web
  tags: [entry-point, tier-frontend]
  links:
    - target: auto-capture-spec
      type: contains
    - target: browser-transport-spec
      type: contains
    - target: browser-lifecycle-spec
      type: contains
    - target: browser-monitor-spec
      type: contains
    - target: trace-context-spec
      type: contains
---

## 목적 ^purpose

브라우저 SDK의 이벤트 수집, 세션 관리, 생명주기, 전송을 담당하는 클라이언트 시스템.

## 구성 ^overview

5개 정의: AutoCapture(DOM 이벤트), Transport(전송), Lifecycle(상태 전환), Monitor(모니터링), TraceContext(컨텍스트).
