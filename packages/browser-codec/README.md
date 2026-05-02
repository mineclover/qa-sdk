# @qa-sdk/browser-codec

`@qa-sdk/browser-codec`는 브라우저용 좌표 encode/decode SSOT다. 아직 전용 package spec은 없고, 브라우저 시스템 문서와 저장소 패키지 경계를 기준으로 읽는다.

## 먼저 볼 문서

- [browser-system.md](../../docs/specs/browser-system/browser-system.md) — 브라우저 SDK 전체 경계
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — browser-codec가 플랫폼 체인에서 차지하는 위치
- [system-overview.md](../../docs/system-overview.md) — browser-codec → browser-sdk 체인

## 패키지 역할

- 브라우저에서 필요한 catalog 로딩과 좌표 encode/decode 보조 기능을 제공한다.
- `@qa-sdk/browser`가 사용하는 경량 codec surface를 담당한다.
- 특정 도메인 데이터가 아닌 범용 브라우저 인코딩 층이다.

## 코드 진입점

- `src/index.ts` — public export
- `src/browser-codec.ts` — 브라우저 codec 핵심
- `src/catalog-loader.ts` — 브라우저 catalog 로딩
- `src/demo-catalog-browser.ts` — 브라우저용 정적 catalog 경로

## 실행

```bash
pnpm --filter @qa-sdk/browser-codec build
pnpm --filter @qa-sdk/browser-codec test
```
