# @qa-sdk/codec

`@qa-sdk/codec`는 dim-wire 인코딩과 typed SDK 패턴을 제공하는 플랫폼 체인 라이브러리다. 구현 기준은 중앙 platform codec spec이다.

## 먼저 볼 문서

- [platform-codec-spec.md](../../docs/specs/platform-chain/platform-codec-spec.md) — dim-wire/TypedSdk 계약
- [platform-chain-system.md](../../docs/specs/platform-chain/platform-chain-system.md) — 플랫폼 체인 전체 구조
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — codec의 계층 위치

## 패키지 역할

- Catalog의 축/prefix 정의를 wire format으로 변환한다.
- dim-wire encode/decode와 typed SDK 조립 도구를 제공한다.
- `weighted-index`와 `@qa-sdk/core` 사이의 플랫폼 보조층이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/dim-wire.ts` — dim-wire encode/decode
- `src/typed-sdk.ts` — TypedSdk 패턴

## 실행

```bash
pnpm --filter @qa-sdk/codec build
pnpm --filter @qa-sdk/codec test
```
