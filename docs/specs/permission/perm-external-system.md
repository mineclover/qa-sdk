---
def:
  id: perm-external-system
  level: module
  address: def_document:v2:342029
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [structural, security]
  links:
    - target: perm-resource-model
      type: contains
    - target: perm-service-ref
      type: contains
    - target: perm-permission-code
      type: contains
    - target: perm-resource-spec
      type: refines
---

# perm-external-system

## 목적 ^purpose

권한 엔진의 외부 식별자 레이어를 resource, service-ref, permission-code 세 문서로 분리해 외부 텍스트 계약과 서비스 경계를 안정적으로 유지한다.

## 구성 ^overview

- `perm-resource-model`: 리소스 식별자 모델과 path-like resource 규칙을 정의한다.
- `perm-service-ref`: 서비스 참조(ServiceRef)와 배포 컨텍스트 표현을 정의한다.
- `perm-permission-code`: service, type, resource, action을 결합한 permission code 형식을 정의한다.

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
