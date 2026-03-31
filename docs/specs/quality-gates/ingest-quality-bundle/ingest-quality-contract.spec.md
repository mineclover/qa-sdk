---
def:
  id: ingest-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: ingest-server
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: ingest-quality-bundle
      type: refines
---
# Ingest Public Contract


## 탐색 ^navigation

quality-gates-system > ingest-quality-bundle > **ingest-quality-contract**

형제: `gate-ingest-build` · `gate-ingest-test` · `gate-ingest-sdk-bridge`

## 목적 ^purpose

`ingest-server`가 외부 소비자에게 약속하는 envelope 수신, 저장, query, verdict 파이프라인 surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `createApp()`, `/v1/ingest`, phase-two worker, query/verdict route, address_context 보강 경로다.
validation gate 문서는 이 계약이 build/test/sdk-bridge 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- ingest 입력은 `TransmissionEnvelope`와 그 안의 `records[]`다.
- 서버 조립 입력은 store 포트, taskQueue, registry validator, convergence pipeline 의존성이다.
- SDK 브리지 입력은 browser/node SDK가 보내는 `/v1/ingest` payload다.

## 출력 ^outputs

- `/v1/ingest`는 accepted 응답과 record count를 반환한다.
- phase-two worker는 reconstruction/verdict/convergence 후속 처리를 수행한다.
- query/verdict route는 trace/session 기반 읽기 API를 제공한다.

## 사전 조건 ^precondition

- ingest-server package는 build 후 실행 가능한 dist 산출물을 생성해야 한다.
- route/app 조립은 필수 store 포트가 주입된 상태에서 동작해야 한다.
- quality bundle은 이 계약을 기준으로 build/test/sdk-bridge 게이트를 실행한다.

## 사후 조건 ^postcondition

- build gate는 서버 산출물과 타입이 일관되게 생성됨을 보장한다.
- test gate는 ingest route, worker, convergence, insights, query/verdict 경로가 유지됨을 보장한다.
- sdk-bridge gate는 SDK에서 전송된 envelope이 ingest까지 실제로 수신/저장되는 경로를 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims ingest-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-ingest-build`, `gate-ingest-test`, `gate-ingest-sdk-bridge`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `ingest-server/src/app.ts`
- `ingest-server/src/routes/ingest.ts`
- `ingest-server/src/lib/phase-two-worker.ts`
- `ingest-server/src/routes/query.ts`
