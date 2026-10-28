---
name: bdd-contract
description: "BDD 계약 기반 테스트/구현 단위 설계. Given/When/Then을 결정론적 contract로 정규화하고, .cases.md/.test.md에서 test unit과 implementation unit을 도출한다. 트리거: BDD, Given/When/Then, behavior contract, 테스트 단위, 구현 단위, .cases.md, .test.md."
---

# BDD Contract — 테스트/구현 단위 설계

BDD를 자연어 테스트 설명이 아니라 **행동 계약**으로 다룬다. 목표는 `Given / When / Then`을 모호하지 않은 contract로 정규화하고, 그 contract에서 테스트 단위와 구현 단위를 함께 도출하는 것이다.

## 사용 시점

- 새 기능을 테스트 우선으로 구현할 때
- `.cases.md` / `.test.md`를 작성하거나 보강할 때
- user story나 PRD acceptance criteria를 테스트 단위로 쪼갤 때
- AI agent가 production code를 쓰기 전에 행동 계약을 고정해야 할 때
- 구현 단위가 너무 크거나 계층을 무너뜨릴 위험이 있을 때

## 기본 원칙

1. BDD contract가 SSOT다. prose보다 정규 YAML block이 우선한다.
2. 한 scenario의 primary `When`은 하나다. 여러 action이면 scenario를 쪼갠다.
3. write-mode contract는 happy path와 failure path를 모두 가진다.
4. 테스트 단위와 구현 단위는 같은 contract id를 공유한다.
5. 새 state/event/axis를 임의로 만들지 않는다. 없으면 계약 보강 또는 escalation.
6. DSPy/LLM output은 contract 후보일 수 있지만 approved contract가 아니다.
7. BDD는 behavior를 소유하고 event vocabulary를 소유하지 않는다. `when.event_key`와 `then.emits`는 event catalog/mapping pack을 참조한다.

기계화 구현이 있는 repo에서는 parser/validator가 `metadata.bdd.contracts`, `metadata.bdd.testUnits`, `metadata.bdd.implementationUnits`를 생성한다. 이 repo에서는 `qa-sdk docs bdd ...`가 공식 read-only surface다. 없으면 이 skill의 템플릿을 기준으로 문서를 먼저 보강한다.

## 작업 흐름

### 1. 컨텍스트 수집

우선 관련 문서를 읽는다.

```bash
qa-sdk def get <spec-id>
qa-sdk docs status <spec-id> --json
qa-sdk docs collect <spec-id> --family-only --json
qa-sdk docs bdd list <spec-id> --family-only --json
```

확인할 것:

- owning system (`owner_system`)
- 관련 `.spec.md`, `.cases.md`, `.test.md`
- state component (`state-enum`)
- public operation / event contract
- `depends_on` provider와 소비자 기대
- 기존 test file과 source refs

### 1.5. 기계화 surface 확인

BDD block이 이미 있거나 보강한 뒤에는 CLI read model을 먼저 확인한다.

```bash
qa-sdk docs bdd list <spec-id> --family-only --json
qa-sdk docs bdd validate <spec-id> --family-only --json
qa-sdk docs bdd units <spec-id> --family-only --json
```

필요할 때만 preview surface를 사용한다.

```bash
qa-sdk docs bdd compile <spec-id> --family-only --format both --json
qa-sdk docs bdd test-plan <spec-id> --family-only --json
qa-sdk docs bdd impl-plan <spec-id> --family-only --json
```

판정:

- `validate`는 source truth를 수정하지 않고 diagnostics만 낸다.
- `test-plan`과 `impl-plan`은 preview다. 실제 test/source file write authority가 아니다.
- lifecycle/work-topic 상태는 `docs status`/`docs collect`에서 보고, contract grouping은 `docs bdd`에서 본다.

### 2. BDD Contract 정규화

`.cases.md` 또는 `.test.md`에 fenced `yaml bdd` block을 만든다. 단수/복수 key 모두 허용되지만, 여러 contract/unit이면 복수형을 선호한다.

```yaml
bdd_contract:
  id: <entity>.<from-state-or-context>.<operation>.<outcome>.v1
  owner_system: <system-id>
  contract_kind: state-transition | query-projection | event-reaction | validation-failure | dependency-contract
  mode: read | write
  links:
    spec: <spec-id>
    state_component: <state-component-id>
    transition_ref: <pipe-doc>#<transitionId>

  given:
    state_component: <state-component-id>
    state: <FINITE_STATE>
    predicates:
      - <stable.predicate.id>

  when:
    actor: <actor-id>
    operation: <system.operation>
    event_key: <event.key>

  then:
    state: <FINITE_STATE>
    returns: {}
    emits: []
    egress: []
    invariants: []
```

