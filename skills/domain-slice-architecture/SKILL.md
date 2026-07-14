---
name: domain-slice-architecture
description: "Domain Slice Architecture 설계/구현/검증 스킬. 기존 도메인 데이터 모델 분석, 슬라이스 위상 (service/read-model/bff/command-only/read-mostly) 결정, 스키마 추가, 기능 구현, OpenAPI 계약, 로깅 스펙, CQRS 읽기/쓰기 캐시, 트랜잭션 API, 테스트 시나리오, BFF/read-model 경계, cross-domain query port + anti-corruption seam, 라이브러리 경계 (process.env 금지 + forRoot config), AST 기반 architecture validator, simulations/enterprise-pm 마이그레이션 lessons 적용. 트리거: domain slice, slice 위상, topology, BFF 컨벤션, cross-domain port, anti-corruption, sim 마이그레이션, library boundary, forRoot, qa-scaffold validate."
---

# Domain Slice Architecture

## 목적

Domain Slice Architecture 작업을 설계 → 최소 구현 → 계약/관측/테스트 → 피드백 개선 루프로 진행한다. 이 스킬은 scaffold 산출물, 샘플 모노레포 (`architecture-samples/domain-slice-monorepo`), 시뮬레이션 (`simulations/enterprise-pm`), definition-catalog 문서를 함께 갱신할 때 사용한다.

## 먼저 확인

