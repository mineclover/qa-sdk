# @qa-sdk/otel

`@qa-sdk/otel`은 OpenTelemetry 초기화와 Drizzle 계측 보조층이다. 패키지 계약은 `otel-package-spec`이 소유하고, APM/metrics/logger 문맥은 상위 observability 맥락으로 함께 읽는다.

## 먼저 볼 문서

- [otel-package.spec.md](../../docs/specs/system/otel-package.spec.md) — 패키지 계약
- [apm-system.md](../../docs/specs/apm-system/apm-system.md) — APM 전체 구조
- [logger.spec.md](../../docs/specs/apm-system/logger.spec.md) — OTLP transport와 observability 문맥
- [metrics.spec.md](../../docs/specs/apm-system/metrics.spec.md) — OpenTelemetry 호환 metric 의미
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 패키지 계층 맥락

## 패키지 역할

- OpenTelemetry SDK 초기화와 tracer 유틸리티를 제공한다.
- Drizzle instrumentation과 sqlcommenter 보조 기능을 묶는다.
- `@qa-sdk/store` 같은 데이터 계층에서 선택적으로 붙는 관측 보조층이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/init.ts` — OTel 초기화
- `src/tracer.ts` — tracer 유틸리티
- `src/drizzle-instrument.ts` — Drizzle 계측
- `src/sqlcommenter.ts` — SQL commenter
- `src/env.ts` — 환경 설정

## 실행

```bash
corepack pnpm --filter @qa-sdk/otel build
corepack pnpm --filter @qa-sdk/otel test
```
