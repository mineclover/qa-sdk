---
def:
  id: scaffold-domain-development-convention
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, domain-slice, ddd, cqrs, adapter-boundary, convention, structural]
  links:
    - target: scaffold-system
      type: refines
    - target: scaffold-domain-schematic
      type: constrains
    - target: scaffold-architecture-validator
      type: depends_on
    - target: scaffold-governance-metadata
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
  sources:
    - architecture-samples/domain-slice-monorepo
---

# scaffold domain development convention

## 목적 ^purpose

이 규칙은 Domain Slice Architecture의 코드 레이어를 qa-sdk definition-catalog의 책임 토폴로지(Responsibility Topology)에 매핑하는 개발 컨벤션이다. Domain Slice Architecture는 DDD-inspired 도메인 모델링, CQRS read/write 분리, adapter boundary, Nest module assembly, governance metadata를 하나의 생성 단위로 묶는 사내 표준 구조다.

## 구성 ^overview

Domain Slice Architecture와 책임 토폴로지는 같은 개념의 다른 이름이 아니다. Domain Slice Architecture는 런타임 코드의 의존 방향, 비즈니스 모델 경계, adapter 배치, governance 산출물을 설명하고, 책임 토폴로지는 문서/정의/source boundary가 어떤 책임을 소유하는지 판정한다. 현재 책임 토폴로지의 vocabulary는 E/C/I/S + L/P이지만, 분류 구조가 바뀌어도 scaffold의 상위 개념명은 유지한다.

| Domain Slice Architecture 개념 | 코드 책임 | 책임 토폴로지 판정 |
|--------------------|-----------|--------------------|
| Bounded Context | 여러 aggregate, use case, port, adapter를 묶는 독립 업무 경계 | 조립/카탈로그만 있으면 Layout/Pack, 자체 런타임 정책을 소유하면 System |
| Aggregate Identity, enum, closed value | 안정 식별자와 유한 vocabulary | Entry / Identity |
| Value Object, snapshot, read model DTO | data/state/evidence shape | Component |
| Aggregate Root invariant, state transition | 순수 도메인 behavior | System |
| Command, Query, Event, HTTP contract | 외부 소비 계약과 입력 vocabulary | Interface / DSL |
| RepositoryPort, OutboxPort, ReadModelPort | application이 요구하는 outbound contract | Interface / DSL |
| UseCase, CommandHandler, Projector | orchestration, policy decision, state transition 호출 | System |
| Drizzle schema, table projection shape | persistence data shape | Component |
| Repository adapter, outbox adapter, read model sync worker | port 구현과 외부 IO boundary | System |
| Nest module, barrel export, OpenAPI fragment pack, metadata seed manifest | 조립/노출/배치 | Layout/Pack |

## 최소 구현 순서

도메인 scaffold는 처음부터 모든 adapter를 완성하지 않더라도 다음 순서를 지킨다.

1. Identity/Value/State Component를 먼저 만든다.
2. Aggregate invariant와 상태 전이를 pure System으로 둔다.
3. Command/Query/Event Interface를 정의한다.
4. UseCase System이 Interface input을 받아 aggregate behavior를 호출한다.
5. Repository/Outbox/ReadModel Port를 Interface로 고정한다.
6. Drizzle schema Component와 repository adapter System을 분리한다.
7. Controller 같은 presentation adapter는 Interface input을 application System에 위임한다.
8. Nest module과 `index.ts`는 Layout/Pack으로 조립만 한다.
9. read model이나 data asset이 생기면 OpenMetadata seed와 cache key DSL manifest를 함께 둔다.
10. 다른 도메인 상태를 근거로 쓰기 모델을 실행해야 하면 query port와 version precondition을 먼저 고정한다.

## 디렉터리 규칙

표준 도메인 slice는 파일명이 책임을 숨기지 않게 둔다.

```text
src/modules/<domain>/
  domain/
    <domain>.ids.ts
    <domain>.types.ts
    <domain>.entity.ts
    <domain>.entity.spec.ts
    <domain>.exceptions.ts
    index.ts
  application/
    commands/*.command.ts
    queries/*.query.ts
    ports/*.port.ts
    use-cases/*.use-case.ts
  infrastructure/
    persistence/*.schema.ts
    persistence/*.repository.ts
    outbox/*.outbox.ts
    transaction/*.drizzle-transaction.ts
    transaction/*.transaction.ts
    transaction/*.unit-of-work.ts
    logging/*.logger.ts
    read-model/*.read-model.ts
  presentation/
    http/*.controller.ts
    bff/*.bff.ts
    bff/*.controller.ts
  contracts/
    openapi/domains/<domain>/spec.json
  metadata/
    openmetadata.seed.json
  <domain>.module.ts
```

