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
---

# Decode Service System — 소비자 기대 시나리오

## 목적 ^purpose

`decode-service-system`(decode-service 런타임 시스템) 이 `decode-system`에 의존할 때 기대하는 계약. service-system 은 decode-system 이 제공하는 DecoderPool / decode-bundle / decode-deploy 3-모듈 스택 위에서 NestJS-less Hono 서비스를 조립한다. (Note: decode-bigint.cases.md 는 BigInt 경로 전용, 본 문서는 service boot/deployment 경로 전용)

## 시나리오 1: ServiceBootConfig 정체성 선언 ^overview

**전제**: `decode-system`의 운영 개요가 `createServiceBootConfig("decode-service")` + `ownedPrefixes: []` + `consumedPrefixes: ["service"]` 를 identity 로 선언.

**동작**: decode-service 부팅 시 ServiceBootConfig 을 로드하여 registry 와 handshake.

**기대**:
- ownedPrefixes 가 빈 배열 → decode-service 가 이벤트를 생산하지 않음을 registry 에 declare
- consumedPrefixes 에 선언된 prefix 외의 decode 요청 → 400 (계약 외)
- ServiceBootConfig 이 변경되면(ownedPrefixes 추가 등) service-ownership-spec 재검증 필수

**실패 시 수정 대상**: `decode-system.md`의 "서비스 정체성" 섹션 — ownedPrefixes/consumedPrefixes 가 명시되지 않으면 decode-service 가 registry 에 암묵적 이벤트 생산자로 등록되어 prefix 충돌 위험.

## 시나리오 2: 3가지 배포 형태 제약 준수 ^overview

**전제**: `decode-system`의 `decode-deploy` 가 Decode Service 의 3가지 배포 형태(Edge Worker / Standalone Node.js / embedded) 와 각각의 제약을 선언.

**동작**: 운영팀이 동일 decode-service 코드를 3개 환경에 동시 배포.

**기대**:
- Worker 배포 → TTL=0 (프로세스 수명 동안 유지), Node.js 배포 → CACHE_TTL_MS=60s
- Worker 에서는 Node.js specific API (fs, net) 미사용 검증
- 각 배포 형태의 제약이 decode-deploy spec 에 명시, deploy 파이프라인에서 자동 검증

**실패 시 수정 대상**: `decode-system.md`의 `decode-deploy` — 배포 형태별 제약(TTL, API 제한) 이 spec 으로 명시되지 않으면 Worker 빌드가 Node.js 전용 API 를 번들하여 배포 실패.

## 시나리오 3: registry-service startup fetch + fail-open ^overview

**전제**: `decode-system`의 서비스 의존 그래프가 `decode-service → registry-service (startup 시 DecodeMap fetch)` 를 선언하고 fail-open 정책을 명시.

**동작**: decode-service 부팅 시 registry-service 가 unreachable.

**기대**:
- boot 성공, DecoderPool 은 빈 상태로 시작
- AbortSignal.timeout(5_000) 로 registry fetch 가 차단되지 않음
- registry 복구 후 pull 모델 로 자동 갱신 (능동적 갱신 없음)

**실패 시 수정 대상**: `decode-system.md`의 "REGISTRY_URL 미설정 → 빈 pool 로 시작 (fail-open)" + timeout 정책 — fail-open 이 암묵적이면 registry 일시 장애가 decode-service cascading outage 유발.

## 시나리오 4: ingest-server Phase 2 decode 호출 계약 ^overview

**전제**: `decode-system`의 서비스 의존 그래프가 `decode-service ← ingest-server (Phase 2에서 주소 디코딩 호출)` 를 선언.

**동작**: ingest-server Phase 2 verdict 단계에서 decode-service `/decode` 엔드포인트를 호출하여 주소를 entity 매핑으로 변환.

**기대**:
- decode-service 응답 timeout → ingest-server 가 verdict 활성화를 차단하지 않음 (에러 격리)
- decode 실패가 Phase 2 전체 verdict 실패로 연결되지 않음 (fail-open + warning)
- ingest-server 는 decode-service 의 ownedPrefixes=[] 를 존중 (decode-service 에 이벤트 전송 금지)

**실패 시 수정 대상**: `decode-system.md`의 ingest-server 역방향 의존 선언 — decode-service 호출 실패가 ingest verdict 를 차단하는 계약이면 에러 격리 원칙(CLAUDE.md §설계 원칙) 위반.
