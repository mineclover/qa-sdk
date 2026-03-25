---
def:
  id: perm-external-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
---
# perm-external-system

## 목적 ^purpose

권한 엔진의 외부 식별자 레이어. resource, service-ref, permission-code로 권한을 외부 시스템에 노출한다.

권한 엔진의 외부 식별자 레이어. resource, service-ref, permission-code로 권한을 외부 시스템에 노출한다.

## contains

| 문서 | id | 설명 |
|------|-----|------|
| [perm-resource-model.spec.md](perm-resource-model.spec.md) | perm-resource-model | 리소스 식별자 모델 |
| [perm-service-ref.spec.md](perm-service-ref.spec.md) | perm-service-ref | 서비스 참조(ServiceRef) 타입 |
| [perm-permission-code.spec.md](perm-permission-code.spec.md) | perm-permission-code | 권한 코드 형식 |

## overview

3개: resource(리소스 식별), service-ref(서비스 참조), permission-code(권한 코드 형식).

`resource.ts`, `service-ref.ts`, `permission-code.ts`는 `permission-engine`의 외부 식별자 레이어를 이룬다.
서비스 경계, resource 규칙, 최종 permission code 문자열을 분리하여 `[S2]` 권한 해소 경로의 텍스트 계약을 안정화한다.

### 책임 분리

| 모듈 | 책임 | canonical 출력 |
|---|---|---|
| `resource.ts` | resource path-like key의 정규화와 타입별 패턴 검증 | `admin/teams`, `admin/teams/:teamId/members` |
| `service-ref.ts` | 서비스 식별자 `(namespace/name)`와 SDK 배포 컨텍스트 `(env/build/region)` 분리 | `shop/payment`, `shop/payment@prod.asia.v2` |
| `permission-code.ts` | 최종 permission address 조립/파싱 | `shop/payment.api.admin/teams.GET` |

### 조합 규칙

최종 permission code의 canonical 형식:

```text
{service-ref}.{type}.{resource}.{action}
```

### 계층 경계

- `resource.ts`는 resource 자체의 형식 규칙만 다룬다.
- `service-ref.ts`는 서비스 식별과 SDK 컨텍스트 숨김 전략을 다룬다.
- `permission-code.ts`는 네 파트를 연결하지만, `parsePermCode()` 자체는 `service-ref`/`resource`의 semantic validation까지 수행하지 않는다.
- semantic validation이 필요한 호출자는 `createServiceContext()`와 `canonicalizeResource()` 또는 `createPermCodeFactory()`를 사용해야 한다.

## 원본

분할 전 원본: `docs/specs/indexing/permission-engine/resource.spec.md` (perm-resource-spec)