- `*.ids.ts`는 Entry / Identity만 둔다.
- `*.types.ts`, `*.schema.ts`, read model DTO는 Component만 둔다.
- `*.entity.ts`, `*.use-case.ts`, `*.repository.ts`, `*.outbox.ts`는 System behavior를 소유한다.
- `*.entity.spec.ts`는 domain behavior를 application 없이 검증하는 test evidence다.
- `*.transaction.ts`, `*.logger.ts`, `*.read-model.ts` infrastructure adapter는 System behavior를 소유한다.
- `*.drizzle-transaction.ts`는 운영 DB transaction client와 application transaction scope를 연결하는 adapter다.
- `*.command.ts`, `*.query.ts`, `*.port.ts`, `*.controller.ts`는 Interface boundary를 드러낸다. 단, controller는 adapter behavior가 커지면 System 문서로 분리한다.
- BFF는 read model을 UI-facing model로 조합하되 domain entity와 persistence write를 직접 다루지 않는다.
- `index.ts`, `<domain>.module.ts`, OpenAPI domain fragment, metadata manifest는 Layout/Pack이며 business logic을 넣지 않는다.

## 의존 방향

- `domain`은 NestJS, Drizzle, HTTP, queue, logger 구현체를 import하지 않는다.
- `application`은 `domain`과 application-owned `ports`만 import한다.
- `infrastructure`는 application port를 구현하지만 application으로 역전파되는 concrete type을 노출하지 않는다.
- `presentation`은 application use case나 inbound port만 호출한다.
- bounded context 외부에서는 deep import 대신 public interface 또는 pack export를 사용한다.
- 상대 경로뿐 아니라 `@modules/<domain>/domain/*`, `@modules/<domain>/infrastructure/*` 같은 path alias deep import도 금지한다.

## 로깅 규칙

로깅은 infrastructure helper를 직접 호출하지 않고 application-owned logger port로 기록한다. use case와 BFF 같은 orchestration boundary가 표준 이벤트 vocabulary를 남긴다.

쓰기 흐름은 다음 순서를 따른다.

```text
controller
  -> use case
    -> logger.record(started)
    -> transaction.run()
      -> repository.save()
      -> outbox.appendCreated()
    -> logger.record(success)
    -> failure면 logger.record(failure)
```

- command 로그는 `traceId`, `correlationId`, `domain`, `useCase`, `aggregateId`, `commandName`, `outcome`을 포함한다.
- domain event가 발생하면 `eventName`, `eventVersion`을 함께 기록한다.
- 실패 로그는 표준 `errorCode`를 포함한다.
- BFF/query 로그는 `queryName`, `cacheKeyPrefix`, `cacheHit`, `outcome`을 포함한다.
- 로그 메시지 문자열보다 구조화된 vocabulary를 우선한다.

## API 계약 규칙

OpenAPI는 controller 구현 덤프가 아니라 consumer contract다.

- scaffold는 domain-local fragment를 `contracts/openapi/domains/<domain>/spec.json`에 생성한다.
- shared API surface에 합류할 때 `qa-scaffold promote-openapi <source> --contracts-root packages/contracts`로 중앙 contracts package에 승격한다.
- 중앙 contracts layout은 `base.openapi.json`, `profiles/<profile>.json`, `domains/common/spec.json`, `domains/<domain>/spec.json`을 병합한다.
- `common`은 먼저 병합하고 나머지 domain은 이름순으로 병합한다.
- path/component 충돌은 실패해야 한다.
- OpenAPI schema는 domain entity나 entity snapshot을 직접 노출하지 않는다. command DTO, query DTO, BFF response DTO만 노출한다.

## Cross-Domain Precondition 규칙

도메인 B의 쓰기가 도메인 A의 상태에 의존하면 B는 A의 persistence, entity, repository를 직접 import하지 않는다. B application은 A 상태를 query port, local projection, 또는 saga/process manager가 제공하는 contract로 관찰한다.

```text
B UseCase
  -> AssignmentStateQueryPort.findById()
  -> observed.version >= requiredVersion 확인
  -> observed.status 같은 billable 조건 확인
  -> B aggregate write
```

