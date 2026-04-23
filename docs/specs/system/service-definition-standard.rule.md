---
def:
  id: service-definition-standard
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
  tags: [structural, convention, architecture]
  links:
    - target: composition-hierarchy
      type: depends_on
    - target: definition-frontmatter-metadata-system
      type: depends_on
    - target: responsibility-closure-harness
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: event-intent-definition-rule
      type: depends_on
    - target: event-vocab-system
      type: depends_on
    - target: work-lifecycle
      type: depends_on
    - target: service-definition-standard-cases
      type: traces_to
---

# Service Definition Standard

## 목적 ^purpose

서비스를 정의할 때 반드시 드러나야 하는 표준 구성 요소를 정의한다. 목표는 서비스 문서가 단순 overview가 아니라 System ownership, Interface contract, Component data/state, Event/Payload/Insight, 운영/검증/closure까지 같은 구조로 반복되게 하는 것이다.

## 표준 구성 ^defines

서비스 정의는 최소 다음 슬롯을 가진다.

| 슬롯 | E/C/I/S + L/P 위치 | 소유 질문 | 대표 문서 |
|------|--------------------|-----------|-----------|
| service system | System | 이 서비스가 독립적으로 소유하는 behavior/runtime boundary는 무엇인가 | `<service>-system` |
| interface surface | Interface / DSL | 외부가 이 서비스를 어떻게 호출/소비하는가 | API/CLI/event contract |
| data/state component | Component | 서비스가 읽고 쓰는 상태, schema, evidence shape는 무엇인가 | state/data/schema spec |
| identity/entry | Entry / Identity | 안정 ID, finite value, singleton은 무엇인가 | entry/axis/prefix spec |
| behavior contract | BDD + System | Given/When/Then으로 닫히는 결정론적 동작은 무엇인가 | `.cases.md`, BDD block |
| event vocabulary | Event vocabulary / mapping pack | 어떤 일이 발생했다고 말하는가 | event/mapping/adoption spec |
| payload contract | Component / Payload guide | event를 해석하기 위한 증거 field는 무엇인가 | payload guide, component schema |
| insight/read model | System / Component | event/payload stream에서 무엇을 판단하는가 | insight/query/read-model spec |
| operations lifecycle | System / Flow | 배포, 설정, 검증, 관측, 장애 대응은 어떻게 하는가 | operations/runbook spec |
| closure evidence | Responsibility Closure | source/rule/test/cases/evidence가 같은 책임을 가리키는가 | `.test.md`, source mapping, `docs closure` |
| layout/pack view | Layout / Pack | 서비스와 하위/주변 시스템을 어떻게 조망하는가 | domain/system layout |

## Root Index Convention

서비스 family에는 selector가 도달할 수 있는 root index가 있어야 한다.

| selector | 권장 root |
|----------|-----------|
| `service:<svc>` | `<service>-system` 또는 동일 `svc`의 entry-point overview |
| `package:<pkg>` | 패키지/서비스 id에 대응하는 `<service>-system` 또는 root overview |
| `owner:<owner_system>` | owner boundary를 대표하는 system/layout |
| `family:<familyId>` | family 내부 entry-point overview |

루트 인덱스 문서는 다음을 만족하는 것이 좋다.

- `entry-point` 태그 또는 equivalent root 역할
- `depth: overview`
- `tier: system` 또는 `tier: layout`
- 다음 탐색 경로(Interface, Component, Event/Payload/Insight, Operations, Closure)를 guide할 수 있는 `^overview`

이 규칙은 Next.js의 폴더 기반 라우팅처럼 "경로/셀렉터가 먼저 root index에 도착하고, 그 다음 하위 구조를 따라 내려간다"는 탐색 모델을 문서화한 것이다.

## 작성 순서 ^method

1. **System boundary**를 먼저 정한다.
   서비스가 독립 behavior/runtime owner인지, 단순 component인지, layout/pack인지 판정한다.

2. **Interface**를 분리한다.
   API/CLI/event input, route, command, public query는 Interface가 소유한다. System behavior나 data shape를 Interface 문서에 섞지 않는다.

