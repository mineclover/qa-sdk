# @qa-sdk/facet-tests

`@qa-sdk/facet-tests`는 환경 의존을 제거한 서비스 로직을 패싯 단위로 검증하는 회귀 테스트 패키지다.

## 먼저 볼 문서

- [facet-tests.spec.md](../../docs/specs/system/facet-tests.spec.md) — 패키지 계약
- [facet-test-isolation.spec.md](../../docs/specs/system/facet-test-isolation.spec.md) — 상위 개요
- [facet-test-isolation.rule.md](../../docs/specs/system/facet-test-isolation.rule.md) — 운영 규칙
- [gate-system.md](../../docs/specs/gate/gate-system.md) — gate 패싯의 문맥
- [query-system.md](../../docs/specs/query-system/query-system.md) — query 패싯의 문맥

## 패키지 역할

- 서비스 코드에서 순수 로직만 복제/동기화해 빠른 회귀 테스트를 돌린다.
- gate-service 이벤트 버스와 query-service 정책 저장소 같은 패싯을 격리 검증한다.
- E2E보다 낮고 단위 테스트보다 넓은 중간 회귀층이다.

## 코드 진입점

- `vitest.config.ts` — mock alias와 테스트 범위
- `__mocks__/gate-service/src/config/env.ts` — 환경 stub
- `synced/` — 동기화된 서비스 소스 입력

## 실행

```bash
pnpm --filter @qa-sdk/facet-tests test
```
