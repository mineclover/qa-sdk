---
status: implemented
sources:
  - simulations/enterprise-pm/services/pm-api/package.json
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/assignment.module.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/domain/assignment.entity.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/domain/assignment.entity.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/application/use-cases/assignment.use-case.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/application/use-cases/assignment.use-case.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/infrastructure/persistence/assignment.repository.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/infrastructure/transaction/assignment.unit-of-work.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/presentation/http/assignment.controller.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/presentation/bff/assignment-detail.test.ts
  - simulations/enterprise-pm/services/pm-api/src/pm/assignment/metadata/openmetadata.seed.json
  - simulations/enterprise-pm/services/pm-api/src/pm/pm-slices.registry.ts
  - simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml
  - simulations/enterprise-pm/scenarios/package.json
  - simulations/enterprise-pm/scenarios/src/architecture/architecture-manifest.test.ts
  - packages/architecture-schematics/src/domain/domain.test.ts
  - packages/architecture-schematics/src/validator.test.ts
---

# Phase 1 — Reference Slice (pm-api/assignment)

직렬, 단일 에이전트. Phase 2 의 모든 병렬 에이전트가 복제·변형의 기준으로 삼는 gold standard 슬라이스를 만든다.

## 소스 / 타겟

| Source (gold standard) | Target |
|---|---|
| `architecture-samples/domain-slice-monorepo/apps/api/src/modules/assignment/` | `simulations/enterprise-pm/services/pm-api/src/pm/assignment/` |

architecture-samples 의 assignment 슬라이스가 `current/` 컨벤션의 reference 구현이다. simulation 환경에 맞게 포팅한다.

## 슬라이스 구조 (current/ 컨벤션 그대로)

```text
services/pm-api/src/pm/assignment/
├── assignment.module.ts              # SliceModule, providers wiring
├── domain/
│   ├── assignment.entity.ts          # invariant 행위
│   ├── assignment.exceptions.ts      # framework-free 도메인 예외
│   ├── assignment.ids.ts             # AssignmentId, ManagerId, ProjectId
│   ├── assignment.types.ts           # 상태/데이터 shape
│   └── index.ts                      # 도메인 public surface
├── application/
│   ├── commands/
│   │   └── create-assignment.command.ts
│   ├── ports/
│   │   ├── assignment-logger.port.ts
│   │   ├── assignment-outbox.port.ts
│   │   ├── assignment-repository.port.ts
│   │   └── assignment-transaction.port.ts
│   ├── queries/
│   │   └── assignment-read-model.query.ts
│   └── use-cases/
│       └── assignment.use-case.ts
├── infrastructure/
│   ├── logging/
│   │   └── assignment.logger.ts
│   ├── outbox/
│   │   └── assignment.outbox.ts
│   ├── persistence/
│   │   ├── assignment.repository.ts
│   │   └── assignment.schema.ts
│   ├── read-model/
│   │   └── assignment.read-model.ts
│   └── transaction/
│       ├── assignment.drizzle-transaction.ts
│       ├── assignment.transaction.ts
│       └── assignment.unit-of-work.ts
├── presentation/
│   ├── bff/
│   │   ├── assignment-detail.bff.ts
│   │   └── assignment-detail.controller.ts
│   └── http/
│       └── assignment.controller.ts
└── metadata/
    └── openmetadata.seed.json
```

## 시뮬레이션 환경 어댑테이션

architecture-samples 와 다른 점만 명시.

### 1. Drizzle dialect

architecture-samples 는 단일 dialect. simulations 는 sqlite + pg 양쪽 운용.

- `infrastructure/persistence/assignment.schema.ts` 안에서 dialect 별 스키마를 동시에 export
- 또는 기존 `services/pm-api/src/pm/sqlite/schema.ts`, `pm/pg/schema.ts` 패턴을 따라 `assignment/infrastructure/persistence/sqlite.schema.ts`, `pg.schema.ts` 분리
- 추천: 후자 (기존 패턴 일치). 단 `assignment.repository.ts` 는 dialect 무관 인터페이스, 어댑터에서 분기

### 2. Transaction port 구현

`assignment.drizzle-transaction.ts` 는 `sim-domain-slice-kit/createSqliteTransactionPort` / `createPgTransactionPort` 를 wrapping.

### 3. Logger

`assignment.logger.ts` 는 `sim-domain-slice-kit/SliceLoggerProvider` 의존. 기존 `createLogger("sim-pm-api.*")` 호출은 kit 내부에서 흡수.

### 4. Outbox 테이블

