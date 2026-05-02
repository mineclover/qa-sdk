# @qa-sdk/viz-3d

`@qa-sdk/viz-3d`는 좌표/시그널을 3D로 시각화하는 데모 패키지다. 전용 package spec은 얇고, indexing/viz 문서를 기준으로 읽는 것이 좋다.

## 먼저 볼 문서

- [viz-3d.spec.md](../../docs/specs/viz-system/viz-3d.spec.md) — 패키지 계약
- [signal-model.md](../../docs/specs/indexing-core-system/signal-model.md) — 시그널 모델
- [indexing/README.md](../../docs/specs/indexing/README.md) — indexing 상위 문맥
- [graph-renderer-live.spec.md](../../docs/specs/viz-system/viz-surface-system/graph-renderer-live.spec.md) — 실시간 시각화 맥락
- [graph-renderer-pipeline.spec.md](../../docs/specs/viz-system/viz-surface-system/graph-renderer-pipeline.spec.md) — 렌더링 파이프라인

## 패키지 역할

- 브라우저 codec과 Three.js 기반 3D 시각화를 묶는다.
- 좌표 시그널과 서비스 흐름을 브라우저 데모에서 체험하게 하는 runtime surface다.
- `platform-demo`와 shop 계열이 쓰는 3D 렌더링 번들을 제공한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/core-bundle.ts` — 순수 번들/핵심 묶음
- `scripts/generate-browser-catalog.ts` — prebuild catalog 생성
- `vite.config.ts` — build 설정

## 실행

```bash
pnpm --filter @qa-sdk/viz-3d prebuild
pnpm --filter @qa-sdk/viz-3d build
pnpm --filter @qa-sdk/viz-3d test
```
