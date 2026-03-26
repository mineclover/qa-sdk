---
def:
  id: perm-resource-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [security]
  links:
    - target: perm-resource-model
      type: depends_on
    - target: perm-service-ref
      type: depends_on
---
# permission-engine resource identity 스펙

## 목적 ^purpose

`resource.ts`, `service-ref.ts`, `permission-code.ts`는 `permission-engine`의 외부 식별자 레이어를 이룬다.
서비스 경계, resource 규칙, 최종 permission code 문자열을 분리하여 `[S2]` 권한 해소 경로의 텍스트 계약을 안정화한다.

패키지: `permission-engine`
운영 흐름: `[S2]` 권한 해소/검사 — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)
패키지 인덱스: [README.md](README.md)

## 상태

implemented

## 1. 외부 식별자 레이어 개요

### 1.1 책임 분리

| 모듈 | 책임 | canonical 출력 |
|---|---|---|
| `resource.ts` | resource path-like key의 정규화와 타입별 패턴 검증 | `admin/teams`, `admin/teams/:teamId/members` |
| `service-ref.ts` | 서비스 식별자 `(namespace/name)`와 SDK 배포 컨텍스트 `(env/build/region)` 분리 | `shop/payment`, `shop/payment@prod.asia.v2` |
| `permission-code.ts` | 최종 permission address 조립/파싱 | `shop/payment.api.admin/teams.GET` |

### 1.2 조합 규칙

최종 permission code의 canonical 형식은 다음과 같다.

```text
{service-ref}.{type}.{resource}.{action}
```

예시:

```text
shop/payment.api.admin/teams.GET
shop/payment.api.admin/teams/:teamId/members.GET
cms/portal.page.admin/users.view
ops/audit.action.users/roles.approve
```

해석 규칙:

- `service-ref`는 `namespace/name`이며, SDK 내부 컨텍스트(`env`, `build`, `region`)는 기본 직렬화에서 숨긴다.
- `type`은 `page`, `api`, `action`이 기본 제공 타입이지만 `ResourceType`은 확장 가능하다.
- `resource`는 `.` 없이 `/`로만 세그먼트를 구분하는 canonical path다.
- `action`은 최종 동작 식별자이며, 대소문자 규칙은 모듈이 직접 강제하지 않는다.

### 1.3 계층 경계

- `resource.ts`는 resource 자체의 형식 규칙만 다룬다.
- `service-ref.ts`는 서비스 식별과 SDK 컨텍스트 숨김 전략을 다룬다.
- `permission-code.ts`는 네 파트를 연결하지만, `parsePermCode()` 자체는 `service-ref`/`resource`의 semantic validation까지 수행하지 않는다.
- semantic validation이 필요한 호출자는 `createServiceContext()`와 `canonicalizeResource()` 또는 `createPermCodeFactory()`를 사용해야 한다.

---

## 2. `resource.ts`

소스: `packages/permission-engine/src/resource.ts`

### 2.1 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `ResourceType` | type | 기본 `"page" | "api" | "action"` + 확장 가능한 string literal |
| `ResourceError` | interface | `{ rule, message }` 검증 오류 구조 |
| `ValidateOptions` | interface | `maxDepth?`, `allowParams?` |
| `ParsedResource` | interface | `{ raw, segments, depth, hasParams, paramNames }` |
| `ResourcePattern` | interface | `{ type, actions?, allowParams, maxDepth }` |
| `validateResource()` | function | 일반 resource 규칙 검사 |
| `canonicalizeResource()` | function | trim 후 검증, 실패 시 `RangeError` |
| `isValidResource()` | function | boolean validator |
| `parseResource()` | function | canonical resource를 구조화 정보로 파싱 |
| `DEFAULT_PATTERNS` | const | `page`/`api`/`action` 기본 패턴 메타데이터 |
| `validateResourceForType()` | function | 타입별 `maxDepth`/`allowParams`를 적용한 validator |

### 2.2 canonical resource 규칙

resource는 canonical path-like key이며 기본 형식은 다음과 같다.

```text
segment(/segment)*
segment := [a-z0-9_-]+ | :param
param   := :[A-Za-z][A-Za-z0-9_]*
```

기본 불변조건:

