---
def:
  id: storage-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: storage-adapters-spec
      type: contains
    - target: storage-schema-spec
      type: contains
    - target: scenario-store-spec
      type: contains
    - target: verdict-spec
      type: contains
    - target: graph-spec
      type: contains
    - target: utils-spec
      type: contains
---

## 목적 ^purpose

이벤트/시나리오/판정/그래프 데이터의 저장 어댑터, 스키마, 유틸리티.

## 구성 ^overview

6개 정의: 저장 어댑터, 스키마, 시나리오 스토어, verdict 스토어, 그래프 스토어, ID/Clock 유틸.
