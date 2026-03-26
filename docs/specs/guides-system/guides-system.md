---
def:
  id: guides-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point]
  links:
    - target: quickstart-guide
      type: contains
    - target: analysis-system
      type: contains
    - target: prefix-type-guide
      type: contains
    - target: cookbook-guide
      type: contains
---

## 목적 ^purpose

개발자 가이드: 빠른 시작, 분석 시스템, prefix 설계, 레시피 모음.

## 구성 ^overview

- `quickstart-guide`: 시스템 내 enum, 이벤트, 권한, API, 화면 경로를 prefix로 관리하는 개발자 시작 가이드.
- `analysis-system-guide`: Self-Check, Convergence, IntentLink, Co-occurrence, TransitionSpec — 각 구성 요소의 목적, 동작 방식, prefix와의 관계를 설명한다.
- `prefix-type-guide`: 프로젝트를 분석하여 적절한 prefix를 설계하는 가이드.
- `cookbook-guide`: entry 추가, 축 생성, prefix 설계, capacity 확장 등 자주 쓰는 좌표 시스템 조작 레시피 모음.
