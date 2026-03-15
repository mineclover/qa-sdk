# weighted-ui 디자인 시스템

`weighted-index-explorer`와 `platform-demo` 두 앱에서 공통적으로 사용하는 표시 방식과 표시 관련 연산을 통합하는 공유 UI 라이브러리.

---

## 1. 통합 근거

### 1.1 현재 중복 현황

| 영역 | explorer 위치 | platform-demo 위치 | 중복 수준 |
|------|-------------|-------------------|----------|
| CSS 토큰 (surface, border, text) | `styles/main.css :root` | `styles/main.css :root` | **동일** (20+ 변수) |
| 그리드 컴포넌트 (xl-grid) | `styles/main.css` + `ui/grid.ts` | `styles/main.css` + `pages/*.ts` | **동일** CSS + 유사 TS |
| 색상 보간 (density fill) | `utils/colors.ts:getDensityFill` | `pages/service.ts:interpolateHex+densityFill` | **유사** (알고리즘 다름) |
| 대비 잉크 색상 | `utils/colors.ts:getDimInk` fallback | `pages/service.ts:densityInk` | **유사** |
| 배지/태그 시스템 | `utils/badge.ts` | `pages/*.ts` 인라인 | **패턴 동일** |
| Hex 바 시각화 | `utils/hex-bar.ts:renderHexBar` | `pages/layout.ts:repaintStruct` | **구조 동일** |
| 수식 표시 | `utils/encode-html.ts` | — | explorer 전용 |
| 사이드바 (.sb-*) | `styles/main.css` + `main.ts` | `styles/main.css` + `pages/*.ts` | **동일** CSS |
| 사이드 패널 (.sp-*) | `styles/main.css` + `ui/detail.ts` | `styles/main.css` + `pages/*.ts` | **동일** CSS |
| 숫자 포매팅 | weighted-index `formatLargeNumber` | weighted-index `formatLargeNumber` | **동일** (이미 공유) |
| 첨자 변환 | `utils/encode-html.ts:subscript` | — | explorer 전용 |
| 컬럼 레터 (A, B, ...) | `utils/colors.ts:colLetter` | — | explorer 전용 |
| 리본/탭 네비게이션 | `styles/main.css` + `index.html` | `styles/main.css` + `main.ts` | **동일** CSS |
| 모드 토글 버튼 그룹 | — | `pages/layout.ts` | platform-demo 전용 |
| 슬라이더 (로그 스케일) | — | `pages/layout.ts` | platform-demo 전용 |

### 1.2 통합 판단 기준

통합 대상:
- **CSS 토큰** — 두 앱 간 변수명·구조가 동일, 값(테마 색상)만 다름 → 토큰 레이어 통합
- **색상 유틸** — 두 앱 모두 density gradient + contrast ink 필요, 알고리즘 통합
- **그리드 CSS** — `.xl-grid`, `.xl-cell`, `.xl-corner` 등 동일 패턴 → CSS 통합
- **사이드바/패널 CSS** — `.sb-*`, `.sp-*` 동일 → CSS 통합
- **배지/태그 유틸** — HTML string 생성 패턴 동일 → 유틸 통합
- **Hex 바** — 구조 동일, API 통합 가능 → 컴포넌트 통합

통합하지 않는 것:
- **도메인 데이터** (DimKey, 스키마 정의 등) — 각 앱 고유
- **API 클라이언트** — 앱별 백엔드 연동
- **페이지 레이아웃** — 전체 라우팅/시트 구조는 앱마다 다름
- **앱 셸** (리본, 시트탭) — 구조 유사하지만 콘텐츠가 앱 전용

---

## 2. 디자인 토큰

### 2.1 토큰 구조

```
tokens/
├── base.css        ← 테마 독립 토큰 (surface, border, text, dimensions, font)
└── themes/
    ├── green.css   ← explorer 테마 (--ui-primary: #217346)
    └── navy.css    ← platform-demo 테마 (--ui-primary: #1e3a5f)
```

### 2.2 시맨틱 토큰 매핑

두 앱에서 동일한 역할이지만 다른 값을 가진 토큰을 시맨틱 이름으로 통합:

