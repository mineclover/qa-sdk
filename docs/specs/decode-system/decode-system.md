---
def:
  id: decode-system
  tier: layout
  address: def_document:v2:412676
  scope: interface
  aspect: decode_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [structural, entry-point]
  links:
    - target: decode-api
      type: refs
    - target: decode-bundle
      type: refs
    - target: decode-bigint
      type: refs
    - target: decode-deploy
      type: refs
    - target: registry-system
      type: depends_on
sources:
  - packages/decode-service/src/app.ts
  - packages/decode-service/src/server.ts
  - packages/decode-service/src/worker.ts
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/lib/decode-map-sync.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/routes/health.ts
  - packages/decode-service/src/routes/metrics.ts
  - packages/registry-service/src/modules/catalog/decode-map.service.ts
---

# Decode 시스템

## 목적 ^purpose

MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스. Edge Worker부터 Standalone Node.js까지 다양한 배포 형태를 지원한다.

소스: `packages/decode-service/src/app.ts`, `packages/decode-service/src/server.ts`, `packages/decode-service/src/worker.ts`, `packages/decode-service/src/lib/decoder-pool.ts`

## 구성 ^overview

- `decode-api`: 주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트.
- `decode-bundle`: decode에 필요한 최소 데이터(entity name → ID 매핑)를 DecodeMap 번들로 패키징하고, 캐시/갱신을 관리한다.
- `decode-bigint`: `numberType: "bigint"` DecodeMap을 `PrefixDecoderBig`로 분리 라우팅하는 BigInt 주소 디코딩 기능.
- `decode-deploy`: Decode Service의 3가지 배포 형태와 각각의 제약 조건을 정의한다.

## 운영 개요

### 서비스 정체성

- `ServiceBootConfig`: `createServiceBootConfig("decode-service")`
- ownedPrefixes: `[]` — 읽기 전용, 이벤트 생산 없음
- consumedPrefixes: `["service"]`
- 포트: 3600 (기본)
- Hono `createApp()`에서 health, metrics, decode 라우트를 조립하고 request-id/error-handler 미들웨어를 적용

### 서비스 의존

```
decode-service
  → registry-service (startup 시 DecodeMap fetch)
  ← ingest-server (Phase 2에서 주소 디코딩 호출)
```

- `REGISTRY_URL`은 env 기본값으로 registry-service dev URL 또는 `http://localhost:3300`을 사용
- registry fetch 실패 → 서버 boot 유지, 빈 pool에서 `DECODER_NOT_LOADED` 반환
- registry fetch: `AbortSignal.timeout(5_000)` 적용

### 캐시 전략

- `DecoderPool`: prefix/version별 `PrefixDecoder` 또는 `PrefixDecoderBig` 캐시. Node.js·Worker 모두 TTL=0 (decoder는 DecodeMap에서 결정론적으로 만들어지므로 만료시키지 않는다)
- Node.js 갱신: `lib/decode-map-sync.ts`가 `DECODE_MAP_REFRESH_MS`(기본 60초)마다 registry `/health/generation`의 catalog digest를 확인하고, 바뀌었을 때만 `/api/decode-map`을 다시 불러온다. digest를 알 수 없으면 매번 다시 불러오고, 실패하면 기존 decoder를 유지한다 (fail-open)
- Worker: isolate 수명 동안 유지 (첫 요청에 로드)
- 이전 설계("TTL 만료 → 클라이언트 재요청")는 decode-map을 다시 불러올 경로가 없어 만료 후 모든 decode가 `DECODER_NOT_LOADED`가 되는 결함이었다 (2026-10-29 수정, `docs/proposals/swc-next-qa-sdk-optimization/06-feature-cleanup-candidates.md` S-8)
- `POST /decode`는 선택적으로 Redis 기반 L2 decode 결과 캐시를 사용하고, `/health`는 cache driver/status를 노출
