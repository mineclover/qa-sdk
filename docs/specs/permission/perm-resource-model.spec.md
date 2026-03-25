---
def:
  id: perm-resource-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [security]
---
# perm-resource-model

## 목적 ^purpose

리소스 식별자 모델. 소문자, / 구분, depth <= 4, :param 허용. leading/trailing slash 금지.

리소스 식별자 모델. 소문자, / 구분, depth <= 4, :param 허용. leading/trailing slash 금지.

소스: `packages/permission-engine/src/resource.ts`
그룹: [perm-external-system.md](perm-external-system.md)
원본: `docs/specs/indexing/permission-engine/resource.spec.md` SS2

## 상태

implemented

## 1. 공개 export

| export | 형태 | 계약 |
|---|---|---|
| `ResourceType` | type | 기본 `"page" \| "api" \| "action"` + 확장 가능한 string literal |
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

## 2. canonical resource 규칙

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
| depth <= 4 | 기본 최대 depth는 4 | `a/b/c/d` 허용, `a/b/c/d/e` 불가 |
| `:param` allowed | 기본적으로 `:param` 세그먼트 허용 | `admin/teams/:teamId/members` |
| no-query / no-fragment | query string, fragment 금지 | `?`, `#` 불가 |
| no-whitespace | 공백 문자 금지 | `"admin/teams list"` 불가 |

문자 규칙:

- 일반 세그먼트는 정규식 `^[a-z0-9_-]+$`를 만족해야 한다.
- 파라미터 세그먼트는 정규식 `^:[A-Za-z][A-Za-z0-9_]*$`를 만족해야 한다.
- 구현 주석은 `:camelCase`를 예시로 들지만, 실제 구현은 첫 글자 영문자만 요구하므로 `:TeamId`도 형식상 허용된다.

## 3. `validateResource(raw, opts?)`

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

## 4. `canonicalizeResource()` / `isValidResource()` / `parseResource()`

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

## 5. 타입별 패턴

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

## 6. Export coverage (resource.ts)

| export | 본문 위치 |
|---|---|
| `ResourceType` | SS1, SS5 |
| `ResourceError` | SS1, SS3 |
| `ValidateOptions` | SS1, SS3 |
| `ParsedResource` | SS1, SS4 |
| `ResourcePattern` | SS1, SS5 |
| `validateResource` | SS1, SS3 |
| `canonicalizeResource` | SS1, SS4 |
| `isValidResource` | SS1, SS4 |
| `parseResource` | SS1, SS4 |
| `DEFAULT_PATTERNS` | SS1, SS5 |
| `validateResourceForType` | SS1, SS5 |
