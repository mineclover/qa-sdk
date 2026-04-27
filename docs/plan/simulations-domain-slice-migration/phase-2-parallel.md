# Phase 2 — Parallel Slices

병렬, N 에이전트. Phase 1 에서 검증된 reference slice 패턴을 22개 슬라이스에 동시 적용한다.

## Dispatch 단위

- 1 에이전트 = 1 슬라이스
- 슬라이스 = `services/<svc>/src/<domain>/<slice>/`
- 각 에이전트는 독립 worktree(또는 동일 워크트리 내 독립 디렉터리)에서 작업
- 에이전트 간 통신/의존 없음 — 통과 기준은 자기 슬라이스의 검증 명령들

## 배치 전략

| 배치 | 슬라이스 | 비고 |
|---|---|---|
| Batch A — 단순 CRUD | pm/task, pm/member, document/document, document/comment, document/version, notification/notification, notification/subscription | cross-domain 의존 없음, 가장 단순 |
| Batch B — access control coupled | pm/project, approval/budget, approval/expense, approval/resource, approval/timeoff | resource-policy / 권한 coupling 보존 필요 |
| Batch C — auth core | auth/user, auth/role, auth/role-assignment, auth/department, auth/authenticate, auth/bitmap | 다른 service 가 의존하는 핵심 |
| Batch D — read model / BFF | reporting/report, reporting/metric, reporting/density, audit-browser/audit-explorer, audit-browser/graph-explorer | 위상이 read model 또는 BFF |

배치 간 직렬 dispatch 권장 (병렬 에이전트 수 제한). 한 배치 내부는 완전 병렬.

## Slice Spec Sheet (에이전트가 받는 입력)

각 에이전트는 다음 형식의 입력을 받는다. Phase 1 결과로부터 채운다.

```yaml
slice: <slice-name>
service: <svc>
domain: <domain>
parent_path: services/<svc>/src/<domain>
target_path: services/<svc>/src/<domain>/<slice>
reference_path: services/pm-api/src/pm/assignment

aggregate:
  name: <PascalCase>           # 예: Project, Task, Budget
  ids:                          # *.ids.ts 에 export 할 ID 타입들
    - <Name>Id
  state_transitions:            # 도메인 상태 머신
    - from: <state>
      to: <state>
      command: <CommandName>
  invariants:                   # entity 가 강제할 불변
    - <description>

commands:                       # application/commands/
  - name: <Verb<Noun>>Command   # 예: CreateProjectCommand
    use_case: <UseCaseMethod>
    emits_events: [<EventName>] # 빈 배열이면 outbox 미사용

queries:                        # application/queries/
  - name: <Noun>ReadModelQuery  # 빈 배열이면 read-model 슬라이스 아님
    return_shape: <type>

cross_domain_query_ports: []    # 다른 도메인 read 가 필요하면 ID로 명시
                                # 예: AssignmentStateQueryPort

http:                           # presentation/http/
  - method: POST
    path: /<resource>
    operation_id: <op>
  - method: GET
    path: /<resource>/:id

bff:                            # presentation/bff/  (없으면 빈 배열)
  - screen: <screen-id>
    composes: [<query-id>, ...]

persistence:
  table: <snake_case>           # drizzle 스키마 테이블명
  has_outbox: true|false        # 이벤트 emit 시 true
  dialects: [sqlite, pg]

openapi_fragment:
  path: contracts/openapi/src/domains/<slice>/spec.yaml
  base_from: <기존 fragment 있으면 경로, 없으면 신규>

om_seed:
  path: services/<svc>/src/<domain>/<slice>/metadata/openmetadata.seed.json
  glossary: [<term>: <definition>]
  lineage: [<edge>]
  cache_keys:
    - id: <slice>-read-model    # read model 있으면
    - id: <slice>-idempotency   # command 있으면

migration_from:                 # 기존 코드가 있으면 명시
  service_file: <path>
  controller_file: <path>
  shared_types_excerpt: <path>
  shared_port_excerpt: <path>

forbidden_paths:                # 에이전트가 절대 만지면 안 되는 경로
  - services/<svc>/src/<domain>/<domain>-slices.registry.ts
  - services/<svc>/src/<domain>/<svc>-db.module.ts
  - services/<svc>/src/<domain>/factory.ts
  - services/<svc>/src/<domain>/shared/**
  - simulations/enterprise-pm/packages/sim-domain-slice-kit/**
  - 다른 슬라이스의 모든 경로
```

Phase 2 시작 시점에 23개의 spec sheet 가 자동 생성된다. 생성 스크립트는 Phase 1 추출 결과 + `current/` 컨벤션 + 기존 코드를 입력으로 받는다 (위치: `simulations/enterprise-pm/scripts/build-slice-spec.mjs`).

## Agent 프롬프트 템플릿

