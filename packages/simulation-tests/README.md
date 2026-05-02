# @qa-sdk/simulation-tests

`@qa-sdk/simulation-tests`는 서비스 간 순수 로직 결합을 시뮬레이션으로 검증하는 통합 테스트 패키지다.

## 먼저 볼 문서

- [simulation-tests.spec.md](../../docs/specs/system/simulation-tests.spec.md) — 패키지 계약
- [facet-test-isolation.spec.md](../../docs/specs/system/facet-test-isolation.spec.md) — 상위 개요
- [facet-test-isolation.rule.md](../../docs/specs/system/facet-test-isolation.rule.md) — 운영 규칙
- [gate-system.md](../../docs/specs/gate/gate-system.md) — gate 측 문맥
- [query-system.md](../../docs/specs/query-system/query-system.md) — query 측 문맥

## 패키지 역할

- gate/query 등 여러 서비스 패싯이 함께 붙을 때의 통합 흐름을 검증한다.
- `facet-tests`보다 넓고 `e2e`보다 낮은 레벨의 시뮬레이션 계층이다.
- 환경 stub과 동기화된 소스를 이용해 서비스 조합 회귀를 검사한다.

## 코드 진입점

- `vitest.config.ts` — 실행 설정
- `scenarios/gate-query-flow.test.ts` — 대표 시뮬레이션 시나리오
- `__mocks__/...` — 환경 stub
- `synced/` — 서비스 소스 입력

## 실행

```bash
pnpm --filter @qa-sdk/simulation-tests test
```