| 규칙 | 설명 | 기본값/예시 |
|---|---|---|
| non-empty | 빈 문자열 금지 | `""` 불가 |
| lowercase | 일반 세그먼트는 소문자만 허용 | `Admin/Teams` 불가 |
| slash-separated | 세그먼트 구분자는 `/`만 사용 | `admin/teams` |
| no-leading-slash | leading slash 금지 | `/admin/teams` 불가 |
| no-trailing-slash | trailing slash 금지 | `admin/teams/` 불가 |
| no-double-slash | 연속 슬래시 금지 | `admin//teams` 불가 |
| depth ≤ 4 | 기본 최대 depth는 4 | `a/b/c/d` 허용, `a/b/c/d/e` 불가 |
| `:param` allowed | 기본적으로 `:param` 세그먼트 허용 | `admin/teams/:teamId/members` |
| no-query / no-fragment | query string, fragment 금지 | `?`, `#` 불가 |
| no-whitespace | 공백 문자 금지 | `"admin/teams list"` 불가 |

문자 규칙:

- 일반 세그먼트는 정규식 `^[a-z0-9_-]+$`를 만족해야 한다.
- 파라미터 세그먼트는 정규식 `^:[A-Za-z][A-Za-z0-9_]*$`를 만족해야 한다.
- 구현 주석은 `:camelCase`를 예시로 들지만, 실제 구현은 첫 글자 영문자만 요구하므로 `:TeamId`도 형식상 허용된다.

### 2.3 `validateResource(raw, opts?)`

```ts
validateResource(raw: string, opts?: ValidateOptions): ResourceError[]
```

계약:

- 기본 옵션은 `{ maxDepth: 4, allowParams: true }`다.
- 실패 시 첫 오류에서 중단하지 않고 `ResourceError[]`를 누적 반환한다.
- leading/trailing slash, query/fragment, whitespace, double slash는 세그먼트 파싱 전에 선검사한다.
- 선검사 오류가 하나라도 있으면 이후 세그먼트 검사 없이 반환한다.

대표 `rule` 값:

| `rule` | 의미 |
|---|---|
| `non-empty` | 빈 문자열 |
| `no-leading-slash` | leading slash |
| `no-trailing-slash` | trailing slash |
| `no-query` | query string |
| `no-fragment` | fragment |
| `no-whitespace` | 공백 문자 |
| `no-double-slash` | 연속 슬래시 |
| `max-depth` | 최대 depth 초과 |
| `segment-empty` | 빈 세그먼트 |
| `no-params` | `allowParams: false`인데 `:param` 사용 |
| `param-format` | `:param` 형식 위반 |
| `lowercase` | 일반 세그먼트 대문자 포함 |
| `segment-chars` | 허용 문자 위반 |

### 2.4 `canonicalizeResource()` / `isValidResource()` / `parseResource()`

```ts
canonicalizeResource(raw: string, opts?: ValidateOptions): string
isValidResource(raw: string, opts?: ValidateOptions): boolean
parseResource(raw: string, opts?: ValidateOptions): ParsedResource
```

차이점:

- `canonicalizeResource()`는 먼저 `trim()`을 적용한 뒤 검증한다.
- `isValidResource()`는 입력을 그대로 검사하므로 앞뒤 공백이 있으면 `false`다.
- `parseResource()`는 `canonicalizeResource()`를 통과한 값만 다루므로 `raw`, `segments`, `depth`, `hasParams`, `paramNames`를 안정적으로 제공한다.

예시:

```ts
canonicalizeResource("  admin/teams  "); // "admin/teams"

parseResource("admin/teams/:teamId/members");
// {
//   raw: "admin/teams/:teamId/members",
//   segments: ["admin", "teams", ":teamId", "members"],
//   depth: 4,
//   hasParams: true,
//   paramNames: ["teamId"]
// }
```

### 2.5 타입별 패턴

기본 제공 패턴:

| type | `actions` metadata | `allowParams` | `maxDepth` | 의도 |
|---|---|---|---|---|
| `page` | `["view", "edit", "create", "delete"]` | `false` | `3` | 사용자 화면/페이지 식별자 |
| `api` | `["GET", "POST", "PUT", "PATCH", "DELETE"]` | `true` | `4` | API endpoint 식별자 |
| `action` | 없음 | `false` | `3` | 임의 이벤트/명령 식별자 |

`validateResourceForType(raw, type, patterns?)` 계약:

- 등록된 타입이면 해당 `ResourcePattern.maxDepth`와 `allowParams`를 `validateResource()`에 전달한다.
- 미등록 타입이면 일반 `validateResource()`로 fallback한다.
- 현재 구현은 `ResourcePattern.actions`를 검증에 사용하지 않는다.
  즉 `actions`는 문서화와 UI 제안용 metadata이며, action whitelist enforcement는 이 함수의 책임이 아니다.

---

