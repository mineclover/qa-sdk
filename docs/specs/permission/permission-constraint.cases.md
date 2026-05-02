---
def:
  id: permission-constraint-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [scenario, permission, security]
  links:
    - target: permission-constraint
      type: refines
    - target: permission-system
      type: depends_on
---

# Permission Constraint — 소비자 기대 시나리오

## 목적 ^purpose

`permission-constraint`(role 해소, resource 형식, permission code, 인코딩 선택, DKG 제약)가 `permission-system`에 의존할 때 기대하는 계약. 비즈니스 제약은 permission-system이 제공하는 모델 정의, codec 스택, external 식별자 계층 위에서만 결정론적으로 평가 가능하다.

## 시나리오 1: role → flat permission mask 해소 경로 ^overview

**전제**: `permission-system`의 `permission-model`이 PermissionSet(bitmask) + TernaryMask(allow/deny/unset) + ScopedEngine(scope 해소)의 3개 코어 타입을 정의한다.

**동작**: 클라이언트가 role 문자열을 서버에 전달하면 서버가 role → PermissionSet flat mask로 해소한다.

**기대**:
- 클라이언트 코드에 role 이름 검사 분기 없음 (CON-001: rbac_role + role 동시 사용 금지)
- 서버 응답은 PermissionSet bitmask (role 이름 미포함)
- 같은 role 입력 → 같은 mask 출력 (결정론적)

**실패 시 수정 대상**: `permission-system.md` §"권한 모델" — role 해소 책임이 서버 단독임을 명문화. 클라이언트 role 직접 확인을 허용하면 constraint 규칙이 무효.

## 시나리오 2: resource canonical path 검증 ^overview

**전제**: `permission-system`의 `perm-external-system`이 resource 식별자 형식(소문자, `/` 구분, depth ≤ 4, `:param` 허용)을 정의.

**동작**: CLI 또는 API에 resource = `/App/Order/:id` 전달.

**기대**:
- validator가 대문자 감지 → reject + 명시적 에러 메시지
- depth ≥ 5 → reject
- `:param` 세그먼트는 허용 + 매칭 시 placeholder 로 해석

**실패 시 수정 대상**: `permission-system.md`의 `perm-external-system` — canonical path 규칙이 external system에서 fix 되지 않으면 constraint가 매번 normalize 를 재구현.

## 시나리오 3: permission code 4-part 구조 불변성 ^overview

**전제**: `permission-system`의 `perm-permission-code`가 `{service-ref}.{type}.{resource}.{action}` 4파트 구조를 선언.

**동작**: codec이 permission code 를 인코딩하거나 migration이 스키마 변경을 처리한다.

**기대**:
- 4파트 중 하나라도 누락 → encode 에러
- 각 파트는 하위 validator (service-ref 존재, action whitelist) 통과
- migration은 4파트 경계를 보존, 재배치 시 부분 바인딩으로 수행

**실패 시 수정 대상**: `permission-system.md`의 `perm-permission-code` — 구조 변경이 필요하면 permission-system 스펙을 먼저 업데이트해야 constraint 계층의 validator 가 drift 없이 추종.

## 시나리오 4: 인코딩 선택 가이드 (WI vs BitIndex) ^overview

**전제**: `permission-system`의 `permission-encoding`이 WeightedIndex(DB + 범위 질의), BitIndex(인메모리 필터), IndexBridge(호환) 3-layer 선택 가이드를 제공.

**동작**: 새 서비스가 RBAC/ABAC 하이브리드 환경에서 encoding 선택.

**기대**:
- 범위 질의(priority >= N) 필요 → WeightedIndex
- 고빈도 필터(membership test) → BitIndex
- 양쪽 혼용 → IndexBridge (소유권은 WeightedIndex 쪽)

**실패 시 수정 대상**: `permission-system.md`의 `permission-encoding` — 선택 기준이 추상적이면 서비스별로 다른 encoding 을 임시 선택하여 policy 평가 결과가 어댑터별로 drift.

## 시나리오 5: DKG 제약 CON-001 위반 감지 ^overview

**전제**: `permission-system`이 DKG constraint `CON-001: rbac_role과 role 동시 사용 금지`를 준수.

**동작**: migration 또는 schema diff 가 두 필드를 동시에 노출한 스펙을 발견.

**기대**:
- 검증 파이프라인이 error (warning 아님)
- 수정 제안: `rbac_role` 유지 + `role` 제거 또는 그 반대 (one-of)
- CI 가 해당 에러 상태로는 배포 차단

**실패 시 수정 대상**: `permission-system.md`의 `perm-constraint-dkg` — CON-001 enforcement 시점(schema validate vs runtime)을 고정. runtime enforcement만 있으면 schema 단계에서 위반이 슬립.
