---
def:
  id: viz-language-system
  tier: system
  address: def_document:v2:342036
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: platform-demo
  tags: [structural]
  links:
    - target: rlsc-core-model
      type: contains
    - target: rlsc-integration
      type: contains
    - target: rlsc
      type: refs
    - target: graphics-interface-adapter-coverage
      type: contains
    - target: canvas-viewport-spec
      type: refs
sources:
  - packages/rlsc-analysis/src/index.ts
  - packages/rlsc-analysis/src/browser.ts
  - packages/rlsc-analysis/src/graphics-interface.ts
  - packages/visbug-bridge/test/rlsc-integration.spec.ts
---

# Viz RLSC 언어 계약 그룹

## 목적 ^purpose

RLSC 계약을 핵심 모델, 좌표계 통합, graphics interface coverage 문서로 분리해 선언형 UI 언어 계층을 정리한다.

## 구성 ^overview

- `rlsc-core-model`: RLSC의 정체성, 핵심 개념, 마크업 포맷을 정리한 문서.
- `rlsc-integration`: context engineering, 기존 좌표계 통합, API/패키지 구조를 정리한 문서.
- `graphics-interface-adapter-coverage`: CSS/DOM, Figma, Pencil, Photoshop, Stitch를 중앙 graphics interface로 흡수하기 위한 adapter coverage 문서.

qa-sdk는 RLSC 구현 전체를 직접 소유하지 않는다. 현재 repo 안의 근거는 `packages/rlsc-analysis`와 `visbug-bridge` 통합 테스트이며, viz-language는 좌표계 연결과 graphics interface 계약을 문서화한다.
