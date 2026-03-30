---
def:
  id: registry-quality-bundle
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: registry-quality-contract
      type: contains
    - target: gate-registry-build
      type: contains
    - target: gate-registry-test
      type: contains
    - target: gate-registry-service-flow
      type: contains
---
# Registry Quality Bundle


## 탐색 ^navigation

quality-gates-system > **registry-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`registry-service`의 공개 계약과 핵심 게이트(build/test/service-flow)를 하나의 품질 번들로 묶어 claim audit의 기준점으로 사용한다.

## 구성 ^overview

계약 문서가 catalog/prefix/version/service topology surface를 고정한다.
각 게이트는 build, 전체 테스트, 서비스 등록/카탈로그 흐름을 서로 다른 범위에서 검증한다.
