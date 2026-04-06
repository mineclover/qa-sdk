# @qa-sdk/apm

`@qa-sdk/apm`은 address context와 metric 성격의 런타임 관측 보조층이다. 패키지 자체보다 `apm-system` 문서군을 먼저 보는 편이 정확하다.

## 먼저 볼 문서

- [apm-system.md](../../docs/specs/apm-system/apm-system.md) — APM 관심사 전체 진입점
- [metrics.spec.md](../../docs/specs/apm-system/metrics.spec.md) — metric 모델
- [logger.spec.md](../../docs/specs/apm-system/logger.spec.md) — logger/transport 계열과의 경계
- [transport.spec.md](../../docs/specs/apm-system/transport.spec.md) — envelope 전달 계층

## 패키지 역할

- address range 계산과 APM 로거 보조 기능을 제공한다.
- `@qa-sdk/sdk`, `@qa-sdk/core`, `weighted-index` 위에 얇게 올라가는 관측 지원 레이어다.
- 대규모 시스템 설명은 중앙 APM spec에 있고, 이 패키지는 그 구현 일부를 맡는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/apm-logger.ts` — APM 로거 보조
- `src/address-ranges.ts` — address range 계산
- `src/config.ts` — 설정 surface

## 실행

```bash
pnpm --filter @qa-sdk/apm build
pnpm --filter @qa-sdk/apm test
```
