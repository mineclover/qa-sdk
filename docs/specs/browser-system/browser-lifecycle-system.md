---
def:
  id: browser-lifecycle-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: browser-lifecycle-states
      type: contains
    - target: browser-session-patterns
      type: contains
---

# 브라우저 생명주기 그룹

## 목적 ^purpose

QaMonitor의 상태 전이와 세션 사용 패턴을 분리해 브라우저 SDK 생명주기의 핵심 계약을 유지하기 쉽게 만든다.

## 구성 ^overview

overview: 총 2개 멤버.
- `browser-lifecycle-states`: 상태 다이어그램과 단계별 계약을 정리한 문서.
- `browser-session-patterns`: 세션 생명주기와 표준 사용 패턴을 정리한 문서.

원본: `docs/specs/browser/lifecycle.spec.md` (`browser-lifecycle-spec`)