### 3. Test Unit 도출

각 BDD contract에서 테스트 단위를 하나 이상 만든다.

| contract kind | 기본 test unit |
|---------------|----------------|
| `state-transition` | unit 또는 integration: source state → operation → target state |
| `query-projection` | unit: fixture → query operation → return shape |
| `event-reaction` | integration: event input → emitted event / egress |
| `validation-failure` | unit: invalid given/when → error |
| `dependency-contract` | contract/integration: consumer expectation against provider |

테스트 단위 템플릿:

```markdown
### TU-001: <contract-id>

- **contract**: `<bdd_contract.id>`
- **level**: unit | integration | e2e
- **given fixture**: `<fixture-id>`
- **when**: `<operation-or-event>`
- **assertions**:
  - `then.state`
  - `then.returns`
  - `then.emits`
  - `then.egress`
- **test file**: `packages/<pkg>/src/<target>.test.ts`
```

테스트 작성 규칙:

- test title에 `[contract:<id>]`를 포함한다.
- `Then` 필드마다 최소 하나의 assertion을 둔다.
- failure path는 success path와 별도 test로 둔다.
- browser 흐름이면 이 skill로 contract를 먼저 고정한 뒤 `e2e-test` skill을 사용한다.

### 4. Implementation Unit 도출

각 BDD contract에서 구현 단위를 명확히 분리한다.

| BDD 필드 | 구현 단위 |
|----------|-----------|
| `given.predicates` | guard/predicate function |
| `when.operation` | System public operation |
| `when.event_key` | event handler / pipe trigger |
| `then.state` | state transition write or read projection |
| `then.emits` | event emitter unit |
| `then.egress` | repository/write adapter unit |
| `then.invariants` | postcondition check or test-only assertion |

구현 단위 템플릿:

```markdown
### IU-001: <operation-or-function>

- **contract**: `<bdd_contract.id>`
- **unit kind**: guard | operation | transition | emitter | repository | projection
- **owned by**: `<owner_system>`
- **source target**: `packages/<pkg>/src/<file>.ts`
- **inputs**: from `given` + `when.input`
- **outputs/effects**: from `then`
- **must not own**: unrelated state/event/axis changes
```

구현 규칙:

- `When` 하나는 public operation 하나를 기준으로 구현한다.
- guard, operation, persistence, emitter를 한 함수에 과도하게 섞지 않는다.
- state enum은 Component 문서/코드 enum과 일치해야 한다.
- `then.emits`가 있으면 event contract 또는 TransitionDef가 있어야 한다.
- `then.egress`가 있으면 저장/안착 target이 명시되어야 한다.
- contract 밖 behavior가 필요하면 새 BDD contract를 만든다.

### 5. 검증

최소 검증:

```bash
qa-sdk docs bdd validate <spec-id> --family-only --json
qa-sdk docs bdd units <spec-id> --family-only --json
pnpm --filter <pkg> test
pnpm --filter <pkg> typecheck
qa-sdk def validate
```

문서/테스트 연결 확인:

```bash
qa-sdk docs status <spec-id> --json
qa-sdk docs collect <spec-id> --family-only --json
qa-sdk docs bdd compile <spec-id> --family-only --format both --json
```

## 체크리스트

- [ ] 각 scenario에 `bdd_contract.id`가 있다.
- [ ] `Given`의 state와 predicate가 finite/stable이다.
- [ ] `When`이 하나의 operation/event다.
- [ ] `Then`이 state/returns/emits/egress/invariants로 분리돼 있다.
- [ ] write-mode에 failure scenario가 있다.
- [ ] test unit이 contract id를 참조한다.
- [ ] implementation unit이 contract id를 참조한다.
- [ ] `qa-sdk docs bdd validate`가 blocking diagnostics를 보고하지 않는다.
- [ ] `qa-sdk docs bdd units`가 contract별 test/implementation unit을 묶어 보여준다.
- [ ] implementation unit이 owner system 경계를 넘지 않는다.
- [ ] 새 state/event/axis를 만들면 별도 결정 절차를 밟는다.

## 다른 skill과의 조합

- 브라우저/E2E가 필요하면: 먼저 `bdd-contract`, 다음 `e2e-test`
- 구현 후 문서가 코드와 drift 날 수 있으면: `spec-lifecycle`
- 문서 관계/contains/refines가 필요하면: `def-context`, `def-link`
- test file이 너무 커지면: `test-split`
