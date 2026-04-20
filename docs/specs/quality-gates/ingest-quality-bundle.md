---
def:
  id: ingest-quality-bundle
  tier: system
  scope: flow
  aspect: ingest_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: ingest-quality-contract
      type: contains
    - target: gate-ingest-build
      type: contains
    - target: gate-ingest-test
      type: contains
    - target: gate-ingest-sdk-bridge
      type: contains
    - target: ingest-system
      type: depends_on
---
# Ingest Quality Bundle


## 탐색 ^navigation

quality-gates-system > **ingest-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`ingest-server`의 공개 계약과 핵심 품질 게이트(build/test/sdk-bridge)를 한 번들로 관리하여 claim audit의 기준점으로 사용한다.

## 구성 ^overview

계약 문서가 ingest의 공개 입력/출력과 파이프라인 전제를 고정한다.
각 게이트는 build, 전체 테스트, SDK→ingest 브리지 경로를 서로 다른 비용 수준에서 검증한다.
