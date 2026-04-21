---
def:
  id: decode-service-system
  tier: layout
  address: def_document:v2:68621
  scope: feature
  aspect: encoding_func
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [structural, entry-point]
  links:
    - target: decode-svc-data-model
      type: refs
    - target: decode-svc-core-logic
      type: refs
    - target: decode-svc-process-flow
      type: refs
    - target: decode-svc-state-model
      type: refs
    - target: decode-svc-constraints
      type: refs
    - target: decode-svc-api-contract
      type: refs
    - target: decode-svc-scenarios
      type: refs
    - target: decode-system
      type: depends_on
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
