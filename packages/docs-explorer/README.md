# @qa-sdk/docs-explorer

`@qa-sdk/docs-explorer`는 definition-catalog를 정적 데이터로 내보내 문서 트리/상세/링크를 탐색하는 웹 UI다.

## 먼저 볼 문서

- [docs-explorer.md](../../docs/specs/docs-explorer/docs-explorer.md) — 패키지 개요
- [docs-explorer.spec.md](../../docs/specs/viz-system/docs-explorer.spec.md) — UI 계약
- [definition-catalog.spec.md](../../docs/specs/definition-catalog/definition-catalog.spec.md) — 데이터 원천
- [definition-service-system.md](../../docs/specs/definition-service/definition-service-system.md) — 온라인 모드 문맥

## 패키지 역할

- definition-catalog 데이터를 정적 JSON으로 export하고, Vite SPA로 탐색 UI를 제공한다.
- 문서의 `scope/aspect/depth/lifecycle` 축을 브라우저에서 소비하는 consumer UI다.
- 서버 없이 정적 배포가 가능하도록 build 시점 export 경로를 가진다.

## 코드 진입점

- `index.html` — 앱 진입점
- `scripts/export-data.mjs` — definition-catalog → 정적 데이터 export
- `vite.config.ts` — dev/build/preview 설정
- `public/data.json` — export 산출물

## 실행

```bash
pnpm --filter @qa-sdk/docs-explorer dev
pnpm --filter @qa-sdk/docs-explorer build
pnpm --filter @qa-sdk/docs-explorer preview
pnpm --filter @qa-sdk/docs-explorer export
```
