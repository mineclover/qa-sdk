# VisBug edit-log 치트시트 (qa-sdk fork)

> 프로토콜 SSOT: `vendor/projectvisbug/app/edit-log/`  
> 데모: `pnpm --filter visbug-bridge demo` → `/packages/visbug-bridge/demo/edit-log-preview.html`

## 공통

| 동작 | 단축키 |
|------|--------|
| 도구 전환 | 툴바 클릭 또는 핫키 (모델 `vis-bug/model.js`) |
| 다중 선택 | `Shift` + 클릭 |
| edit-log 패널 | `Cmd+Shift+L` |
| 도움말 | `?` (도구 활성 시) |
| 스타일 되돌리기 | `Opt+Delete` |

**edit-log 엔트리:** `source: feature` (wrapper) + `source: mutation` (Observer) 동시 기록. 분석 시 `getHistory({ merge: 'correlated' })`.

---

## feature-wrapper 커버리지

### 간격

| 툴 | 핫키 | 조작 | feature | edit-log 함수 |
|----|------|------|---------|---------------|
| **padding** | `p` | `↑↓←→` / `Shift`+방향 = 전체 면 | `padding` | `padElement` |
| **margin** | `m` | `↑↓←→` / `Alt`+방향 / `Cmd`+`↑↓` 전체 | `margin` | `pushElement` |

### 타이포

| 툴 | 핫키 | 조작 | feature | edit-log 함수 |
|----|------|------|---------|---------------|
| **font** | `f` | `↑↓` 크기 · `Shift`+`←→` 자간 · `Shift`+`↑↓` 행간 · `←→` 정렬 | `font` | `changeFontSize` 등 |
| | | `Cmd`+`↑↓` weight · **`Cmd+B`** 굵게 · **`Cmd+I`** 기울임 | `font` | `toggleFontWeightBold` / `toggleFontStyleItalic` |

### 레이아웃

| 툴 | 핫키 | 조작 | feature | edit-log 함수 |
|----|------|------|---------|---------------|
| **move** | `v` | `←→` 형제 순서 · `↑↓` 트리 이동 | `move` | `moveElement` |
| | | 드래그 grip으로 형제 **swap** | `move` | `swapElements` (+ `beforeDOM` sibling index) |
| **align** | `a` | `↑↓←→` flex 정렬 · `Shift` 분배 | `flex` | `changeJustifyContent` 등 |
| **position** | `l` | `↑↓←→` nudge · 클릭 드래그 배치 | `position` | `positionElement` |
| **boxshadow** | `d` | 방향키 광원/그림자 | `boxshadow` | `changeBoxShadow` |

### 색상

| 툴 | 핫키 | 조작 | feature | edit-log 함수 |
|----|------|------|---------|---------------|
| **hueshift** | (툴바) | `←→` 채도 · `↑↓` 명도 · `Cmd`+방향 색조 | `hueshift` | `changeHue` |
| | | `[` `]` 전경/배경/테두리 전환 | | |
| **color** | (툴바 하단 피커) | 전경/배경/테두리 input | `color` | `applyForegroundColor` 등 |

### 콘텐츠 / 미디어

| 툴 | 조작 | feature | edit-log |
|----|------|---------|----------|
| **text** | `t` → 요소 클릭 → 편집 → **blur** / `Esc` | `text` | `dom-bind` → `beforeDOM`/`afterDOM.textContent` |
| **imageswap** | (전역) 이미지에 파일/이미지 드래그앤드롭 | `imageswap` | `updateContentImage` / `applyBackgroundImage` |

---

## replay 모드

| mode | 용도 |
|------|------|
| `css` | `afterCSS` → `element.style` |
| `feature` | `registry[feature](...args)` |
| `dom` | `afterDOM.textContent` 복원 |

```ts
ctrl.replay(entry, { mode: 'css' })
ctrl.replay(entry, { mode: 'dom' })
ctrl.replay(entry, { mode: 'feature', registry: { move: swapElements } })
```

---

## 아직 wrapper 밖 (mutation만)

| 동작 | 비고 |
|------|------|
| guides, inspector, search, screenshot 등 | 관측/조회 위주 |
| contenteditable 중간 keystroke | blur 시점에만 `text` feature |
| `Opt+Delete` unstyle | 별도 wrapper 없음 |

---

## bridge 마운트

```ts
mountVisBug(host, {
  colorScheme: 'light' | 'dark' | 'auto',
  onEntry: (e) => { /* EditLogEntry */ },
})
```

---

## 로컬 검증

```bash
make visbug-demo          # 프리뷰 서버
make visbug-smoke         # unit + e2e
pnpm --filter visbug test -- app/edit-log/integration.test.js
```
