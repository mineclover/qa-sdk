---
def:
  tier: component
  id: query-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: query-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: query-quality-bundle
      type: refines
---
# Query Service Public Contract


## 탐색 ^navigation

quality-gates-system > query-quality-bundle > **query-quality-contract**

형제: `gate-query-build` · `gate-query-test` · `gate-query-gate-integration`

## 목적 ^purpose

`query-service`가 외부 소비자에게 약속하는 query resolve, rule management, gate-aware filtering surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `createApp()`, `createQueryService()`, `GateStateClient`, `/query`, `/rules`, `/state` 경로다.
validation gate 문서는 이 계약이 build/test/gate integration 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- query resolve 입력은 coord 배열, pattern rules, shape, indexId/versionId다.
- rules 입력은 policy rule 집합과 prefix registry다.
- gate integration 입력은 gate-service가 제공하는 address state ranges다.

## 출력 ^outputs

- query resolve는 policy match 결과와 optional gate-aware resolve 결과를 반환한다.
- rules API는 등록된 policy rule 목록과 저장 결과를 반환한다.
- state/query route는 gate 상태를 반영한 필터/resolve 응답을 제공한다.

## 사전 조건 ^precondition

- query-service package는 build 후 실행 가능한 dist/server.js를 생성해야 한다.
- gate integration을 사용할 때 gate-client는 fail-open/fail-closed 정책을 일관되게 적용해야 한다.
- quality bundle은 이 계약을 기준으로 build/test/gate-integration 게이트를 실행한다.

## 사후 조건 ^postcondition

- build gate는 query-service 산출물과 타입이 일관되게 생성됨을 보장한다.
- test gate는 app/query/rules/store 핵심 동작이 유지됨을 보장한다.
- gate integration gate는 gate-service 상태 범위가 resolve/filter 경로에 반영됨을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims query-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-query-build`, `gate-query-test`, `gate-query-gate-integration`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `query-service/src/app.ts`
- `query-service/src/lib/query-service.ts`
- `query-service/src/lib/gate-client.ts`
- `query-service/src/routes/query.ts`
