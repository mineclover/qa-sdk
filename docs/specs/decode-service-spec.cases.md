---
def:
  id: decode-service-spec-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [scenario, decode-service, api]
  links:
    - target: decode-service-spec
      type: refines
    - target: decode-service-system
      type: depends_on
---

# Decode Service Spec — 소비자 기대 시나리오

## 목적 ^purpose

`decode-service-spec`(URN → 메타데이터 복원 기능의 API 선언) 이 `decode-service-system`에 의존할 때 기대하는 계약. spec 은 runtime system(Hono + DecoderPool + 6 endpoint) 이 제공하는 독립 디코딩 환경 위에서만 의미를 가지며, registry-service 없이도 동작할 수 있어야 한다.

## 시나리오 1: DecodeMap 번들 기반 독립 디코딩 ^overview

**전제**: `decode-service-system`이 시작 시 registry-service 에서 DecodeMap 을 fetch 하여 DecoderPool 에 로드. 이후 registry 연결 없이도 작동.

**동작**: 클라이언트가 `/decode` 엔드포인트로 압축된 URN 을 전송.

**기대**:
- decode 는 순수 인메모리 (DB 조회 없음)
- registry 에 network error 발생해도 이미 로드된 DecodeMap 은 계속 사용 가능 (fail-open)
- DecoderPool 캐시 TTL 만료 시 background refresh 시도, 실패 → stale 번들 유지

**실패 시 수정 대상**: `decode-service-system.md`의 DecoderPool(TTL 캐시) 명세 — TTL + fail-open 정책이 없으면 registry 일시 장애가 decode-service 전체 중단으로 전파.

## 시나리오 2: 6 엔드포인트 API 표면 고정 ^overview

**전제**: `decode-service-system`이 health / metrics / decode / batch / deep / decode-map 6개 엔드포인트를 Hono + @hono/node-server 포트 3600 으로 제공.

**동작**: 외부 도구(CLI, viz-web)가 decode-service 의 공개 엔드포인트를 호출.

**기대**:
- 엔드포인트 목록이 6개 고정, 신규 추가는 api-contract spec 변경 선행 필수
- /health 는 authentication 없이 접근 가능 (liveness probe)
- /decode/batch 는 inputs 배열 크기 상한 enforce (메모리 보호)

**실패 시 수정 대상**: `decode-service-system.md`의 엔드포인트 목록 — 6개가 열린 집합으로 정의되면 클라이언트가 암묵 엔드포인트에 의존.

## 시나리오 3: 에러 계층 HTTP 응답 매핑 ^overview

**전제**: `decode-service-system`이 IndexMetaError → AppError → HTTP 응답의 3-tier 에러 매핑을 선언.

**동작**: 클라이언트가 잘못된 prefix/version 을 decode 요청.

**기대**:
- IndexMetaError.PrefixNotFound → HTTP 404 + `{ error: { code: "NOT_FOUND" } }`
- IndexMetaError.VersionMismatch → HTTP 400
- 예상외 에러는 HTTP 500 + generic message (stack trace 미노출)

**실패 시 수정 대상**: `decode-service-system.md`의 에러 계층 — 각 에러의 HTTP mapping 이 명시되지 않으면 클라이언트가 에러 종류별 분기 불가.

## 시나리오 4: Edge Worker ↔ Standalone Node.js 이식성 ^overview

**전제**: `decode-service-system`이 "Edge Worker 부터 Standalone Node.js 까지 다양한 환경에서 동작" 을 설계 목표로 선언.

**동작**: 동일 decode-service 이미지를 Cloudflare Worker / Node.js / Deno 에 배포.

**기대**:
- 런타임 specific API(fs, net) 는 spec 에서 제외 (Hono 추상만 사용)
- DecoderPool 이 worker 환경에서도 메모리 제한 안에서 로드 가능 (크기 상한)
- 시작 시 DecodeMap fetch 는 AbortSignal.timeout(5_000) 필수 (worker cold start 보호)

**실패 시 수정 대상**: `decode-service-system.md`의 "DB 없음 — 순수 인메모리" 설계 — Node.js specific 의존이 들어가면 Edge Worker 배포 경로가 깨짐.
