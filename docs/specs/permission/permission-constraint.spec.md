---
def:
  id: permission-constraint
  address: def_document:v2:274563
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: perm-codec-system
      type: constrains
    - target: perm-migration-system
      type: constrains
    - target: perm-permission-code
      type: constrains
---
# 권한 비즈니스 제약

## 목적 ^purpose

권한 시스템의 비즈니스 규칙과 제약. 클라이언트는 role을 직접 확인하지 않고, 서버가 role → flat permission mask로 해소한다.

## 구성 ^overview

- `role 해소 규칙`: 클라이언트는 role을 직접 확인하지 않고, 서버가 flat permission mask로 해소하는 구조를 정의한다.
- `resource 형식 제약`: 소문자, `/` 구분, depth ≤ 4, `:param` 허용의 canonical path 규칙을 기술한다.
- `permission code 형식`: `{service-ref}.{type}.{resource}.{action}` 4파트 구조를 명시한다.
- `인코딩 선택 기준`: WeightedIndex/BitIndex/IndexBridge 선택 가이드를 정리한다.
- `DKG 제약 (CON-001)`: rbac_role과 role 동시 사용 금지 규칙을 기술한다.

## role 해소 규칙

클라이언트는 role을 직접 확인하지 않는다. 서버가 role → flat permission mask로 resolve한 결과만 클라이언트에 전달한다.

```
[서버]                                          [클라이언트]
role: "admin"
  → PermissionCodec.encode(permissions[]) →     Uint8Array bitmask
  → HTTP 응답 (mask 전달)                        → hasBit(mask, address) — O(1) 체크
```

이 구조의 이점:
- 클라이언트가 role 구조를 몰라도 된다 (role 변경 시 클라이언트 수정 불필요)
- O(1) 비트 체크로 권한 확인 (role hierarchy 탐색 없음)
- bitmask는 직렬화/전송 효율이 높다

### Domain Role deny 레이어

grant와 대칭되는 deny 어휘를 제공한다. grant가 role/feature 단위로 부여하듯, deny도 동일한 vocabulary로 제거한다.

- 타입 정의: `permission-engine/src/role-registry.ts` — `DomainRoleDef.denyRoles`, `DomainRoleDef.denyFeatures`
- grant 레이어: `parents`(role 단위 부여), `ownFeatures`(feature 단위 부여)
- deny 레이어: `denyRoles`(role 단위 제거), `denyFeatures`(feature 단위 제거)

**resolution 순서:**

```
1. parents → 상속 feature OR 합산
2. + ownFeatures 추가
3. denyRoles → 대상 role의 resolvedFeatures 전체를 deny set에 수집
4. + denyFeatures → deny set에 추가
5. final = (step 2 결과) - (deny set)
```

**규칙:**
- `denyRoles`는 같은 domain 내 role만 참조 가능
- `denyRoles` 대상 role에 feature가 추가되면 자동으로 deny에 반영됨
- 자기 자신을 deny하면 검증 에러 (`self-deny-role`)
- 존재하지 않는 role을 deny하면 검증 에러 (`unknown-deny-role`)
- deny는 해당 role의 resolved에만 영향. 부모/자식 role의 resolved에 전파되지 않음

**테스트 참조** (`permission-engine/src/role-registry.test.ts`):
- denyFeatures 개별 제거: `:154`
- denyRoles 통째로 제거: `:185`
- denyRoles + denyFeatures 복합: `:206`
- denyRoles 자동 반영: `:225`
- mask 반영: `:246`
- 검증 (unknown/self-deny): `:265`, `:277`

## resource 형식 제약

permission-engine/src/resource.ts의 `validateResource()` 규칙:

| 규칙 | 제약 | 예시 |
|------|------|------|
| 소문자 | 대문자 금지 | `admin/teams` O, `Admin/Teams` X |
| `/` 구분 | 슬래시로 세그먼트 분리 | `admin/teams` O |
| leading/trailing slash 금지 | 시작/끝 슬래시 없음 | `/admin/` X |
| depth ≤ 4 | 세그먼트 수 최대 4 | `a/b/c/d` O, `a/b/c/d/e` X |
| `:param` 허용 | 동적 파라미터 세그먼트 | `users/:userId` O |
| 연속 슬래시 금지 | `//` 불가 | `admin//teams` X |
| query/fragment 금지 | `?`, `#` 불가 | `admin?q=1` X |

타입별 패턴 (DEFAULT_PATTERNS):
- page: depth ≤ 3, `:param` 금지, actions = view/edit/create/delete
- api: depth ≤ 4, `:param` 허용, actions = GET/POST/PUT/PATCH/DELETE
- action: depth ≤ 3, `:param` 금지, 임의 이벤트명

## permission code 형식

4파트 구조: `{service-ref}.{type}.{resource}.{action}`

```typescript
// permission-engine/src/permission-code.ts
interface PermissionCode {
  service: string;    // "shop/payment" (namespace/name)
  type: ResourceType; // "api" | "page" | "action"
  resource: string;   // "admin/teams" (canonical path)
  action: string;     // "GET" | "view" | ...
}

formatPermCode(code) → "shop/payment.api.admin/teams.GET"
parsePermCode(raw)   → PermissionCode 객체
```

파싱 전략: 첫 `.` → service, 두 번째 `.` → type, 마지막 `.` → action, 중간 → resource. resource에 `.`이 없으므로 파싱이 unambiguous하다.

`createPermCodeFactory(serviceContext)` — 서비스 바인딩된 헬퍼로 service 부분을 매번 지정하지 않아도 된다.

## 인코딩 선택 기준

PermissionCodec (permission-engine/src/permission-codec.ts)이 3-tier 인코딩을 제공한다:

| Tier | 형태 | 용도 | 구현 |
|------|------|------|------|
| Tier 1 | text | 사람용, 디버그/로그 | formatPermCode/parsePermCode |
| Tier 2 | integer | 1D 주소 (SemanticAddress) | WeightedIndex encode/decode |
| Tier 3 | bitmask | O(1) 클라이언트 체크 | Uint8Array + hasBit |

인코딩 선택 가이드:
- **DB + 범위 질의** → WeightedIndex (Tier 2): 주소 범위로 특정 service/resource의 권한을 질의
- **인메모리 필터** → BitIndex (Tier 3): BitMaskSet.filterByLabel()로 차원별 O(1) 필터
- **양쪽 모두** → IndexBridge: WI ↔ BI 변환. `toBitMaskSet(mask)`, `toUint8Mask(bitSet)`
- **캐시된 반복 질의** → PermissionView: mask 1개당 1회 변환, 이후 모든 필터 O(granted)

## DKG 제약 (CON-001)

rbac_role과 role 축을 동시에 사용하면 안 된다. 하나의 시스템에서 두 가지 role 개념이 공존하면 권한 해소 경로가 모호해진다. 시스템 정의 시 둘 중 하나를 선택하고, 나머지는 DKG에서 제거한다.

추가 관련 제약:
- **CON-002**: 이벤트 prefix action dim은 `*_action` 축 사용
- **PolicyRule match 기반**: entity name + 명시적 와일드카드(`"*"`). dim 누락 → ValidationError (암묵적 와일드카드 금지)
