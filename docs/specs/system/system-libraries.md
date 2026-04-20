---
def:
  id: system-libraries
  level: group
  tier: layout
  address: def_document:v2:137231
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: wi-system
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
---
# 좌표 라이브러리 계층

## 목적 ^purpose

좌표 인코딩, 질의 연산, 기반 원리, 메타데이터 관리, 저장소 — 서비스가 공유하는 핵심 라이브러리.

## 구성 ^overview

5개 라이브러리: weighted-index(인코딩), coordinate-query(질의), indexing-core(기반 원리), index-meta(메타데이터), storage(저장소).
