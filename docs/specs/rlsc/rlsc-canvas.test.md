---
def:
  id: rlsc-canvas-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-canvas
      type: refines
---

## 목적 ^purpose

`renderToSVG`와 `assignColors`를 DOM 없이 검증한다.
SVG 렌더링은 문자열 반환이므로 서버·테스트 환경 호환.
`renderToCanvas`는 브라우저 가드만 검증한다.

소스: `packages/rlsc/src/canvas.test.ts`

## assignColors

| 시나리오 | 기대 결과 |
|----------|----------|
| `colorBy:"role"`, role=`"banner"` | `#4A90D9` |
| `colorBy:"role"`, 알 수 없는 role | `#999999` (fallback) |
| `colorBy:"depth"`, depth 0 vs depth 2 | 두 색상이 서로 다름 |
| `colorBy:"custom"`, palette에 id 있음 | palette 색상 |
| `colorBy:"custom"`, palette에 id 없음 | `#999999` (fallback) |

## renderToSVG — 기본 구조

| 시나리오 | 기대 결과 |
|----------|----------|
| 가시 노드 포함 | `<svg ...>` 로 시작, `</svg>` 로 끝 |
| 뷰포트 800×600 | `viewBox="0 0 800 600"` 포함 |
| 노드 (x=10, y=20, w=200, h=100) | `<rect x="10"`, `y="20"` 포함 |
| 비가시 노드 | 출력 제외 |
| role 있는 노드 | role 문자열 `<text>` 출력 |

## renderToSVG — 옵션

| 시나리오 | 기대 결과 |
|----------|----------|
| `showGrid: true` | `class="overlay-grid"` 그룹 포함 |
| `showBalance: true` | `class="overlay-balance"` 그룹 포함 |
| `showGrid: false` (기본) | `overlay-grid` 없음 |
| `opacity: 0.3` | `opacity="0.3"` 속성 포함 |

## renderToCanvas — 브라우저 가드

| 시나리오 | 기대 결과 |
|----------|----------|
| Node.js 환경 | `renderToCanvas()` → "브라우저 환경에서만" 에러 throw |
