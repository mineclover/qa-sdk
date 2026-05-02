---
def:
  id: system-frontend
  tier: layout
  address: def_document:v2:137229
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural]
  links:
    - target: browser-system
      type: refs
    - target: viz-system
      type: refs
    - target: viz-system-root
      type: refs
    - target: experience-layer-group
      type: refs
---
# 프론트엔드 계층

## 목적 ^purpose

브라우저 SDK(이벤트 수집/세션)와 시각화(패널/렌더러/에디터) — 클라이언트 측 좌표 시스템 소비자 및 경험 계층 그룹.

## 구성 ^overview

- browser-system(SDK 수집/세션)
- viz-system(시각화 + 내부 서브시스템)
- viz-system-root(Visualization 도메인 루트)
- experience-layer-group(UX 그룹 — viz + platform-demo)
