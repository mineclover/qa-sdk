---
def:
  id: meta-semantic-concepts-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [scenario, meta-semantic, concepts]
  links:
    - target: meta-semantic-concepts
      type: refines
    - target: meta-semantic-system
      type: depends_on
  sources:
    - packages/core/src/meta-semantic/ir-types.ts
    - packages/core/src/meta-semantic/ir-rule-validation.test.ts
    - packages/core/src/meta-semantic/ir-validate.ts
    - packages/core/src/meta-semantic/ir-validate.test.ts
    - packages/core/src/meta-semantic/spacetime-uid.ts
    - packages/core/src/meta-semantic/spacetime-uid.test.ts
---

# Meta-Semantic Concepts — 소비자 기대 시나리오

## 목적 ^purpose

`meta-semantic-concepts`(데이터 패싯, 바운더리, 계약 하향, Folding, 검증 단위, 분기 경로, Spacetime UID, 파이프, 이벤트 9개 원자 개념)가 `meta-semantic-system`에 의존할 때 기대하는 계약. 9가지 concept 은 meta-semantic-system 이 제공하는 2-layer 체계(수집/해석), scope→aspect 분류, layer/concern 정의와 정합적으로 연결되어야 한다.

## 시나리오 1: 데이터 패싯 역할 분리 강제 ^overview

**전제**: `meta-semantic-system`이 레이어 1(수집)에서 "데이터 패싯이 역할을 분리" 함을 선언.

**동작**: IR 추출 중 한 데이터 단위가 생산/소비/저장 3역할을 동시에 담당하는 코드를 만남.

**기대**:
- 데이터 패싯 분리 규칙 위반 → warning 또는 error (정책에 따름)
- 자동 분리 불가 시 분석 중단 + 메시지에 어느 역할이 혼합되어 있는지 기재
- 생산/소비 분리 후 Spacetime UID 가 각각 부여

**실패 시 수정 대상**: `meta-semantic-system.spec.md` §"레이어 1" — 역할 분리 정책이 수집 단계에서 선언되지 않으면 concepts 가 분리를 자체 판단해야 함.

## 시나리오 2: 바운더리 - 검증 가능 단위 ^overview

**전제**: `meta-semantic-system`이 "바운더리가 일부 패싯을 가진 검증 가능 기능 단위" 로 규정.

**동작**: `ms-concept-boundary` 가 패싯 집합으로부터 바운더리 후보를 생성.

**기대**:
- 패싯 집합이 검증 가능 조건(입출력 결정성) 충족 시 바운더리 등록
- 계약 하향 원칙(부모 계약 → 자식 계약)이 바운더리 계층에서 적용
- 순환 계약(바운더리 A → B → A)은 scope-nesting-system 과 동일 규칙으로 reject

**실패 시 수정 대상**: `meta-semantic-system.spec.md` — "검증 가능" 의 판정 기준이 수집 레이어 문서에 없으면 concepts 가 임의 기준으로 바운더리를 생성.

## 시나리오 3: Folding 인터페이스 끌어올림 ^overview

**전제**: `meta-semantic-system`의 Semantic Folding 이 "모듈/파이프가 하위 패싯을 접어 인터페이스로 끌어올리는 개념" 을 선언.

**동작**: ModuleIR 빌드 시 하위 DataIR 패싯을 fold 하여 외부 인터페이스만 노출.

**기대**:
- Fold 된 패싯은 상위에서 직접 접근 불가 (encapsulation)
- 하위 패싯 변경 시 상위 인터페이스 변경 없으면 소비자 영향 없음
- Fold 경계 누락 → "inadequate boundary" warning

**실패 시 수정 대상**: `meta-semantic-system.spec.md` §"Semantic Folding" — Fold 경계 정의가 concepts 가 아닌 concrete IR 에 위임되면 적용 일관성 저하.

## 시나리오 4: Spacetime UID 주소 부여 ^overview

**전제**: `meta-semantic-system`이 "분기 경로 + 시간 축 주소 = Spacetime UID" 를 정의.

**동작**: 한 데이터 단위가 여러 분기 경로에서 생성될 때 각 경로에 UID 부여.

**기대**:
- 분기 경로 a vs b → 서로 다른 UID (경로 합산, 전곱 아님)
- 같은 분기 경로 반복 실행 → 같은 UID 재사용
- 시간 축 전진 시 UID suffix 로 sequence 추가 (같은 공간, 다른 시점)

**실패 시 수정 대상**: `meta-semantic-system.spec.md` §"분기 경로 기반 주소 체계" — "경로 합산, 전곱 아님" 원칙이 명문화되지 않으면 concepts 가 전곱 주소 체계로 구현하여 공간 폭발.
