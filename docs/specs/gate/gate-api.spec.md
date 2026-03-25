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

> RPC 엔드포인트 명세. 요청/응답 스키마, 에러 코드, 인증 요구만 기술한다.
> 상태 모델의 의미나 계산 로직은 gate-state-model, gate-engine-func를 참조.

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

| 코드 | 의미 |
|------|------|
| NOT_FOUND | prefix/versionId 미등록 |
| NOT_COMPUTED | recompute 미실행 (전체 active 취급) |
| STALE_CACHE | open 상태 캐시 무효 가능 |

## 인증

모든 엔드포인트는 서비스 간 내부 호출 전용. 외부 노출 금지.