```css
/* base.css — 테마 독립, 모든 앱 공통 */
:root {
  /* Surface */
  --surface-0:        #ffffff;     /* 셀/카드 기본 배경 */
  --surface-1:        #f2f2f2;     /* 짝수 행, 빈 영역 */
  --surface-2:        #e9e9e9;     /* 헤더 배경 */

  /* Selection (blue — 테마 불문 공통) */
  --xl-blue:          #2e75b6;
  --xl-blue-light:    #cce4ff;
  --xl-blue-hover:    #e8f2ff;

  /* Border */
  --border-cell:      #d4d4d4;
  --border-header:    #b0b0b0;
  --border-formula:   #c8c8c8;

  /* Text */
  --text-cell:        #000000;
  --text-header:      #595959;
  --text-ribbon:      #ffffff;
  --text-muted:       #767676;
  --text-dim:         #b0b0b0;
  --text-formula:     #1a1a1a;

  /* Typography */
  --font:     'Noto Sans KR', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-num: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;

  /* Dimensions (defaults — 앱에서 override 가능) */
  --ribbon-h:      42px;
  --formulabar-h:  26px;
  --bottom-h:      30px;
  --cell-h:        52px;
  --cell-min-w:    88px;
  --row-header-w:  72px;
  --col-header-h:  22px;

  /* Radius */
  --radius-sm: 2px;
  --radius:    3px;
}
```

```css
/* themes/green.css — explorer */
:root {
  --ui-primary:       #217346;
  --ui-primary-dark:  #185c38;
  --ui-primary-light: #e8f5ee;
  --ui-primary-faint: #f0faf4;

  --surface-ribbon:   var(--ui-primary);
  --surface-status:   var(--ui-primary);
  --border-ribbon:    var(--ui-primary-dark);
  --text-formula-fn:  var(--ui-primary);
}
```

```css
/* themes/navy.css — platform-demo */
:root {
  --ui-primary:       #1e3a5f;
  --ui-primary-dark:  #152c4a;
  --ui-primary-light: #e8eef5;
  --ui-primary-faint: #f0f4f8;

  --surface-ribbon:   var(--ui-primary);
  --surface-status:   var(--ui-primary);
  --border-ribbon:    var(--ui-primary-dark);
  --text-formula-fn:  var(--ui-primary);

  /* platform-demo 전용 override */
  --row-header-w:  180px;
  --col-header-h:  36px;
  --cell-min-w:    96px;
}
```

### 2.3 도메인 색상 토큰

도메인 색상(env, role, category)은 앱마다 다르므로 **weighted-ui에 포함하지 않음**.
각 앱이 자체 CSS에서 정의. weighted-ui는 `--ui-primary` 계열만 제공.

---

## 3. 유틸리티 (display-related 연산)

### 3.1 `utils/colors.ts` — 색상 보간 및 밀도 계산

```typescript
/**
 * 두 hex 색상 사이 선형 보간.
 * 두 앱 모두 density gradient에 사용.
 *
 * explorer: getDensityFill → white→yellow→green (3구간)
 * platform-demo: densityFill → navy gradient (1구간)
 *
 * 통합: interpolateHex를 기본 빌딩블록으로, 앱별 gradient는 이 위에 조합.
 */
export function interpolateHex(from: string, to: string, t: number): string;

/**
 * Navy blue density gradient (platform-demo 방식).
 * from=#e8eef5 → to=#1e3a5f, t 범위를 0.8로 캡.
 */
export function densityFill(value: number, maxValue: number): string;

/**
 * 배경 밝기 기반 텍스트 색상 선택.
 * explorer: 임계값 없이 dim ink 맵에서 조회
 * platform-demo: t > 0.55 → white, else black
 *
 * 통합: 범용 contrast ink + 앱별 dim color 맵은 각 앱이 관리.
 */
export function densityInk(value: number, maxValue: number): string;

/**
 * hex 색상의 relative luminance 기반 흑/백 선택.
 * W3C contrast 알고리즘.
 */
export function contrastInk(hexColor: string): "#000000" | "#ffffff";
```

### 3.2 `utils/format.ts` — 숫자·텍스트 포매팅

