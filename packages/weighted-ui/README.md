# weighted-ui

`weighted-ui`는 weighted-index 계열 앱이 공유하는 UI 컴포넌트와 스타일 토큰 묶음이다. 아직 전용 package spec은 없고, 관련 UI/시각화 상위 문서를 기준으로 유지한다.

## 먼저 볼 문서

- [weighted-ui.spec.md](../../docs/specs/viz-system/weighted-ui.spec.md) — 패키지 계약
- [indexing/README.md](../../docs/specs/indexing/README.md) — 이 UI가 설명하려는 indexing 개념의 상위 문맥
- [viz-system.md](../../docs/specs/viz-system/viz-system.md) — 시각화 UI 계층의 구조
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 데모/프론트엔드 패키지 맥락

## 패키지 역할

- badge, hex-bar, mode-toggle 같은 재사용 컴포넌트를 제공한다.
- weighted-index 데모 앱들이 공통으로 쓰는 CSS 토큰과 layout 스타일을 묶는다.
- `weighted-index-explorer`, `platform-demo` 같은 앱에서 일관된 시각 언어를 유지하게 한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/components/*` — 공용 UI 컴포넌트
- `src/utils/*` — 색상/포맷 유틸리티
- `src/styles/index.css` — 기본 스타일 엔트리
- `src/styles/tokens/*` — 테마 토큰 export

## 실행

```bash
pnpm --filter weighted-ui build
pnpm --filter weighted-ui dev
```

전용 central spec이 생기기 전까지는, 이 패키지의 public surface를 넓히는 변경은 consumer 앱과 상위 시각화 문서를 같이 보고 결정하는 편이 안전하다.