- `docs/specs/scaffold/scaffold-domain-development-convention.rule.md`
- `docs/specs/scaffold/scaffold-domain-schematic.spec.md`
- `architecture-samples/domain-slice-monorepo/README.md`
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/README.md`
- 현재 구현 기준 레퍼런스는 `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/`를 우선한다.
- 시뮬레이션 실증: `simulations/enterprise-pm/services/pm-api/src/pm/assignment/` (gold reference slice), `simulations/enterprise-pm/docs/bff-convention.md`.
- 필요한 세부 기준:
  - `references/workflow.md` — 도메인 분석 → 위상 → 구현 단계
  - `references/surface-map.md` — 책임 위상 + slice 그룹핑 + read-model vs BFF
  - `references/topology-taxonomy.md` — 5 위상 표 + validator 룰 분기 + OM seed `topology` SSOT
  - `references/cross-domain-ports.md` — query port + in-process/http 어댑터 + fail-open
  - `references/library-boundary.md` — `process.env` 금지 + `forRoot(config)` 패턴
  - `references/lessons-from-migration.md` — 24 슬라이스 마이그레이션 핵심 발견 + commit hash 색인
  - `references/review-checklist.md` — 계층/위상별 체크리스트
- 짝 skill: `docs/skills/sub-agent-verify-discipline.md` (slice 작업을 sub-agent 에 dispatch 할 때 verify-before-complete 룰).

## 실행 루프

1. **도메인 분석**: 기존 데이터 모델, 용어, ownership, read/write 흐름, 외부 계약을 먼저 읽는다.
2. **Slice 경계 결정**: aggregate, use case, ports, adapters, read model/BFF, metadata seed 를 하나의 domain slice 로 묶을지 분리할지 정한다. **5 위상 (`service`/`read-model`/`bff`/`command-only`/`read-mostly`) 중 하나를 선택**하고 `metadata/openmetadata.seed.json` 의 top-level `topology` 필드에 명시한다 (`references/topology-taxonomy.md`).
3. **계약 우선 고정**: command/query/event/OpenAPI/logging/test scenario 를 코드보다 먼저 최소 형태로 만든다.
4. **최소 구현**: domain identity/types/entity, application use case/ports, infrastructure adapter, presentation/BFF surface 순서로 구현한다.
5. **CQRS 와 캐시 판단**: write model, read model, UI-facing BFF model, cache key DSL 이 각각 다른 책임인지 판정한다.
6. **트랜잭션 경계 확정**: use case 단위 transaction API 와 outbox/idempotency 경계를 명시한다 (`service`/`command-only` 위상에서만).
7. **Cross-Domain 의존**: 다른 슬라이스/서비스의 read 가 필요하면 `application/ports/<dep>-query.port.ts` + `infrastructure/adapters/{in-process,http}-<dep>-query.adapter.ts` (`references/cross-domain-ports.md`).
8. **검증**: unit/contract/scenario/logging assertions 를 추가하고 scaffold validator (AST 기반), def validate, 관련 package test 를 실행한다.
9. **재귀 개선**: 누락된 관측, 중복된 model, 모호한 port, 과한 BFF 결합을 다음 iteration backlog 로 기록한다.

## 판단 규칙

### Layer 경계

- Domain entity 를 API response, OpenAPI schema, read model, BFF view model 로 직접 노출하지 않는다.
- Application use case 는 infrastructure adapter, Drizzle schema, HTTP framework 에 의존하지 않는다.
- Read model 은 데이터 처리/조회 최적화 책임이고, BFF model 은 UI composition 책임이다. 둘이 같을 수는 있지만 같은 이유를 문서화해야 한다.
- OpenAPI 계약은 presentation adapter 의 구현 세부가 아니라 consumer contract 다.
- Logging spec 은 디버그 문자열이 아니라 trace/correlation/audit/metric vocabulary 다.
- Cache key 는 코드 문자열 상수가 아니라 metadata/DSL 에서 관리하고 `prefix:version:id...` 로 렌더링한다.
- 트랜잭션 API 는 persistence 편의 함수가 아니라 use case consistency boundary 다.

### Topology 룰

- 위상은 `metadata/openmetadata.seed.json` top-level `topology` 가 SSOT — `service`/`read-model`/`bff`/`command-only`/`read-mostly`.
- `read-model`/`bff`/`read-mostly` 위상은 transaction port / outbox port / use-case 부재가 정상 — 강제하지 않는다.
- `read-model`/`bff` 위상은 산출물 가시성 강제 — `topology: bff` 면 `presentation/bff/*` 산출물 필수.
- 위상이 모호하거나 admin-port 패턴을 흉내내야 한다면 위상 분리 (admin write 슬라이스 + read 슬라이스) 검토.

### Cross-Domain Port

- 다른 도메인의 deep import (`/<other>/domain/...`, `/<other>/infrastructure/...`) 금지 — `bounded-context-uses-contracts` 룰.
- query port 추상 + AlwaysTrue/Optional 기본 구현 (fail-open) — auth-api 부재 환경 호환.
- in-process 어댑터는 **구조적 타이핑** 으로 정적 의존 회피.
- http 어댑터는 `AbortSignal.timeout(5_000)` + 5xx/네트워크 에러 fail-open.

### Library Boundary

- 슬라이스 모듈에서 `process.env` 직접 접근 금지 (CLAUDE.md 컨벤션).
- env 의존 슬라이스는 `static forRoot(config)` DynamicModule — 서비스 `config/env.ts` (zod) 가 config 빌드해 주입.

### Validator AST 검사

- `transaction-and-logging-are-ports`, `bff-does-not-expose-domain-entity`, `openapi-does-not-expose-domain-entity` 는 모두 AST 기반.
- substring 회피 (import 한 줄, 주석 토큰) 가 통하지 않음. type reference + 식별자 참조까지 확인.
- `LoggerPort` 의 경우 `SLICE_LOGGER_PORT` inject 패턴도 정당하게 통과.

### BFF 정체성

- BFF 정체성 = **디렉터리 위치 (`presentation/bff/`)** — path prefix 는 도메인 자율.
- 새 BFF: `/bff/<resource>/...` 권장. 기존 외부 호환 (`/audit/...` 등) 은 유지.
- BFF 는 outbox emit / persistence write 금지 (read 전용).

### Slice 그룹핑

- 전통: `apps/api/src/modules/<domain>/<slice>` (architecture-samples).
- 시뮬레이션: 부모에 `<domain>-slices.registry.ts` 마커 (`services/<svc>/src/<domain>/`).
- top-level slice 도 인접 같은 깊이 마커 허용.

## 산출물

작업 범위에 맞춰 다음 중 필요한 것만 만든다.

- domain slice 코드 또는 scaffold template 변경
- OpenAPI fragment / merged contract 검증 (shape-deep-equal dedup 활용)
- logging event vocabulary / trace field spec
- OpenMetadata seed (`topology` 필드 + cache key DSL manifest 포함)
- read model 또는 BFF model
- cross-domain query port + adapter (in-process / http)
- forRoot config + 서비스 env zod schema
- scenario/test 문서와 test implementation
- architecture sample 업데이트
- definition-catalog spec/rule 업데이트

## 검증 명령

기본:

```bash
node packages/cli/dist/index.js def validate --no-code-checks=true
corepack pnpm --filter @qa-sdk/scaffold test
corepack pnpm exec qa-scaffold validate <slice-or-service-src>
node architecture-samples/domain-slice-monorepo/scripts/verify.mjs
```

코드 변경이 특정 package 에 있으면 해당 package 의 `build` (tsc), `test`, `oxlint` 를 추가한다. **`build` 는 `vitest` 와 별도로 실행** — esbuild loader 통과 ≠ tsc strict 통과 (`docs/skills/sub-agent-verify-discipline.md`).

시뮬레이션 변경 시 추가:

```bash
corepack pnpm --filter @qa-sdk/sim-scenarios test
node simulations/enterprise-pm/contracts/openapi/scripts/check-merge.mjs
```