```typescript
/**
 * 큰 숫자를 사람이 읽기 쉬운 형태로.
 * 현재 weighted-index에 있지만, 표시 전용이므로 여기로 이동 검토.
 *
 * 판단: weighted-index에서 이미 export → re-export로 통합.
 * (향후 weighted-index에서 제거하고 여기로 이전 가능)
 */
export { formatLargeNumber } from "weighted-index";

/**
 * N hex chars 필드의 미리보기 문자열.
 * 0x + padStart(chars, "0") 형식.
 *
 * explorer: hex-bar.ts에서 인라인
 * platform-demo: layout.ts:hexPreview
 */
export function hexPreview(chars: number, val: number): string;

/**
 * 숫자를 유니코드 첨자로 변환. 1 → ₁, 123 → ₁₂₃
 *
 * explorer: encode-html.ts:subscript
 * platform-demo: 사용 안 함 (하지만 범용 유틸)
 */
export function subscript(n: number): string;

/**
 * Excel 스타일 컬럼 레터. 0→A, 1→B, ..., 25→Z, 26→AA
 *
 * explorer: colors.ts:colLetter
 * platform-demo: 사용 안 함
 */
export function colLetter(idx: number): string;
```

---

## 4. 컴포넌트 카탈로그

모든 컴포넌트는 **HTML string을 반환하는 순수 함수**. 프레임워크 의존성 없음.
CSS 클래스는 `styles/` 디렉토리에서 제공.

### 4.1 Grid (데이터 그리드)

```
components/grid.ts
styles/grid.css
```

**역할**: Excel 스타일 2D 데이터 그리드. 스티키 헤더, 셀 선택/호버, 짝수 행 배경.

**현재 중복**:
- explorer `ui/grid.ts` — DOM 생성 방식, `renderGrid()`
- platform-demo `pages/service.ts`, `pages/permission.ts`, `pages/event.ts` — 각 페이지에서 개별 구현

**통합 API 설계**:
```typescript
interface GridConfig {
  columns: { key: string; label: string; width?: string }[];
  rows: { header: string; cells: GridCell[] }[];
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  stickyHeaders?: boolean;  // default: true
}

interface GridCell {
  value: string | number;
  fill?: string;     // background color
  ink?: string;      // text color
  selected?: boolean;
  class?: string;    // 추가 CSS 클래스
}

/** DOM Element를 반환 (이벤트 바인딩 필요) */
export function createGrid(config: GridConfig): HTMLTableElement;

/** 셀 선택 상태만 업데이트 (DOM 재생성 없이) */
export function updateGridSelection(
  table: HTMLTableElement,
  prev: number | null,
  next: number | null,
): void;
```

**CSS 클래스**: `.xl-grid`, `.xl-cell`, `.xl-corner`, `.xl-col-header`, `.xl-row-header`, `.selected`

### 4.2 Sidebar (차원 선택 사이드바)

```
components/sidebar.ts
styles/sidebar.css
```

**역할**: 수직 목록으로 차원 값 표시. 선택 시 왼쪽 보더 액센트.

**현재 중복**:
- explorer `main.ts` — `.sb-item`, `.sb-active`
- platform-demo `pages/service.ts:buildDimSidebar` — 동일 패턴

**통합 API**:
```typescript
interface SidebarItem {
  id: string;
  label: string;
  sublabel?: string;  // 한국어 레이블 등
  fill?: string;
  ink?: string;
}

export function createSidebar(
  items: SidebarItem[],
  onSelect: (id: string) => void,
): HTMLElement;

export function updateSidebarSelection(
  el: HTMLElement,
  activeId: string,
): void;
```

**CSS 클래스**: `.sb-list`, `.sb-item`, `.sb-active`, `.sb-val`, `.sb-ko`

### 4.3 DetailPanel (우측 상세 패널)

```
components/detail-panel.ts
styles/detail-panel.css
```

**역할**: 선택된 항목의 상세 정보. 섹션 기반 레이아웃.

**현재 중복**:
- explorer `ui/detail.ts` — 4개 섹션 (coords, encode, decode, meaning)
- platform-demo `pages/service.ts:renderServiceDetail` — 다수 섹션

**통합 API**:
```typescript
interface DetailSection {
  title: string;
  rows: { label: string; value: string; class?: string }[];
  html?: string;  // rows 대신 커스텀 HTML
}

/** 상세 패널 HTML string 반환 */
export function renderDetailPanel(sections: DetailSection[]): string;

/** placeholder 표시/숨김 토글 */
export function toggleDetailPlaceholder(
  container: HTMLElement,
  show: boolean,
  placeholder?: string,
): void;
```

