---
def:
  id: decode-service-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [scenario, decode-service, service-boot]
  links:
    - target: decode-service-system
      type: refines
    - target: decode-system
      type: depends_on
sources:
  - packages/decode-service/src/server.ts
  - packages/decode-service/src/worker.ts
  - packages/decode-service/src/app.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/app.test.ts
  - packages/decode-service/src/lib/decode-cache.test.ts
  - packages/ingest-server/src/lib/decode-client.ts
---

# Decode Service System — 소비자 기대 시나리오

## 목적 ^purpose

`decode-service-system`(decode-service 런타임 시스템) 이 `decode-system`에 의존할 때 기대하는 계약. service-system 은 decode-system 이 제공하는 DecoderPool / decode-bundle / decode-deploy 3-모듈 스택 위에서 NestJS-less Hono 서비스를 조립한다. (Note: decode-bigint.cases.md 는 BigInt 경로 전용, 본 문서는 service boot/deployment 경로 전용)

## 시나리오 1: ServiceBootConfig 부팅 메타데이터 ^overview

**전제**: Node 엔트리포인트가 `createServiceBootConfig("decode-service")`로 namespace/name/env/region 부팅 메타데이터를 만든다.

**동작**: decode-service 부팅 시 ServiceBootConfig를 로드하고 listen 로그와 포트 충돌 경고에 서비스 정체성을 포함한다.

**기대**:
- 환경변수 미설정 시 서비스 이름 fallback은 `decode-service`
- namespace/env/region은 공통 `ServiceBootConfig` 규칙을 따른다
- decode 요청의 prefix/version 검증은 ownership gate가 아니라 DecoderPool 조회와 schema 검증으로 처리한다

**실패 시 수정 대상**: `server.ts`의 service boot logging 경로 — 서비스 정체성 메타데이터가 숨겨지면 운영 로그에서 decode-service 인스턴스 식별이 어려워진다.

## 시나리오 2: 3가지 배포 형태 제약 준수 ^overview

**전제**: `decode-system`의 `decode-deploy` 가 Decode Service 의 3가지 배포 형태(Edge Worker / Standalone Node.js / embedded) 와 각각의 제약을 선언.

**동작**: 운영팀이 동일 decode-service 코드를 3개 환경에 동시 배포.

**기대**:
- Worker 배포 → TTL=0 (프로세스 수명 동안 유지), Node.js 배포 → CACHE_TTL_MS=60s
- Worker 에서는 server.ts/@hono/node-server 경로를 import하지 않고 `worker.ts` + 공통 Hono app을 사용
- `/metrics`는 process가 없는 런타임에서도 0 fallback으로 응답 가능
- 각 배포 형태의 제약이 decode-deploy spec 에 명시, deploy 파이프라인에서 자동 검증

**실패 시 수정 대상**: `decode-system.md`의 `decode-deploy` — 배포 형태별 제약(TTL, API 제한) 이 spec 으로 명시되지 않으면 Worker 빌드가 Node.js 전용 API 를 번들하여 배포 실패.

## 시나리오 3: registry-service startup fetch + fail-open ^overview

**전제**: `decode-system`의 서비스 의존 그래프가 `decode-service → registry-service (startup 시 DecodeMap fetch)` 를 선언하고 fail-open 정책을 명시.

**동작**: decode-service 부팅 시 registry-service 가 unreachable.

**기대**:
- boot 성공, DecoderPool 은 빈 상태로 시작
- AbortSignal.timeout(5_000) 로 registry fetch 가 차단되지 않음
- Node 경로는 startup fetch 실패 후 자동 재시도 없음
- Worker 경로는 pool이 비어 있을 때 D1 또는 HTTP로 lazy load를 다시 시도

**실패 시 수정 대상**: `decode-system.md`의 "REGISTRY_URL 미설정 → 빈 pool 로 시작 (fail-open)" + timeout 정책 — fail-open 이 암묵적이면 registry 일시 장애가 decode-service cascading outage 유발.

## 시나리오 4: ingest-server Phase 2 decode 호출 계약 ^overview

**전제**: `decode-system`의 서비스 의존 그래프가 `decode-service ← ingest-server (Phase 2에서 주소 디코딩 호출)` 를 선언.

**동작**: ingest-server Phase 2 verdict 단계에서 decode-service `/decode` 엔드포인트를 호출하여 주소를 entity 매핑으로 변환.

**기대**:
- decode-service 응답 timeout → ingest-server 가 verdict 활성화를 차단하지 않음 (에러 격리)
- decode 실패가 Phase 2 전체 verdict 실패로 연결되지 않음 (fail-open + warning)
- ingest-server 는 decode-service 의 ownedPrefixes=[] 를 존중 (decode-service 에 이벤트 전송 금지)

