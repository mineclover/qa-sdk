---
def:
  id: auth-permission-integration
  tier: system
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [auth, permission, oauth, token, cross-scope]
  links:
    - target: auth-provider-contract
      type: contains
    - target: permission-version-store
      type: contains
    - target: permission-change-notifier
      type: contains
    - target: token-enrichment-handler
      type: contains
    - target: permission-middleware
      type: contains
    - target: system-support
      type: depends_on
sources:
  - packages/permission-engine/src/auth-provider.ts
  - packages/permission-engine/src/permission-version.ts
  - packages/permission-engine/src/permission-change-notifier.ts
  - packages/permission-engine/src/token-enrichment.ts
  - packages/permission-engine/src/permission-middleware.ts
  - packages/permission-engine/src/auth-integration.test.ts
---

# Auth × Permission 통합

## 목적 ^purpose

OAuth provider(Zitadel, Keycloak 등)를 인증 레이어로, permission-engine을 인가 레이어로 분리하여 연결한다.
토큰에 domain별 bitmask를 임베드하여 요청마다 DB 조회 없이 O(1) 권한 판정을 가능하게 한다.
권한 변경 시 버전 불일치(소프트) 또는 provider 세션 취소(하드)로 토큰을 무효화하여 일관성을 보장한다.

## 구성 ^overview

- `auth-provider-contract`: provider별 세션/토큰 취소 추상 인터페이스. Zitadel/Keycloak/Noop 구현 내장.
- `permission-version-store`: 유저별 권한 버전 카운터 인터페이스. InMemory 기본 구현 제공.
- `permission-change-notifier`: 권한 변경의 단일 진입점. 버전 bump + 선택적 하드 취소.
- `token-enrichment-handler`: 토큰 발급 시 bitmask + 버전 + schema hash를 JWT claims로 계산.
- `permission-middleware`: 요청 시 schema → version → permission 3단계 체크.

## 기능 경계 ^boundary

| 기능 | 소유 | 소유하지 않는 것 |
|------|------|------------------|
| provider 취소 | `AuthProvider` | role/group 배정, permission 계산 |
| 권한 버전 | `PermissionVersionStore` | persistence 구현 선택, 토큰 판정 |
| 변경 알림 | `PermissionChangeNotifier` | permission DB 변경 자체, 요청 권한 판정 |
| 토큰 claim 생성 | `TokenEnrichmentHandler` | provider 세션 관리, 요청 middleware 응답 |
| 요청 권한 판정 | `PermissionMiddleware` | 토큰 발급, 권한 변경 기록 |

## 방법 ^method

```
권한 변경 → PermissionChangeNotifier.notify()
  → VersionStore.bumpVersion()       소프트: 다음 요청에서 VERSION_MISMATCH
  → AuthProvider.revokeUserSessions() 하드: 즉시 세션 종료 (선택)

토큰 발급 훅 → TokenEnrichmentHandler.enrich()
  → UserPermissionEngine.resolveFinalMask() → VersionStore.getVersion() → claims 병합

요청 도달 → PermissionMiddleware.check()
  → schema hash → version → bitmask O(1) 판정
```

## 소비 ^consumes

- `UserPermissionEngine` (`user-permission-engine.ts`) — final mask 계산
- `RoleRegistry` (`role-registry.ts`) — domainFeatureIds, schema hash 계산

## 제약

- `AuthProvider`는 토큰/세션 취소만 담당. role 배정은 Permission DB가 SSOT.
- provider의 role/group 기능은 authz 목적으로 사용하지 않는다.
- JWT claims에 role 이름 포함 금지 — `perms` bitmask만 포함.
- Drizzle 구현은 permission-engine 패키지에 포함하지 않는다 — 라이브러리 순수성 유지.
