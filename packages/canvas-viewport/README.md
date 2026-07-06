# canvas-viewport

`canvas-viewport`는 여러 캔버스/미니맵 UI에서 재사용하는 viewport 수학과 상태 보조층이다. 패키지 계약은 `canvas-viewport-spec`이 소유하고, overview 문서는 소비 UI가 같은 viewport abstraction을 경유하도록 라우팅한다.

## 먼저 볼 문서

- [canvas-viewport.spec.md](../../docs/specs/viz-system/canvas-viewport.spec.md) — 패키지 계약
- [canvas-viewport-spec.spec.md](../../docs/specs/canvas-viewport-spec.spec.md) — overview/routing entry
- [scope-nesting-visualization.spec.md](../../docs/specs/scope-nesting/scope-nesting-visualization.spec.md) — viewport/preview 계열 시각화가 어떤 역할로 분리되는지
- [viz-system.md](../../docs/specs/viz-system/viz-system.md) — 시각화 UI 계층 전체 경계
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 프론트엔드/데모 패키지의 저장소 내 위치

## 패키지 역할

- pan/zoom, minimap, HUD, support bar 같은 canvas chrome 공통 요소를 묶는다.
- 앱별 UI 코드가 viewport 수학을 다시 구현하지 않도록 공용 컨트롤러와 상태를 제공한다.
- 스타일은 `./styles.css` export로 노출한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/math.ts` — viewport 계산
- `src/controller.ts` — viewport controller
- `src/chrome.ts`, `src/hud.ts`, `src/support-bar.ts` — UI 보조 surface
- `src/ui-state.ts` — 상태 모델
- `src/styles.css` — 공용 스타일

## 실행

```bash
corepack pnpm --filter canvas-viewport build
corepack pnpm --filter canvas-viewport typecheck
```

계약을 넓히는 변경이 생기면 `docs/specs/viz-system/canvas-viewport.spec.md`와 소비자 시나리오를 함께 보강하는 흐름이 안전하다.