## 3. `service-ref.ts`

소스: `packages/permission-engine/src/service-ref.ts`

### 3.1 설계 원칙

- `(namespace/name)`는 필수 service identity다.
- `(env/build/region)`은 SDK가 일괄 설정하는 deployment context다.
- permission code에 service를 넣을 때는 기본적으로 identity만 노출한다.
- 컨텍스트는 `ServiceContext`가 보관하고, 필요할 때만 `refFull()` 또는 `formatServiceRef(..., { includeContext: true })`로 노출한다.

### 3.2 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `ServiceIdentity` | interface | `{ namespace, name }` 필수 식별자 |
| `DeployContext` | interface | `{ env?, build?, region? }` SDK 배포 컨텍스트 |
| `ServiceRef` | interface | `ServiceIdentity` + 선택적 deploy fields |
| `ServiceRefFormatOptions` | interface | `{ includeContext?: boolean }` |
| `ServiceContext` | interface | `identity`, `deploy`, `ref()`, `refFull()` |
| `validateServiceIdentity()` | function | `namespace`/`name` 형식 검사 |
| `formatServiceRef()` | function | `ServiceRef`를 canonical 문자열로 직렬화 |
| `parseServiceRef()` | function | canonical 문자열을 `ServiceRef`로 파싱 |
| `createServiceContext()` | function | validated `ServiceContext` 생성 |

### 3.3 identity 규칙

`namespace`와 `name`은 동일한 식별자 규칙을 따른다.

```text
[a-z][a-z0-9_-]*
```

의미:

- 첫 글자는 반드시 소문자 영문자다.
- 이후는 소문자 영문자, 숫자, `_`, `-`를 허용한다.
- 빈 문자열, 대문자, 숫자 시작 값은 거부한다.

`validateServiceIdentity(id)`는 오류 문자열 배열을 반환한다.

```ts
validateServiceIdentity({ namespace: "shop", name: "payment" }); // []
validateServiceIdentity({ namespace: "1shop", name: "payment" });
// ['namespace "1shop" — [a-z][a-z0-9_-]* 필요']
```

### 3.4 `formatServiceRef()` / `parseServiceRef()`

기본 직렬화:

```text
namespace/name
```

컨텍스트 포함 직렬화:

```text
namespace/name@env.region.build
```

계약:

- `includeContext` 기본값은 `false`다.
- context를 포함할 때 순서는 항상 `env`, `region`, `build`다.
- 값이 없는 context slot은 생략되며, 하나도 없으면 `@`를 붙이지 않는다.

예시:

```ts
formatServiceRef({ namespace: "shop", name: "payment" });
// "shop/payment"

formatServiceRef(
  { namespace: "shop", name: "payment", env: "prod", region: "asia", build: "v2" },
  { includeContext: true },
);
// "shop/payment@prod.asia.v2"
```

파싱 규칙:

- `parseServiceRef()`는 `@` 앞부분을 `namespace/name`, 뒤부분을 `env.region.build`로 나눈다.
- identity 부분은 `validateServiceIdentity()`로 검증한다.
- context 부분은 position-based split만 수행하며, 별도 형식 검증은 하지 않는다.

주의:

- `parseServiceRef("shop/payment@prod.asia")`는 `{ env: "prod", region: "asia", build: undefined }`를 반환한다.
- context 순서는 `env.region.build`로 고정되어 있으므로 partial context도 이 순서에 맞춰 해석된다.

### 3.5 `ServiceContext`와 `createServiceContext()`

```ts
createServiceContext(config: ServiceRef): ServiceContext
```

`ServiceContext` 표면:

| 속성/API | 설명 |
|---|---|
| `identity` | `{ namespace, name }` |
| `deploy` | `{ env?, build?, region? }` |
| `ref()` | context를 숨긴 canonical `namespace/name` |
| `refFull()` | context를 포함한 `namespace/name@env.region.build` |

의도:

- 애플리케이션 부트 시점에 서비스 identity와 deploy context를 한 번 설정한다.
- 이후 permission code 생성 시 매번 `env/build/region`을 전달하지 않는다.
- `createPermCodeFactory()`는 이 컨텍스트의 `ref()`만 사용하므로 permission code 문자열에는 deploy context가 기본적으로 포함되지 않는다.

예시:

```ts
const ctx = createServiceContext({
  namespace: "shop",
  name: "payment",
  env: "prod",
  region: "asia",
});

ctx.identity;  // { namespace: "shop", name: "payment" }
ctx.deploy;    // { env: "prod", region: "asia", build: undefined }
ctx.ref();     // "shop/payment"
ctx.refFull(); // "shop/payment@prod.asia"
```

