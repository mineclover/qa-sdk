---
def:
  id: meta-semantic-ir-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  owner_system: meta-semantic-system
  tags: [scenario, meta-semantic, ir]
  links:
    - target: meta-semantic-ir
      type: refines
    - target: meta-semantic-system
      type: depends_on
---

# Meta-Semantic IR — 소비자 기대 시나리오

## 목적 ^purpose

`meta-semantic-ir`(ModuleIR + DataIR + PipeIR 3종 IR, DataRef/ModuleRef/PipeRef 참조 타입)이 `meta-semantic-system`에 의존할 때 기대하는 계약. IR 모델은 meta-semantic-system 이 제공하는 9개 원자 개념, scope→aspect 분류, layer 정의, WeightedIndex 좌표 규약 위에서 코드를 "의도 객체 네트워크" 로 표현해야 한다.

## 시나리오 1: Module·Data·Pipe 3종 IR 분해 ^overview

**전제**: `meta-semantic-system`이 "코드는 Module·Data·Pipe 3종 IR 로 분해" 된다고 선언.

**동작**: TypeScript 모듈 A 에서 IR extraction 파이프라인 실행.

**기대**:
- 모든 심볼이 3종 IR 중 하나로 분류 (unknown 없음)
- 분류 불가 심볼 → "unclassifiable" metric 증가 + 로그 (silent drop 금지)
- 3종 IR 간 참조는 ModuleRef/DataRef/PipeRef 전용 타입으로만 연결

**실패 시 수정 대상**: `meta-semantic-system.spec.md` §"method — 레이어 1" — 3종 분해가 전수(exhaustive)임을 보장하지 않으면 IR 이 기타 범주로 leak.

## 시나리오 2: 계약 하향 위임 + 트랜잭션 상향 전달 ^overview

**전제**: `meta-semantic-system`이 "계약은 하향 위임(parent→children), 트랜잭션은 상향 전달(pipe→module)" 규정.

**동작**: ModuleIR 계층에서 parent 계약 변경 시 자식 ModuleIR 에 전파, pipe 실행 결과 시간 축이 parent module 로 집계.

**기대**:
- 계약 상향 전파(자식 → 부모) 시도는 error (규약 위반)
- 트랜잭션 하향 전파(pipe → 독립 module) 시도는 error
- 위반 시 방향 위반 메시지 + 의도 확인 요구 (tag: intentional-override 허용)

**실패 시 수정 대상**: `meta-semantic-system.spec.md` §"정의" — 하향/상향 방향이 spec 이 아닌 convention 에만 있으면 IR validator 가 enforce 못함.

## 시나리오 3: DataIR 패싯 역할 분리 ^overview

**전제**: `meta-semantic-system`의 ms-concept-data-facets 가 "생산/소비/정의/관리/저장" 5역할을 고정.

**동작**: DataIR 빌드 시 각 데이터 단위에 role 부여.

**기대**:
- 5역할 외 role → reject
- 한 데이터 단위가 다중 역할을 가지면 DataRef 로 분리 등록
- 역할별 schema 분리 (생산 schema vs 저장 schema)

**실패 시 수정 대상**: `meta-semantic-system.spec.md` 의 `ms-concept-data-facets` — 5역할 목록이 spec 에 명확하지 않으면 DataIR 이 임의 역할 확장.

## 시나리오 4: WeightedIndex 좌표 재사용 ^overview

**전제**: `meta-semantic-system`의 `^consumes` 가 "WeightedIndex (weighted-index) — 좌표 압축" 을 명시.

**동작**: IR 의 Spacetime UID 를 WeightedIndex 로 압축 저장.

**기대**:
- 같은 IR 입력 → 같은 WI 좌표 (결정론적)
- capacity headroom 규약 준수 (nextPowerOf2 × 2)
- WI 버전 mismatch 시 IR 빌드 실패 (cross-version encode 금지)

**실패 시 수정 대상**: `meta-semantic-system.spec.md` — WI 의존이 consumes 로 명시되더라도 version policy 가 없으면 IR 이 latest version 을 가정하여 기존 데이터 decode 실패.
