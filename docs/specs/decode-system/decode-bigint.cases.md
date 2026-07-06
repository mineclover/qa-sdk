---
def:
  id: decode-bigint-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [scenario, decode, bigint]
  links:
    - target: decode-bigint
      type: refines
    - target: decode-system
      type: depends_on
sources:
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/schemas/decode.ts
  - packages/decode-service/src/server.ts
  - packages/decode-service/src/worker.ts
  - packages/decode-service/src/app.test.ts
  - packages/index-meta/src/prefix-decoder-big.test.ts
---

# Decode BigInt — 소비자 기대 시나리오

## 목적 ^purpose

`decode-bigint`(BigInt 주소 decode facade)가 `decode-system`에 의존할 때 기대하는 계약. BigInt decoder는 decode-system이 제공하는 DecoderPool 자동 라우팅과 decode-bundle 포맷을 소비한다.

소스: `packages/decode-service/src/lib/decoder-pool.ts`, `packages/decode-service/src/routes/decode.ts`, `packages/decode-service/src/app.test.ts`, `packages/index-meta/src/prefix-decoder-big.test.ts`

## 시나리오 1: DecoderPool numberType 라우팅 ^overview

**전제**: `decode-system`의 `DecoderPool`이 DecodeMap의 `numberType` 필드를 기반으로 PrefixDecoder/PrefixDecoderBig 를 자동 라우팅한다.

**동작**: `POST /decode/big` 요청이 들어오고, DecoderPool이 대상 prefix의 bundle에서 numberType을 읽는다.

**기대**:
- `numberType === "bigint"` → `PrefixDecoderBig` 사용
- `numberType === "number"` → `INVALID_INPUT` (400)
- `numberType` 미지정 → `DecoderPool.loadMap()`은 Number decoder로 로드한다. BigInt로 쓰려면 `loadBig({ map })` 또는 `numberType: "bigint"`가 필요하다.

**실패 시 수정 대상**: `decode-system`의 `decode-bundle` 스키마와 registry-service DecodeMap 공급 경로. BigInt 자동 라우팅은 `numberType: "bigint"`를 기준으로 하므로 registry DTO가 이 값을 공급하지 않으면 REST 경로는 Number decoder 중심으로 동작한다.

## 시나리오 2: bundle TTL 기반 만료 ^overview

**전제**: `decode-system`의 `DecoderPool`은 Node.js 에서 `CACHE_TTL_MS`(기본 60초) 기반 TTL 캐시를 쓴다.

**동작**: prefix 스키마가 변경되거나 TTL이 지나면 다음 `get(prefix, version)`에서 캐시 엔트리를 제거하고 `null`을 반환한다.

**기대**:
- TTL 만료 시 decode 라우트는 `DECODER_NOT_LOADED` (404)를 반환한다.
- Node.js 라우트는 요청 시점에 registry를 다시 fetch하지 않는다. 자동 재생성은 현재 계약이 아니다.
- Worker 모드는 `DecoderPool(0)`을 사용하므로 로드된 decoder는 Worker 수명 동안 만료되지 않는다.

**실패 시 수정 대상**: `decode-system`의 캐시 전략과 갱신 정책. stale decoder를 계속 쓰지 않는 것이 현재 안전 계약이며, 자동 refresh/stampede 방지는 별도 기능으로 다룬다.

## 시나리오 3: registry fetch fail-open ^overview

**전제**: `decode-service`는 startup 시 `REGISTRY_URL`(기본 dev URL 포함)에서 `/api/decode-map`을 fetch하고, 실패해도 서버 boot를 막지 않는다.

**동작**: decode-service 시작 시 registry-service가 unreachable이거나 decode-map fetch가 실패한다.

**기대**:
- 서비스 boot 성공 (빈 pool)
- 요청이 들어오면 404 (prefix not found) 반환
- Node.js 모드에서 registry 복구 후 자동 갱신 없음. 재시작 또는 명시적 reload 기능이 필요하다.
- Worker 모드는 첫 요청에서 D1 또는 HTTP 경로로 로드하며, pool이 비어 있으면 `loadPromise`로 동시 로드를 dedup한다.

**실패 시 수정 대상**: `decode-system`의 registry 의존 정책. fail-open 스펙이 명시되지 않으면 decode-service가 registry 장애 시 boot 실패로 cascading outage 유발.

## 시나리오 4: BigInt JSON 직렬화 ^overview

**전제**: `decode-system`의 REST endpoint들이 BigInt 응답을 문자열로 직렬화한다 (JSON bigint 미지원).

**동작**: `POST /decode/big` 응답의 address value가 string.

**기대**:
- 요청 body의 bigint input도 string (클라이언트가 `"123456789012345678"` 형태 전송)
- 응답의 bigint value도 string (10진수)
- 문자열 파싱 실패 시 `INVALID_INPUT` (400)

**실패 시 수정 대상**: `decode-system`의 `decode-api` spec. BigInt 직렬화 표준(hex vs decimal, 0x prefix, 등)이 명시되지 않으면 클라이언트 구현 간 비호환.
