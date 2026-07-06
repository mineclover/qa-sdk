---
def:
  id: browser-lifecycle-system
  tier: system
  address: def_document:v2:137216
  scope: flow
  aspect: lifecycle_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: [structural]
  links:
    - target: browser-lifecycle-states
      type: contains
    - target: browser-session-patterns
      type: contains
    - target: browser-system
      type: depends_on
sources:
  - packages/browser-sdk/src/monitor.ts
  - packages/browser-sdk/src/session.ts
  - packages/browser-sdk/src/types.ts
  - packages/browser-sdk/src/monitor.lifecycle.test.ts
  - packages/browser-sdk/src/session.test.ts
---

# 브라우저 생명주기 그룹

## 목적 ^purpose

QaMonitor의 상태 전이와 세션 사용 패턴을 분리해 브라우저 SDK 생명주기의 핵심 계약을 유지하기 쉽게 만든다.

## 구성 ^overview

- `browser-lifecycle-states`: 상태 다이어그램과 단계별 계약을 정리한 문서.
- `browser-session-patterns`: 세션 생명주기와 표준 사용 패턴을 정리한 문서.

원본: `docs/specs/browser/lifecycle.spec.md` (`browser-lifecycle-spec`)