```text
당신은 Domain Slice Architecture 마이그레이션 에이전트다.

입력:
- slice spec sheet: <YAML 본문>
- reference slice 경로: services/pm-api/src/pm/assignment
- current/ 컨벤션 문서: architecture-samples/domain-slice-monorepo/docs/source-architecture/current/
- 사용 가능한 공유 kit: simulations/enterprise-pm/packages/sim-domain-slice-kit

작업:
1. spec sheet 의 target_path 에 reference 슬라이스 구조를 복제하되 변형 포인트를 spec 에 맞게 조정
2. migration_from 이 명시되어 있으면 기존 service/controller 의 동작(특히 access check, policy lifecycle, error 매핑)을 반드시 보존
3. domain/, application/, infrastructure/, presentation/ 의 import 경계를 위반하지 않도록 항상 sim-domain-slice-kit 의 port 를 사용
4. forbidden_paths 의 어떤 파일도 수정 금지
5. <domain>-slices.registry.ts 에서 자기 슬라이스의 import 주석만 해제 (다른 줄 절대 변경 금지)
6. 기존 controller/service 가 routing 받던 경로는 새 슬라이스의 controller 가 동등하게 받도록 wiring
7. 마이그레이션 후 기존 service/controller 파일은 삭제 (단, 다른 슬라이스가 import 하고 있지 않은 것을 확인 후)

검증 (모두 통과해야 작업 완료로 간주):
- pnpm --filter @qa-sdk/sim-enterprise-pm-<svc> build
- pnpm --filter @qa-sdk/sim-enterprise-pm-<svc> test
- pnpm exec qa-scaffold validate <target_path>
- 슬라이스 단위 vitest 가 5계층 모두 커버

산출 보고:
- 변경된 파일 목록
- 추가된 OpenAPI fragment 경로
- 추가된 OM seed 경로
- migration_from 의 기존 파일 삭제 여부
- registry 변경 라인 (1줄)
- 검증 명령 출력 (실패가 있다면 즉시 중단하고 보고)
```

## 변형 포인트 (Phase 1 추출 후 채움)

Phase 1 종료 시 다음 표가 채워져 Phase 2 에이전트가 정확히 어디를 변형하는지 알 수 있게 한다.

| 영역 | reference 에서 그대로 복제 | 슬라이스마다 변형 |
|---|---|---|
| `domain/<slice>.ids.ts` | 형식 (PascalCase + as const branding) | ID 이름 |
| `domain/<slice>.types.ts` | 형식 (state union type, command-shaped types) | 타입 이름과 필드 |
| `domain/<slice>.entity.ts` | 클래스 골격, exception throw 패턴 | invariant 메서드 본문 |
| `domain/<slice>.exceptions.ts` | 패턴 | 예외 이름 + 메시지 |
| `application/commands/*.command.ts` | 형식 | command 이름 + 필드 |
| `application/ports/*.port.ts` | 인터페이스 골격 | 메서드 시그니처 |
| `application/queries/*.query.ts` | 형식 | query 이름 + return 타입 |
| `application/use-cases/*.use-case.ts` | port 의존 패턴, transaction.run 호출 패턴, log 호출 패턴 | 비즈니스 로직 |
| `infrastructure/persistence/*.schema.ts` | drizzle table 정의 패턴 | 컬럼 |
| `infrastructure/persistence/*.repository.ts` | repository 구현 패턴 | 쿼리 |
| `infrastructure/transaction/*.unit-of-work.ts` | 그대로 복제 (TransactionPort + OutboxPort 합성) | `name` 라벨만 |
| `infrastructure/outbox/*.outbox.ts` | 그대로 복제 | event 타입 |
| `infrastructure/logging/*.logger.ts` | 그대로 복제 | domain/useCase 라벨 |
| `infrastructure/read-model/*.read-model.ts` | (read-model 슬라이스만) 패턴 | 쿼리 |
| `presentation/http/*.controller.ts` | 컨트롤러 골격, exception filter 의존 패턴 | route + DTO 매핑 |
| `presentation/bff/*.bff.ts`, `*.controller.ts` | (BFF 슬라이스만) 패턴 | composition |
| `metadata/openmetadata.seed.json` | 골격 (domain/team/glossary/lineage/qualityTests/cacheKeys) | 도메인별 데이터 |
| `<slice>.module.ts` | provider wiring 패턴 | 클래스 이름 |

## 검증 게이트 (per slice)

```bash
SLICE=services/pm-api/src/pm/task
SVC=pm-api

# qa-scaffold 는 dist/cli.js 를 가리키므로 최초/변경 시 빌드 선행
pnpm --filter @qa-sdk/scaffold build
pnpm --filter @qa-sdk/sim-enterprise-pm-$SVC build
pnpm --filter @qa-sdk/sim-enterprise-pm-$SVC test --filter "task"
pnpm exec qa-scaffold validate $SLICE
```

`qa-scaffold validate` 가 issue 0 으로 통과해야 한다 (severity error 0 보다 엄격하게).

## Dispatch 메커니즘

옵션 (Phase 0 에서 메커니즘 자체는 결정):
1. Claude Code Agent tool 로 N 개 동시 dispatch
2. ralph-tui beads 로 task 큐 채워서 worker 가 소비
3. cron + dynamic loop 로 시간 분산

Phase 0 가 끝나면 위 옵션 중 하나로 결정. 본 plan 은 dispatch 메커니즘에 종속되지 않는다 — 어느 방식이든 spec sheet + 프롬프트 템플릿이 입력이 된다.

## 종료 조건

- 22개 슬라이스 모두 검증 게이트 통과
- 22개 OpenAPI fragment 가 `contracts/openapi/src/domains/` 하위에 존재
- 22개 OM seed 가 슬라이스 내부 `metadata/openmetadata.seed.json` 에 콜로케이션
- 모든 service 의 build/test 회귀 없음
- gateway 라우팅이 모든 새 슬라이스 컨트롤러로 정상 흐름
- registry 의 모든 슬롯 활성화 (주석 해제)
- 기존 `*.service.ts`, `*.controller.ts` 중 슬라이스로 이전된 것은 삭제됨 (혹은 어댑터 호환을 위해 명시적 보존 표기)
