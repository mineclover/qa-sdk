---
def:
  id: permission-model-scoped-engine
  level: leaf
  tier: component
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-model
      type: refines
    - target: perm-service-ref
      type: depends_on
---
# 권한 모델 — ScopedEngine

## 목적 ^purpose

env/region 같은 외부 컨텍스트에서 독립 scope별 PermissionSet을 관리하는 `ScopedEngine`의 상태 모델을 정의한다. 스코프별 분리와 공통 차원 공유의 규칙을 정리한다.

## 구성 ^overview

- scope 관리: `scope(key)`, `hasScope(key)`, `scopeKeys()`, `deleteScope(key)`
- 모든 scope는 같은 features/roles 정의를 공유
- 스코프별 PermissionSet은 독립 상태를 유지

## 생성

```typescript
const engine = new ScopedEngine(
  { name: "features", ids: ["dashboard", "admin"] },
  { name: "roles",    ids: ["viewer", "admin"] },
);
```

모든 스코프가 같은 features/roles 차원 정의를 공유한다.

## 스코프 관리

| 메서드 | 동작 |
|--------|------|
| `scope(key)` | PermissionSet 획득. 없으면 새로 생성 |
| `hasScope(key)` | 스코프 존재 여부 |
| `scopeKeys()` | 등록된 스코프 키 배열 |
| `deleteScope(key)` | 스코프 제거 |

## 독립성

```typescript
engine.scope("prod:asia").grant("dashboard", "admin");
engine.scope("prod:asia").has("dashboard", "admin");  // true
engine.scope("dev:usa").has("dashboard", "admin");    // false
```

같은 모델 정의를 공유하지만 scope별 상태는 독립이다.

## 활용 의미 ^constraint

- ServiceRef나 외부 deployment context가 바뀌어도 권한 공간 정의 자체는 변하지 않는다.
- ScopedEngine은 권한 상태를 “어느 범위에서 적용하는가”를 담당한다.