**실패 시 수정 대상**: `decode-system.md`의 ingest-server 역방향 의존 선언 — decode-service 호출 실패가 ingest verdict 를 차단하는 계약이면 에러 격리 원칙(CLAUDE.md §설계 원칙) 위반.

## 시나리오 5-8: API 계약 측면 (전 decode-service-spec)

> 아래 4건은 2026-04-21 `decode-service-spec` deprecation 에 따라 원 `.cases.md` 에서 이식된 API-계약 시나리오다. 시나리오 1-4 (service boot/deployment 관점) 와 상보적으로 decode-service 의 공개 표면을 blackbox 로 검증한다.

## 시나리오 5: DecodeMap 번들 기반 독립 디코딩 ^overview

**전제**: `decode-service-system`이 시작 시 registry-service 에서 DecodeMap 을 fetch 하여 DecoderPool 에 로드. 이후 registry 연결 없이도 작동.

**동작**: 클라이언트가 `/decode` 엔드포인트로 압축된 URN 을 전송.

**기대**:
- decode 는 순수 인메모리 (DB 조회 없음)
- registry 에 network error 발생해도 이미 로드된 DecodeMap 은 계속 사용 가능 (fail-open)
- DecoderPool 캐시 TTL 만료 시 해당 decoder는 evict되고, 현재 Node 경로에서는 재로딩 없이 404가 반환된다

**실패 시 수정 대상**: `decode-service-system.md`의 DecoderPool(TTL 캐시) 명세 — TTL + fail-open 정책이 없으면 registry 일시 장애가 decode-service 전체 중단으로 전파.

## 시나리오 6: 9 엔드포인트 API 표면 고정 ^overview

**전제**: `decode-service-system`이 health / metrics / decode / batch / deep / decode-map / big / big-batch / big-deep 9개 엔드포인트를 Hono 앱으로 제공한다.

**동작**: 외부 도구(CLI, viz-web)가 decode-service 의 공개 엔드포인트를 호출.

**기대**:
- 엔드포인트 목록이 API 계약 문서와 동기화되어야 하며, 신규 추가는 api-contract spec 변경 선행 필수
- /health 는 authentication 없이 접근 가능 (liveness probe)
- /decode/batch 는 inputs 배열 크기 상한 enforce (메모리 보호)
- BigInt 세부 시나리오는 `decode-bigint` 문서가 소유하고 decode-service API 표면은 경로를 노출한다

**실패 시 수정 대상**: `decode-service-system.md`의 엔드포인트 목록 — 실제 route와 문서가 drift하면 클라이언트가 암묵 엔드포인트에 의존.

## 시나리오 7: 에러 계층 HTTP 응답 매핑 ^overview

**전제**: `decode-service-system`이 IndexMetaError → AppError → HTTP 응답의 3-tier 에러 매핑을 선언.

**동작**: 클라이언트가 잘못된 prefix/version 을 decode 요청.

**기대**:
- decoder 미로드 → HTTP 404 + `{ error: { code: "DECODER_NOT_LOADED" } }`
- 자동 감지 실패 또는 entry/index 미발견 → HTTP 404 + `{ error: { code: "NOT_FOUND" } }`
- Zod 검증 실패 또는 prefix/version 불완전 → HTTP 400 + `{ error: { code: "INVALID_INPUT" } }`
- 예상외 에러는 HTTP 500 + generic message (stack trace 미노출)

**실패 시 수정 대상**: `decode-service-system.md`의 에러 계층 — 각 에러의 HTTP mapping 이 명시되지 않으면 클라이언트가 에러 종류별 분기 불가.

## 시나리오 8: Edge Worker ↔ Standalone Node.js 이식성 ^overview

**전제**: `decode-service-system`이 "Edge Worker 부터 Standalone Node.js 까지 다양한 환경에서 동작" 을 설계 목표로 선언.

**동작**: 동일 decode-service 앱을 Cloudflare Worker / Standalone Node.js / embedded Hono app 형태로 배포.

**기대**:
- Worker 진입점은 `server.ts`를 통하지 않고 공통 Hono app만 사용
- DecoderPool 이 worker 환경에서도 메모리 제한 안에서 로드 가능 (크기 상한)
- Worker는 REGISTRY_DB(D1) 우선, REGISTRY_URL HTTP fallback 순서로 DecodeMap을 lazy load
- process가 없는 런타임에서도 metrics route는 0 fallback으로 응답

**실패 시 수정 대상**: `decode-service-system.md`의 "DB 없음 — 순수 인메모리" 설계 — Node.js specific 의존이 들어가면 Edge Worker 배포 경로가 깨짐.
