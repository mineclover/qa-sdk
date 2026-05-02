---
def:
  id: perm-constraint-permission-code
  tier: component
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-constraint
      type: refines
    - target: perm-permission-code
      type: depends_on
---
# 권한 제약 — Permission Code 형식

## 목적 ^purpose

`{service-ref}.{type}.{resource}.{action}` 4파트 구조의 permission code 형식과 파싱 전략을 정의한다.

## 정의 ^defines

- Permission code 4파트 구조
- 파싱 전략: 첫 `.` → service, 두 번째 `.` → type, 마지막 `.` → action, 중간 → resource
- `createPermCodeFactory` — 서비스 바인딩 헬퍼

## 소비 ^consumes

- `formatPermCode()`, `parsePermCode()` (`permission-engine/src/permission-code.ts`)
- `createPermCodeFactory()` (`permission-engine/src/permission-code.ts`)
- `PermissionCode` 타입 (`permission-engine/src/permission-code.ts`)

## 4파트 구조

```
{service-ref}.{type}.{resource}.{action}
예: shop/payment.api.orders/items.POST
```

- service: namespace/name (예: `shop/payment`)
- type: `api` | `page` | `action`
- resource: canonical path (예: `admin/teams`)
- action: HTTP method 또는 이벤트명 (예: `GET`, `view`)

파싱이 unambiguous한 이유: resource에 `.`이 포함되지 않음.

`createPermCodeFactory(serviceContext)` — service 부분을 바인딩하여 매번 지정하지 않아도 됨.

## 구현 참조

- 구현: `permission-engine/src/permission-code.ts`
- 테스트: `permission-engine/src/permission-codec.test.ts`
