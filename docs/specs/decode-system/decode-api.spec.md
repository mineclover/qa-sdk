---
def:
  id: decode-api
  tier: system
  address: def_document:v2:412805
  scope: interface
  aspect: decode_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [entry-point, contract, runtime]
  links:
    - target: decode-bundle
      type: contains
    - target: decode-bigint
      type: depends_on
contains:
  - decode-bigint
sources:
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/schemas/decode.ts
  - packages/decode-service/src/app.test.ts
---
# Decode Service REST API

## 목적 ^purpose

주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트. Number 주소와 BigInt 주소를 같은 서비스 경계에서 제공하되, BigInt 요청은 별도 `/decode/big/*` 경로로 분리한다.

소스: `packages/decode-service/src/routes/decode.ts`, `packages/decode-service/src/schemas/decode.ts`, `packages/decode-service/src/app.test.ts`

## 구성 ^overview

- **POST /decode** — 단일 주소를 디코딩하여 entity 매핑 반환. 포맷 자동 감지 지원.
- **POST /decode/batch** — 동일 prefix/version의 주소 배열을 일괄 디코딩 (최대 10,000건).
- **POST /decode/deep** — index_ref 차원을 1-level 확장하고 미해결 참조를 보고하는 심층 디코딩.
- **POST /decode/big** — BigInt 주소 문자열을 디코딩하여 entity 매핑 반환.
- **POST /decode/big/batch** — 동일 prefix/version의 BigInt 주소 문자열 배열을 일괄 디코딩.
- **POST /decode/big/deep** — BigInt 주소의 index_ref 차원을 확장하여 반환.
- **GET /decode-map/:prefix/:version** — 캐시된 DecodeMap 번들 원본 조회.
- Hono 프레임워크 기반, request-id 미들웨어 + 중앙 에러 핸들러 적용.

## 엔드포인트 상세

### POST /decode

단일 주소를 entity 매핑으로 변환한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `input` | `number \| string` | O | 디코딩할 주소 (정수 또는 colon/URI/compact 프로토콜 문자열) |
| `prefix` | `string` | - | prefix ID (string input 시 생략 가능 — auto-detect) |
| `version` | `string` | - | version ID (prefix와 함께 제공해야 함) |

**decoder 해소 우선순위:**
1. `prefix` + `version` 둘 다 명시 → 직접 조회
2. 둘 다 없고 string input → pool 내 auto-detect (`decoder.detect()`)
3. 둘 다 없고 number input → 에러 (prefix/version 필수)
4. 하나만 있으면 → INVALID_INPUT 에러

**응답:** `{ indexId, versionId, value, entities }`

### POST /decode/batch

같은 prefix/version의 주소 배열을 일괄 디코딩한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `prefix` | `string` | O | prefix ID |
| `version` | `string` | O | version ID |
| `inputs` | `(number \| string)[]` | O | 1~10,000개 주소 배열 |

**응답:** `{ results: [{ value, entities }] }`

### POST /decode/deep

index_ref 차원을 1-level 풀어내어 참조 prefix의 entity까지 반환한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `input` | `number \| string` | O | 디코딩할 주소 |
| `prefix` | `string` | - | prefix ID |
| `version` | `string` | - | version ID |

**응답:** `{ entities, refs, unresolved? }`

### POST /decode/big

BigInt 주소를 entity 매핑으로 변환한다. JSON은 bigint를 직접 표현할 수 없으므로 `input`은 10진수 문자열이다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `input` | `string` | O | bigint를 나타내는 10진수 문자열 |
| `prefix` | `string` | O | prefix ID |
| `version` | `string` | O | version ID |

**응답:** `{ indexId, versionId, value, entities }`, 여기서 `value`는 문자열이다.

### POST /decode/big/batch

같은 prefix/version의 BigInt 주소 문자열 배열을 일괄 디코딩한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `prefix` | `string` | O | prefix ID |
| `version` | `string` | O | version ID |
| `inputs` | `string[]` | O | 1~10,000개 bigint 문자열 배열 |

**응답:** `{ results: [{ value, entities }] }`, 여기서 `value`는 문자열이다.

### POST /decode/big/deep

BigInt 주소를 디코딩하고 index_ref 차원을 확장한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `input` | `string` | O | bigint를 나타내는 10진수 문자열 |
| `prefix` | `string` | O | prefix ID |
| `version` | `string` | O | version ID |

**응답:** `{ entities, refs, unresolved? }`

### GET /decode-map/:prefix/:version

캐시된 DecodeMap 번들 원본을 JSON으로 반환한다. 디버그 및 진단 용도.

## 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| `INVALID_INPUT` | 400 | prefix/version 불완전 또는 number input에 prefix 미지정 |
| `NOT_FOUND` | 404 | auto-detect 실패 — 어떤 decoder도 입력 포맷을 인식하지 못함 |
| `DECODER_NOT_LOADED` | 404 | 요청한 prefix/version의 decoder가 캐시에 없음 |

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3600` | 서비스 포트 |
| `REGISTRY_URL` | registry-service dev URL 또는 `http://localhost:3300` | `/api/decode-map` 로드·갱신 대상 |
| `CACHE_TTL_MS` | `60000` | L2 decode 결과 캐시(redis) TTL (ms). decoder는 만료하지 않는다 |
| `DECODE_MAP_REFRESH_MS` | `60000` | registry catalog digest 확인 주기 (ms). 바뀌었을 때만 decode-map 재로드. 0이면 부팅 때 한 번만 |
| `CACHE_DRIVER` | `memory` | L2 decode 캐시 드라이버 (`memory` 또는 `redis`) |
| `REDIS_URL` | - | `CACHE_DRIVER=redis`일 때 필수 |
