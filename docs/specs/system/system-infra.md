---
def:
  id: system-infra
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
    - target: gate-engine-group
      type: refs
    - target: decode-system
      type: refs
    - target: decode-service-system
      type: refs
    - target: query-system
      type: refs
    - target: registry-system
      type: refs
    - target: pipeline-system
      type: refs
    - target: decision-service-spec
      type: refs
    - target: infra-engine-system
      type: refs
    - target: persistence-system-root
      type: refs
    - target: observability-system-root
      type: refs
    - target: system-libraries
      type: depends_on
---
# 인프라 서비스 계층

## 목적 ^purpose

이벤트 수집, 주소 유효성, 디코딩, 질의, 레지스트리, 파이프라인 — 좌표 시스템의 런타임 인프라를 구성하는 서비스 및 공통 인프라 도메인.

## 구성 ^overview

6개 코어 서비스: ingest-server(수집), gate-service(유효성) + gate-engine-group(엔진 그룹), decode-service(디코딩) + decode-service-system(서비스 시스템), query-service(질의), registry-service(등록), pipeline(처리 흐름).

부속 인프라 도메인: decision-service-spec(결정 서비스 계약), infra-engine-system(인프라 엔진), persistence-system-root(영속성), observability-system-root(관측성).
