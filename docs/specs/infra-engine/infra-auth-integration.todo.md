---
def:
  id: infra-auth-integration-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: mediation
  links:
    - target: infra-engine-pipeline
      type: depends_on
---

# AuthN/AuthZ 통합 — TODO

## 목적 ^purpose

gateway + Zitadel + permission-engine을 연결하여, JWT 서명 검증 + bitmask 기반 O(1) 권한 판정이 실제로 동작하게 한다.

## 핵심 설계

```
Zitadel (AuthN)
  → 로그인 → JWT 발급
  → Zitadel Action: TokenEnrichment 호출
    → permission-engine: userId → Role 계보 → bitmask 계산
    → JWT claims에 perms bitmask 주입 (경량 — 수십 바이트)
  → JWT = { sub, perms: { "shop": "AAAB..." }, perms_v, perms_schema }

Gateway (AuthZ)
  → JWKS로 서명 검증 (Zitadel 공개키)
  → PermissionMiddleware.validate(claims) — 버전/스키마 체크
  → checkFromClaims(claims, domain, feature) — hasBit() O(1)
  → 통과 시 Backend 프록시
```

**bitmask 공급 핵심**: Zitadel의 role 메타데이터에 permission bitmask를 저장. JWT 발급 시 Action이 이 bitmask를 claims에 복사. DB 조회 없이 토큰만으로 권한 판정.

---

## P0 — 보안 필수

### 0-1. Gateway JWKS 서명 검증

현재: JWT payload base64 디코딩만 (서명 미검증 → 위조 가능)
목표: Zitadel JWKS 엔드포인트에서 공개키 캐시 → RS256 서명 검증

- [ ] `packages/gateway/lib/jwks-verifier.ts` — JWKS fetcher + 캐시 (TTL 1시간)
  - `http://localhost:8085/oauth/v2/keys` 에서 공개키 조회
  - `kid` 매칭 → RS256 검증
  - 캐시 만료 시 자동 갱신
- [ ] `packages/gateway/server.ts` AUTH_MODE=jwt 수정
  - base64 디코딩 → JWKS 서명 검증으로 교체
  - 검증 실패 → 401 `{ error: "Invalid signature" }`
  - 만료 검증 → 401 `{ error: "Token expired" }`
- [ ] 테스트: 위조 JWT → 401, Zitadel 실토큰 → 200

### 0-2. Gateway API별 Permission 매핑

현재: perms claims 존재 여부만 확인
목표: API 경로별 필요 permission 정의 → hasBit() 판정

- [ ] `packages/gateway/lib/route-permissions.ts` — 라우트별 permission 정의
  ```typescript
  const ROUTE_PERMISSIONS: Record<string, { domain: string; feature: string }> = {
    "/v1/ingest":    { domain: "infra", feature: "ingest_write" },
    "/v1/sessions":  { domain: "infra", feature: "ingest_read" },
    "/v1/traces":    { domain: "infra", feature: "ingest_read" },
    "/api/services": { domain: "infra", feature: "registry_read" },
    "/docs":         { domain: "infra", feature: "definition_read" },
    "/gate/":        { domain: "infra", feature: "gate_read" },
    "/query/":       { domain: "infra", feature: "query_read" },
    "/decode/":      { domain: "infra", feature: "decode_read" },
    "/decisions/":   { domain: "infra", feature: "decision_read" },
  };
  ```
- [ ] gateway 미들웨어에서 route match → permission check
  - permission-engine의 `hasBit()` 또는 간단한 bitmask 체크 직접 구현
  - 권한 없음 → 403 `{ error: "Forbidden", required: "infra.ingest_write" }`
- [ ] `/health`는 권한 체크 스킵 (공개 엔드포인트)
- [ ] 테스트: admin(전체) → 200, reader(일부만) → 특정 API 403

---

## P1 — Zitadel ↔ permission-engine 연결

### 1-1. Zitadel Action에서 TokenEnrichment 호출

Zitadel Action = 토큰 발급 시 외부 HTTP 호출. permission-engine의 enrichment 서비스를 호출하여 perms bitmask를 JWT에 주입.