`services/pm-api/drizzle/sqlite/`, `pm/pg/` 에 outbox migration 추가.

```sql
-- pm-api/drizzle/sqlite/0001_outbox.sql (예시)
CREATE TABLE IF NOT EXISTS pm_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,           -- JSON
  occurred_at INTEGER NOT NULL,    -- epoch ms
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | published | failed
);
CREATE INDEX IF NOT EXISTS pm_outbox_status_idx ON pm_outbox_events(status, occurred_at);
```

pg 버전도 동등하게 추가.

### 5. NestJS 모듈 wiring

`assignment.module.ts` 가 다음을 provide:
- `AssignmentRepository` (dialect 별 어댑터, factory 가 주입)
- `AssignmentLogger` → `LoggerPort`
- `AssignmentTransaction` → `TransactionPort`
- `AssignmentOutbox` → `OutboxPort`
- `AssignmentUseCase`
- `AssignmentReadModelQuery`
- 컨트롤러 (`AssignmentController`, `AssignmentDetailController`)

`pm-slices.registry.ts` 에서 `AssignmentSliceModule` 주석 해제.

### 6. OpenAPI fragment

기존 `simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml` 가 이미 존재. 슬라이스 구현이 spec 을 만족하는지 검증하고, 누락된 component 가 있으면 추가.

### 7. OM seed

기존 `simulations/enterprise-pm/metadata/openmetadata/assignment.seed.json` 을 슬라이스 안 `metadata/openmetadata.seed.json` 으로 이동(콜로케이션 규칙). 루트의 seed 는 deprecate.

`scenarios/src/architecture/architecture-manifest.test.ts:44` 가 이 경로를 읽고 있으므로 manifest test 의 seed 경로를 슬라이스 내부로 갱신.

## 5계층 테스트

`tests/` 가 아닌 슬라이스 내부에 `*.test.ts` 콜로케이션 (architecture-samples 패턴).

| 테스트 | 검증 |
|---|---|
| `domain/assignment.entity.test.ts` | 상태 전이, 불변, 도메인 예외 |
| `application/use-cases/assignment.use-case.test.ts` | port 호출 순서, transaction scope 전파, log outcome |
| `infrastructure/transaction/assignment.unit-of-work.test.ts` | commit/rollback, outbox 캡슐화 |
| `infrastructure/persistence/assignment.repository.test.ts` | sqlite + pg 어댑터 매핑 |
| `presentation/http/assignment.controller.test.ts` | 컨트랙트 shape, 에러 매핑 |
| `presentation/bff/assignment-detail.test.ts` | 다중 read 합성 |

## 검증

```bash
pnpm --filter @qa-sdk/sim-pm-api build
pnpm --filter @qa-sdk/sim-pm-api test
# qa-scaffold 는 dist/cli.js 를 가리키므로 최초/변경 시 빌드 선행
pnpm --filter @qa-sdk/scaffold build
pnpm exec qa-scaffold validate \
  simulations/enterprise-pm/services/pm-api/src/pm/assignment
pnpm --filter @qa-sdk/sim-scenarios test architecture-manifest
```

모두 통과해야 Phase 1 종료.

## 슬라이스 spec sheet 추출

Phase 1 마지막에 assignment 슬라이스로부터 Phase 2 의 slice spec sheet 템플릿을 역으로 추출한다 (`phase-2-parallel.md` 의 템플릿이 비어 있는 부분을 구체화).

추출 대상:
- 어떤 파일들이 정확히 같은 모양으로 복제되는지
- 어떤 파일이 슬라이스마다 달라지는지 (entity, types, ids, schema, repository methods, command/query 이름, 컨트롤러 라우트)
- 어떤 외부 의존이 슬라이스마다 다른지 (cross-domain query port)

이 추출 결과를 `phase-2-parallel.md` 의 "변형 포인트" 섹션에 채운다.

## 종료 조건

- 슬라이스 디렉터리 구조가 위 트리와 정확히 일치
- 모든 테스트 통과
- `qa-scaffold validate` 통과 (issue 0)
- architecture-manifest test 가 새 OM seed 경로 + 슬라이스 디렉터리 실재성 검증
- gateway 라우팅이 `POST /assignments`, `GET /assignments/:id` 통과 (smoke)
- pm-api 의 다른 슬라이스(project/task/member)는 기존대로 동작 (회귀 없음)
- assignment 루트 OM seed 파일은 슬라이스 안으로 이동 완료, 기존 위치 deprecate 표기 또는 삭제
