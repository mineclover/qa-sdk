# RLSC × pretext 텍스트 점유 분석 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RLSC에 `@chenglou/pretext`를 통합하여 텍스트의 시각적 공간 점유(x/y 축 점유율, 경계 접촉, 오버플로우)를 측정한다.

**Architecture:** `collectLayoutWithText()` 신규 함수가 기존 `collectLayout()` 내부를 공유하면서 font 정보 + PreparedText를 함께 반환. 후처리 `analyzeTextOccupancy()`가 pretext의 `layout()`으로 순수 산술 점유 분석. 영역 집계는 기존 `extractRegions()`와 합성.

**Tech Stack:** TypeScript, `@chenglou/pretext@0.0.4`, vitest, tsup (ESM+CJS)

**Spec:** `docs/superpowers/specs/2026-04-06-rlsc-pretext-integration-design.md`

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `packages/rlsc/package.json` | 수정 | pretext 의존성 추가 |
| `packages/rlsc/src/types.ts` | 수정 | `TextFontInfo`, `TextOccupancy`, `TextRegionDensity`, `TextPreparedMap` 타입 |
| `packages/rlsc/src/collector.ts` | 수정 | `extractFontInfo()`, `getFullText()`, `collectLayoutWithText()` |
| `packages/rlsc/src/text-occupancy.ts` | 생성 | `prepareTextMap()`, `analyzeTextOccupancy()`, `aggregateTextRegions()` |
| `packages/rlsc/src/text-occupancy.test.ts` | 생성 | pretext mock 기반 단위 테스트 |
| `packages/rlsc/src/index.ts` | 수정 | 새 타입/함수 export |

---

### Task 1: 의존성 추가 + 빌드 확인

**Files:**
- Modify: `packages/rlsc/package.json`

- [ ] **Step 1: pretext 의존성 추가**

```bash
pnpm --filter rlsc add @chenglou/pretext@0.0.4
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter rlsc build`
Expected: 성공 (pretext는 아직 import하지 않으므로 기존 빌드 그대로 통과)

- [ ] **Step 3: 기존 테스트 통과 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add packages/rlsc/package.json pnpm-lock.yaml
git commit -m "chore(rlsc): add @chenglou/pretext dependency"
```

---

### Task 2: 타입 정의 (`types.ts`)

**Files:**
- Modify: `packages/rlsc/src/types.ts` (파일 끝에 추가)

- [ ] **Step 1: TextFontInfo, TextOccupancy, TextRegionDensity 타입 추가**

`types.ts` 파일 끝(`LayoutMonitor` 인터페이스 뒤)에 아래를 추가:

```typescript
// ─── Text Occupancy ────────────────────────────────────────────────

/** 수집 시점에 노드에 부착되는 폰트 정보 */
export interface TextFontInfo {
  /** Canvas font shorthand ("500 16px Inter") */
  readonly fontString: string;
  /** CSS line-height (px) */
  readonly lineHeight: number;
  /** CSS text-align */
  readonly textAlign: string;
  /** 내부 여백 (px) */
  readonly padding: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
}

/** 노드별 텍스트 점유 분석 결과 */
export interface TextOccupancy {
  readonly nodeId: string;
  /** 뷰포트 좌표 기준 텍스트 실제 렌더링 영역 */
  readonly renderedRect: LayoutRect;
  /** 컨테이너 대비 x축 점유율 (0–1) */
  readonly fillX: number;
  /** 컨테이너 대비 y축 점유율 (0–1) */
  readonly fillY: number;
  /** 줄 수 */
  readonly lineCount: number;
  /** shrink-wrap 너비 (px) */
  readonly naturalWidth: number;
  /** 텍스트와 컨테이너 content-box 사이의 여백 (px) */
  readonly margins: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  /** 경계 접촉 판정 (margin < threshold) */
  readonly boundaryContact: {
    readonly top: boolean;
    readonly right: boolean;
    readonly bottom: boolean;
    readonly left: boolean;
  };
  /** 텍스트가 컨테이너 밖으로 넘침 */
  readonly overflows: boolean;
}

