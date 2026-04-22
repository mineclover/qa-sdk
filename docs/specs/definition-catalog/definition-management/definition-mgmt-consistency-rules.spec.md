---
def:
  id: definition-mgmt-consistency-rules
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: definition-management
      type: refines
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: service-definition-standard
      type: depends_on
    - target: definition-taxonomy
      type: depends_on
    - target: definition-state-model
      type: depends_on
    - target: definition-mgmt-feedback-loop
      type: depends_on
---

# Definition Management — 일관성 규칙

## 목적 ^purpose

definition 관리 전반에서 깨지면 안 되는 일관성 규칙을 정리한다. 좌표 불변, 단일 개념 원칙, 상태 좌표화, 피드백 순환 유지 조건을 명시한다.

## 구성 ^overview

- 좌표 주소 불변
- 문서 단위 단일 개념
- E/C/I/S + L/P 중심 분할
- Architecture-revealing code convention
- 문서-코드 공동 분할
- 상태 변경의 좌표화
- 피드백 순환 유지

## 좌표 주소는 불변

scope × aspect × depth가 주소를 결정한다. 한번 부여된 주소는 변하지 않는다. level, lifecycle, tags, revision/version은 메타데이터이므로 주소에 포함하지 않는다.

## 모든 정의는 하나의 개념

문서든 코드 단위든 하나의 개념과 그 구성을 참조하는 완결된 정의여야 한다. 여러 개념이 섞이면 분할한다.

## 분할의 기준점은 E/C/I/S + L/P다

문서 분할은 임의의 목차나 파일 크기가 아니라 **System이 무엇을 소유하고, Interface가 무엇을 소비 계약으로 노출하며, Component/Entry가 어떤 데이터와 식별자를 제공하는가**를 먼저 정한 뒤 수행한다. I는 별도 tier가 아니라 `scope: interface`와 DSL/rule/spec 계약 평면이다.

판정 순서:

1. **System**: 독립 동작/변환/검증/저장/배포 책임을 가진 owner boundary를 찾는다.
2. **Interface / DSL (I)**: System을 어떻게 소비할지 정하는 API/CLI/event/rule/contract 평면을 분리한다.
3. **Component**: Interface와 System이 참조하는 data shape, state enum, evidence shape, validation vocabulary를 분리한다.
4. **Entry / Identity (E)**: 고정 ID, 유한 값, singleton identity처럼 안정 식별자만 별도로 분리한다. ECS 설명에서만 Entity라고 부른다.
5. **Layout / Pack (L/P)**: 여러 System 또는 문법 조각을 조망/배치할 뿐, 세부 behavior/data ownership을 갖지 않는다. Layout은 `tier: layout`, Pack은 배포/문서 묶음 이름으로 쓰는 layout-like 조직 단위다.

좋은 분할은 다음 형태를 따른다:

```text
<domain-or-service>-system          # S: behavior / transforms / runtime ownership
  ├── <domain>-interface            # Interface: API/CLI/event/rule/DSL contract
  ├── <domain>-component-state       # C: state enum / data shape / evidence shape
  ├── <domain>-component-schema      # C: schema or validation vocabulary
  └── <domain>-entry-*               # E: stable ids or finite values, only when needed
```

반대로 Layout/Pack에서 바로 세부 문서를 대량 소유하거나, system끼리 contains로 묶거나, Interface 문서에 data shape와 runtime behavior를 함께 넣으면 책임 경계가 흐려진다.

## 문서 분할은 코드 boundary 분할과 함께 닫는다

문서를 E/C/I/S + L/P로 나눴는데 구현 코드가 여전히 하나의 거대 파일/함수에 섞여 있으면 분할은 미완료다. 각 분할 단위는 가능하면 자기 구현 boundary와 테스트 boundary를 가져야 한다. 코드 작성 자체도 `architecture-revealing-code-convention`을 따른다.

판정 기준:

