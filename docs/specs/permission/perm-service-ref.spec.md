---
def:
  id: perm-service-ref
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  svc: permission-engine
  tags: [security]
  links:
    - target: registry-services-api-spec
      type: depends_on
---
# perm-service-ref

## 목적 ^purpose

서비스 참조(ServiceRef) 타입. ServiceBootConfig와 구조적 호환으로 자동 할당 가능.

서비스 참조(ServiceRef) 타입. ServiceBootConfig와 구조적 호환으로 자동 할당 가능.

## 구성 ^overview

- **ServiceIdentity**: `{ namespace, name }` 필수 식별자로 서비스를 고유하게 식별
- **DeployContext**: `{ env?, build?, region? }` 선택적 배포 컨텍스트로 identity와 분리
- **식별자 규칙**: namespace/name 모두 `[a-z][a-z0-9_-]*` 패턴 (소문자 시작, 대문자/숫자 시작 금지)
- **formatServiceRef()**: 기본은 `namespace/name`, includeContext 시 `namespace/name@env.region.build` 형식으로 직렬화
- **parseServiceRef()**: `@` 기준으로 identity/context를 분리하고 position 기반으로 env.region.build 순서 해석
- **ServiceContext**: 앱 부트 시 1회 생성하여 `ref()`(identity만)와 `refFull()`(context 포함)을 제공
- **createPermCodeFactory 연동**: ServiceContext의 `ref()`만 사용하므로 permission code에 deploy context가 기본 포함되지 않음

소스: `packages/permission-engine/src/service-ref.ts`
그룹: [perm-external-system.md](perm-external-system.md)
원본: `docs/specs/indexing/permission-engine/resource.spec.md` SS3

## 상태

implemented

## 1. 설계 원칙

- `(namespace/name)`는 필수 service identity다.
- `(env/build/region)`은 SDK가 일괄 설정하는 deployment context다.
- permission code에 service를 넣을 때는 기본적으로 identity만 노출한다.
- 컨텍스트는 `ServiceContext`가 보관하고, 필요할 때만 `refFull()` 또는 `formatServiceRef(..., { includeContext: true })`로 노출한다.

## 2. 공개 export

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

## 3. identity 규칙

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

## 4. `formatServiceRef()` / `parseServiceRef()`

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

## 5. `ServiceContext`와 `createServiceContext()`

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

## 6. Export coverage (service-ref.ts)

| export | 본문 위치 |
|---|---|
| `ServiceIdentity` | SS2, SS3 |
| `DeployContext` | SS2, SS5 |
| `ServiceRef` | SS2, SS4 |
| `ServiceRefFormatOptions` | SS2, SS4 |
| `ServiceContext` | SS2, SS5 |
| `validateServiceIdentity` | SS2, SS3 |
| `formatServiceRef` | SS2, SS4 |
| `parseServiceRef` | SS2, SS4 |
| `createServiceContext` | SS2, SS5 |
