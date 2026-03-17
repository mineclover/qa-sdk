# Decode Service 스펙

> MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스.
> PrefixDecoder facade를 기반으로, Edge Worker부터 Standalone Node.js까지 다양한 배포 형태를 지원한다.

관련 스펙: [../indexing/index-meta/codec.spec.md](../indexing/index-meta/codec.spec.md) · [../indexing/index-meta/resolver.spec.md](../indexing/index-meta/resolver.spec.md)
기반 라이브러리: `packages/index-meta/src/prefix-decoder.ts`, `decode.ts`, `meta-resolver.ts`
서비스 구현: `packages/decode-service/`

## 상태

implemented

---

## 1. 목적

### 문제

MetaRegistry는 전체 스키마(dims, indices, migrations)를 메모리에 보유한다. decode만 필요한 소비자에게 전체 registry를 요구하는 것은:

- 메모리 과다 사용 (dim/index 수백 개 시 수십 MB)
- 불필요한 의존성 전파 (migration, validation 모듈)
- Edge/브라우저 환경에서 실행 불가

### 해법

`DecodeMap` 번들만으로 독립 decode를 수행하는 전용 서비스를 분리한다.

```
MetaRegistry (중앙)          Decode Service (분산)
├── 스키마 관리               ├── DecodeMap 번들 캐시
├── encode                   ├── decode (value → entity IDs)
├── serialize/parse          ├── decodeDeep (index_ref 확장)
└── createCodec              └── 포맷 자동 감지 + 파싱
```

---

## 2. 기반 구현

### PrefixDecoder

Decode Service의 핵심 런타임은 기존 `PrefixDecoder` 클래스.

```ts
interface PrefixDecoderConfig {
  map: DecodeMap;
  refs?: Record<string, DecodeMap>;  // index_ref 대상 DecodeMap
}

class PrefixDecoder {
  constructor(config: PrefixDecoderConfig)

  // 포맷 감지
  detect(input: string): string | null

  // L1 — 주소 → VersionedValue
  resolve(input: number | string): VersionedValue

  // L2 — 주소 → entity record
  decode(input: number | string): Readonly<Record<string, EntityId>>

  // L2+ — index_ref 1단계 확장
  decodeDeep(input: number | string): PrefixDeepDecodeResult

  // 배치
  decodeBatch(inputs: readonly (number | string)[]): Readonly<Record<string, EntityId>>[]

  // 부분 매칭
  matchRanges(partial: Record<string, EntityId | null>): [number, number][]

  // ref 확인
  hasRef(dimId: string): boolean
  resolveRef(value: number, dimId: string): Readonly<Record<string, EntityId>>
}

interface PrefixDeepDecodeResult {
  entities: Record<string, EntityId>;
  refs: Record<string, Record<string, EntityId>>;
}
```

### 서비스 구조

```
packages/decode-service/src/
├── server.ts              진입점 (Hono + @hono/node-server)
├── app.ts                 앱 팩토리 (createApp)
├── config/env.ts          Zod 환경 변수 (PORT, CACHE_TTL_MS)
├── lib/
│   ├── decoder-pool.ts    PrefixDecoder 인스턴스 풀 (TTL 캐시)
│   ├── errors.ts          AppError + IndexMetaError → HTTP 매핑
│   └── logger.ts          Pino 로거
├── middleware/
│   ├── error-handler.ts   AppError / ZodError / IndexMetaError 통합 핸들러
│   └── request-id.ts      x-request-id 전파
├── routes/
│   ├── decode.ts          4개 엔드포인트 + resolveDecoder
│   └── health.ts          GET /health
└── schemas/decode.ts      Zod 요청 스키마
```

### resolveDecoder 분기 로직

```
resolveDecoder(pool, input, prefix?, version?)

1. prefix + version 명시 → pool.get(prefix, version) 직접 조회
2. prefix 또는 version 하나만 → 400 (불완전 파라미터)
3. 둘 다 없고 number → 400 (특정 불가)
4. 둘 다 없고 string → pool 순회, detect(input)으로 자동 감지
5. 감지 실패 → 404
```

---

## 3. REST API

### POST /decode

단일 주소 decode.

```
POST /decode
Content-Type: application/json

{
  "input": "perm:v1:42" | 42,
  "prefix": "perm",          // prefix + version 둘 다 있거나 둘 다 없어야 함
  "version": "v1"            // number 입력 시 필수, string 입력 시 생략하면 auto-detect
}

→ 200 OK
{
  "indexId": "perm",
  "versionId": "v1",
  "value": 42,
  "entities": { "role": "admin", "action": "read", "resource": "users" }
}
```

### POST /decode/batch

복수 주소 일괄 decode. prefix/version 필수.

