---
def:
  tier: component
  id: decode-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: decode-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: decode-quality-bundle
      type: refines
sources:
  - packages/decode-service/src/app.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/app.test.ts
---
# Decode Service Public Contract


## 탐색 ^navigation

quality-gates-system > decode-quality-bundle > **decode-quality-contract**

형제: `gate-decode-build` · `gate-decode-test` · `gate-decode-route`

## 목적 ^purpose

`decode-service`가 외부 소비자에게 약속하는 decode API, decode result, decoder pool surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `createApp()`, `/decode`, decoder pool, health/metrics route다.
validation gate 문서는 이 계약이 build/test/route 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- decode 입력은 prefix/version/address 또는 semantic address payload다.
- 서버 조립 입력은 catalog/decoder registry와 app deps다.
- route 입력은 HTTP query/body와 decode schema다.

## 출력 ^outputs

- decode route는 dim 값이 해석된 결과 또는 오류 응답을 반환한다.
- decoder pool은 address 해석 요청을 병렬로 처리한다.
- health/metrics route는 서비스 상태와 관측 메타를 제공한다.

## 사전 조건 ^precondition

- decode-service package는 build 후 실행 가능한 dist 산출물을 생성해야 한다.
- decode schema와 route validation은 index-meta/weighted-index와 일관돼야 한다.
- quality bundle은 이 계약을 기준으로 build/test/route 게이트를 실행한다.

## 사후 조건 ^postcondition

- build gate는 decode-service 산출물과 타입이 일관되게 생성됨을 보장한다.
- test gate는 app/decoder-pool/error-handler 동작이 유지됨을 보장한다.
- route gate는 `/decode` 경로가 실제 요청을 받아 해석 결과를 반환함을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims decode-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-decode-build`, `gate-decode-test`, `gate-decode-route`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `decode-service/src/app.ts`
- `decode-service/src/lib/decoder-pool.ts`
- `decode-service/src/routes/decode.ts`
- `decode-service/src/server.ts`
