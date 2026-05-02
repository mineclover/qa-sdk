# test-scenario-store

`test-scenario-store`는 테스트 시나리오의 B 좌표 SQLite 레지스트리다. 전용 central spec은 아직 약하고, 서비스 개발 하네스 설계 문서 기준으로 읽는다.

## 먼저 볼 문서

- [service-dev-harness-design.md](../../docs/superpowers/specs/2026-04-04-service-dev-harness-design.md) — 전체 설계와 B 좌표 역할
- [test-types.spec.md](../../docs/specs/system/test-types.spec.md) — 분류 타입 SSOT
- [system-overview.md](../../docs/system-overview.md) — `test-types → test-scenario-store` 위치

## 패키지 역할

- `qa-sdk test scan/assign/scaffold/status/report`가 쓰는 SQLite 레지스트리다.
- A 좌표로부터 파생된 테스트 선언을 B 좌표 `test_scenario:v1:M`으로 관리한다.
- Drizzle 스키마와 store API를 제공한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/types.ts` — 타입
- `src/store.ts` — 저장소 로직
- `src/db/schema.ts` — DB 스키마

## 실행

```bash
pnpm --filter test-scenario-store build
pnpm --filter test-scenario-store test
```
