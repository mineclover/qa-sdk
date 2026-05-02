---
def:
  id: guides-system
  type: knowledge
  knowledge_kind: guide
  tier: system
  address: def_document:v2:137219
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, entry-point, cross-scope]
  links:
    - target: analysis-system
      type: traces_to
    - target: architecture-decisions
      type: contains
    - target: coding-conventions
      type: contains
    - target: cookbook-guide
      type: contains
    - target: data-model-guide
      type: contains
    - target: definition-runtime-guide
      type: contains
    - target: getting-started-guide
      type: contains
    - target: prefix-type-guide
      type: contains
    - target: scenario-authoring-guide
      type: contains
    - target: quickstart-guide
      type: contains
    - target: sdk-usage-guide
      type: contains
    - target: sdk-vite-onboarding-guide
      type: contains
    - target: scope-classification-guide
      type: contains
    - target: spec-convention
      type: contains
---

## 목적 ^purpose

개발자가 시스템을 처음 붙이거나 운영 절차를 다시 확인할 때 어떤 가이드를 어떤 순서로 읽어야 하는지 정리하는 루트 문서. 빠른 시작, 런타임 초기화, prefix 설계, SDK 소비, 레시피를 한곳에서 찾게 한다.

## 구성 ^overview

- `quickstart-guide`: 시스템 내 enum, 이벤트, 권한, API, 화면 경로를 prefix로 관리하는 개발자 시작 가이드.
- `analysis-system`: Self-Check, Convergence, IntentLink, Co-occurrence, TransitionSpec — 각 구성 요소의 목적, 동작 방식, prefix와의 관계를 설명한다.
- `prefix-type-guide`: 프로젝트를 분석하여 적절한 prefix를 설계하는 가이드.
- `cookbook-guide`: entry 추가, 축 생성, prefix 설계, capacity 확장 등 자주 쓰는 좌표 시스템 조작 레시피 모음.
- `definition-runtime-guide`: definition runtime 초기화, gate tracker 연결, Cross-Loop 브릿지 사용 순서를 설명한다.
- `sdk-usage-guide`: `@qa-sdk/sdk` 소비처 레퍼런스와 브라우저/테스트 환경별 베스트 프랙티스.
- `sdk-vite-onboarding-guide`: `vp create` 이후 Vite 소비처를 qa-sdk 규칙에 맞게 붙이는 체크리스트.
