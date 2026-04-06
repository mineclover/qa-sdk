# @qa-sdk/e2e

`@qa-sdk/e2e`는 Playwright 기반 cross-app 브라우저 E2E 패키지다. 전용 package spec은 약하고, ingest/browser/system 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [e2e-suite.spec.md](../../docs/specs/system/e2e-suite.spec.md) — 패키지 계약
- [ingest-system.md](../../docs/specs/ingest/ingest-system.md) — 수집 파이프라인 상위 구조
- [browser-system.md](../../docs/specs/browser-system/browser-system.md) — 브라우저 SDK 상위 구조
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 프론트엔드/서비스 위치
- [testing-patterns.spec.md](../../docs/specs/system/testing-patterns.spec.md) — 테스트 관례

## 패키지 역할

- 브라우저 시나리오와 ingest 수집 경로를 한 번에 검증한다.
- shop, viz, roleplay, registry-ui 등 여러 앱을 동시에 띄운 상태에서 흐름을 검사한다.
- 루트 `test:e2e`를 담당하는 최상위 브라우저 테스트 러너다.

## 코드 진입점

- `playwright.config.ts` — 테스트 대상 서비스/브라우저 설정
- `tests/helpers.ts` — 공통 helper
- `tests/*.spec.ts` — 쇼핑, verdict, iframe, pipeline, registry-ui 시나리오

## 실행

```bash
pnpm --filter @qa-sdk/e2e install:browsers
pnpm --filter @qa-sdk/e2e test
pnpm --filter @qa-sdk/e2e test:ui
pnpm --filter @qa-sdk/e2e test:headed
```
