---
def:
  id: cq-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: cq-policy-resolver
      type: contains
    - target: cq-cross-index
      type: contains
    - target: cq-version-query
      type: contains
    - target: cq-relational-engine
      type: contains
---
# Coordinate Query 시스템

## 목적 ^purpose

닫힌 좌표 공간 위의 패턴 포함 관계, 정책 해소, cross-index 합성 질의, 버전 횡단 탐색을 다루는 n차원 연산 계층. range algebra 위에 lattice, policy, join, version 연산을 쌓는다.

## 구성 ^overview

4개 정의: policy-resolver(정책 해소), cross-index-query(교차 인덱스 합성), version-query(버전 횡단), RelationalEngine(관계형 질의 통합).
