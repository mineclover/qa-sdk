---
def:
  id: system-root
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [cross-scope, entry-point]
  links:
    - target: system-concepts
      type: contains
    - target: system-data-flow
      type: contains
    - target: system-packages
      type: contains
    - target: ingest-system
      type: contains
    - target: gate-system
      type: contains
    - target: df-system
      type: contains
    - target: pipeline-system
      type: contains
    - target: permission-system
      type: contains
    - target: decode-system
      type: contains
    - target: query-system
      type: contains
    - target: registry-system
      type: contains
    - target: dkg-system
      type: contains
    - target: wi-system
      type: contains
    - target: cq-system
      type: contains
    - target: browser-system
      type: contains
    - target: spec-engine-system
      type: contains
    - target: indexing-core-system
      type: contains
    - target: index-meta-system
      type: contains
    - target: viz-system
      type: contains
    - target: apm-system
      type: contains
    - target: storage-system
      type: contains
    - target: event-vocab-system
      type: contains
    - target: guides-system
      type: contains
    - target: definition-catalog-spec
      type: contains
---
# QA-SDK 시스템

## 목적 ^purpose

이벤트를 좌표로 인코딩하여, 데이터 흐름의 분기점에 명시적 추적성을 부여하는 로깅 SDK + 분석 인프라. 축(Axis)으로 유한한 분류 차원을 정의하고, Prefix로 축의 조합을 만들고, 정수 하나로 압축한다.

## 구성 ^overview

20개 하위 시스템: ingest(수집), gate(주소 유효성), decision-flow(의사결정), pipeline(처리 흐름), permission(권한), decode(디코딩), query(질의), registry(중앙 등록), DKG(설계 그래프), weighted-index(좌표 인코딩), coordinate-query(좌표 질의).
