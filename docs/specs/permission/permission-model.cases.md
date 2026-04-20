---
def:
  id: permission-model-cases
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
    - target: permission-model
      type: refines
    - target: permission-system
      type: depends_on
---

# Permission Model — 소비자 기대 시나리오

## 목적 ^purpose

`permission-model`(PermissionSet + TernaryMask + ScopedEngine 3개 코어 타입)이 `permission-system`에 의존할 때 기대하는 계약. 모델은 permission-system이 제공하는 encoding, external 식별자, migration 경로와 일관성을 유지해야 의미 있는 상태 표현이 된다.

## 시나리오 1: PermissionSet bitmask 왕복 ^overview

**전제**: `permission-system`의 `permission-encoding`이 PermissionSet을 WeightedIndex 기반 bitmask로 인코딩하는 규약을 고정한다.

**동작**: role R을 flat permission list → PermissionSet bitmask → WeightedIndex encode → decode 후 permission list 복원.

**기대**:
- encode → decode 왕복이 identity (결정론적)
- bitmask 길이는 해당 service-ref의 권한 공간 capacity 이상
- capacity headroom ≤ 1 → warning, 0 → critical (좌표 컨벤션 준수)

**실패 시 수정 대상**: `permission-system.md` §"권한 모델" + `permission-encoding` — PermissionSet capacity 공식(`nextPowerOf2(entries × 2)`)이 규약으로 고정되어야 migration 시 인코딩 drift를 막는다.

## 시나리오 2: TernaryMask allow/deny/unset 의미 유지 ^overview

**전제**: `permission-system`이 TernaryMask 3진 값(allow=1, deny=-1, unset=0)을 도메인 state로 선언한다.

**동작**: 상위 role 이 allow, 하위 role 이 deny 를 override 하는 계층 평가.

**기대**:
- 같은 비트에 상위 allow + 하위 deny → 최종 deny (deny 우선)
- unset 은 "결정되지 않음" 으로 다음 scope에 해소 위임
- 3진 값 외의 값 주입 → 타입 에러 (discriminated union)

**실패 시 수정 대상**: `permission-system.md`가 deny 우선 규칙을 명문화. 규칙이 암묵적이면 엔진 구현이 allow 우선 / deny 우선 경로를 각각 시도.

## 시나리오 3: ScopedEngine 계층 상속과 override ^overview

**전제**: `permission-system`의 ScopedEngine 설계가 "상위 스코프 → 하위 스코프 상속, 하위에서 override 가능" 을 규정한다.

**동작**: `scope = [env, region, service]` 3계층에서 env 레벨 allow + region 레벨 deny 설정.

**기대**:
- 하위 scope 에서 상위 mask 를 직접 수정하지 않음 (불변 승계)
- override 는 현재 scope 의 덮어쓰기 벡터로 기록 (composition 경로 명시)
- 같은 (env, region, service) 입력 → 같은 최종 mask (결정론적)

**실패 시 수정 대상**: `permission-system.md`의 ScopedEngine 명세 — 상속/override 규칙이 mutable 편집을 허용하면 계층 계약 재현 불가.

## 시나리오 4: PermissionSet migration shape 보존 ^overview

**전제**: `permission-system`의 `perm-migration-system`이 PermissionSet shape migration을 `CoordMapper` 기반 자동 재배치로 수행.

**동작**: v1 → v2 로 permission 추가/제거가 있는 스키마 업그레이드.

**기대**:
- 기존 bit 할당 보존 (신규 bit 는 끝에 append 원칙)
- 삭제된 bit 는 `tombstone` 으로 유지 (bit index 재사용 금지)
- migration 실패 → rollback, partial write 없음

**실패 시 수정 대상**: `permission-system.md`의 `perm-migration-system` — tombstone 정책이 허술하면 bit 재사용으로 이전 세션의 권한 상태가 오염.
