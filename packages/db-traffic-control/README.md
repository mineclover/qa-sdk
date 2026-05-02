# db-traffic-control

`db-traffic-control`은 DB 트래픽 버짓, 동시성, QPS를 제어하는 보조 라이브러리다. 아직 전용 package spec은 없고, Drizzle/운영 규약 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [db-traffic-control.spec.md](../../docs/specs/system/db-traffic-control.spec.md) — 패키지 계약
- [drizzle-orm-convention.spec.md](../../docs/specs/system/drizzle-orm-convention.spec.md) — Drizzle 사용 제약
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 데이터 계층 패키지 맥락

## 패키지 역할

- 쿼리 fingerprint와 budget을 기반으로 concurrency/QPS를 제한한다.
- Drizzle middleware와 이벤트 bridge를 통해 DB 사용량 관측을 붙인다.
- 데이터 계층 공용 제어 장치로 사용된다.

## 코드 진입점

- `src/index.ts` — public export
- `src/budget.ts` — 버짓 모델
- `src/concurrency-limiter.ts`, `src/rate-limiter.ts` — 제한기
- `src/controller.ts` — 전체 제어기
- `src/drizzle-middleware.ts` — Drizzle 연동
- `src/event-bridge.ts`, `src/metrics.ts` — 관측 연결

## 실행

```bash
pnpm --filter db-traffic-control build
pnpm --filter db-traffic-control test
```
