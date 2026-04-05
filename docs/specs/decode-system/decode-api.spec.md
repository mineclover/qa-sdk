---
def:
  id: decode-api
  level: module
  address: def_document:v2:412805
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [entry-point, contract, runtime]
  links:
    - target: decode-bundle
      type: depends_on
    - target: decode-bigint
      type: contains
contains:
  - decode-bigint
---
# Decode Service REST API

## 목적 ^purpose

주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트. decode(단일), batch(배치), deep(index_ref 확장) 3개 엔드포인트를 제공한다.

## 구성 ^overview

- **POST /decode** — 단일 주소를 디코딩하여 entity 매핑 반환. 포맷 자동 감지 지원.
- **POST /decode/batch** — 동일 prefix/version의 주소 배열을 일괄 디코딩 (최대 10,000건).
- **POST /decode/deep** — index_ref 차원을 재귀적으로 확장하여 참조 prefix까지 풀어내는 심층 디코딩.
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

index_ref 차원을 재귀적으로 풀어내어 참조 prefix의 entity까지 반환한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `input` | `number \| string` | O | 디코딩할 주소 |
| `prefix` | `string` | - | prefix ID |
| `version` | `string` | - | version ID |
| `maxDepth` | `number` | - | 최대 재귀 깊이 (1~16, 기본값 미지정) |

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
| `REGISTRY_URL` | - | registry-service URL (startup 시 DecodeMap 자동 fetch) |
| `CACHE_TTL_MS` | `60000` | DecoderPool 캐시 TTL (밀리초) |
| `DECODE_MAP_SOURCE` | - | DecodeMap JSON 파일 경로 또는 URL (선택) |