3. **Component data/state**를 분리한다.
   schema, state enum, payload/evidence shape, validation vocabulary는 Component가 소유한다.

4. **Behavior contract**를 작성한다.
   BDD contract는 frontend behavior unit, request path, then state/effect/event를 연결한다.

5. **Event/Payload/Insight**를 분리한다.
   Event는 semantic fact key, payload는 해석 증거, insight는 event stream을 해석한 판단 결과다.

6. **Operations/observability**를 붙인다.
   deploy/config/verify/observe/runbook은 service operation 문서가 소유한다.

7. **Closure를 확인한다.**
   `docs closure <service-system>`과 `def find-by-file <source>`로 source/rule/test/cases/evidence가 닫혔는지 본다.

## Event / Payload / Insight 구분

| 대상 | 정의 | 예 |
|------|------|----|
| event | 발생한 semantic fact. raw mutation이 아니라 requester/request path/data effect로 결정된다 | `policy.rule.disabled` |
| payload | event를 판단하기 위한 증거 envelope | requester, route, subject, effect_kind, changed_fields |
| insight | event/payload stream에서 파생된 판단 | `policy.disable.rate_spike`, `missing_actor_context` |

Backend가 `status: 1 -> 2`를 수행했다는 사실만으로는 event intent가 정해지지 않는다. request path, requester, frontend behavior unit, persistence outcome이 결합되어 event key와 alert routing이 결정된다.

## 표준 문서 family

서비스 하나는 보통 다음 family를 가진다.

```text
<service>-system.spec.md       # System boundary + overview
<service>-interface.spec.md    # API/CLI/event input contract
<service>-data.spec.md         # schema/state/evidence/payload component
<service>.cases.md             # behavior/use cases + optional BDD contracts
<service>.test.md              # provider-side validation mapping
<service>.rule.md              # service-specific consumption/policy rule
<service>.todo.md              # active implementation slice only
<service>-operations.spec.md   # deploy/config/verify/observe/runbook
```

모든 파일이 항상 필요한 것은 아니다. 하지만 슬롯 자체는 존재해야 하며, 생략할 때는 service system 문서에서 "해당 없음" 또는 참조 대상을 명시한다.

## Reference Scaffold

`qa-sdk init --nest-service <packages/<service>>`는 이 표준 구조의 baseline scaffold를 생성한다. 생성 범위는 `main.ts`, `AppModule`, `config/env.ts`, health endpoint, `api/application/infrastructure` 예시 domain, `@qa-sdk/nest-service-kit` wiring까지다.

템플릿은 시작 구조만 제공한다. 실제 서비스는 example domain 교체, outbox/event adapter 연결, service family docs 생성, closure evidence 연결을 별도로 수행해야 한다. 구체 scaffold behavior는 `nest-service-template`, bootstrap/event/port baseline은 `nest-service-kit`이 소유한다.

## Frontmatter 기준

| 슬롯 | 권장 metadata |
|------|---------------|
| service system | `type: design`, `tier: system`, `owner_system`, `svc`, `scope: feature|flow|data`, `depth: overview|specification` |
| interface | `scope: interface`, `aspect: api_contract|cli_contract|event_contract`, `tier: component|system` |
| component | `tier: component`, `scope: data|state|constraint`, `aspect`는 shape 성격에 맞춤 |
| layout/pack | `tier: layout`, `refs`만 사용 |
| rule | `.rule.md`, `scope: constraint`, `aspect: tech_constraint` |
| cases/test | `depth: validation`, `scope: flow|feature`, `aspect: user_scenario|scenario` |

개별 metadata option의 의미는 `definition-frontmatter-metadata-system`이 소유한다.

## 검증 ^constraint

```bash
qa-sdk def validate
qa-sdk def doctor
qa-sdk def topdown <service-system>
qa-sdk docs closure <service-system>
qa-sdk def find-by-file <service-source[:symbol]>
```

통과 기준:

- `def validate` errors/warnings 0
- `def topdown`에서 구조 member와 consumer가 구분됨
- `docs closure`가 `closed` 또는 의도적 deferred info만 남김
- source file 하나가 서로 다른 서비스/system 책임을 과도하게 소유하지 않음
