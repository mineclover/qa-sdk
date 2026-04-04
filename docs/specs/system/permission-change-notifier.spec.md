---
def:
  id: permission-change-notifier
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [permission, notification, revoke]
  links:
    - target: auth-permission-integration
      type: refines
---

# PermissionChangeNotifier

## 목적 ^purpose

권한 변경(role 배정 / override 추가)의 단일 진입점이다.
버전 bump(소프트)와 선택적 provider 세션 취소(하드)를 조율하여 토큰 일관성을 보장한다.

## 정의 ^defines

### 권한 변경 흐름

```
Permission DB 변경 (role 배정 / override 추가)
  → PermissionChangeNotifier.notify(userId, { hardRevoke? })
      → VersionStore.bumpVersion(userId)           소프트: 다음 요청에서 VERSION_MISMATCH
      → provider.revokeUserSessions(userId)        하드: 즉시 모든 세션 종료 (선택)
```

### API

```typescript
interface PermissionChangeNotifier {
  notify(userId: string, options?: { hardRevoke?: boolean }): Promise<void>;
  notifyBatch(userIds: string[], options?: { hardRevoke?: boolean }): Promise<void>;
}
```

`notifyBatch()`는 대량 권한 변경 시 사용한다 (예: role 정의 변경으로 전체 영향).

## 소비 ^consumes

- `PermissionVersionStore` — `bumpVersion()` 호출
- `AuthProvider` — `hardRevoke` 시 `revokeUserSessions()` 호출

## 코드 위치

`packages/permission-engine/src/permission-change-notifier.ts`
