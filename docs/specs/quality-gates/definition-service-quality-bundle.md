---
def:
  id: definition-service-quality-bundle
  tier: system
  scope: flow
  aspect: quality_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: definition-service-quality-contract
      type: contains
    - target: gate-definition-service-build
      type: contains
    - target: gate-definition-service-sync
      type: contains
    - target: gate-definition-service-context
      type: contains
    - target: definition-service-system
      type: depends_on
---
# Definition Service Quality Bundle


## 탐색 ^navigation

quality-gates-system > **definition-service-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`definition-service`의 공개 계약과 핵심 검증 게이트(build/sync/context)를 하나의 품질 번들로 묶어 claim audit의 기준점으로 사용한다.

## 구성 ^overview

계약 문서가 docs/graph/sync/search/GraphQL surface를 고정한다.
각 게이트는 build, 문서 스캔/동기화, 컨텍스트 조회 경로를 서로 다른 범위에서 검증한다.
