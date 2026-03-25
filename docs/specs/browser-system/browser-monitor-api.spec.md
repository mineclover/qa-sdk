---
def:
  id: browser-monitor-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: browser-monitor-spec
      type: refines
---

# 브라우저 모니터 API

## 목적 ^purpose

`@qa-sdk/browser` 패키지의 공개 API, config, 초기화 순서를 분리해 브라우저 monitor의 단일 진입점 계약을 정리한다.

## 공개 계약

- monitor API는 생성자, config, 런타임 메서드의 책임을 명확히 나눠야 한다.
- 초기화 순서는 trace/session context, transport, 자동 수집기를 안정적으로 연결하는 순서로 고정한다.
- config는 외부 서비스 URL, 샘플링, transport 설정처럼 앱이 바꿀 수 있는 항목만 노출한다.
