---
def:
  id: browser-runtime-system
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: [structural, tier-frontend]
  links:
    - target: browser-capture-contract
      type: contains
    - target: browser-monitor-api
      type: contains
    - target: browser-monitor-operations
      type: contains
---

# 브라우저 런타임 그룹

## 목적 ^purpose

브라우저 자동 수집과 monitor 초기화/오류 처리를 런타임 계약 문서로 분리해 SDK 진입점의 변경 범위를 줄인다.

## 구성 ^overview

- `browser-capture-contract`: opt-in DOM 이벤트 자동 수집 모드와 cleanup 규칙을 정리한 문서.
- `browser-monitor-api`: `@qa-sdk/browser`의 공개 API와 초기화 절차를 정리한 문서.
- `browser-monitor-operations`: monitor의 내부 파라미터, 오류 처리, 빌드/사용 예시를 정리한 문서.

원본: `docs/specs/browser/auto-capture.spec.md` (`auto-capture-spec`), `docs/specs/browser/monitor.spec.md` (`browser-monitor-spec`)
