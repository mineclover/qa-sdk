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

overview: 총 5개 멤버.
- `auto-capture-spec`: opt-in DOM 이벤트 자동 수집.
- `browser-transport-spec`: 브라우저 언로드 타이밍에서도 이벤트를 누락하지 않는 전송 구현체.
- `browser-lifecycle-spec`: QaMonitor의 상태 전환 규칙, 각 단계의 계약, 올바른 사용 패턴을 정의한다.
- `browser-monitor-spec`: `@qa-sdk/browser` 패키지의 단일 진입점.
- `trace-context-spec`: trace_id, span stack, qa_session_id를 관리하는 런타임 컨텍스트 객체.
