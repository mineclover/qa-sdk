---
def:
  id: permission-middleware
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [permission, middleware, jwt, auth]
  links:
    - target: auth-permission-integration
      type: refines
sources:
  - packages/permission-engine/src/permission-middleware.ts
  - packages/permission-engine/src/token-enrichment.ts
  - packages/permission-engine/src/permission-version.ts
  - packages/permission-engine/src/role-registry.ts
  - packages/permission-engine/src/auth-integration.test.ts
---

# PermissionMiddleware

## 목적 ^purpose

요청 진입 시 JWT claims에서 schema → version → permission을 순서대로 검증한다.
한 요청에서 여러 feature를 체크할 때 DB 조회를 1회로 줄이는 validate/checkFromClaims 패턴을 제공한다.

## 정의 ^defines

### 미들웨어 3단계 체크 순서

```
PermissionMiddleware.check(claims, domain, feature)
  1. schema check  — computeSchemaHash(roleRegistry) vs claims.perms_schema
                     불일치 → SCHEMA_MISMATCH (동기, DB 없음)
  2. version check — VersionStore.getVersion(userId) vs claims.perms_v
                     claims.perms_v < current → VERSION_MISMATCH (비동기, DB 1회)
  3. permission check — hasBit(base64Decode(claims.perms[domain]), featureIdx)
                        O(1), DB 없음
```

schema hash는 매 체크 시 동적 계산 — registry 변경 즉시 반영, 캐시 없음.
middleware는 provider 세션 취소나 토큰 발급을 수행하지 않는다. 실패 종류를 반환하고, HTTP 상태 매핑은 호출자 adapter가 담당한다.

### 에러 종류 (MiddlewareErrorKind)

| 종류 | 원인 | 클라이언트 대응 |
|------|------|----------------|
| `VERSION_MISMATCH` | 권한 변경 후 구 토큰 | 토큰 재발급 (refresh) |
| `SCHEMA_MISMATCH` | feature 정의 변경 | 재인증 |
| `NO_DOMAIN_CLAIM` | 해당 도메인 claim 없음 | 403 |
| `PERMISSION_DENIED` | 도메인 claim은 있으나 feature bit가 꺼짐 | 403 |
| `FEATURE_NOT_FOUND` | 알 수 없는 feature ID | 서버 설정 오류 |

### validate() + checkFromClaims() 분리 패턴

한 요청에서 여러 feature를 체크할 때 version DB 조회를 1회로 줄인다.

```typescript
// 미들웨어 진입 시 1회
const err = await middleware.validate(claims);  // schema + version check
if (err) return 401;

// 이후 반복 체크 (DB 없음)
middleware.checkFromClaims(claims, "project", "resource:write");
middleware.checkFromClaims(claims, "project", "action:approve");
```

## 소비 ^consumes

- `PermissionVersionStore` — `getVersion()` 호출 (version check)
- `RoleRegistry` — `computeSchemaHash()` (schema check), featureIdx 조회 (permission check)

## 코드 위치

`packages/permission-engine/src/permission-middleware.ts`
