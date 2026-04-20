---
def:
  id: perm-constraint-resource-format
  level: leaf
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
    - target: perm-resource-model
      type: depends_on
---
# 권한 제약 — Resource 형식

## 목적 ^purpose

권한 리소스 경로의 canonical path 규칙을 정의한다. 소문자, `/` 구분, depth ≤ 4, `:param` 허용.

## 정의 ^defines

- Resource 경로 형식 제약 7가지
- 타입별 패턴 (page, api, action)

## 소비 ^consumes

- `validateResource()` (`permission-engine/src/resource.ts`)
- `DEFAULT_PATTERNS` (`permission-engine/src/resource.ts`)

## 형식 규칙

| 규칙 | 제약 | 예시 |
|------|------|------|
| 소문자 | 대문자 금지 | `admin/teams` O, `Admin/Teams` X |
| `/` 구분 | 슬래시로 세그먼트 분리 | `admin/teams` O |
| leading/trailing slash 금지 | 시작/끝 슬래시 없음 | `/admin/` X |
| depth ≤ 4 | 세그먼트 수 최대 4 | `a/b/c/d` O, `a/b/c/d/e` X |
| `:param` 허용 | 동적 파라미터 세그먼트 | `users/:userId` O |
| 연속 슬래시 금지 | `//` 불가 | `admin//teams` X |
| query/fragment 금지 | `?`, `#` 불가 | `admin?q=1` X |

## 타입별 패턴 (DEFAULT_PATTERNS)

- page: depth ≤ 3, `:param` 금지, actions = view/edit/create/delete
- api: depth ≤ 4, `:param` 허용, actions = GET/POST/PUT/PATCH/DELETE
- action: depth ≤ 3, `:param` 금지, 임의 이벤트명

## 구현 참조

- 구현: `permission-engine/src/resource.ts` — `validateResource()`, `parseResource()`, `DEFAULT_PATTERNS`
