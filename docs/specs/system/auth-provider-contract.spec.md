---
def:
  id: auth-provider-contract
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [auth, oauth, provider]
  links:
    - target: auth-permission-integration
      type: refines
  sources:
    - packages/permission-engine/src/auth-provider.ts
    - packages/permission-engine/src/auth-integration.test.ts
---

# AuthProvider 계약

## 목적 ^purpose

OAuth provider(Zitadel, Keycloak 등)의 세션/토큰 취소 동작을 추상화한다.
permission-engine이 특정 provider에 의존하지 않도록 인터페이스를 분리한다.

## 정의 ^defines

### AuthProvider 인터페이스

```typescript
interface AuthProvider {
  readonly id: string;
  revokeUserSessions(userId: string): Promise<void>;
  revokeRefreshToken?(refreshToken: string): Promise<void>;
}
```

### 내장 구현체

| 구현체 | 용도 |
|--------|------|
| `ZitadelProvider` | Zitadel Admin API를 통해 세션/토큰 취소 |
| `KeycloakProvider` | Keycloak Admin REST API를 통해 세션/토큰 취소 |
| `NoopAuthProvider` | 테스트 / provider 없는 환경 (취소 동작 무시) |

### hardRevoke 사용 기준

`hardRevoke: true`는 `PermissionChangeNotifier`를 통해 `AuthProvider.revokeUserSessions()`를 호출한다.
보안 이슈 또는 즉각적인 효력이 필요한 경우에만 사용한다 — provider API 부하가 높음.
일반 권한 변경은 소프트 revoke(버전 bump만)로 충분하다.

`revokeRefreshToken()`은 provider가 지원할 때만 노출되는 선택 API다. 권한 변경 기본 흐름은 refresh token 단건 취소가 아니라 유저별 permission version bump를 기준으로 한다.

## 소비 ^consumes

- `PermissionChangeNotifier` — `hardRevoke` 옵션 시 provider 취소 호출

## 코드 위치

`packages/permission-engine/src/auth-provider.ts`