**CSS 클래스**: `.sp-section`, `.sp-sec-header`, `.sp-sec-body`, `.detail-row`, `.detail-label`, `.detail-value`

### 4.4 HexBar (hex 필드 시각화)

```
components/hex-bar.ts
styles/hex-bar.css
```

**역할**: UUID/주소의 hex 문자별 필드 구분 시각화.

**현재 중복**:
- explorer `utils/hex-bar.ts:renderHexBar` — 완성도 높은 구현
- platform-demo `pages/layout.ts:repaintStruct` — 유사하지만 다른 API

**통합 방향**: explorer 구현을 기반으로, layout 시뮬레이터의 세그먼트 바도 지원.

**통합 API**:
```typescript
interface HexField {
  type: "prefix" | "version" | "shard" | "gap" | "index";
  chars: number;
  value?: number;  // hex 값 (없으면 0으로 채움)
}

export function renderHexBar(
  label: string,
  capacity: number,
  fields: HexField[],
  options?: {
    showLabels?: boolean;     // default: true
    showFormatted?: boolean;  // default: false
    formatGroups?: number[];  // e.g. [8,4,4,4,12] for UUID
  },
): string;
```

**CSS 클래스**: `.hex-layout`, `.hex-bar`, `.hex-cell`, `.hex-cell-{type}`, `.hex-cell-sep`, `.hex-label`, `.hex-labels`

### 4.5 Badge (인라인 배지/태그)

```
components/badge.ts
styles/badge.css
```

**역할**: 인라인 컬러 배지, 태그, 코드 블록.

**현재 중복**:
- explorer `utils/badge.ts` — `dimBadge`, `coordChip`, `permIdCode`, `newTag`
- platform-demo — `envTagClass`, role tags, event tags (인라인)

**통합 API**:
```typescript
/** 단색 인라인 배지 */
export function badge(text: string, fill: string, ink: string): string;

/** 그룹 배지 (label → value → info 구조) */
export function chip(parts: {
  label?: string;
  value: string;
  info?: string;
  fill: string;
  ink: string;
  isNew?: boolean;
}): string;

/** 코드 스타일 배지 */
export function codeBadge(text: string): string;

/** NEW 태그 */
export function newTag(): string;

/** 정보 배지 (green/gray/blue 등) */
export function infoBadge(text: string, variant: "green" | "gray" | "blue" | "red"): string;
```

**CSS 클래스**: `.ui-badge`, `.ui-chip`, `.ui-code`, `.new-tag`, `.info-badge`, `.info-badge-{variant}`

### 4.6 ModeToggle (버튼 그룹 토글)

```
components/mode-toggle.ts
styles/mode-toggle.css
```

**역할**: 상호 배타적 모드 선택 버튼 그룹.

**현재 사용**:
- platform-demo `layout.ts` — Number/BigInt 모드 토글
- explorer `main.ts` — color mode 토글 (`.tcb-btn` 패턴)

**통합 API**:
```typescript
interface ToggleOption {
  id: string;
  label: string;
}

export function createModeToggle(
  options: ToggleOption[],
  activeId: string,
  onChange: (id: string) => void,
): HTMLElement;

export function setModeToggleActive(el: HTMLElement, activeId: string): void;
```

**CSS 클래스**: `.ui-toggle`, `.ui-toggle-btn`, `.ui-toggle-active`

### 4.7 FormulaBlock (수식 표시)

```
components/formula.ts
styles/formula.css
```

**역할**: 하이라이트된 수식 표시 블록.

**현재 사용**:
- explorer — `.xl-formula-block` + `encode-html.ts`
- platform-demo — `pages/range.ts:buildFormula` 에서 유사 패턴

**통합 API**:
```typescript
/** 수식 블록 (라벨 + 표현식) */
export function formulaBlock(label: string, expr: string): string;

/** 수식 테이블 행 (단계별 계산 표시) */
export function formulaRow(step: string, expr: string, isResult?: boolean): string;
```

**CSS 클래스**: `.xl-formula-block`, `.xlf-label`, `.xlf-expr`, `.formula-tbl`, `.ftbl-step`, `.ftbl-expr`, `.ftbl-result`

---

## 5. CSS 컴포넌트 스타일

### 5.1 파일 구조

