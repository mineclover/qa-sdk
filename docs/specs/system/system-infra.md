---
def:
  id: system-infra
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: ingest-system
      type: contains
    - target: gate-system
      type: contains
    - target: decode-system
      type: contains
    - target: query-system
      type: contains
    - target: registry-system
      type: contains
    - target: pipeline-system
      type: contains
---
# 인프라 서비스 계층

## 목적 ^purpose

이벤트 수집, 주소 유효성, 디코딩, 질의, 레지스트리, 파이프라인 — 좌표 시스템의 런타임 인프라를 구성하는 6개 서비스.

## 구성 ^overview

6개 서비스: ingest-server(수집), gate-service(유효성), decode-service(디코딩), query-service(질의), registry-service(등록), pipeline(처리 흐름).