```
POST /decode/batch
Content-Type: application/json

{
  "prefix": "perm",
  "version": "v1",
  "inputs": [42, 43, 44, "perm:v1:45"]   // min 1, max 10,000
}

→ 200 OK
{
  "results": [
    { "value": 42, "entities": { ... } },
    { "value": 43, "entities": { ... } },
    ...
  ]
}
```

### POST /decode/deep

index_ref 확장 decode.

```
POST /decode/deep
Content-Type: application/json

{
  "input": 42,
  "prefix": "article",
  "version": "v1",
  "maxDepth": 3              // 선택, 기본 8, 최대 16
}

→ 200 OK
{
  "entities": { "quality": 0, "priority": "high" },
  "refs": {
    "quality": { "role": "admin", "action": "create" }
  }
}

// ref 코덱 없는 dim이 있으면:
{
  "entities": { ... },
  "refs": {},
  "unresolved": ["quality"]   // 해석 불가 dim 목록
}
```

### GET /decode-map/:prefix/:version

DecodeMap 번들 직접 조회 (클라이언트 사이드 decode용).

```
GET /decode-map/perm/v1

→ 200 OK
{
  "indexId": "perm",
  "versionId": "v1",
  "shape": [3, 4],
  "size": 12,
  "dims": [ ... ],
  "address": { ... }
}
```

### 에러 응답

모든 에러는 동일한 JSON 구조:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "decoder not loaded for \"unknown/v1\""
  }
}
```

| HTTP | code | 발생 조건 |
|---|---|---|
| 400 | `INVALID_INPUT` | Zod 검증 실패, 불완전 파라미터, number 입력에 prefix/version 누락 |
| 404 | `NOT_FOUND` | 미등록 prefix/version, 자동 감지 실패 |
| 404 | `DECODER_NOT_LOADED` | pool에 해당 decoder 없음 |
| 400 | `PARSE_ERROR` | 주소 문자열 파싱 실패 (index-meta ParseError) |
| 500 | `INTERNAL_ERROR` | 범위 초과 value, 예상 외 에러 |

---

## 4. DecodeMap 번들 관리

### 버전 관리

- 각 (prefix, versionId) 쌍에 대해 DecodeMap을 캐시
- MetaResolver.getDecodeMap()으로 생성, MetaResolver.getDecodeMapBundle()로 refs 포함 생성

### 갱신 프로토콜

| 방식 | 설명 | 적합 환경 |
|---|---|---|
| Polling | 주기적으로 중앙 registry에 최신 버전 확인 | 단순 배포, 저빈도 변경 |
| Webhook | schema 변경 시 중앙에서 push 알림 | 실시간 반영 필요 |
| Version header | 요청에 `If-None-Match: {etag}` → 304 응답 시 캐시 유지 | Edge Worker |

### DecoderPool (구현)

`DecoderPool` 클래스가 prefix/version별 PrefixDecoder를 TTL 기반으로 캐시한다.

```ts
class DecoderPool {
  constructor(ttlMs: number = 60_000)
  load(config: PrefixDecoderConfig): PrefixDecoder  // 번들 등록
  loadMap(map: DecodeMap): PrefixDecoder             // refs 없이 간편 등록
  get(prefix: string, version: string): PrefixDecoder | null  // TTL 만료 시 null
  values(): IterableIterator<PrefixDecoder>          // TTL 만료 항목 자동 정리
  evict(prefix: string, version: string): boolean
  clear(): void
  get size(): number
}
```

- TTL > 0: `get()` 호출 시 만료 체크, 만료 시 항목 삭제 후 null
- TTL = 0: 만료 없음 (수동 evict/clear만)
- 같은 key 재등록 시 덮어쓰기

### 캐시 TTL

| 환경 | 권장 TTL | 이유 |
|---|---|---|
| Edge Worker (KV) | 5분 | 전파 지연 허용, KV 쓰기 비용 절감 |
| Standalone Node.js | 1분 | 메모리 캐시, 빠른 갱신 |
| 임베디드 | ∞ (`ttlMs=0`) | 번들에 포함, 배포 시 갱신 |

---

## 5. deep-decode 제한

### maxDepth

- 기본값: 8
- 서비스 설정으로 상한 제한 가능 (예: 최대 16)
- 요청별 `maxDepth` 파라미터로 조절

### refs 번들 범위

- `PrefixDecoderConfig.refs`에 포함된 DecodeMap만 확장 가능
- 미포함 index_ref는 값만 반환 (entity 해석 없음)
- deep-decode 범위는 번들 구성 시 결정

### 미해석 ref 처리

```ts
// refs에 DecodeMap이 없는 index_ref dim
{
  "entities": { "quality_tier": 42 },  // 숫자 값 그대로 반환
  "refs": {},                           // 해석 불가 → 빈 객체
  "unresolved": ["doc_meta"]           // 미해석 ref 목록
}
```

---

## 6. 배포 토폴로지

### Edge Worker (Cloudflare Workers / Vercel Edge)

```
Client → Edge Worker → KV Store (DecodeMap 캐시)
                     ↳ PrefixDecoder 인스턴스 (per-request)
