---
def:
  id: system-support
  level: group
  address: def_document:v2:137235
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: permission-system
      type: contains
    - target: apm-system
      type: contains
    - target: event-vocab-system
      type: contains
    - target: guides-system
      type: contains
    - target: skill-catalog-system
      type: contains
    - target: auth-service-spec
      type: contains
    - target: e2e-suite-spec
      type: contains
    - target: facet-tests-spec
      type: contains
    - target: simulation-tests-spec
      type: contains
    - target: config-loader-spec
      type: contains
    - target: package-classifier-spec
      type: contains
    - target: db-traffic-control-spec
      type: contains
    - target: otel-package-spec
      type: contains
    - target: error-handling-convention
      type: contains
    - target: review-ledger-spec
      type: contains
    - target: tag-search
      type: contains
---
# 지원 계층

## 목적 ^purpose

권한 엔진, APM 관측 인프라, 이벤트 어휘, 개발자 가이드 — 핵심 시스템을 보조하는 횡단 관심사.

## 구성 ^overview

4개 시스템: permission(권한), apm(관측 인프라), event-vocab(이벤트 어휘), guides(가이드).
