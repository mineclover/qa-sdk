---
def:
  id: decode-service-system
  address: def_document:v2:68621
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [structural, entry-point, tier-infra]
  links:
    - target: decode-svc-data-model
      type: contains
    - target: decode-svc-core-logic
      type: contains
    - target: decode-svc-process-flow
      type: contains
    - target: decode-svc-state-model
      type: contains
    - target: decode-svc-constraints
      type: contains
    - target: decode-svc-api-contract
      type: contains
    - target: decode-svc-scenarios
      type: contains
---
# Decode Service — 시스템 개요

## 목적 ^purpose

DecodeMap 번들로 주소를 독립 디코딩하는 경량 서비스. registry-service 없이 Edge Worker부터 Standalone Node.js까지 다양한 환경에서 동작한다. 시작 시 registry에서 DecodeMap을 fetch하고, 이후 순수 인메모리로 디코딩을 수행한다.

## 구성 ^overview

- Hono + @hono/node-server, 포트 3600
- 상태: DecoderPool (TTL 캐시, Map<prefix:version, PrefixDecoder>)
- DB 없음 — 순수 인메모리
- 6 엔드포인트: health, metrics, decode, batch, deep, decode-map
- 시작 시 registry-service에서 DecodeMap fetch (fail-open)
- 에러 계층: IndexMetaError → AppError → HTTP 응답
