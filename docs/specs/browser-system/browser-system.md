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
    - target: browser-runtime-system
      type: contains
    - target: browser-transport-spec
      type: contains
    - target: browser-lifecycle-system
      type: contains
    - target: trace-context-spec
      type: contains
---

## 목적 ^purpose

브라우저 SDK의 이벤트 수집, 세션 관리, 생명주기, 전송을 담당하는 클라이언트 시스템.

## 구성 ^overview

overview: 총 4개 멤버.
- `browser-runtime-system`: opt-in DOM 자동 수집과 monitor 초기화/오류 처리 규칙을 묶은 그룹.
- `browser-transport-spec`: 브라우저 언로드 타이밍에서도 이벤트를 누락하지 않는 전송 구현체.
- `browser-lifecycle-system`: QaMonitor의 상태 전이와 세션 사용 패턴을 분리한 그룹.
- `trace-context-spec`: trace_id, span stack, qa_session_id를 관리하는 런타임 컨텍스트 객체.
