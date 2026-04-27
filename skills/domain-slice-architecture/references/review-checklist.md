# Review Checklist

## Topology

- [ ] `metadata/openmetadata.seed.json` 에 top-level `topology` 명시 (5 enum 중)
- [ ] 위상과 디렉터리 시그너처 일치 (`topology: bff` 면 `presentation/bff/*` 존재)
- [ ] 위상에 어울리지 않는 룰을 우회하지 않음 (admin-port 흉내 금지)

## Domain

- [ ] identity and state shape are separated
- [ ] entity does not import framework/infrastructure
- [ ] invariant behavior is tested

## Application

- [ ] use case imports ports, not adapters
- [ ] transaction boundary is explicit (`service` / `command-only` 위상)
- [ ] outbox/idempotency decision is documented for writes
- [ ] cross-domain read 는 `application/ports/<dep>-query.port.ts` 추상 + fail-open 기본 구현

## Infrastructure

- [ ] outbox 어댑터가 service-shared schema 의 table 을 직접 import (alias re-export 없음)
- [ ] cross-domain adapter 가 `infrastructure/adapters/` 에 있고 in-process / http 두 형태 (해당 시)
- [ ] http adapter 는 `AbortSignal.timeout(5_000)` + fail-open
- [ ] persistence schema 가 위상에 부합 (read-model 슬라이스는 write 테이블 주도 금지)

## Library Boundary

- [ ] 슬라이스 모듈에서 `process.env` 직접 접근 없음
- [ ] env 의존 슬라이스는 `static forRoot(config)` DynamicModule 패턴
- [ ] 서비스 `config/env.ts` (zod) 가 슬라이스 config 를 빌드해 주입

## Contracts

- [ ] OpenAPI/event contract is separate from domain entity
- [ ] logging vocabulary has trace/correlation fields
- [ ] cache key prefix/version/id shape is defined
- [ ] OpenAPI fragment 의 동일 component 이름이 다른 도메인에 등장하면 deep-equal 일치 (dedup 가능)

## Read Side and BFF

- [ ] read model and BFF model are not accidentally conflated
- [ ] UI composition logic does not mutate domain state
- [ ] cache invalidation path is named
- [ ] BFF controller 가 `presentation/bff/` 하위에 위치 (정체성 = 디렉터리)
- [ ] BFF 가 outbox emit 또는 persistence write 하지 않음 (read 전용)

## Validator

- [ ] AST 기반 검사 통과 (substring 회피 시도 없음)
- [ ] `bounded-context-uses-contracts` — 다른 도메인 deep import 없음
- [ ] `metadata-ships-with-domain-slice` — read-model/bff/read-mostly 위상에 OM seed 존재
- [ ] `topology-shape-mismatch` — 위상과 산출물 일치

## Tests

- [ ] domain tests cover invariant failures
- [ ] application tests cover port interactions
- [ ] contract tests cover API/event shape
- [ ] scenario tests cover read/write/logging side effects when relevant
- [ ] cross-domain port adapter 의 fail-open 경로 테스트 (auth-api 부재 / 5xx / timeout)

## Sub-Agent Dispatch (해당 시)

- [ ] sub-agent prompt 에 검증 명령 stdout last 20 lines 보고 강제
- [ ] `pnpm --filter <pkg> build` (tsc) 가 vitest 와 별도로 실행됨
- [ ] caller 가 phase advance 전 1-2 명령 spot-check 직접 실행
- [ ] 짝 skill: `docs/skills/sub-agent-verify-discipline.md`

## Documentation

- [ ] definition-catalog source links point to changed code/sample
- [ ] architecture sample is updated if the convention changed
- [ ] scaffold catalog matches generated files
- [ ] BFF 위치/path 변경 시 `simulations/enterprise-pm/docs/bff-convention.md` 갱신 (해당 시)