/** 영역별 텍스트 밀도 집계 */
export interface TextRegionDensity {
  /** GridRegion nodeId */
  readonly regionId: string;
  /** 영역 내 텍스트 총 면적 (px²) */
  readonly textArea: number;
  /** 영역 면적 (px²) */
  readonly regionArea: number;
  /** 텍스트 밀도 (0–1) */
  readonly density: number;
  /** 영역 내 노드 평균 x 점유 */
  readonly avgFillX: number;
  /** 영역 내 노드 평균 y 점유 */
  readonly avgFillY: number;
  /** 경계 접촉 노드 수 */
  readonly contactCount: number;
}
```

- [ ] **Step 2: RLSCNode에 fontInfo 필드 추가**

`RLSCNode` 인터페이스에 추가:

```typescript
  /** 폰트 정보 (텍스트가 있는 노드에만 존재) */
  readonly fontInfo?: TextFontInfo;
```

위치: `readonly address?: string;` 바로 아래.

- [ ] **Step 3: CollectorOptions에 collectFontInfo 추가**

`CollectorOptions`에 추가:

```typescript
  /** 텍스트 노드의 폰트 정보 수집 여부. 기본 true */
  readonly collectFontInfo?: boolean;
```

- [ ] **Step 4: 타입체크 확인**

Run: `pnpm --filter rlsc typecheck`
Expected: PASS

- [ ] **Step 5: 기존 테스트 통과 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS (타입 추가만이므로 기존 테스트에 영향 없음)

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/types.ts
git commit -m "feat(rlsc): add TextFontInfo, TextOccupancy, TextRegionDensity types"
```

---

### Task 3: Collector 확장 (`collector.ts`)

**Files:**
- Modify: `packages/rlsc/src/collector.ts`

- [ ] **Step 1: extractFontInfo 헬퍼 구현**

`isVisible()` 함수 아래, `collectNode()` 위에 추가:

```typescript
/** CSS computed style에서 Canvas font shorthand + 레이아웃 정보를 추출한다 */
function extractFontInfo(
  style: CSSStyleDeclaration,
): TextFontInfo {
  const weight = style.fontWeight;
  const size = style.fontSize; // "16px" 형태
  const family = style.fontFamily;
  const fontString = `${weight} ${size} ${family}`;

  // line-height: "normal" → fontSize × 1.2, "20px" → 20, "1.5" → fontSize × 1.5
  const rawLH = style.lineHeight;
  const fontSize = parseFloat(size);
  let lineHeight: number;
  if (rawLH === "normal") {
    lineHeight = fontSize * 1.2;
  } else if (rawLH.endsWith("px")) {
    lineHeight = parseFloat(rawLH);
  } else {
    // 단위 없는 숫자 (배율)
    lineHeight = fontSize * parseFloat(rawLH);
  }

  return {
    fontString,
    lineHeight: Math.round(lineHeight * 100) / 100,
    textAlign: style.textAlign,
    padding: {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
    },
  };
}
```

- [ ] **Step 2: getFullText 헬퍼 추가**

`getDirectText()` 아래에 추가:

```typescript
/** truncation 없는 전체 직접 텍스트 반환 (pretext prepare 입력용) */
function getFullText(el: Element): string | undefined {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent?.trim() ?? "";
    }
  }
  text = text.trim();
  return text || undefined;
}
```

- [ ] **Step 3: import에 TextFontInfo 추가**

파일 상단 import를 수정:

```typescript
import type {
  RLSCNode,
  RLSCDocument,
  CollectorOptions,
  LayoutRect,
  TextFontInfo,
} from "./types.js";
```

- [ ] **Step 4: collectNode에 fontInfo 부착**

`collectNode()` 함수의 return 문에서, `textContent` 줄 아래에 `fontInfo`를 추가:

```typescript
    textContent: getDirectText(el, opts.maxTextLength),
    fontInfo:
      opts.collectFontInfo !== false && getFullText(el)
        ? extractFontInfo(style)
        : undefined,
```

