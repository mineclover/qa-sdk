---
def:
  id: gate-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: gate-state-model
      type: depends_on
    - target: gate-engine-func
      type: implements
---
# Gate Service API 계약

## 목적 ^purpose

RPC 엔드포인트 명세. 요청/응답 스키마, 에러 코드, 인증 요구를 정의한다.
모든 호출은 서비스 간 내부 전용이며 외부 노출을 금지한다.

## 구성 ^overview

6개 RPC: check, classify, getState, recompute, cascadeRecompute, filterRanges.
에러 코드: NOT_FOUND, NOT_COMPUTED, STALE_CACHE 3종.

## 엔드포인트

### POST /gate/check

주소의 encode/decode 가능 여부를 반환한다.

```
요청: { prefix: string, versionId: string, address: number }
응답: { allowed: boolean, state: AddressState, shouldVerify: boolean }
```

### POST /gate/classify

주소의 상태를 분류한다.

```
요청: { prefix: string, versionId: string, address: number }
응답: { state: "active" | "inactive" | "open" | "reserved" }
```

### GET /gate/state/:prefix/:version

prefix의 전체 상태 범위를 반환한다.

```
응답: { reserved: [number,number][], inactive: [number,number][], open: [number,number][] } | null
```

### POST /gate/recompute

단일 prefix의 상태를 재계산한다.

```
요청: { prefix: string, versionId: string }
응답: 204 No Content
```

### POST /gate/cascade-recompute

leaf 변경을 composite까지 전파한다.

```
요청: { prefix: string, versionId: string }
응답: 204 No Content
```

### POST /gate/filter-ranges

입력 범위에서 gate 차단 범위를 제거한다.

```
요청: { prefix: string, versionId: string, ranges: [number,number][], mode: "encodable"|"decodable"|"active" }
응답: { ranges: [number,number][] }
```

## 에러 코드

NOT_FOUND, NOT_COMPUTED, STALE_CACHE 3종 ^overview

| 코드 | 의미 |
|------|------|
| NOT_FOUND | prefix/versionId 미등록 |
| NOT_COMPUTED | recompute 미실행 (전체 active 취급) |
| STALE_CACHE | open 상태 캐시 무효 가능 |

## 인증

모든 엔드포인트는 서비스 간 내부 호출 전용. 외부 노출 금지.

## 엔드포인트 ^endpoints

<!-- auto-generated from OpenAPI: Gate Service API v1.0.0 -->

- POST /gate/check — 주소 encode/decode 가능 여부 확인
- POST /gate/classify — 주소 상태 분류
- POST /gate/recompute — 단일 prefix 상태 재계산
- POST /gate/cascade-recompute — leaf → composite cascade 전파
- POST /gate/filter-ranges — gate 차단 범위 제거
- GET /gate/state/{prefix}/{version} — prefix 전체 상태 범위 조회
- GET /health — Health check
