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
    - target: config-loader-spec
      type: refs
    - target: package-classifier-spec
      type: refs
    - target: db-traffic-control-spec
      type: refs
    - target: otel-package-spec
      type: refs
    - target: error-handling-convention
      type: refs
    - target: review-ledger-spec
      type: refs
    - target: tag-search
      type: refs
---
# 지원 계층

## 목적 ^purpose

권한 엔진, APM 관측 인프라, 이벤트 어휘, 개발자 가이드 — 핵심 시스템을 보조하는 횡단 관심사.

## 구성 ^overview

4개 시스템: permission(권한), apm(관측 인프라), event-vocab(이벤트 어휘), guides(가이드).