- [ ] **Step 5: DEFAULT_OPTIONS에 collectFontInfo 추가**

```typescript
const DEFAULT_OPTIONS: Required<CollectorOptions> = {
  minSize: 4,
  maxDepth: 20,
  includeHidden: false,
  maxTextLength: 80,
  addressAttribute: "data-qa-address",
  collectFontInfo: true,
};
```

- [ ] **Step 6: collectLayoutWithText 함수 추가**

`collectLayout()` 함수 아래에 추가:

```typescript
/** pretext PreparedText를 담는 Map. nodeId → PreparedText */
export type TextPreparedMap = Map<string, unknown>;

/**
 * collectLayout()과 동일하되, 텍스트 노드에 대해 pretext prepare()를 수행하여
 * PreparedText Map을 함께 반환한다.
 *
 * TextPreparedMap은 text-occupancy 모듈의 analyzeTextOccupancy()에 전달한다.
 */
export function collectLayoutWithText(
  root?: Element,
  options?: CollectorOptions,
): { doc: RLSCDocument; textPrepared: TextPreparedMap } {
  const doc = collectLayout(root, options);
  // prepareTextMap은 text-occupancy 모듈에서 담당
  // 여기서는 doc만 반환하고, textPrepared는 외부에서 prepareTextMap(doc)으로 생성
  return { doc, textPrepared: new Map() };
}
```

> 참고: 실제 prepare() 호출은 Task 4의 `prepareTextMap()`에서 수행. `collectLayoutWithText`는 편의 wrapper로 시작하고, Task 4 완료 후 내부에서 `prepareTextMap()`을 호출하도록 업데이트.

- [ ] **Step 7: 타입체크 + 기존 테스트 확인**

Run: `pnpm --filter rlsc typecheck && pnpm --filter rlsc test`
Expected: 모두 PASS

- [ ] **Step 8: 커밋**

```bash
git add packages/rlsc/src/collector.ts packages/rlsc/src/types.ts
git commit -m "feat(rlsc): add fontInfo collection + collectLayoutWithText"
```

---

### Task 4: 텍스트 점유 분석 모듈 — 테스트 먼저 (`text-occupancy.test.ts`)

**Files:**
- Create: `packages/rlsc/src/text-occupancy.test.ts`

- [ ] **Step 1: 테스트 파일 생성 — 노드 fixture + mock 설정**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { RLSCNode, RLSCDocument, TextOccupancy } from "./types.js";
import { analyzeGrid } from "./grid.js";

// ── pretext mock ──────────────────────────────────────────────────────
// pretext는 브라우저 Canvas 필요. Node 환경에서는 mock으로 순수 산술 로직만 검증.

vi.mock("@chenglou/pretext", () => ({
  prepare: vi.fn(() => ({ __brand: "PreparedText" })),
  layout: vi.fn((_prepared: unknown, _maxWidth: number, lineHeight: number) => ({
    lineCount: 2,
    height: lineHeight * 2,
  })),
  measureLineStats: vi.fn(() => ({
    lineCount: 2,
    maxLineWidth: 160,
  })),
  measureNaturalWidth: vi.fn(() => 180),
}));

// ── 헬퍼 ──────────────────────────────────────────────────────────────

