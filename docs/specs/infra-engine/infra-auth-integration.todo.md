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

## P0 — 보안 필수 ✅

### 0-1. Gateway JWKS 서명 검증 ✅

- [x] `packages/gateway/lib/jwks-verifier.ts` — JWKS fetcher + 캐시 (TTL 1시간)
  - kid 매칭 → RS256 검증, 캐시 만료 시 자동 갱신
  - JWK → PEM 변환 (ASN.1 DER 직접 구현)
- [x] `packages/gateway/server.ts` AUTH_MODE=jwt 수정
  - JWKS_URL 설정 시 서명 검증, 미설정 시 dev 모드 (base64 디코딩)
  - 검증 실패 → 401, 만료 → 401
- [x] 테스트: 위조 JWT → 401, Zitadel 실토큰 → 200

### 0-2. Gateway API별 Permission 매핑 ✅

- [x] `packages/gateway/lib/route-permissions.ts` — 라우트별 permission 정의 (longest prefix match)
- [x] gateway 미들웨어에서 route match → `checkPermission()` bitmask 판정 (O(1))
  - base64 디코드 → byte[idx/8] & (1<<idx%8) 비트 체크
  - 권한 없음 → 403 `{ error: "Forbidden", required: "infra.ingest_write" }`
- [x] `/health`, `/debug/healthz` 권한 체크 스킵 (PUBLIC_PATHS)
- [x] FEATURE_INDEX 12종 정의 (enrichment-server.ts와 순서 일치)

---

## P1 — Zitadel ↔ permission-engine 연결 ✅

### 1-1. Enrichment Server ✅

- [x] `packages/infra-engine/src/auth/enrichment-server.ts` — Hono HTTP 서버 (포트 3900)
  - `POST /enrich` — `{ userId, roles? } → { perms, perms_v, perms_schema }`
  - `PUT /roles/:userId` — role 할당
  - `GET /roles/:userId` — role 조회
  - `GET /features` — feature 목록 + role 정의
- [x] gateway `server.ts`에서 enrichment fallback 연동 (ENRICHMENT_URL)
  - id_token에 perms 없으면 enrichment 서버 → Zitadel metadata 순으로 조회

### 1-2. Zitadel Action Flow 연결 ✅

- [x] Zitadel Action → flow 연결 (trigger 4 + 5 linked to qa-enrich-perms)
  - 엔드포인트: `http://enrichment-server:3900/enrich`
- [x] Zitadel metadata sync (perms/perms_v/perms_schema stored in user metadata via _bulk POST)
- [x] Enrichment JWT 발급 (POST /token — Zitadel 검증 → HS256 JWT)
- [x] PermissionVersionStore → Zitadel metadata 연동 (perms_v 변경 시 자동)

### 1-3. RoleRegistry 초기 정의 ✅

- [x] features 12종 정의 (enrichment-server.ts FEATURES 배열)
  ```
  ingest_read(0), ingest_write(1), registry_read(2), gate_read(3),
  query_read(4), decode_read(5), definition_read(6), definition_write(7),
  decision_read(8), decision_write(9), deploy_execute(10), monitoring_read(11)
  ```
- [x] roles 3종 정의 (ROLE_FEATURES)
  - viewer: *_read + monitoring_read
  - operator: viewer + ingest_write + deploy_execute
  - admin: 전체 12 features
- [x] ScopedEngine env별 분리 (enrichment-server.ts ENV_RESTRICTIONS)

---

## P2 — K3s 네이티브 라우팅

### 2-1. port-forward 제거 → K8s Service DNS ✅

- [x] local.ts: Deployment/Service에 `metadata.name` 명시 → Pulumi 해시 제거
  - Deployment: `name: serviceId` (예: `ingest-server`)
  - Service: `name: ${serviceId}-svc` (예: `ingest-server-svc`)
- [x] K8s DNS 사용 가능: `http://ingest-server-svc.qa-dev.svc.cluster.local:3200`
- [x] gateway에 K8s 내부 URL 자동 주입 (config의 서비스 URL → env vars)
- [x] dev.json gateway 설정: K8s DNS 기반 URL로 통일
- [x] port-forward는 외부 접근용(호스트→K3s)으로만 유지

