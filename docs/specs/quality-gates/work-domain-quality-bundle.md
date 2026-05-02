---
def:
  id: work-domain-quality-bundle
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: work-domain-quality-contract
      type: contains
    - target: gate-work-domain-typecheck
      type: contains
    - target: gate-work-domain-build
      type: contains
    - target: gate-work-domain-test
      type: contains
    - target: work-domain
      type: contains
---
# Work Domain Quality Bundle


## 탐색 ^navigation

quality-gates-system > **work-domain-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`work-domain` 개념의 품질 문서를 level/scope 기준으로 한 묶음으로 관리하고, 인터페이스 계약과 validation 게이트를 같은 컨텍스트에서 보이게 하는 번들 문서.

## 구성 ^overview

이 번들은 먼저 인터페이스 계약 문서를 포함한다.
그 아래에서 validation 게이트가 contract를 검증하는 순서로 붙는다.
