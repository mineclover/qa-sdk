---
def:
  id: system-infra
  level: group
  tier: layout
  address: def_document:v2:137230
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: ingest-system
      type: refs
    - target: gate-system
      type: refs
    - target: decode-system
      type: refs
    - target: query-system
      type: refs
    - target: registry-system
      type: refs
    - target: pipeline-system
      type: refs
    - target: system-libraries
      type: depends_on
---
# 인프라 서비스 계층

## 목적 ^purpose

이벤트 수집, 주소 유효성, 디코딩, 질의, 레지스트리, 파이프라인 — 좌표 시스템의 런타임 인프라를 구성하는 6개 서비스.

## 구성 ^overview

6개 서비스: ingest-server(수집), gate-service(유효성), decode-service(디코딩), query-service(질의), registry-service(등록), pipeline(처리 흐름).