### 2-2. Pulumi 서비스명 고정 ✅

- [x] local.ts `metadata.name` 직접 지정 — 랜덤 해시 없는 고정 이름
- [x] 서비스 간 DNS 참조 가능: `{serviceId}-svc` 패턴

---

## P2.5 — 고급 검증 ✅

### 동시 배포 충돌 ✅

- [x] 동일 서비스 동시 배포 시 Pulumi lock 충돌 감지
- [x] 서로 다른 서비스 동시 배포 성공 검증

### K8s DNS 엔드포인트 ✅

- [x] K8s 내부 DNS `{serviceId}-svc.{namespace}.svc.cluster.local` 검증
- [x] gateway → backend K8s DNS 라우팅 검증

### 장애 복구 ✅

- [x] Pod kill → auto restart (K8s liveness probe)
- [x] 서비스 장애 감지 → 자동 복구 확인

### 멀티 환경 동시 운영 ✅

- [x] dev + stage 동시 운영 (namespace 격리)
- [x] 환경별 설정 독립 검증

---

## P2.7 — 브라우저 OIDC 로그인 ✅

### 브라우저 OIDC + PKCE ✅

- [x] Zitadel Login V2 SPA 배포 (zitadel + zitadel-login + nginx 3-컨테이너)
- [x] test/oidc-login.html — Zitadel authorization_code + PKCE 플로우 UI
- [x] scripts/test-oidc-browser.ts — SPA 앱 자동 등록 + 정적 서버 (port 5500)
- [x] OIDC 브라우저 로그인 환경 구축 완료

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

## P4 — CI/CD

- [ ] GitHub Actions 활성화 — OIDC, SOPS, config 변경 감지 → 자동 배포

---

## 현재 상태 요약

```
✅ P0 완료 — JWKS + route permissions:
  JWKS RS256 서명 검증 (jwks-verifier.ts)
  HS256 서명 검증 (enrichment JWT)
  AUTH_MODE=jwt — JWKS 설정 시 프로덕션, 미설정 시 dev
  route-permissions.ts — longest prefix match + FEATURE_INDEX 12종
  checkPermission() — base64 bitmask O(1) 비트 체크
  /health, /debug/healthz 공개 경로 스킵

✅ P1 완료 — enrichment server + JWT issuance + metadata:
  enrichment-server.ts — POST /enrich + POST /token + role 관리 API (infra-engine)
  gateway에서 enrichment fallback + HS256 검증 연동
  features 12종 + roles 3종 (admin/operator/viewer)
  Zitadel Action → flow 연결 (trigger 4 + 5 linked to qa-enrich-perms)
  Zitadel metadata sync (perms/perms_v/perms_schema via _bulk POST)
  ScopedEngine env별 분리 (ENV_RESTRICTIONS)
  Enrichment JWT 발급 (POST /token — Zitadel 검증 → HS256 JWT)

✅ P2 완료 — K8s DNS + service name:
  local.ts — metadata.name 고정 (Pulumi 해시 제거)
  K8s DNS 라우팅: {serviceId}-svc.{namespace}.svc.cluster.local
  dev.json gateway URL K8s DNS 기반으로 통일

✅ P2.5 완료 — 고급 시나리오 16건:
  동시 배포 충돌 감지 + 독립 서비스 병렬 배포
  K8s DNS 엔드포인트 검증
  Pod kill → auto restart 장애 복구
  dev + stage 멀티 환경 동시 운영

✅ P2.7 완료 — Zitadel Login V2 + OIDC 브라우저:
  Zitadel Login V2 SPA 배포 (zitadel + zitadel-login + nginx 3-컨테이너)
  OIDC 브라우저 테스트 UI (authorization_code + PKCE)
  SPA 앱 자동 등록 + 정적 서버

✅ 테스트 완료:
  AuthZ 라이프사이클 57건 (grant/revoke/override/invalidate/explain)
  운영 데모 42건 E2E
  고급 시나리오 16건

❌ 미완 (모두 외부 의존):
  Google/GitHub OAuth IdP
  ZitadelProvider 세션 종료
  CI/CD 활성화
```