function textNode(
  id: string,
  x: number, y: number, w: number, h: number,
  text: string,
  opts?: {
    textAlign?: string;
    padding?: { top: number; right: number; bottom: number; left: number };
  },
): RLSCNode {
  return {
    id, tag: "p", classes: [],
    rect: { x, y, width: w, height: h },
    zIndex: 0, depth: 1,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children: [],
    textContent: text,
    fontInfo: {
      fontString: "400 16px sans-serif",
      lineHeight: 20,
      textAlign: opts?.textAlign ?? "left",
      padding: opts?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
}

function emptyNode(id: string, x: number, y: number, w: number, h: number): RLSCNode {
  return {
    id, tag: "div", classes: [],
    rect: { x, y, width: w, height: h },
    zIndex: 0, depth: 1,
    display: "block", position: "static", overflow: "visible",
    visible: true, attributes: {}, children: [],
  };
}

function makeDoc(children: RLSCNode[]): RLSCDocument {
  const vp = { width: 1024, height: 768 };
  const root: RLSCNode = {
    id: "root", tag: "body", classes: [],
    rect: { x: 0, y: 0, width: 1024, height: 768 },
    zIndex: 0, depth: 0, display: "block", position: "static",
    overflow: "visible", visible: true, attributes: {}, children,
  };
  return {
    version: "1.0", viewport: vp,
    url: "http://localhost", timestamp: "2024-01-01T00:00:00.000Z",
    root, grid: analyzeGrid(root, vp),
    layers: [], relations: [],
  };
}
```

- [ ] **Step 2: prepareTextMap 테스트 추가**

```typescript
import {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
} from "./text-occupancy.js";
import { prepare } from "@chenglou/pretext";

describe("prepareTextMap", () => {
  it("fontInfo + textContent가 있는 노드만 prepare 호출", () => {
    const t = textNode("p1", 0, 0, 200, 100, "Hello World");
    const e = emptyNode("div1", 0, 100, 200, 100);
    const doc = makeDoc([t, e]);

    const map = prepareTextMap(doc);

    expect(map.size).toBe(1);
    expect(map.has("p1")).toBe(true);
    expect(map.has("div1")).toBe(false);
    expect(prepare).toHaveBeenCalledWith("Hello World", "400 16px sans-serif");
  });
});
```

- [ ] **Step 3: analyzeTextOccupancy 테스트 — 기본 케이스**

```typescript
describe("analyzeTextOccupancy", () => {
  it("기본: fillX = maxLineWidth / contentWidth", () => {
    // 컨테이너 200×100, padding 없음, text-align left
    // mock: maxLineWidth=160, height=40 (2줄×20), naturalWidth=180
    const t = textNode("p1", 10, 20, 200, 100, "Hello World");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);

    expect(result).toHaveLength(1);
    const occ = result[0]!;
    expect(occ.nodeId).toBe("p1");
    expect(occ.fillX).toBeCloseTo(160 / 200); // 0.8
    expect(occ.fillY).toBeCloseTo(40 / 100);  // 0.4
    expect(occ.lineCount).toBe(2);
    expect(occ.naturalWidth).toBe(180);
    expect(occ.overflows).toBe(false);
  });

  it("padding 반영: contentWidth = rect.width - padding.left - padding.right", () => {
    // 컨테이너 200×100, padding 20 all sides → contentWidth=160, contentHeight=60
    const t = textNode("p1", 10, 20, 200, 100, "Hello", {
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
    });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    // fillX = maxLineWidth(160) / contentWidth(160) = 1.0
    expect(occ.fillX).toBeCloseTo(1.0);
    // fillY = textHeight(40) / contentHeight(60) ≈ 0.667
    expect(occ.fillY).toBeCloseTo(40 / 60, 2);
  });
});
```

- [ ] **Step 4: 경계 접촉 테스트**

```typescript
describe("analyzeTextOccupancy — boundaryContact", () => {
  it("text-align left, padding 0: left 접촉, right 비접촉", () => {
    // contentWidth=200, maxLineWidth=160
    // margin.left=0 (text-align left → textX=0), margin.right=40
    const t = textNode("p1", 0, 0, 200, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.boundaryContact.left).toBe(true);   // margin=0 < 4
    expect(occ.boundaryContact.right).toBe(false);  // margin=40 > 4
    expect(occ.boundaryContact.top).toBe(true);     // margin=0 < 4
    // margin.bottom = 100 - 40 - 0 = 60
    expect(occ.boundaryContact.bottom).toBe(false);
  });

  it("text-align center: 좌우 대칭 여백", () => {
    // contentWidth=200, maxLineWidth=160 → 양쪽 (200-160)/2 = 20px
    const t = textNode("p1", 0, 0, 200, 100, "Hello", { textAlign: "center" });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.margins.left).toBeCloseTo(20);
    expect(occ.margins.right).toBeCloseTo(20);
    expect(occ.boundaryContact.left).toBe(false);
    expect(occ.boundaryContact.right).toBe(false);
  });

  it("text-align right: left 비접촉, right 접촉 가능", () => {
    // contentWidth=200, maxLineWidth=160
    // textX = 200 - 160 = 40 → margin.left=40, margin.right=0
    const t = textNode("p1", 0, 0, 200, 100, "Hello", { textAlign: "right" });
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    const occ = result[0]!;

    expect(occ.margins.left).toBeCloseTo(40);
    expect(occ.margins.right).toBeCloseTo(0);
    expect(occ.boundaryContact.left).toBe(false);
    expect(occ.boundaryContact.right).toBe(true);
  });
});
```

- [ ] **Step 5: 오버플로우 테스트**

```typescript
describe("analyzeTextOccupancy — overflow", () => {
  it("textHeight > contentHeight → overflows: true", () => {
    // 컨테이너 200×30, mock textHeight=40 → 넘침
    const t = textNode("p1", 0, 0, 200, 30, "Long text");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const result = analyzeTextOccupancy(doc, map);
    expect(result[0]!.overflows).toBe(true);
  });
});
```

- [ ] **Step 6: aggregateTextRegions 테스트**

```typescript
describe("aggregateTextRegions", () => {
  it("영역 내 텍스트 밀도 집계", () => {
    const t1 = textNode("p1", 0, 0, 200, 100, "Hello");
    const t2 = textNode("p2", 0, 100, 200, 100, "World");
    const doc = makeDoc([t1, t2]);
    const map = prepareTextMap(doc);
    const occupancies = analyzeTextOccupancy(doc, map);

    const regions = aggregateTextRegions(doc, occupancies);

    // 결과가 있으면 density가 0–1 범위인지 확인
    for (const region of regions) {
      expect(region.density).toBeGreaterThanOrEqual(0);
      expect(region.density).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 7: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- text-occupancy`
Expected: FAIL — `text-occupancy.ts` 모듈이 아직 없으므로 import 에러

- [ ] **Step 8: 커밋 (실패 테스트)**

```bash
git add packages/rlsc/src/text-occupancy.test.ts
git commit -m "test(rlsc): add text-occupancy unit tests (failing — module not yet created)"
```

---

### Task 5: 텍스트 점유 분석 모듈 — 구현 (`text-occupancy.ts`)

**Files:**
- Create: `packages/rlsc/src/text-occupancy.ts`

- [ ] **Step 1: text-occupancy.ts 구현**

```typescript
import type {
  RLSCDocument,
  RLSCNode,
  LayoutRect,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";
import { flattenTree } from "./tree-utils.js";
import { extractRegions } from "./grid.js";
import {
  prepare,
  layout,
  measureLineStats,
  measureNaturalWidth,
} from "@chenglou/pretext";
import type { PreparedText } from "@chenglou/pretext";

/** pretext PreparedText를 nodeId로 매핑 */
export type TextPreparedMap = Map<string, PreparedText>;

/** 경계 접촉 판정 기본 임계값 (px) */
const DEFAULT_CONTACT_THRESHOLD = 4;

// ─── prepareTextMap ────────────────────────────────────────────────

/**
 * RLSCDocument의 텍스트 노드에 대해 pretext prepare()를 수행하여
 * PreparedText Map을 반환한다. 브라우저 환경(Canvas API) 필요.
 */
export function prepareTextMap(doc: RLSCDocument): TextPreparedMap {
  const map: TextPreparedMap = new Map();
  const nodes = flattenTree(doc.root);

  for (const node of nodes) {
    if (!node.textContent || !node.fontInfo) continue;
    const prepared = prepare(node.textContent, node.fontInfo.fontString);
    map.set(node.id, prepared);
  }

  return map;
}

// ─── analyzeTextOccupancy ──────────────────────────────────────────

export interface TextOccupancyOptions {
  /** 경계 접촉 판정 임계값 (px). 기본 4 */
  readonly contactThreshold?: number;
}

/**
 * 각 텍스트 노드의 시각적 공간 점유를 분석한다.
 * pretext의 layout()으로 실제 텍스트 렌더 크기를 산출하고,
 * 컨테이너 content-box 대비 점유율·경계 접촉·오버플로우를 계산한다.
 */
export function analyzeTextOccupancy(
  doc: RLSCDocument,
  preparedMap: TextPreparedMap,
  options?: TextOccupancyOptions,
): TextOccupancy[] {
  const threshold = options?.contactThreshold ?? DEFAULT_CONTACT_THRESHOLD;
  const nodes = flattenTree(doc.root);
  const results: TextOccupancy[] = [];

  for (const node of nodes) {
    const prepared = preparedMap.get(node.id);
    if (!prepared || !node.fontInfo) continue;

    const { padding, textAlign, lineHeight } = node.fontInfo;
    const { rect } = node;

    // content-box 크기
    const contentWidth = rect.width - padding.left - padding.right;
    const contentHeight = rect.height - padding.top - padding.bottom;

    // 빈 content-box: 스킵
    if (contentWidth <= 0 || contentHeight <= 0) continue;

    // pretext 측정
    const layoutResult = layout(prepared, contentWidth, lineHeight);
    const stats = measureLineStats(prepared, contentWidth);
    const naturalW = measureNaturalWidth(prepared);

    const textHeight = layoutResult.height;
    const maxLineWidth = stats.maxLineWidth;

    // text-align → textX (content-box 내 상대 좌표)
    let textX: number;
    switch (textAlign) {
      case "center":
        textX = (contentWidth - maxLineWidth) / 2;
        break;
      case "right":
        textX = contentWidth - maxLineWidth;
        break;
      case "justify":
      case "left":
      default:
        textX = 0;
        break;
    }

    // 여백 계산 (content-box 기준)
    const marginTop = 0; // 텍스트는 content-box 상단에서 시작
    const marginBottom = contentHeight - textHeight;
    const marginLeft = textX;
    const marginRight = contentWidth - maxLineWidth - textX;

    // 뷰포트 좌표 기준 텍스트 렌더링 rect
    const renderedRect: LayoutRect = {
      x: rect.x + padding.left + textX,
      y: rect.y + padding.top,
      width: maxLineWidth,
      height: textHeight,
    };

    // 오버플로우 판정
    const overflows = textHeight > contentHeight || maxLineWidth > contentWidth;

    results.push({
      nodeId: node.id,
      renderedRect,
      fillX: Math.min(1, maxLineWidth / contentWidth),
      fillY: Math.min(1, textHeight / contentHeight),
      lineCount: layoutResult.lineCount,
      naturalWidth: naturalW,
      margins: {
        top: Math.max(0, marginTop),
        right: Math.max(0, marginRight),
        bottom: Math.max(0, marginBottom),
        left: Math.max(0, marginLeft),
      },
      boundaryContact: {
        top: marginTop < threshold,
        right: marginRight < threshold,
        bottom: marginBottom < threshold,
        left: marginLeft < threshold,
      },
      overflows,
    });
  }

  return results;
}

// ─── aggregateTextRegions ──────────────────────────────────────────

/**
 * 그리드 영역(region)별로 TextOccupancy를 집계하여 텍스트 밀도를 계산한다.
 */
export function aggregateTextRegions(
  doc: RLSCDocument,
  occupancies: readonly TextOccupancy[],
): TextRegionDensity[] {
  const regions = extractRegions(doc.grid);
  const occMap = new Map(occupancies.map((o) => [o.nodeId, o]));
  const results: TextRegionDensity[] = [];

  for (const region of regions) {
    const regionWidth = (region.colEnd - region.colStart + 1) * doc.grid.cellSize;
    const regionHeight = (region.rowEnd - region.rowStart + 1) * doc.grid.cellSize;
    const regionArea = regionWidth * regionHeight;
    if (regionArea <= 0) continue;

    // 이 영역의 dominant nodeId에 해당하는 occupancy 찾기
    const occ = occMap.get(region.nodeId);
    if (!occ) {
      results.push({
        regionId: region.nodeId,
        textArea: 0,
        regionArea,
        density: 0,
        avgFillX: 0,
        avgFillY: 0,
        contactCount: 0,
      });
      continue;
    }

    const textArea = occ.renderedRect.width * occ.renderedRect.height;
    const hasContact =
      occ.boundaryContact.top || occ.boundaryContact.right ||
      occ.boundaryContact.bottom || occ.boundaryContact.left;

    results.push({
      regionId: region.nodeId,
      textArea,
      regionArea,
      density: Math.min(1, textArea / regionArea),
      avgFillX: occ.fillX,
      avgFillY: occ.fillY,
      contactCount: hasContact ? 1 : 0,
    });
  }

  return results;
}
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `pnpm --filter rlsc test -- text-occupancy`
Expected: 모든 테스트 PASS

- [ ] **Step 3: 타입체크 확인**

Run: `pnpm --filter rlsc typecheck`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add packages/rlsc/src/text-occupancy.ts
git commit -m "feat(rlsc): implement text-occupancy analysis module"
```

---

### Task 6: collectLayoutWithText 통합 + index.ts export

**Files:**
- Modify: `packages/rlsc/src/collector.ts`
- Modify: `packages/rlsc/src/index.ts`

- [ ] **Step 1: collector.ts — collectLayoutWithText를 prepareTextMap과 연결**

기존의 placeholder `collectLayoutWithText()`를 실제 구현으로 교체:

```typescript
import { prepareTextMap } from "./text-occupancy.js";
import type { TextPreparedMap } from "./text-occupancy.js";
```

그리고 함수를 교체:

```typescript
/**
 * collectLayout()과 동일하되, 텍스트 노드에 대해 pretext prepare()를 수행하여
 * PreparedText Map을 함께 반환한다.
 *
 * TextPreparedMap은 analyzeTextOccupancy()에 전달한다.
 */
export function collectLayoutWithText(
  root?: Element,
  options?: CollectorOptions,
): { doc: RLSCDocument; textPrepared: TextPreparedMap } {
  const doc = collectLayout(root, options);
  const textPrepared = prepareTextMap(doc);
  return { doc, textPrepared };
}
```

이전의 placeholder 타입 `export type TextPreparedMap = Map<string, unknown>;`도 제거.

- [ ] **Step 2: index.ts — 새 타입/함수 export 추가**

`index.ts` 하단에 추가:

```typescript
// 텍스트 점유 분석
export {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
} from "./text-occupancy.js";
export type {
  TextPreparedMap,
  TextOccupancyOptions,
} from "./text-occupancy.js";
```

`types.ts` export 섹션에 새 타입 추가:

```typescript
export type {
  // ... 기존 타입들 ...
  // 텍스트 점유
  TextFontInfo,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";
```

`collector.ts` export 섹션에 추가:

```typescript
export { collectLayout, collectLayoutWithText } from "./collector.js";
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter rlsc build`
Expected: PASS

- [ ] **Step 4: 전체 테스트 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/rlsc/src/collector.ts packages/rlsc/src/index.ts
git commit -m "feat(rlsc): wire collectLayoutWithText + export text-occupancy APIs"
```

---

### Task 7: 반응형 예측 유틸리티

**Files:**
- Modify: `packages/rlsc/src/text-occupancy.ts`
- Modify: `packages/rlsc/src/text-occupancy.test.ts`

- [ ] **Step 1: 반응형 예측 테스트 추가**

`text-occupancy.test.ts`에 추가:

```typescript
import { predictTextReflow, findBreakpointWidth } from "./text-occupancy.js";
import { layout as pretextLayout } from "@chenglou/pretext";

describe("predictTextReflow", () => {
  it("새로운 너비에서 줄 수 변화 반환", () => {
    const t = textNode("p1", 0, 0, 200, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    // mock layout: 어떤 width든 lineCount=2, height=40 반환
    const result = predictTextReflow(map.get("p1")!, 100, 20);
    expect(result.lineCount).toBe(2);
    expect(result.height).toBe(40);
  });
});

describe("findBreakpointWidth", () => {
  it("목표 줄 수가 되는 너비를 이진 탐색", () => {
    // mock을 조정: width ≥ 180이면 1줄, < 180이면 2줄
    vi.mocked(pretextLayout).mockImplementation(
      (_p: unknown, maxWidth: number, lineHeight: number) => {
        const lines = maxWidth >= 180 ? 1 : 2;
        return { lineCount: lines, height: lines * lineHeight };
      },
    );

    const t = textNode("p1", 0, 0, 400, 100, "Hello");
    const doc = makeDoc([t]);
    const map = prepareTextMap(doc);

    const width = findBreakpointWidth(map.get("p1")!, 1, 20, 50, 400);
    // 이진 탐색이 180 근처를 찾아야 함
    expect(width).toBeGreaterThanOrEqual(178);
    expect(width).toBeLessThanOrEqual(182);

    // mock 복원
    vi.mocked(pretextLayout).mockImplementation(
      (_p: unknown, _mw: number, lineHeight: number) => ({
        lineCount: 2,
        height: lineHeight * 2,
      }),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- text-occupancy`
Expected: FAIL — `predictTextReflow`, `findBreakpointWidth` 없음

- [ ] **Step 3: 구현 추가**

`text-occupancy.ts` 하단에 추가:

```typescript
// ─── 반응형 예측 유틸리티 ──────────────────────────────────────────

/**
 * 새로운 maxWidth에서 텍스트 리플로우 결과를 예측한다.
 * prepare()를 다시 호출하지 않고 layout()만 재실행 (순수 산술).
 */
export function predictTextReflow(
  prepared: PreparedText,
  newWidth: number,
  lineHeight: number,
): { lineCount: number; height: number } {
  return layout(prepared, newWidth, lineHeight);
}

/**
 * 이진 탐색으로 목표 줄 수가 되는 최소 maxWidth를 찾는다.
 *
 * @param prepared - pretext PreparedText
 * @param targetLineCount - 원하는 줄 수
 * @param lineHeight - CSS line-height (px)
 * @param minWidth - 탐색 하한 (px)
 * @param maxWidth - 탐색 상한 (px)
 * @returns 목표 줄 수 이하가 되는 최소 너비 (px, 정수)
 */
export function findBreakpointWidth(
  prepared: PreparedText,
  targetLineCount: number,
  lineHeight: number,
  minWidth: number,
  maxWidth: number,
): number {
  let lo = Math.ceil(minWidth);
  let hi = Math.floor(maxWidth);

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { lineCount } = layout(prepared, mid, lineHeight);
    if (lineCount <= targetLineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  return lo;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter rlsc test -- text-occupancy`
Expected: 모든 테스트 PASS

- [ ] **Step 5: index.ts export 추가**

```typescript
export {
  prepareTextMap,
  analyzeTextOccupancy,
  aggregateTextRegions,
  predictTextReflow,
  findBreakpointWidth,
} from "./text-occupancy.js";
```

- [ ] **Step 6: 타입체크 + 빌드**

Run: `pnpm --filter rlsc typecheck && pnpm --filter rlsc build`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add packages/rlsc/src/text-occupancy.ts packages/rlsc/src/text-occupancy.test.ts packages/rlsc/src/index.ts
git commit -m "feat(rlsc): add predictTextReflow + findBreakpointWidth utilities"
```

---

### Task 8: 최종 검증

**Files:** (수정 없음 — 검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter rlsc build`
Expected: PASS

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter rlsc typecheck`
Expected: PASS

- [ ] **Step 4: export 확인**

```bash
node -e "import('rlsc').then(m => console.log(Object.keys(m).filter(k => k.includes('text') || k.includes('Text') || k.includes('prepare') || k.includes('predict') || k.includes('Breakpoint') || k.includes('aggregate'))))"
```

Expected: `['prepareTextMap', 'analyzeTextOccupancy', 'aggregateTextRegions', 'predictTextReflow', 'findBreakpointWidth']` + 타입들

- [ ] **Step 5: 최종 커밋 (필요 시)**

변경사항이 있으면 정리 커밋.
