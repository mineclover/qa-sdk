---
def:
  id: infra-auth-integration
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  links:
    - target: infra-engine-pipeline
      type: depends_on
---

# AuthN/AuthZ 통합

## 목적 ^purpose

nginx(gateway)에 인증 레이어를 붙여 요청을 검증한다. 인증은 Zitadel(OIDC/JWT), 권한 판정은 permission-engine의 bitmask O(1) 체크로 구현한다.

## 문서 구조

| 문서 | 역할 |
|------|------|
| `infra-auth-integration.spec.md` (본 문서) | 설계 — 아키텍처, 관여 패키지, 구현 상태 |
| `infra-auth-usecases.cases.md` | 시나리오 — 로그인, 권한 판정, 세션 종료 등 UC |
| `infra-auth-integration.todo.md` | 잔여 작업 — 미완 항목만 추적 |

> **원칙**: 설계는 spec, 시나리오는 usecases, 작업 추적은 todo로 분리한다. todo에 설계나 시나리오를 혼합하지 않는다.

## 관여 패키지 ^defines

| 패키지 | 역할 |
|--------|------|
| **gateway** | nginx 프록시 + JWKS 서명 검증 + route-level bitmask 권한 판정 |
| **permission-engine** | role → bitmask 계산, hasBit() O(1) 판정, AuthProvider 추상화 |
| **infra-engine** | Zitadel 배포/운영, enrichment server, K3s 라우팅 |

## 핵심 설계

```
Zitadel (AuthN) — infra-engine이 배포/운영
  → 로그인 → JWT 발급
  → Zitadel Action: TokenEnrichment 호출
    → permission-engine: userId → Role 계보 → bitmask 계산
    → JWT claims에 perms bitmask 주입 (경량 — 수십 바이트)
  → JWT = { sub, perms: { "shop": "AAAB..." }, perms_v, perms_schema }

Gateway (AuthZ) — gateway 패키지
  → JWKS로 서명 검증 (Zitadel 공개키)
  → PermissionMiddleware.validate(claims) — 버전/스키마 체크
  → checkFromClaims(claims, domain, feature) — hasBit() O(1)
  → 통과 시 Backend 프록시
```

**bitmask 공급 핵심**: Zitadel의 role 메타데이터에 permission bitmask를 저장. JWT 발급 시 Action이 이 bitmask를 claims에 복사. DB 조회 없이 토큰만으로 권한 판정.

## 2단계 취소 메커니즘

| 방식 | 트리거 | 동작 | 지연 |
|------|--------|------|------|
| **Soft (기본)** | 권한 변경 | perms_v bump → 다음 요청에서 401 → 클라이언트 재발급 | 다음 요청까지 |
| **Hard** | 비활성화, 보안 이슈 | perms_v bump + active=false + Zitadel 세션 삭제 | 즉시 |

## 구현 현황

### P0 — Gateway 서명 검증 + 권한 판정 ✅ `[gateway]`

- `packages/gateway/lib/jwks-verifier.ts` — JWKS RS256/HS256 서명 검증
- `packages/gateway/lib/route-permissions.ts` — route → feature 매핑 + bitmask O(1) 체크
- FEATURE_INDEX 13종, PUBLIC_PATHS 스킵

### P1 — Enrichment Server + Bitmask ✅ `[infra-engine, permission-engine]`

- `packages/infra-engine/src/auth/enrichment-server.ts` — Hono HTTP (포트 3900)
  - POST /enrich, POST /token, role/override/invalidate/activate API
- Zitadel Action → flow 연결 (trigger 4 + 5)
- features 13종 + roles 3종 (admin/operator/viewer)

### P2~P2.7 — K3s + OIDC ✅ `[infra-engine]`

- K8s Service DNS 고정 (Pulumi metadata.name), 고급 시나리오 16건
- Zitadel Login V2 SPA (zitadel + zitadel-login + nginx 3-컨테이너)
- OIDC 브라우저 로그인 (authorization_code + PKCE)

### P3 — OAuth IdP + 세션 종료 `[infra-engine, permission-engine]`

- Zitadel PAT 캡처 (PATPATH 볼륨), Login V2 안정화 (IAM_LOGIN_CLIENT)
- Google OAuth IdP 연동 (GCP 클라이언트 + redirect URI `/idps/callback`)
- enrichment `/invalidate` → `revokeZitadelSessions()` 연동 (fail-open)

## 테스트 현황

| 범위 | 건수 | 위치 |
|------|------|------|
| AuthZ 라이프사이클 | 57건 | permission-engine/src/auth-integration.test.ts |
| 운영 데모 | 42건 | infra-engine E2E |
| 고급 시나리오 | 16건 | infra-engine (동시 배포, DNS, 장애 복구, 멀티 환경) |
| permission-engine 전체 | 214건 | permission-engine (14 파일) |

## Zitadel 운영 참조

- 인스턴스: `http://localhost:8085` (Docker Compose)
- Console: `http://localhost:8085/ui/console/`
- admin: `admin@zitadel.localhost`
- 초기화 절차 + 트러블슈팅: `infra-auth-integration.todo.md` §3-0
