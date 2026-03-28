---
def:
  id: system-root
  address: def_document:v1:1072
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, cross-scope, entry-point]
  links:
    - target: system-concepts
      type: contains
    - target: system-data-flow
      type: contains
    - target: system-design-tools
      type: contains
    - target: system-frontend
      type: contains
    - target: system-infra
      type: contains
    - target: system-libraries
      type: contains
    - target: system-narrative
      type: contains
    - target: system-packages
      type: contains
    - target: system-support
      type: contains
---

# QA-SDK 시스템

## 목적 ^purpose

이벤트를 좌표로 인코딩하여, 데이터 흐름의 분기점에 명시적 추적성을 부여하는 로깅 SDK + 분석 인프라.

## 구성 ^overview

3개 기본 문서 + 5개 계층:
- `system-concepts`: 이벤트, 좌표, 축, Prefix, prefix_ref 기본 개념.
- `system-data-flow`: 이벤트 발생 → 수집 → 저장 → 판정 → 시각화 전체 흐름.
- `system-packages`: 패키지 의존 관계.
- `system-infra`: 인프라 서비스 6종 (ingest, gate, decode, query, registry, pipeline).
- `system-libraries`: 좌표 라이브러리 5종 (weighted-index, coord-query, indexing-core, index-meta, storage).
- `system-design-tools`: 설계 도구 5종 (DKG, decision-flow, spec-engine, analysis, definition-catalog).
- `system-frontend`: 프론트엔드 2종 (browser SDK, 시각화).
- `system-support`: 지원 4종 (권한, APM, 이벤트 어휘, 가이드).