- A 상태가 B invariant에 필수이면 stale read model을 그대로 믿지 않는다.
- command에는 `required<Domain>Version` 또는 equivalent precondition token을 둔다.
- observed version이 부족하면 `PRECONDITION_NOT_READY` 계열 named exception으로 지연/재시도 가능 상태를 반환한다.
- observed 상태가 최신이지만 업무 조건을 만족하지 않으면 `NOT_BILLABLE`, `NOT_ALLOWED` 같은 domain named exception으로 거부한다.
- A/B 쓰기가 하나의 장기 비즈니스 프로세스면 saga/process manager로 분리한다.

## 테스트 단위 규칙

테스트는 source boundary 또는 behavior responsibility 기준으로 분리한다. 한 파일이 여러 책임을 섞기 시작하면 분리한다.

```text
<domain>-domain.test.ts              # 순수 entity/state transition/named exception
<domain>-use-case.test.ts            # application orchestration, port, logging
<domain>-unit-of-work.test.ts        # commit/rollback, outbox storage encapsulation
<domain>-drizzle-transaction.test.ts # DB transaction client mapping
<domain>-bff.test.ts                 # read model -> UI-facing composition
<domain>-projector.test.ts           # event -> read model projection
<domain>-cross-domain-precondition.test.ts # A read/version -> B write precondition
openapi-merge.test.mjs               # contract merge collision rules
```

- domain behavior는 application 없이 테스트한다.
- use case 테스트는 fake port로 transaction scope 전달과 logging outcome을 검증한다.
- infrastructure 테스트는 adapter와 unit-of-work commit/rollback을 검증한다.
- BFF 테스트는 domain entity 미노출, cache key, query logging vocabulary를 검증한다.
- cross-domain 테스트는 stale version, non-billable state, success path를 모두 포함한다.

## 시나리오 추적 규칙

use case는 시나리오 문서와 테스트 evidence에 연결되어야 한다. 시나리오 문서는 use case가 왜 존재하는지와 어떤 테스트가 그 behavior를 증명하는지 추적하는 BDD contract다.

`docs/scenarios/*.md`는 다음 섹션을 둔다.

```text
# Scenario: <name>

## Purpose

## Traceability

Use cases:
- <source path>#<symbol>

Tests:
- <test path>

Contracts:
- <OpenAPI/metadata/port/command path>

## Given
## When
## Then
```

- `application/use-cases/*.use-case.ts`는 최소 하나의 scenario 문서에서 `Traceability`로 참조한다.
- cross-domain behavior는 별도 scenario로 분리한다.
- scenario의 Tests 항목은 실제 테스트 파일을 가리킨다.
- scenario의 Contracts 항목은 OpenAPI fragment, command DTO, query port, metadata seed처럼 외부 계약이 되는 파일을 가리킨다.
- use case 구현이 바뀌면 관련 scenario와 test evidence를 함께 갱신한다.

## 리뷰 판정

다음 신호가 있으면 scaffold template 또는 소비 프로젝트 코드를 수정한다.

- Entity가 HTTP response, OpenAPI schema, query read model로 직접 노출된다.
- BFF가 domain entity를 반환하거나 persistence write를 수행한다.
- Component 파일에서 IO, transaction, queue publish, lock control을 수행한다.
- Interface 파일에서 business invariant나 persistence write를 수행한다.
- Layout/Pack 파일에 조건 분기 많은 behavior가 들어간다.
- application layer가 Drizzle schema, repository adapter, Nest provider token에 직접 의존한다.
- use case가 transaction/logger infrastructure helper에 직접 의존한다.
- read model이 있는데 OpenMetadata seed, lineage, cache key DSL 중 하나가 빠져 있다.
- bounded context를 넘는 상대 경로 deep import가 있다.
- 다른 도메인 쓰기를 위해 foreign repository/schema/entity를 직접 import한다.
- 다른 도메인 상태를 근거로 쓰면서 version precondition 또는 retry 가능한 실패 상태가 없다.
- API spec이 controller 구현체나 domain entity shape를 그대로 노출한다.
- 테스트 파일 하나가 domain/use-case/infra/BFF/projector 책임을 섞는다.

## scaffold 적용 기준

`@qa-sdk/scaffold`의 domain template은 이 문서를 기본 생성 규칙으로 삼는다. validator는 최소 import 위반을 먼저 잡고, 이후 단계에서 파일 suffix별 책임 토폴로지 위반과 OpenMetadata/cache key manifest 누락까지 확장한다.