- 새 Interface/Component/System 문서의 `source:` 또는 `@def.doc`가 거대 shared 파일 전체만 가리키면 코드 분할 후보로 본다.
- 한 source file이 서로 다른 owner system 또는 서로 다른 E/C/I/S + L/P 문서 3개 이상을 동시에 담당하면 system/interface/component/layout split 또는 adapter split을 검토한다.
- 문서가 `contains`로 나뉘면 코드도 public operation, adapter, validator, projector, test fixture 같은 안정된 boundary로 나눌 수 있는지 확인한다.
- 코드 분할이 아직 불가능하면 문서에는 그 이유와 후속 `todo`를 남기고, 개별 문서가 코드 전체를 자기 것처럼 소유한다고 쓰지 않는다.

좋은 완료 상태:

- System 문서: behavior ownership과 runtime boundary를 설명한다.
- Interface 문서: 소비 계약과 문법을 설명한다.
- Component 문서: data/state/evidence/schema vocabulary만 설명한다.
- Entry 문서: 안정 식별자 또는 유한 값만 설명한다.
- BDD contract: System behavior의 결정론적 의미를 설명한다.
- Event vocabulary/mapping pack: event key와 관측 vocabulary를 설명한다.
- code boundary: 한 파일/모듈이 한 개념 또는 한 안정된 역할을 담당한다.
- test boundary: `test-split` 기준으로 source boundary 또는 BDD contract 단위와 맞는다.

서비스 단위 표준 슬롯은 `service-definition-standard`를 따른다. 이 문서는 E/C/I/S + L/P 일관성 규칙을 소유하고, 서비스별 family의 구체 슬롯 목록은 service-definition-standard가 소유한다.

## 코드 구조는 책임을 드러낸다

코드 모듈화는 문서 분할의 충분조건이 아니다. 하지만 코드가 이미 모듈화되어 있다면 그 모듈은 E/C/I/S + L/P 중 어떤 책임을 맡는지 드러나야 한다.

- `types`, `schema`, `state`, `evidence` 파일은 Component 책임을 드러낸다.
- `commands`, `routes`, `events`, `ports` 파일은 Interface 책임을 드러낸다.
- `traverse`, `project`, `validate`, `sync`, `activate`, `write` 파일은 System behavior 책임을 드러낸다.
- `index`, `pack`, `manifest`, `registry` 파일은 Layout/Pack 조립 책임을 드러낸다.
- helper/util 파일은 독립 문서가 아니라 가장 가까운 owner 문서의 implementation topology로 기록한다.

문서는 이 코드 구조를 복제하지 않고 책임 경계만 좌표화한다.

## 행동과 이벤트 책임 분리

E/C/I/S + L/P에서 행동과 이벤트는 같은 것이 아니다.

| 대상 | 소유 위치 | 정의 |
|------|-----------|------|
| operation | Interface / DSL | System을 호출하거나 질의하는 public command/query/event input |
| behavior | BDD contract + System | given/when/then으로 고정되는 결정론적 결과 |
| event | Event vocabulary / mapping pack | 발생하거나 관측된 사실의 key와 taxonomy |
| state/data | Component | behavior가 읽고 쓰는 상태, 데이터 shape, evidence shape |
| id/value | Entry / Identity | 안정 식별자, finite value, singleton |

규칙:

- 행동의 SSOT는 `bdd_contract`다.
- 이벤트의 SSOT는 core event vocabulary 또는 service mapping pack/adoption이다.
- `when.operation`은 Interface가 노출한 operation을 참조한다.
- `when.event_key`와 `then.emits`는 event vocabulary/mapping pack에 존재해야 한다.
- `then.state`, `then.returns`, `then.egress`가 참조하는 shape는 Component가 소유한다.
- System 문서는 behavior ownership과 runtime boundary를 소유하지만, event vocabulary나 data shape를 새로 정의하지 않는다.

## 모든 상태 변경은 좌표화

하네스 전이, 게이트 실행, 그래프 변경, 수렴 분석은 모두 prefix 좌표가 있어야 한다. "언제 어디서 무엇이 변했는가"를 좌표로 추적할 수 있어야 한다.

## 피드백은 순환

관측 → 분석 → 의사결정 → 문서 갱신 → 코드 변경 → 관측. 어느 지점에서 시작해도 순환이 끊어지지 않아야 한다.
