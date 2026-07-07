# Phase 0 — Foundation

직렬, 단일 에이전트. Phase 1, 2 가 의존하는 공유 추상을 한 번에 정의한다.

## 산출물

### 1. 공유 패키지 `sim-domain-slice-kit`

위치: `simulations/enterprise-pm/packages/sim-domain-slice-kit/`

기존 sim-* 패키지(`sim-audit-recorder-provider`, `sim-bitmap-cache`, `sim-otel-utils`)와 같은 빌드 컨벤션 (tsup dual format, `package.json` 동일 패턴).

#### 노출 인터페이스

```ts
// src/transaction.port.ts
export interface TransactionScope { readonly id: string; readonly startedAt: Date }
export interface TransactionPort {
  run<T>(name: string, work: (scope: TransactionScope) => Promise<T>): Promise<T>;
}

// src/outbox.port.ts
export interface OutboxRecord {
  readonly aggregateId: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly payload: unknown;
  readonly occurredAt: Date;
}
export interface OutboxPort {
  append(record: OutboxRecord, scope: TransactionScope): Promise<void>;
}

// src/logger.port.ts
export interface SliceLogContext {
  traceId?: string;
  correlationId?: string;
  domain: string;
  useCase: string;
  aggregateId?: string;
  commandName?: string;
  queryName?: string;
  eventName?: string;
  eventVersion?: number;
  outcome?: "success" | "failure";
  errorCode?: string;
  cacheKeyPrefix?: string;
  cacheHit?: boolean;
}
export interface LoggerPort {
  info(ctx: SliceLogContext, message: string): void;
  warn(ctx: SliceLogContext, message: string): void;
  error(ctx: SliceLogContext & { err: unknown }, message: string): void;
}

// src/error-mapping.ts
export interface DomainErrorPayload {
  code: string;
  message: string;
  traceId: string;
  details?: Record<string, unknown>;
}
export function mapDomainErrorToHttp(err: unknown, traceId: string): {
  status: number; payload: DomainErrorPayload;
};
```

#### 구현 노트

- `LoggerPort` 의 기본 구현은 기존 `services/<svc>/src/lib/logger.ts` 의 `createLogger` 를 wrapping. 표준 필드를 강제하는 얇은 어댑터.
- `mapDomainErrorToHttp` 은 도메인 예외 클래스명을 보고 status code 결정. 알 수 없는 에러는 500 + `code: "INTERNAL_ERROR"`.
- `TransactionPort` 의 기본 구현은 dialect 별 (`createSqliteTransactionPort(db)`, `createPgTransactionPort(db)`) 어댑터로 제공. drizzle 트랜잭션 위에서 동작.
- `OutboxPort` 기본 구현: `outbox_events` 테이블에 INSERT. 테이블 DDL 은 Phase 1 에서 pm-api drizzle migration 으로 추가, Phase 2 에이전트는 자기 슬라이스 service 에 동일 패턴으로 추가.

### 2. NestJS 통합

위치: `sim-domain-slice-kit/src/nest/`

- `SliceLoggerProvider` — `LoggerPort` 를 NestJS DI 토큰으로 노출.
- `DomainExceptionFilter` (`@Catch()`) — controller 에서 도메인 예외 throw 시 `mapDomainErrorToHttp` 통해 표준 페이로드로 응답.
- `TransactionScopeProvider` — request scope 단위 traceId 발급.

### 3. 슬라이스 registry 패턴

각 service 의 `<domain>-db.module.ts` 가 슬라이스를 직접 import 하던 방식을 제거하고 registry 한 단계 거친다.

생성 위치: `services/<svc>/src/<domain>/<domain>-slices.registry.ts`

```ts
// 예: services/pm-api/src/pm/pm-slices.registry.ts
import { AssignmentSliceModule } from "./assignment/assignment.module.js";
// import { ProjectSliceModule } from "./project/project.module.js";  // Phase 2
// import { TaskSliceModule } from "./task/task.module.js";          // Phase 2
// import { MemberSliceModule } from "./member/member.module.js";    // Phase 2

export const PM_SLICE_MODULES = [
  AssignmentSliceModule,
  // ProjectSliceModule,
  // TaskSliceModule,
  // MemberSliceModule,
] as const;
```

Phase 0 에서 모든 슬라이스의 import 라인을 미리 작성하되 Phase 1, 2 진행 전까지는 주석 처리. 각 Phase 2 에이전트는 자기 슬라이스의 주석만 해제 — registry 파일 자체의 다른 줄은 변경 금지. Phase 0 가 모든 슬롯을 미리 만들어두기 때문에 두 에이전트가 같은 줄을 만지지 않는다.

### 4. 슬라이스 디렉터리 템플릿

`packages/architecture-schematics` 의 domain schematic 을 그대로 사용. 단 simulation 환경 변형:
- 모듈 클래스명: `<Slice>SliceModule` (architecture-samples 의 `<Slice>Module` 과 구분)
- factory: 기존 `<svc>/src/<domain>/factory.ts` 와 호환되도록 dialect 어댑터 호출 위치를 슬라이스 안 `infrastructure/persistence/<slice>.adapter.ts` 에 배치
- ports: `LoggerPort`, `TransactionPort`, `OutboxPort` 는 `sim-domain-slice-kit` 에서 import (슬라이스 자체 정의 금지)

이 변형 옵션은 schematic 호출 시 `--simulation-mode` flag 로 전환되도록 추가. (Phase 0 의 schematic 패치)

### 5. OpenAPI fragment promotion

simulations 의 OpenAPI 는 yaml. `qa-scaffold promote-openapi` 는 현재 json 만. Phase 0 에서 yaml 입력을 지원하도록 확장하거나, 시뮬레이션 자체 promote 스크립트 추가.

선택: **시뮬레이션 자체 스크립트** 추가. `simulations/enterprise-pm/scripts/promote-openapi.mjs`. 입력은 슬라이스 임시 fragment, 출력은 `contracts/openapi/src/domains/<slice>/spec.yaml`. 충돌 시 `--force` 없으면 거부. 이렇게 하면 architecture-schematics 패키지를 건드리지 않고 진행.

## 작업 순서

1. `sim-domain-slice-kit` 패키지 scaffold (package.json, tsup, tsconfig, vitest config)
2. port 인터페이스 + 구현 어댑터 작성
3. NestJS 통합 클래스 작성
4. 단위 테스트 (transaction port commit/rollback, logger 표준 필드, error mapper)
5. 각 service 의 `<domain>-slices.registry.ts` 생성 (모든 슬라이스 import 미리 작성, 주석 처리)
6. simulations 자체 promote-openapi 스크립트 작성
7. 패키지 빌드 + 의존 service 들이 인식하도록 `pnpm install`

## 검증

```bash
pnpm --filter sim-domain-slice-kit build
pnpm --filter sim-domain-slice-kit test
pnpm --filter @qa-sdk/sim-pm-api build  # registry 가 컴파일 통과
```

## 종료 조건

- `sim-domain-slice-kit` 가 dist 생성, 모든 service 가 dependency 로 추가
- 7개 service 의 `<domain>-slices.registry.ts` 가 모든 슬라이스 슬롯을 가지고 있음 (assignment 만 활성)
- `simulations/enterprise-pm/scripts/promote-openapi.mjs` 가 dry-run 으로 동작
- 기존 service 빌드/테스트 회귀 없음 (registry 가 추가만 됐고 기존 wiring 은 유지)
