---
def:
  id: rlsc
  type: spec
  tier: system
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: platform-demo
  tags: [structural, runtime, boundary]
  links:
    - target: viz-language-system
      type: depends_on
    - target: rlsc-core-model
      type: refs
    - target: rlsc-integration
      type: refs
sources:
  - packages/rlsc-analysis/src/index.ts
  - packages/rlsc-analysis/src/browser.ts
  - packages/rlsc-analysis/src/graphics-interface.ts
  - packages/visbug-bridge/src/controller.ts
  - packages/visbug-bridge/src/index.ts
  - packages/visbug-bridge/src/types.ts
---

# RLSC System

## 목적 ^purpose

RLSC 분석과 visbug bridge가 공유하는 실행 경계를 고정한다. 세부 모델은 `rlsc-core-model`, 좌표계 및 도구 통합 설명은 `rlsc-integration`이 소유하고, 이 문서는 코드의 `@def.boundary rlsc` 주석이 가리키는 시스템 anchor로만 동작한다.

## 구성 ^overview

- `packages/rlsc-analysis`: DOM 수집, 구조 분석, graphics interface 추출
- `packages/visbug-bridge`: RLSC 결과와 visbug 편집 경계를 연결하는 bridge
- `rlsc-core-model`: 핵심 데이터 모델
- `rlsc-integration`: qa-sdk 좌표계와 외부 graphics 도구 통합 경로
