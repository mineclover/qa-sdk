---
def:
  id: system-libraries
  level: area
  address: def_document:v1:1072
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: wi-system
      type: contains
    - target: cq-system
      type: contains
    - target: indexing-core-system
      type: contains
    - target: index-meta-system
      type: contains
    - target: storage-system
      type: contains
---
# 좌표 라이브러리 계층

## 목적 ^purpose

좌표 인코딩, 질의 연산, 기반 원리, 메타데이터 관리, 저장소 — 서비스가 공유하는 핵심 라이브러리.

## 구성 ^overview

5개 라이브러리: weighted-index(인코딩), coordinate-query(질의), indexing-core(기반 원리), index-meta(메타데이터), storage(저장소).
