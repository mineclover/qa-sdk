---
def:
  id: permission-version-store
  tier: component
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [permission, version, storage]
  links:
    - target: auth-permission-integration
      type: refines
---

# PermissionVersionStore

## 목적 ^purpose

유저별 권한 버전 카운터를 저장·조회·증가시킨다.
토큰 발급 시 현재 버전을 claims에 기록하고, 요청 시 DB 버전과 비교하여 권한 변경 후 구 토큰을 감지한다.

## 정의 ^defines

### PermissionVersionStore 인터페이스

```typescript
interface PermissionVersionStore {
  getVersion(userId: string): Promise<number>;
  bumpVersion(userId: string): Promise<number>;
}
```

### InMemoryPermissionVersionStore

기본 제공 구현체. 테스트 및 단일 인스턴스 환경에 적합.
서버 재시작 시 버전 초기화됨 — 운영 환경에서는 영속 구현 필요.

### 영속 구현 가이드 (소비자 주입)

```sql
-- Drizzle 스키마 참고
CREATE TABLE permission_versions (
  user_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  changed_at INTEGER NOT NULL   -- epoch ms
);
```

Drizzle SQLite/D1 또는 Redis 구현을 소비자가 직접 주입한다.
permission-engine 패키지에 Drizzle 구현을 포함하지 않는다 — 라이브러리 순수성 유지.

## 소비 ^consumes

- `PermissionChangeNotifier` — `bumpVersion()` 호출
- `TokenEnrichmentHandler` — `getVersion()` 호출 (claims 생성)
- `PermissionMiddleware` — `getVersion()` 호출 (요청 검증)

## 코드 위치

`packages/permission-engine/src/permission-version.ts`
