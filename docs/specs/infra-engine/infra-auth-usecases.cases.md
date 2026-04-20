---
def:
  id: infra-auth-usecases
  level: leaf
  tier: component
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  links:
    - target: infra-auth-integration
      type: refines
---

# AuthN/AuthZ 통합 — Use Cases

## 목적 ^purpose

인증/권한 시스템의 구체적 사용 시나리오를 정의한다. 각 시나리오에서 어떤 컴포넌트가 관여하고, 어떤 흐름으로 동작하며, 어떤 결과를 기대하는지를 명시한다.

---

## UC-1: 브라우저 OIDC 로그인 (Zitadel 직접)

**상황**: 사용자가 Zitadel 계정으로 로그인.

**관여**: gateway, infra-engine(Zitadel)

**흐름**:
```
1. 브라우저 → /oauth/v2/authorize (PKCE code_challenge)
2. Zitadel Login V2 SPA → 사용자 인증 (ID/PW)
3. Zitadel → authorization_code 발급 → 브라우저 redirect
4. 브라우저 → /oauth/v2/token (code + code_verifier)
5. Zitadel Action(qa-enrich-perms) → enrichment server /enrich 호출
6. JWT claims에 perms bitmask 주입
7. 브라우저 → JWT로 gateway API 호출
```

**기대 결과**:
- JWT에 `perms`, `perms_v`, `perms_schema` claims 포함
- gateway가 JWKS RS256으로 서명 검증 → 200

**검증**: `test/oidc-login.html`, `scripts/test-oidc-browser.ts`

---

## UC-2: Google OAuth 로그인 (외부 IdP)

**상황**: 사용자가 Google 계정으로 로그인. Zitadel 계정이 없으면 자동 생성.

**관여**: gateway, infra-engine(Zitadel + Google IdP)

**흐름**:
```
1. 브라우저 → Zitadel authorize → Google IdP redirect
2. Google 인증 → callback /idps/callback
3. Zitadel: 계정 자동 생성 (Automatic creation 활성화)
4. Zitadel Action → enrichment → JWT claims 주입
5. 브라우저 → JWT로 API 호출
```

**기대 결과**:
- Google 계정으로 최초 로그인 시 Zitadel 유저 자동 생성
- 이후 로그인 시 프로필 자동 업데이트 (Automatic update)
- JWT에 동일한 perms claims 구조

**검증**: Console에서 Google 로그인 → 유저 목록에 Google 계정 확인

---

## UC-3: API 요청 권한 판정

**상황**: JWT를 가진 클라이언트가 gateway를 통해 백엔드 API에 접근.

**관여**: gateway, permission-engine

**흐름**:
```
1. 클라이언트 → GET /v1/ingest/records (Authorization: Bearer <JWT>)
2. Gateway: JWT 서명 검증 (JWKS RS256 또는 HS256)
3. Gateway: route → feature 매핑 (/v1/ingest/* → ingest_read)
4. Gateway: checkPermission(perms["infra"], "ingest_read")
   → base64 decode → byte[0] & (1<<0) — O(1) 비트 체크
5. 비트 ON → 200 + 백엔드 프록시
   비트 OFF → 403 { error: "Forbidden", required: "infra.ingest_read" }
```

**기대 결과**:
- viewer role: `*_read` + `monitoring_read` 접근 가능
- operator role: viewer + `ingest_write` + `deploy_execute`
- admin role: 전체 13 features

**검증**: `permission-engine/src/auth-integration.test.ts`

---

## UC-4: 권한 변경 — Soft 취소

**상황**: admin이 특정 유저의 role을 변경. 유저의 기존 JWT가 아직 유효.

**관여**: enrichment server, permission-engine

**흐름**:
```
1. Admin → PUT /roles/:userId { roles: ["viewer"] } (operator에서 강등)
2. Enrichment: user.perms_v += 1
3. 유저의 다음 API 요청:
   → Gateway: PermissionMiddleware.validate()
   → token.perms_v < store.getVersion(userId)
   → 401 VERSION_MISMATCH
4. 클라이언트 → POST /token (재발급)
5. 새 JWT에 변경된 perms 반영
```

**기대 결과**:
- 기존 JWT는 다음 요청에서 401 반환
- 재발급된 JWT는 새 role 기준 bitmask 포함
- DB 조회 없음 — 버전 비교만

**검증**: `permission-engine/src/auth-integration.test.ts` "soft revocation"

---

## UC-5: 사용자 비활성화 — Hard 취소

**상황**: 퇴사자 계정 비활성화. 즉시 모든 세션 종료가 필요.

**관여**: enrichment server, Zitadel, permission-engine

**흐름**:
```
1. Admin → POST /users/:userId/invalidate
2. Enrichment:
   a. user.active = false, user.perms_v += 1
   b. revokeZitadelSessions(userId):
      → ListSessions → userId 필터 → DeleteSession (각 세션)
3. 결과: { active: false, perms_v: N, zitadel_sessions_revoked: M }
4. 이후 요청:
   → checkFeature() → active=false → "session_invalidated"
   → Zitadel 세션도 삭제되어 refresh 불가
```

**기대 결과**:
- 내부 상태 즉시 변경 (active=false)
- Zitadel 세션 삭제 (재로그인 불가)
- Zitadel 연결 실패 시 fail-open (내부 상태만 변경, warn 로그)

**검증**: `permission-engine/src/auth-integration.test.ts` "hardRevoke"

---

## UC-6: 사용자 재활성화

**상황**: 비활성화된 사용자를 다시 활성화.

**관여**: enrichment server

**흐름**:
```
1. Admin → POST /users/:userId/activate
2. Enrichment: user.active = true (perms_v 유지)
3. 유저 재로그인 → 정상 JWT 발급
```

**기대 결과**:
- active=true 복원
- 기존 perms_v 유지 (이전 JWT는 여전히 무효)
- 재로그인 필요

---

## UC-7: Feature Override

**상황**: 특정 유저에게만 개별 feature를 grant/deny.

**관여**: enrichment server, permission-engine

**흐름**:
```
1. Admin → POST /users/:userId/override { feature: "deploy_execute", granted: true }
2. Enrichment: user.overrides에 추가 (deny wins 규칙)
3. Permission check 시:
   → Override 먼저 확인 → 있으면 override 결과 반환
   → 없으면 role 기반 판정
```

**기대 결과**:
- viewer + override(deploy_execute: grant) → deploy_execute 접근 가능
- admin + override(ingest_write: deny) → ingest_write 차단
- deny가 항상 우선

**검증**: `permission-engine/src/auth-integration.test.ts` "override"

---

## UC-8: Enrichment Fallback

**상황**: Zitadel Action이 실패하여 JWT에 perms claims가 없는 경우.

**관여**: gateway, enrichment server, Zitadel

**흐름**:
```
1. 클라이언트 → API 요청 (perms 없는 JWT)
2. Gateway: perms claims 없음 감지
3. Fallback 1: enrichment server /enrich 호출
   → 성공 시 perms 획득
4. Fallback 2: Zitadel metadata API 조회
   → user metadata에서 perms/perms_v/perms_schema 획득
5. 양쪽 다 실패 → 401
```

**기대 결과**:
- enrichment server 가용 → 정상 권한 판정
- enrichment 불가 + Zitadel metadata 가용 → 정상 권한 판정
- 양쪽 불가 → 401

**검증**: `gateway/server.ts` fallback 로직