- [ ] `packages/permission-engine/src/enrichment-server.ts` — HTTP 서버 (Hono)
  - `POST /enrich` — `{ userId } → { perms, perms_v, perms_schema }`
  - TokenEnrichmentService.enrich(userId) 호출
  - Zitadel Action이 이 엔드포인트를 호출
- [ ] Zitadel Action 등록
  - Zitadel Admin API → Action 생성
  - 트리거: `pre-access-token-creation`
  - 엔드포인트: `http://enrichment-server:3900/enrich`
- [ ] K3s 또는 로컬에서 enrichment-server 배포
- [ ] 테스트: Zitadel 로그인 → JWT에 perms claims 포함 확인

### 1-2. Bitmask를 Zitadel Role 메타데이터에 저장

핵심: role 변경 시 Zitadel의 role metadata에 bitmask를 동기화.

- [ ] permission-engine → Zitadel role metadata sync
  - `RoleRegistry` 변경 시 → `perms_v` 증가 + Zitadel metadata 업데이트
  - Zitadel API: `PUT /management/v1/users/{userId}/metadata/{key}`
- [ ] PermissionVersionStore → Zitadel metadata 연동
  - `perms_v` 불일치 → 토큰 재발급 강제 (VERSION_MISMATCH)
- [ ] 테스트: role 변경 → 기존 토큰 무효화 → 새 토큰에 새 bitmask

### 1-3. RoleRegistry 초기 정의

qa-sdk 도메인에 맞는 role + feature 정의.

- [ ] features 정의
  ```
  infra 도메인:
    ingest_read, ingest_write
    registry_read, registry_write
    gate_read, gate_write
    query_read
    decode_read
    definition_read, definition_write
    decision_read, decision_write
    deploy_execute
  ```
- [ ] roles 정의
  ```
  viewer:  *_read
  operator: viewer + ingest_write + deploy_execute
  admin:   전체
  ```
- [ ] ScopedEngine으로 env별 분리
  - `prod:asia` → admin만 deploy_execute
  - `dev:local` → operator도 deploy_execute

---

## P2 — K3s 네이티브 라우팅

### 2-1. port-forward 제거 → K8s Service DNS

현재: gateway → `127.0.0.1:23200` (port-forward)
목표: gateway → `ingest-server-svc.qa-dev.svc.cluster.local:3200`

- [ ] gateway K8s Deployment에 서비스 URL을 K8s DNS로 설정
  - `INGEST_URL=http://ingest-server-svc.qa-dev.svc.cluster.local:3200`
- [ ] 문제: Pulumi가 서비스명에 랜덤 해시 추가 (`ingest-server-svc-59c20c40`)
  - 해결: local.ts에서 서비스명을 고정하도록 수정 (해시 제거)
  - 또는 K8s headless service 사용
- [ ] gateway가 K3s 내부에서 직접 서비스 접근 → port-forward 불필요
- [ ] port-forward는 외부 접근용(호스트→K3s)으로만 유지

### 2-2. Pulumi 서비스명 고정

- [ ] local.ts K8s Service/Deployment 이름에서 Pulumi 자동 해시 제거
  - `metadata.name` 직접 지정: `ingest-server-svc` (해시 없이)
- [ ] 서비스 간 DNS 참조 가능해짐

---

## P3 — 멀티 OAuth 프로바이더

### 3-1. Zitadel에 외부 IdP 추가

- [ ] Google OAuth 연동 (Zitadel Admin → Identity Providers)
- [ ] GitHub OAuth 연동
- [ ] 테스트: Google/GitHub 로그인 → Zitadel JWT → gateway 인증

### 3-2. AuthProvider 활용

- [ ] permission-engine ZitadelProvider — 세션 종료 연동
- [ ] 사용자 비활성화 시 → 모든 세션 종료 + 토큰 무효화

---

## 현재 상태 요약

```
✅ 동작:
  Zitadel OIDC 로그인 + machine key JWT 발급
  Gateway JWT 파싱 + perms claims 확인
  permission-engine bitmask 계산 (O(1) hasBit)
  10/10 인증 테스트 통과

❌ 미완:
  JWT 서명 미검증 (위조 가능)
  API별 권한 판정 없음 (perms 있으면 전부 통과)
  Zitadel ↔ permission-engine 미연결 (perms가 토큰에 안 들어감)
  K3s 내부 라우팅 port-forward 의존
```
