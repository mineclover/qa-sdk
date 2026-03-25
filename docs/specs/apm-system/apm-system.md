---
def:
  id: apm-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: codegen-spec
      type: contains
    - target: dsl-schemas-spec
      type: contains
    - target: address-context-spec
      type: contains
    - target: runtime-flows-spec
      type: contains
    - target: logger-spec
      type: contains
    - target: collection-transport-spec
      type: contains
    - target: infra-logger-spec
      type: contains
    - target: cli-contract-spec
      type: contains
---

## 목적 ^purpose

코드 생성, DSL 스키마, 주소 컨텍스트, 런타임 흐름, 로깅, CLI 등 APM 관측 인프라.

## 구성 ^overview

8개 정의: codegen, DSL 스키마, address context, 런타임 흐름, QaLogger, 수집 전송, 인프라 로거, CLI 계약.
