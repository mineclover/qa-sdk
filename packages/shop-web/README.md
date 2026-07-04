# @qa-sdk/shop-web

`@qa-sdk/shop-web`은 브라우저 SDK와 카탈로그 로더를 소비하는 쇼핑 데모 사이트다. 패키지 계약은 `shop-web.spec.md`를 기준으로 읽고, 브라우저/ingest 문서가 상위 문맥을 제공한다.

## 먼저 볼 문서

- [shop-web.spec.md](../../docs/specs/browser-system/shop-web.spec.md) — 패키지 계약
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 프론트엔드/데모 패키지 위치
- [browser-system.md](../../docs/specs/browser-system/browser-system.md) — 브라우저 SDK 문맥
- [dsl-schema-versioning.spec.md](../../docs/specs/apm-system/apm-schema-system/dsl-schema-versioning.spec.md) — `BROWSER_CATALOG → shop-web` 파생 체인
- [getting-started.md](../../docs/getting-started.md) — 로컬 기동/포트

## 패키지 역할

- 로그인, 상품 탐색, 장바구니, 결제 흐름을 보여주는 데모 앱이다.
- 브라우저 SDK와 카탈로그 번들을 정적 파일 형태로 소비한다.
- Cloudflare Pages 배포와 로컬 정적 서빙을 전제로 한다.

## 코드 진입점

- `public/index.html` — 앱 진입점
- `public/config.js` — 런타임 설정
- `public/qa-browser-sdk.js` — 브라우저 수집 번들
- `public/catalog-loader-*.js`, `public/viz-3d-core.js` — 보조 번들
- `public/_redirects` — 프록시 규칙
- `wrangler.toml` — Pages 설정

## 실행

```bash
pnpm --filter @qa-sdk/shop-web dev
pnpm --filter @qa-sdk/shop-web start
pnpm --filter @qa-sdk/shop-web test
```
