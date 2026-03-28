---
def:
  id: system-frontend
  address: def_document:v1:1072
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, tier-frontend]
  links:
    - target: browser-system
      type: contains
    - target: viz-system
      type: contains
---
# 프론트엔드 계층

## 목적 ^purpose

브라우저 SDK(이벤트 수집/세션)와 시각화(패널/렌더러/에디터) — 클라이언트 측 좌표 시스템 소비자.

## 구성 ^overview

2개 시스템: browser-system(SDK), viz-system(시각화).
