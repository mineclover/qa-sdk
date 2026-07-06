---
def:
  tier: component
  id: decode-svc-scenarios
  address: def_document:v2:70019
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [testing]
  links:
    - target: decode-service-system
      type: refines
    - target: decode-svc-core-logic
      type: traces_to
sources:
  - packages/decode-service/src/app.test.ts
  - packages/decode-service/src/lib/decode-cache.test.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/schemas/decode.ts
---
# Decode Service — 검증 시나리오

## 목적 ^purpose

decode-service의 핵심 경로를 검증하는 시나리오와 기대 결과를 정의한다. `app.test.ts`와 `decode-cache.test.ts`의 설계 근거.

## 구성 ^overview

### resolveDecoder 분기 시나리오

| # | 입력 | 기대 |
|---|------|------|
| 1 | prefix=A, version=v1, input=42 | pool에서 A:v1 직접 조회 → 200 |
| 2 | prefix=A (version 없음) | 400 INVALID_INPUT |
| 3 | input=42 (prefix/version 없음) | 400 (숫자는 자동 감지 불가) |
| 4 | input="rbac:v1:0" (prefix 없음) | pool 순회 → detect() 매치 → 200 |
| 5 | input="unknown:v1:0" (매치 없음) | 404 NOT_FOUND |

### batch 시나리오

| # | 입력 | 기대 |
|---|------|------|
| 6 | inputs=[0,1,2], prefix=A, version=v1 | 3건 decode 성공 |
| 7 | inputs=[] | 400 INVALID_INPUT (min 1) |
| 8 | inputs=[99999] (범위 초과) | 400 RANGE_EXCEEDED |

### deep decode 시나리오

| # | 입력 | 기대 |
|---|------|------|
| 9 | prefix_ref 포함 주소 | entities + refs 모두 반환 |
| 10 | prefix_ref 없는 주소 | entities만, refs 빈 배열 |
| 11 | 일부 ref 미해석 | unresolved 키 포함 |

### 에러 매핑 시나리오

| # | 에러 | 기대 HTTP | 기대 code |
|---|------|----------|----------|
| 12 | EntryNotFoundError | 404 | NOT_FOUND |
| 13 | ZodError | 400 | INVALID_INPUT |
| 14 | IndexRangeError | 400 | RANGE_EXCEEDED |
| 15 | decoder 미로드 | 404 | DECODER_NOT_LOADED |

### cache/health 시나리오

| # | 입력 | 기대 |
|---|------|------|
| 16 | /health + memory cache | `{ cache: { driver: "memory", status: "disabled" } }` |
| 17 | Redis cache ping 성공 | cacheHealth connected + decodeCache 노출 |
| 18 | Redis cache ping 실패 | cacheHealth disconnected + decodeCache 미노출 |
| 19 | L2 cache hit | cached decode result 반환 |
| 20 | L2 cache get/set 실패 | fail-open, 실제 decode 결과 반환 |

BigInt REST 시나리오는 `decode-bigint` / `decode-bigint-cases`가 별도 소유한다.