```
styles/
├── index.css       ← @import 순서 정의
├── reset.css       ← box-sizing, body 기본값
├── grid.css        ← .xl-grid, .xl-cell, ...
├── sidebar.css     ← .sb-list, .sb-item, ...
├── detail-panel.css ← .sp-section, .detail-row, ...
├── hex-bar.css     ← .hex-layout, .hex-bar, .hex-cell, ...
├── badge.css       ← .ui-badge, .ui-chip, ...
├── controls.css    ← .ui-toggle, 슬라이더, 입력 폼
└── formula.css     ← .xl-formula-block, .formula-tbl, ...
```

### 5.2 앱 적용 방식

```css
/* explorer의 main.css */
@import "weighted-ui/styles";            /* base + reset + components */
@import "weighted-ui/styles/green.css";  /* green 테마 */

/* 앱 전용 스타일 */
.concept-block { ... }
```

```css
/* platform-demo의 main.css */
@import "weighted-ui/styles";
@import "weighted-ui/styles/navy.css";   /* navy 테마 */

/* 앱 전용 스타일 */
.scenario-section { ... }
.lay-slider-section { ... }
```

### 5.3 CSS 네이밍 규칙

| 접두사 | 소속 | 예시 |
|--------|------|------|
| `.xl-` | weighted-ui (grid) | `.xl-grid`, `.xl-cell` |
| `.sb-` | weighted-ui (sidebar) | `.sb-item`, `.sb-active` |
| `.sp-` | weighted-ui (panel) | `.sp-section`, `.sp-sec-header` |
| `.hex-` | weighted-ui (hex bar) | `.hex-cell`, `.hex-bar` |
| `.ui-` | weighted-ui (범용) | `.ui-badge`, `.ui-toggle` |
| `.concept-` | explorer 전용 | `.concept-block` |
| `.lay-` | platform-demo 전용 | `.lay-slider-section` |
| `.svc-` | platform-demo 전용 | `.svc-tag-dev` |

---

## 6. 마이그레이션 전략

### Phase 1: 토큰 + 유틸 (이 단계)
1. `tokens/base.css`, `tokens/themes/{green,navy}.css` 작성
2. `utils/colors.ts`, `utils/format.ts` 구현
3. 빌드 검증 (tsup → ESM/CJS/DTS)
4. 두 앱에서 `weighted-ui` 의존성 추가
5. 앱 CSS에서 공통 토큰을 `@import`로 대체
6. 앱 TS에서 color/format 유틸을 import 전환

### Phase 2: CSS 컴포넌트
1. `.xl-grid`, `.sb-*`, `.sp-*` CSS를 weighted-ui로 추출
2. `.hex-*`, `.ui-badge`, `.formula-*` CSS 추출
3. 앱 CSS에서 중복 제거, import로 대체
4. 앱별 override는 앱 CSS에 유지

### Phase 3: TS 컴포넌트
1. `createGrid`, `createSidebar`, `renderDetailPanel` 구현
2. `renderHexBar` 통합 (explorer 구현 기반)
3. `badge`, `chip`, `codeBadge` 유틸 구현
4. `createModeToggle`, `formulaBlock` 구현
5. 각 앱에서 인라인 구현 → weighted-ui import로 전환

### Phase 4: 정리
1. 앱 CSS에서 weighted-ui로 이전된 중복 코드 제거
2. 앱 유틸 파일에서 이전된 함수 제거
3. 통합 테스트 (두 앱 모두 정상 렌더링 확인)

---

## 7. 빌드 의존성

```
weighted-index (core codec)
     ↓
weighted-ui (display layer)
     ↓
├── weighted-index-explorer (app)
└── platform-demo (app)
```

- `weighted-ui`는 `weighted-index`에 peer dependency (formatLargeNumber re-export)
- 앱은 `weighted-ui` + `weighted-index` 모두 의존
- 빌드 순서: `weighted-index` → `weighted-ui` → 앱

---

## 8. 설계 원칙

1. **프레임워크 무관** — 순수 HTML string + DOM API. 두 앱 모두 vanilla TS.
2. **테마 가능** — CSS 변수 기반, 앱별 `--ui-primary` override로 브랜딩.
3. **점진적 채택** — 앱이 한 번에 전환할 필요 없음. 컴포넌트별 독립 import.
4. **표시 전용** — 비즈니스 로직, API 호출, 라우팅은 포함하지 않음.
5. **최소 의존성** — weighted-index만 peer dep. 외부 라이브러리 없음.
