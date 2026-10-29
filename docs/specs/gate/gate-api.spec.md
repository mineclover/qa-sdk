---
def:
  id: gate-api
  tier: layout
  address: def_document:v2:412810
  scope: interface
  aspect: gate_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: gate-service
  tags: [security]
  links:
    - target: gate-state-model
      type: refs
    - target: gate-engine-func
      type: implements
    - target: gate-event-bus
      type: depends_on
    - target: gate-cache-invalidation
      type: depends_on
    - target: gate-consistency
      type: depends_on
sources:
  - packages/gate-service/src/routes/gate.ts
  - packages/gate-service/src/schemas/gate.ts
  - packages/gate-service/src/routes/gate-openapi.ts
  - packages/gate-service/src/routes/gate-openapi.test.ts
  - packages/gate-service/src/app.test.ts
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
응답: { prefix, versionId, specs, reservedRanges: [number,number][], inactiveRanges: [number,number][], openRanges: [number,number][], computedAt } | null
```

### POST /gate/recompute

단일 prefix의 상태를 재계산한다.

```
요청: { prefix: string, versionId: string }
응답: 204 No Content
     501 { error: { code: "GATE_ENGINE_NOT_CONFIGURED", message } } — GateEngine 미구성
```

### POST /gate/cascade-recompute

leaf 변경을 composite까지 전파한다.

```
요청: { prefix: string, versionId: string }
응답: 204 No Content
     501 { error: { code: "GATE_ENGINE_NOT_CONFIGURED", message } } — GateEngine 미구성
```

> 현재 서비스 부팅 경로(`src/server.ts`, `src/worker.ts`)는 GateEngine을 주입하지 않는다. 엔진이 읽을 prefix·entry·flag 데이터는 registry DB에 있어 gate-service DB와 분리돼 있기 때문이다. 데이터 공급 경로가 정해질 때까지 recompute는 501이고, 상태가 없는 주소는 `check`에서 fail-open(active)으로 판정된다. `/health`의 `gate_engine_configured`로 확인한다.

### POST /gate/filter-ranges

입력 범위에서 gate 차단 범위를 제거한다.

```
요청: { prefix: string, versionId: string, ranges: [number,number][], mode: "encodable"|"decodable"|"active" }
응답: [number,number][]
```

## 에러 코드

NOT_FOUND, NOT_COMPUTED, STALE_CACHE 3종 ^overview

| 코드 | 의미 |
|------|------|
| NOT_FOUND | prefix/versionId 미등록 |
| NOT_COMPUTED | recompute 미실행 (전체 active 취급) |
| GATE_ENGINE_NOT_CONFIGURED | GateEngine 미구성 — recompute 불가 (HTTP 501) |
| STALE_CACHE | open 상태 캐시 무효 가능 |

## 인증

모든 엔드포인트는 서비스 간 내부 호출 전용. 외부 노출 금지.

## OpenAPI

개별 엔드포인트 상세는 OpenAPI 스펙을 참조: `packages/gate-service/openapi.json` (`src/routes/gate-openapi.ts` 선언에서 생성, 실제 응답과의 일치는 `gate-openapi.test.ts`가 검증)
