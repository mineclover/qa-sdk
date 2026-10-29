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
  - packages/decode-service/src/lib/decode-map-sync.ts
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

## 시나리오 2: catalog 변경 시 decode-map 갱신 ^overview

**전제**: `decode-system`의 `DecoderPool`은 decoder를 만료시키지 않는다(TTL=0). Node.js에서는 decode-map 동기화가 `DECODE_MAP_REFRESH_MS`마다 registry catalog digest를 확인한다.

**동작**: catalog가 바뀌어 digest가 달라지면 `/api/decode-map`을 다시 불러와 같은 `prefix:version` 키의 decoder를 교체한다.

**기대**:
- digest가 같으면 decode-map을 다시 받지 않는다.
- 갱신 실패 시 기존 decoder를 유지한다 (fail-open). 만료로 decoder가 사라져 `DECODER_NOT_LOADED`가 되는 일은 없다.
- 같은 `prefix:version`의 decoder를 계속 써도 안전하다 — 발행된 version의 layout은 append-only로만 바뀌고, 호환되지 않는 변경은 registry publish가 `MigrationRequired`로 막아 새 version을 요구한다 (ADR-010).

**이전 계약과의 차이**: 이전에는 Node.js TTL(`CACHE_TTL_MS`) 만료 후 `DECODER_NOT_LOADED`를 "stale decoder를 쓰지 않는 안전 계약"으로 봤지만, 다시 불러올 경로가 없어 만료 뒤 모든 decode가 실패했다 (S-8).

**실패 시 수정 대상**: `decode-system`의 캐시 전략과 `lib/decode-map-sync.ts`.

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
