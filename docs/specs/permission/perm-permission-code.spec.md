---
def:
  id: perm-permission-code
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  svc: permission-engine
  tags: [security]
  links:
    - target: perm-resource-model
      type: depends_on
    - target: perm-service-ref
      type: depends_on
---
# perm-permission-code

## 목적 ^purpose

권한 코드 형식: {service-ref}.{type}.{resource}.{action}. 외부 시스템이 권한을 참조하는 표준 포맷.

권한 코드 형식: {service-ref}.{type}.{resource}.{action}. 외부 시스템이 권한을 참조하는 표준 포맷.

소스: `packages/permission-engine/src/permission-code.ts`
그룹: [perm-external-system.md](perm-external-system.md)
원본: `docs/specs/indexing/permission-engine/resource.spec.md` SS4

## 구성 ^overview

- **canonical 형식**: `{service-ref}.{type}.{resource}.{action}` — 외부 시스템이 권한을 참조하는 표준 포맷
- **파싱 규칙**: service-ref는 `/` 포함 가능하나 `.` 불포함, resource도 `.` 불포함 — 첫/두번째/마지막 `.` 기준으로 모호하지 않게 분리
- **formatPermCode / parsePermCode**: 구조화된 PermissionCode 객체와 Tier 1 텍스트 간 양방향 변환. parsePermCode는 구조적 split만 수행하며 semantic validation은 별도
- **PermCodeFactory**: ServiceContext를 바인딩하여 service-ref를 자동 주입하는 factory. resource에 canonicalizeResource() 적용
- **deploy context 분리**: factory 생성 시 service는 `ctx.ref()` 기준이며, deploy context는 문자열에 포함되지 않음
- **5개 공개 export**: PermissionCode, PermCodeFactory, formatPermCode, parsePermCode, createPermCodeFactory

## 상태

implemented

## 1. 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `PermissionCode` | interface | `{ service, type, resource, action }` 구조화된 permission address |
| `PermCodeFactory` | interface | callable factory + `.format()` helper |
| `formatPermCode()` | function | `PermissionCode`를 Tier 1 text로 직렬화 |
| `parsePermCode()` | function | Tier 1 text를 `PermissionCode`로 파싱 |
| `createPermCodeFactory()` | function | `ServiceContext`가 바인딩된 factory 생성 |

## 2. canonical 형식

```text
{service-ref}.{type}.{resource}.{action}
```

예시:

```text
shop/payment.api.admin/teams.GET
cms/portal.page.admin/users.view
ops/audit.action.users/roles.approve
shop/payment.api.admin/teams/:teamId/members.GET
```

파싱이 가능한 이유:

- `service-ref`는 `/`를 포함할 수 있지만 `.`는 포함하지 않는다.
- `resource`도 `resource.ts` 규칙상 `.`를 포함하지 않는다.
- 따라서 첫 번째 `.`, 두 번째 `.`, 마지막 `.` 기준으로 경계를 고정해도 모호하지 않다.

## 3. `formatPermCode()` / `parsePermCode()`

```ts
formatPermCode(code: PermissionCode): string
parsePermCode(raw: string): PermissionCode
```

`formatPermCode()` 계약:

- 입력 객체를 그대로 `{service}.{type}.{resource}.{action}`로 연결한다.
- 이 함수는 `service`, `resource`, `action`의 semantic validation을 수행하지 않는다.

`parsePermCode()` 계약:

1. 입력은 반드시 string이어야 한다.
2. 첫 번째 `.` 앞부분이 `service`다.
3. 그 뒤 첫 번째 `.` 앞부분이 `type`이다.
4. 남은 문자열의 마지막 `.` 뒤가 `action`이다.
5. 중간 부분 전체가 `resource`다.
6. 네 파트 중 하나라도 비어 있으면 `RangeError`다.

실패 사례:

- `"no-dots"` -> `service.type.resource.action 형식 필요`
- `"shop/payment.api"` -> `type.resource.action 부분 없음`
- `"shop/payment.api.admin/teams"` -> `resource.action 구분 없음`
- `"shop/payment.api..GET"` -> `빈 파트 존재`
- `null` 같은 비-string 입력 -> `string 형식 필요`

중요한 경계:

- `parsePermCode()`는 구조적 split만 수행한다.
- 즉 `service`를 `parseServiceRef()`로 검증하지 않고, `resource`를 `canonicalizeResource()`로 검증하지도 않는다.
- semantic validation이 필요한 경우 `parsePermCode()` 결과에 대해 별도 검증을 수행해야 한다.

## 4. `createPermCodeFactory()`

```ts
createPermCodeFactory(ctx: ServiceContext): PermCodeFactory
```

반환 타입:

```ts
interface PermCodeFactory {
  (type: ResourceType, resource: string, action: string): PermissionCode;
  format(type: ResourceType, resource: string, action: string): string;
}
```

계약:

- `ctx.ref()`를 service로 바인딩한다.
- resource 입력은 항상 `canonicalizeResource()`를 거친다.
- 따라서 factory 경유 생성은 앞뒤 공백을 trim하고 invalid resource를 `RangeError`로 거부한다.
- `factory.format()`은 내부적으로 `formatPermCode(factory(...))`와 동일하다.

예시:

```ts
const ctx = createServiceContext({
  namespace: "shop",
  name: "payment",
  env: "prod",
  region: "asia",
});

const perm = createPermCodeFactory(ctx);

perm("api", "  admin/teams  ", "GET");
// {
//   service: "shop/payment",
//   type: "api",
//   resource: "admin/teams",
//   action: "GET"
// }

perm.format("api", "admin/teams", "GET");
// "shop/payment.api.admin/teams.GET"
```

의미:

- service는 항상 `ctx.ref()` 기준이므로 deploy context는 문자열에 포함되지 않는다.
- deploy context를 별도로 직렬화해야 하면 `ctx.refFull()` 또는 `formatServiceRef(..., { includeContext: true })`를 호출자가 명시적으로 사용해야 한다.

## 5. Export coverage (permission-code.ts)

| export | 본문 위치 |
|---|---|
| `PermissionCode` | SS1, SS2 |
| `PermCodeFactory` | SS1, SS4 |
| `formatPermCode` | SS1, SS3 |
| `parsePermCode` | SS1, SS3 |
| `createPermCodeFactory` | SS1, SS4 |
