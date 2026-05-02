---
def:
  id: permission-engine-spec-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [scenario, permission, engine]
  links:
    - target: permission-engine-spec
      type: refines
    - target: permission-system
      type: depends_on
---

# Permission Engine Spec — 소비자 기대 시나리오

## 목적 ^purpose

`permission-engine-spec`(다중 차원 Scope/Identity/Context 기반 정책 평가 엔진) 이 `permission-system`에 의존할 때 기대하는 계약. engine-spec 은 permission-model / permission-constraint 가 정의한 state 와 rule 을 받아 **평가 런타임** 을 수행하는 역할이며, 모델 정의(Wave 2 permission-model.cases.md) 및 비즈니스 제약(Wave 2 permission-constraint.cases.md) 과 직교한다.

## 시나리오 1: Scope × Identity × Context 3차원 결합 평가 ^overview

**전제**: `permission-system`의 ScopedEngine + perm-external-system 이 Scope(계층적 범위), Identity(role/principal), Context(런타임 속성) 3차원을 분리해 선언한다.

**동작**: 엔진이 `(subject, action, resource, scope, context)` 튜플을 입력받아 allow/deny 를 결정.

**기대**:
- 3차원 중 하나라도 누락 → 엔진이 명시적 에러 (silent deny 금지)
- 같은 튜플 입력 → 같은 결정 (결정론적, context 시점 제외)
- context 의 dynamic attribute(예: request-time) 는 결정에 포함되지만 cache key 에서 제외

**실패 시 수정 대상**: `permission-system.md`의 ScopedEngine + perm-external-system 분리 — 3차원 경계가 흐릿하면 엔진이 암묵적으로 context 를 scope 로 승격해 cache miss 폭증.

## 시나리오 2: 다중 role 평가의 우선순위 결정 ^overview

**전제**: `permission-system`의 TernaryMask 가 deny 우선 규칙을 선언(Wave 2 permission-model.cases 참조).

**동작**: 한 principal 에 여러 role 이 바인딩되고, 각 role 이 같은 resource 에 서로 다른 결정을 줌.

**기대**:
- deny 우선 — 어떤 role 이 deny 를 선언하면 최종 deny
- unset(결정되지 않음) 은 상위 scope 로 위임
- role 순서에 따른 결과 변경 없음 (평가가 가환적)

**실패 시 수정 대상**: `permission-system.md`의 TernaryMask deny 우선 규칙 — 규칙이 engine 레벨에서 해석되지 않으면 role 순서에 따른 비결정적 결정 발생.

## 시나리오 3: PermissionCodec 3-tier 스택 통합 ^overview

**전제**: `permission-system`의 `perm-codec-system`이 3-tier codec stack(encoding / bitmap / interop) 과 PrefixCodec/MetaCodec 상호운용 계약을 선언.

**동작**: 엔진이 외부에서 전달받은 serialized permission payload 를 역직렬화해 평가.

**기대**:
- 각 tier 의 codec 은 다음 tier 의 출력을 그대로 입력으로 수용 (stacked)
- codec 버전 불일치 → handshake 에서 에러 (silent upgrade 금지)
- MetaCodec 결과 는 PrefixCodec 으로 round-trip 가능 (identity)

**실패 시 수정 대상**: `permission-system.md`의 `perm-codec-system` — tier 간 입출력 계약이 spec 으로 고정되지 않으면 엔진이 특정 tier 를 bypass 해 decode 결과가 손상.

## 시나리오 4: Masking 정책의 응답 단계 적용 ^overview

**전제**: `permission-system`의 `masking-spec`이 클라이언트 측 payload 의 민감정보 마스킹 규칙을 선언.

**동작**: 엔진이 evaluate 에 allow 결정을 내린 뒤 response serialization 직전 masking 적용.

**기대**:
- 마스킹은 엔진의 최종 stage (allow 결정과 분리, deny 여도 마스킹 전 상태 노출 없음)
- 마스킹 규칙 불일치 시 기본 최대 마스킹 (fail-safe)
- 감사 로그 에는 unmasked raw payload 기록 금지 (마스킹 이후 값만)

**실패 시 수정 대상**: `permission-system.md`의 `masking-spec` + 엔진 스테이지 정의 — 마스킹이 엔진 외부 계층에서 수행된다면 엔진 응답이 raw 로 노출되어 계약 위반.
