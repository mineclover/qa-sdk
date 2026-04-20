---
def:
  id: decision-flow-quality-bundle
  level: module
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [testing, quality-bundle, work-domain:productivity]
  links:
    - target: decision-flow-quality-contract
      type: contains
    - target: gate-decision-flow-typecheck
      type: contains
    - target: gate-decision-flow-build
      type: contains
    - target: gate-decision-flow-test
      type: contains
---
# Decision Flow Quality Bundle


## 탐색 ^navigation

quality-gates-system > **decision-flow-quality-bundle**

형제: `gate-kind-taxonomy` · `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

`decision-flow` 패키지의 공개 계약과 핵심 검증 게이트(typecheck/build/test)를 하나의 품질 번들로 묶어 claim audit의 기준점으로 사용한다.

## 구성 ^overview

먼저 인터페이스 계약 문서가 외부에 약속하는 타입과 동작 surface를 고정한다.
그 아래에서 typecheck/build/test 게이트가 같은 계약을 서로 다른 비용/신뢰 수준에서 검증한다.
