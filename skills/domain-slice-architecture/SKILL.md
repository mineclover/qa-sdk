---
name: domain-slice-architecture
description: "Domain Slice Architecture 설계/구현/검증 스킬. 기존 도메인 데이터 모델 분석, 스키마 추가, 기능 구현, OpenAPI 계약, 로깅 스펙, CQRS 읽기/쓰기 캐시, 트랜잭션 API, 테스트 시나리오, 코딩 컨벤션, BFF/read model 경계 설계와 재귀 개선에 사용한다."
---

# Domain Slice Architecture

## 목적

Domain Slice Architecture 작업을 설계 → 최소 구현 → 계약/관측/테스트 → 피드백 개선 루프로 진행한다. 이 스킬은 scaffold 산출물, 샘플 모노레포, definition-catalog 문서를 함께 갱신할 때 사용한다.

## 먼저 확인

- `docs/specs/scaffold/scaffold-domain-development-convention.rule.md`
- `docs/specs/scaffold/scaffold-domain-schematic.spec.md`
- `architecture-samples/domain-slice-monorepo/README.md`
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/README.md`
- 현재 구현 기준 레퍼런스는 `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/`를 우선한다.
- 필요한 세부 기준:
  - `references/workflow.md`
  - `references/surface-map.md`
  - `references/review-checklist.md`

## 실행 루프

1. **도메인 분석**: 기존 데이터 모델, 용어, ownership, read/write 흐름, 외부 계약을 먼저 읽는다.
2. **Slice 경계 결정**: aggregate, use case, ports, adapters, read model/BFF, metadata seed를 하나의 domain slice로 묶을지 분리할지 정한다.
3. **계약 우선 고정**: command/query/event/OpenAPI/logging/test scenario를 코드보다 먼저 최소 형태로 만든다.
4. **최소 구현**: domain identity/types/entity, application use case/ports, infrastructure adapter, presentation/BFF surface 순서로 구현한다.
5. **CQRS와 캐시 판단**: write model, read model, UI-facing BFF model, cache key DSL이 각각 다른 책임인지 판정한다.
6. **트랜잭션 경계 확정**: use case 단위 transaction API와 outbox/idempotency 경계를 명시한다.
7. **검증**: unit/contract/scenario/logging assertions를 추가하고 scaffold validator, def validate, 관련 package test를 실행한다.
8. **재귀 개선**: 누락된 관측, 중복된 model, 모호한 port, 과한 BFF 결합을 다음 iteration backlog로 기록한다.

## 판단 규칙

- Domain entity를 API response, OpenAPI schema, read model, BFF view model로 직접 노출하지 않는다.
- Application use case는 infrastructure adapter, Drizzle schema, HTTP framework에 의존하지 않는다.
- Read model은 데이터 처리/조회 최적화 책임이고, BFF model은 UI composition 책임이다. 둘이 같을 수는 있지만 같은 이유를 문서화해야 한다.
- OpenAPI 계약은 presentation adapter의 구현 세부가 아니라 consumer contract다.
- Logging spec은 디버그 문자열이 아니라 trace/correlation/audit/metric vocabulary다.
- Cache key는 코드 문자열 상수가 아니라 metadata/DSL에서 관리하고 `prefix:version:id...`로 렌더링한다.
- 트랜잭션 API는 persistence 편의 함수가 아니라 use case consistency boundary다.

## 산출물

작업 범위에 맞춰 다음 중 필요한 것만 만든다.

- domain slice 코드 또는 scaffold template 변경
- OpenAPI fragment / merged contract 검증
- logging event vocabulary / trace field spec
- OpenMetadata seed / cache key DSL manifest
- read model 또는 BFF model
- scenario/test 문서와 test implementation
- architecture sample 업데이트
- definition-catalog spec/rule 업데이트

## 검증 명령

기본:

```bash
node packages/cli/dist/index.js def validate --no-code-checks=true
pnpm --filter @qa-sdk/scaffold test
node architecture-samples/domain-slice-monorepo/scripts/verify.mjs
```

코드 변경이 특정 package에 있으면 해당 package의 `typecheck`, `test`, `oxlint`를 추가한다.