```

- DecodeMap을 KV에 JSON 저장
- Worker 기동 시 KV에서 로드, PrefixDecoder 생성
- 장점: 전 세계 저지연, 자동 스케일
- 제한: BigInt 미지원 (PrefixDecoder 제한)

### Standalone Node.js

```
Client → Node.js 서버 → 메모리 캐시 (DecodeMap)
                      ↳ PrefixDecoder pool (prefix별)
```

- 다수 prefix의 PrefixDecoder를 메모리에 유지
- Webhook으로 실시간 갱신
- 장점: 완전 제어, 모든 기능 지원

### 임베디드

```
Application → 번들된 DecodeMap → PrefixDecoder (인앱)
```

- 빌드 타임에 DecodeMap을 코드에 포함
- MetaRegistry 의존 없이 런타임 decode
- 장점: 네트워크 불필요, 최소 지연

---

## 7. 프로토콜 협상

### 입력 자동 감지

`PrefixDecoder.detect(input)`으로 입력 포맷을 자동 감지:

| 입력 예 | 감지 프로토콜 |
|---|---|
| `"perm:v1:42"` | colon |
| `"wi://perm/v1/42"` | uri |
| `"perm_v1_42"` | compact |
| `42` (number) | raw value |
| `"0x2a"` | hex |

### BigInt 제한

- PrefixDecoder는 Number 기반 → `numberType: "bigint"` 인덱스 미지원
- BigInt index decode가 필요하면 MetaCodecBig을 직접 사용하는 별도 경로 필요
- 향후 `PrefixDecoderBig` 추가 가능

---

## 8. 테스트 맵

테스트 파일: `packages/decode-service/src/app.test.ts` (39 tests)

### POST /decode

| 시나리오 | 설명 |
|---|---|
| 숫자 입력 + prefix/version → 200 | 기본 decode 경로 |
| 경계값 (마지막 주소) → 200 | size-1 정상 decode |
| 숫자 + prefix/version 모두 누락 → 400 | resolveDecoder 분기 3 |
| prefix만 + version 누락 → 400 | resolveDecoder 분기 2 (불완전) |
| version만 + prefix 누락 → 400 | resolveDecoder 분기 2 (불완전) |
| 미등록 prefix → 404 | DECODER_NOT_LOADED |
| 범위 초과 value → 500 | weighted-index IndexRangeError |
| 잘못된 JSON body → 400+ | JSON parse 실패 |
| 필수 필드 누락 → 400 | Zod validation |
| string 입력 + 자동 감지 실패 → 404 | resolveDecoder 분기 5 |

### POST /decode/batch

| 시나리오 | 설명 |
|---|---|
| 복수 입력 일괄 decode → 200 | 3건 batch |
| 단일 입력 batch → 200 | min=1 경계 |
| 빈 inputs → 400 | Zod min(1) |
| 미등록 prefix → 404 | DECODER_NOT_LOADED |
| prefix 누락 → 400 | Zod required |
| batch 내 범위 초과 → 500 | 부분 실패 |

### POST /decode/deep

| 시나리오 | 설명 |
|---|---|
| index_ref 확장 (refs 로드) → 200 | entities + refs 모두 반환, unresolved 없음 |
| 단순 index (index_ref 없음) → 200 | refs 빈 객체 |
| ref 코덱 없음 → unresolved 표시 | unresolved 배열에 dim 포함 |
| 미등록 prefix → 404 | DECODER_NOT_LOADED |

### GET /decode-map/:prefix/:version

| 시나리오 | 설명 |
|---|---|
| DecodeMap 반환 → 200 | shape, dims, size 포함 |
| 미등록 → 404 | DECODER_NOT_LOADED |

### 미들웨어

| 시나리오 | 설명 |
|---|---|
| x-request-id 자동 생성 | UUID 형식 |
| x-request-id 전달 시 유지 | 클라이언트 ID 보존 |

### 에러 응답 포맷

| 시나리오 | 설명 |
|---|---|
| 모든 에러 `{ error: { code, message } }` | Zod/AppError/IndexMetaError 통합 |

### DecoderPool

| 시나리오 | 설명 |
|---|---|
| load → get 왕복 | 등록 후 조회 |
| loadMap (간편 등록) | refs 없이 |
| 미등록 key → null | |
| TTL 만료 → null | 자동 정리 |
| TTL=0 → 만료 없음 | |
| 같은 key 재등록 → 덮어쓰기 | size 유지 |
| evict | 개별 제거 + 이미 없는 것 false |
| clear | 전체 초기화 |
| keys | prefix:version 목록 |
| values — TTL 만료 자동 정리 | iterator 중 만료 항목 삭제 |
