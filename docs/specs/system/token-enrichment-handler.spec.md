---
def:
  id: token-enrichment-handler
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [token, jwt, permission, enrichment]
  links:
    - target: auth-permission-integration
      type: refines
---

# TokenEnrichmentHandler

## 목적 ^purpose

토큰 발급 시점에 유저의 최종 permission mask + 버전 + schema hash를 JWT claims로 계산하여 주입한다.
요청마다 DB 조회 없이 O(1) 권한 판정을 가능하게 하는 토큰 자급 구조의 핵심이다.

## 정의 ^defines

### PermissionClaims 구조

```typescript
{
  perms: Record<string, string>  // domain → base64(Uint8Array bitmask)
  perms_v: number                // 발급 시점의 유저 권한 버전
  perms_schema: string           // RoleRegistry feature 정의 djb2 해시
}
```

### 토큰 발급 흐름

```
Zitadel Action / Keycloak Protocol Mapper 에서 호출:

  TokenEnrichmentHandler.enrich(userId)
    → contextLoader(userId)                      Permission DB → ResolutionContext
    → UserPermissionEngine.resolveFinalMask()    도메인별 최종 mask (override 적용)
    → VersionStore.getVersion(userId)            현재 버전
    → computeSchemaHash(roleRegistry)            feature 정의 해시
    → { perms, perms_v, perms_schema }           JWT claims에 병합
```

### schema hash 결정론성

`computeSchemaHash(roleRegistry)` = djb2(`JSON.stringify({ domain: featureIds[] }, sortedKeys)`)

- 같은 registry → 항상 같은 hash
- feature 추가/삭제/순서 변경 → hash 변경 → 구 토큰 자동 무효
- 암호학적 강도 불필요 — 빠른 변경 감지 목적

## 소비 ^consumes

- `UserPermissionEngine` — `resolveFinalMask()` 호출
- `PermissionVersionStore` — `getVersion()` 호출
- `RoleRegistry` — `computeSchemaHash()` 입력

## 코드 위치

`packages/permission-engine/src/token-enrichment.ts`
