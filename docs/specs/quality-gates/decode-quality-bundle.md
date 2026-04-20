---
def:
  id: decode-quality-bundle
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: decode-quality-contract
      type: contains
    - target: gate-decode-build
      type: contains
    - target: gate-decode-test
      type: contains
    - target: gate-decode-route
      type: contains
    - target: decode-system
      type: depends_on
---
# Decode Quality Bundle


## 탐색 ^navigation

quality-gates-system > **decode-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`decode-service`의 공개 계약과 핵심 게이트(build/test/route)를 한 번들로 묶어 claim audit의 기준점으로 사용한다.

## 구성 ^overview

계약 문서가 decode API와 decoder pool 동작 surface를 고정한다.
각 게이트는 build, 전체 테스트, decode route 경로를 서로 다른 범위에서 검증한다.
