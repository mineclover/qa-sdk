---
def:
  id: decode-bigint
  tier: system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [bigint, runtime]
  links:
    - target: decode-api
      type: refines
    - target: decode-bigint-test
      type: contains
contains:
  - decode-bigint-test
---
# PrefixDecoderBig — BigInt 주소 디코딩

## 목적 ^purpose

Number.MAX_SAFE_INTEGER(2^53) 초과 주소 공간의 BigInt decode를 지원한다. MetaCodecBig를 내부적으로 사용하여 PrefixDecoder와 대칭 API를 제공하되, 입력·출력·범위가 모두 bigint 타입이다.

## 정의 ^defines

- `PrefixDecoderBig` — BigInt index 전용 통합 facade 클래스
- `PrefixDecoderBigConfig` — DecodeMap + 참조 DecodeMap(refs) 설정
- `PrefixDeepDecodeResultBig` — decodeDeep 결과 (entities + refs)
- `PrefixDeepDecodeDetailedResultBig` — decodeDeepDetailed 결과 (+ unresolved)

## 소비 ^consumes

- `packages/index-meta/src/prefix-decoder-big.ts` — 구현 소스
- `packages/index-meta/src/meta-codec-big.ts` — MetaCodecBig (내부 코덱)
- `packages/decode-service/src/routes/decode.ts` — `/decode/big/*` 엔드포인트
- `packages/decode-service/src/lib/decoder-pool.ts` — DecoderPool (BigInt 자동 라우팅)

## 구성 ^overview

### 생성

- DecodeMap의 `numberType`이 `"bigint"` 또는 미지정이어야 한다.
- `numberType === "number"` → `ValidationError` (PrefixDecoder 사용 안내).
- `refs` 옵션으로 index_ref dim의 참조 prefix DecodeMap을 주입한다. ref는 BigInt/Number 어느 쪽이든 허용 (shape를 BigInt로 변환).

### API

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `resolve(bigint)` | bigint | `VersionedValueBig` | bigint → 버전 식별 값 |
| `decode(bigint)` | bigint | `Record<string, EntityId>` | bigint → entity ID 매핑 |
| `encode(entities)` | `Record<string, EntityId>` | `VersionedValueBig` | entity → bigint (대칭) |
| `decodeBatch(bigint[])` | bigint[] | `Record<string, EntityId>[]` | 배치 decode |
| `decodeDeep(bigint)` | bigint | `PrefixDeepDecodeResultBig` | index_ref 1-level 확장 |
| `decodeDeepDetailed(bigint)` | bigint | `PrefixDeepDecodeDetailedResultBig` | deep + unresolved 수집 |
| `matchRanges(partial)` | `Record<string, EntityId \| null>` | `[bigint, bigint][]` | 부분 조건 매칭 범위 |
| `resolveRef(bigint, dimId)` | bigint, string | `Record<string, EntityId>` | ref 코덱으로 해석 |
| `hasRef(dimId)` | string | boolean | index_ref + ref 코덱 존재 여부 |
| `toDecodeMap()` | - | `DecodeMap` | 원본 DecodeMap 반환 |

### Identity 속성

- `indexId`, `versionId` — 코덱 식별자
- `size: bigint` — 전체 주소 공간 크기
- `shape: readonly bigint[]` — dim별 capacity (BigInt)
- `strides: readonly bigint[]` — dim별 stride (BigInt)
- `dimIds: readonly string[]` — dim ID 목록

### 제한 사항

- 입력은 bigint만 받는다 (string address 파싱 미지원). BigInt 주소 공간에서는 텍스트 프로토콜의 value 부분이 bigint여야 하므로 별도 파싱 체계가 필요하다.
- `enumerate()` 미지원 — BigInt 범위 전개는 메모리 위험이 크므로 `matchRanges()`만 제공한다.

### REST 엔드포인트 (decode-service)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /decode/big` | 단일 BigInt 주소 decode. input은 문자열 bigint |
| `POST /decode/big/batch` | BigInt 주소 배열 일괄 decode |
| `POST /decode/big/deep` | BigInt 주소 deep decode (index_ref 확장) |

- DecoderPool이 `numberType`에 따라 PrefixDecoder/PrefixDecoderBig를 자동 라우팅한다.
- Number decoder에 BigInt 요청 또는 반대 시 `INVALID_INPUT` (400) 에러.
- BigInt 응답의 value는 문자열로 직렬화된다 (JSON bigint 미지원).

### 에러

| 상황 | 에러 |
|------|------|
| `numberType === "number"` DecodeMap으로 생성 | `ValidationError` |
| `resolveRef` — 존재하지 않는 dimId | `ValidationError` |
| `resolveRef` — index_ref가 아닌 dim | `ValidationError` |
| `resolveRef` — ref 코덱 없음 | `ValidationError` |