---

## 4. `permission-code.ts`

소스: `packages/permission-engine/src/permission-code.ts`

### 4.1 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `PermissionCode` | interface | `{ service, type, resource, action }` 구조화된 permission address |
| `PermCodeFactory` | interface | callable factory + `.format()` helper |
| `formatPermCode()` | function | `PermissionCode`를 Tier 1 text로 직렬화 |
| `parsePermCode()` | function | Tier 1 text를 `PermissionCode`로 파싱 |
| `createPermCodeFactory()` | function | `ServiceContext`가 바인딩된 factory 생성 |

### 4.2 canonical 형식

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

### 4.3 `formatPermCode()` / `parsePermCode()`

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

- `"no-dots"` → `service.type.resource.action 형식 필요`
- `"shop/payment.api"` → `type.resource.action 부분 없음`
- `"shop/payment.api.admin/teams"` → `resource.action 구분 없음`
- `"shop/payment.api..GET"` → `빈 파트 존재`
- `null` 같은 비-string 입력 → `string 형식 필요`

중요한 경계:

- `parsePermCode()`는 구조적 split만 수행한다.
- 즉 `service`를 `parseServiceRef()`로 검증하지 않고, `resource`를 `canonicalizeResource()`로 검증하지도 않는다.
- semantic validation이 필요한 경우 `parsePermCode()` 결과에 대해 별도 검증을 수행해야 한다.

### 4.4 `createPermCodeFactory()`

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

---

## 5. Export coverage matrix

이 문서는 `packages/permission-engine/src/index.ts`를 통해 공개되는 아래 export를 모두 다룬다.

| 모듈 | export | 본문 위치 |
|---|---|---|
| `resource.ts` | `ResourceType` | §2.1, §4.4 |
| `resource.ts` | `ResourceError` | §2.1, §2.3 |
| `resource.ts` | `ValidateOptions` | §2.1, §2.3 |
| `resource.ts` | `ParsedResource` | §2.1, §2.4 |
| `resource.ts` | `ResourcePattern` | §2.1, §2.5 |
| `resource.ts` | `validateResource` | §2.1, §2.3 |
| `resource.ts` | `canonicalizeResource` | §2.1, §2.4, §4.4 |
| `resource.ts` | `isValidResource` | §2.1, §2.4 |
| `resource.ts` | `parseResource` | §2.1, §2.4 |
| `resource.ts` | `DEFAULT_PATTERNS` | §2.1, §2.5 |
| `resource.ts` | `validateResourceForType` | §2.1, §2.5 |
| `service-ref.ts` | `ServiceIdentity` | §3.2, §3.3 |
| `service-ref.ts` | `DeployContext` | §3.2, §3.5 |
| `service-ref.ts` | `ServiceRef` | §3.2, §3.4 |
| `service-ref.ts` | `ServiceRefFormatOptions` | §3.2, §3.4 |
| `service-ref.ts` | `ServiceContext` | §3.2, §3.5 |
| `service-ref.ts` | `validateServiceIdentity` | §3.2, §3.3 |
| `service-ref.ts` | `formatServiceRef` | §3.2, §3.4 |
| `service-ref.ts` | `parseServiceRef` | §3.2, §3.4 |
| `service-ref.ts` | `createServiceContext` | §3.2, §3.5 |
| `permission-code.ts` | `PermissionCode` | §4.1, §4.2 |
| `permission-code.ts` | `PermCodeFactory` | §4.1, §4.4 |
| `permission-code.ts` | `formatPermCode` | §4.1, §4.3 |
| `permission-code.ts` | `parsePermCode` | §4.1, §4.3 |
| `permission-code.ts` | `createPermCodeFactory` | §4.1, §4.4 |

## 6. 구현 상태 요약

- `resource` 규칙은 소문자, `/` 구분, leading/trailing slash 금지, depth 기본값 4, `:param` 허용으로 구현돼 있다.
- 타입별 기본 패턴은 `page`(param 금지, depth 3), `api`(param 허용, depth 4), `action`(param 금지, depth 3)으로 구현돼 있다.
- `service-ref`는 `(namespace/name)`를 필수로 두고 `(env/build/region)`은 SDK `ServiceContext`가 숨기는 구조로 구현돼 있다.
- `permission-code`는 `{service-ref}.{type}.{resource}.{action}` 형식과 `formatPermCode()` / `parsePermCode()` / `createPermCodeFactory()`를 구현한다.
