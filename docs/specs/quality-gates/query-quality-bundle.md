---
def:
  id: query-quality-bundle
  level: module
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: query-quality-contract
      type: contains
    - target: gate-query-build
      type: contains
    - target: gate-query-test
      type: contains
    - target: gate-query-gate-integration
      type: contains
---
# Query Quality Bundle


## 탐색 ^navigation

quality-gates-system > **query-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`query-service`의 공개 계약과 핵심 게이트(build/test/gate-integration)를 하나의 품질 번들로 묶어 claim audit의 기준점으로 사용한다.

## 구성 ^overview

계약 문서가 query-service의 resolve/rules/gate 연동 surface를 고정한다.
각 게이트는 build, 전체 테스트, gate-service 연동 로직을 서로 다른 범위에서 검증한다.
