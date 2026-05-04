---
def:
  id: system-libraries
  tier: layout
  address: def_document:v2:137231
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: sim-decision-view
      type: refs
    - target: sim-internal-network
      type: refs
    - target: sim-outbox-view
      type: refs
    - target: motion-content-system
      type: refs
    - target: motion-content-editor-system
      type: refs
    - target: motion-content-editor-demo-system
      type: refs
    - target: wi-system
      type: refs
    - target: weighted-index-system
      type: refs
    - target: wi-trace-group
      type: refs
    - target: cq-system
      type: refs
    - target: indexing-core-system
      type: refs
    - target: index-meta-system
      type: refs
    - target: storage-system
      type: refs
    - target: platform-chain-system
      type: refs
    - target: qa-sdk-core-system
      type: refs
---
# 좌표 라이브러리 계층

## 목적 ^purpose

좌표 인코딩, 질의 연산, 기반 원리, 메타데이터 관리, 저장소 — 서비스가 공유하는 핵심 라이브러리와 추적성 그룹, 공통 core.

## 구성 ^overview

핵심 라이브러리: weighted-index(인코딩), coordinate-query(질의), indexing-core(기반 원리), index-meta(메타데이터), storage(저장소), platform-chain(플랫폼 체인).

부속: weighted-index-system/wi-trace-group(WI 도메인 루트 + 추적성), qa-sdk-core-system(공통 타입/상수/유틸).
