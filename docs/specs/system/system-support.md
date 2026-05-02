---
def:
  id: system-support
  tier: layout
  address: def_document:v2:137235
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: permission-system
      type: refs
    - target: permission-engine-spec
      type: refs
    - target: apm-system
      type: refs
    - target: event-vocab-system
      type: refs
    - target: guides-system
      type: refs
    - target: skill-catalog-system
      type: refs
    - target: auth-service-spec
      type: refs
    - target: e2e-suite-spec
      type: refs
    - target: facet-tests-spec
      type: refs
    - target: simulation-tests-spec
      type: refs
    - target: validation-layer-group
      type: refs
    - target: config-loader-spec
      type: refs
    - target: package-classifier-spec
      type: refs
    - target: db-traffic-control-spec
      type: refs
    - target: db-bootstrap
      type: refs
    - target: otel-package-spec
      type: refs
    - target: error-handling-convention
      type: refs
    - target: review-ledger-spec
      type: refs
    - target: tag-search
      type: refs
    - target: shared-utility-group
      type: refs
---
# 지원 계층

## 목적 ^purpose

권한 엔진, APM 관측 인프라, 이벤트 어휘, 개발자 가이드, 공통 유틸리티 — 핵심 시스템을 보조하는 횡단 관심사.

## 구성 ^overview

권한: permission-system + permission-engine-spec. 관측: apm-system. 어휘: event-vocab-system. 가이드/skill: guides-system, skill-catalog-system.

테스트 환경: e2e/facet/simulation 스펙 + validation-layer-group(통합).

인프라 보조: auth/config/db-traffic/db-bootstrap/otel/package-classifier/review-ledger/tag-search/error-handling-convention + shared-utility-group(공통 유틸).
