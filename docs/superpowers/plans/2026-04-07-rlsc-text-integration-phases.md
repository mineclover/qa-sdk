# RLSC 텍스트 점유 통합 Phase 4-8 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 구현된 text-occupancy 핵심 모듈을 metrics/context/intent/monitor에 통합하여 RLSC 텍스트 점유 분석 파이프라인을 완성한다.

**Architecture:** 기존 모듈의 공개 API에 optional TextOccupancy 파라미터를 추가하고, 타입은 types.ts에서 확장. 기존 시그니처 무파괴 — optional 파라미터만 추가. LayoutPattern에 텍스트 의도 선언 필드를 추가하여 intent 기반 적합성 검증까지 연결.

**Tech Stack:** TypeScript, vitest, `@chenglou/pretext`

**Spec:** `docs/superpowers/specs/2026-04-06-rlsc-pretext-integration-design.md`

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `packages/rlsc/src/types.ts` | 수정 | `LayoutMetrics`에 텍스트 필드 3건, `LayoutPattern`에 `textDensityRange`, `ContextOptions.sections`에 `"text"`, `MonitorOptions`에 `trackText` |
| `packages/rlsc/src/metrics.ts` | 수정 | `measureLayout()` optional `TextOccupancy[]` 수용, 텍스트 메트릭 산출 |
| `packages/rlsc/src/metrics.test.ts` | 수정 | 텍스트 메트릭 테스트 3건 추가 |
| `packages/rlsc/src/context.ts` | 수정 | `generateDesignContext()`에 텍스트 점유 섹션 생성 |
| `packages/rlsc/src/context.test.ts` | 수정 | 텍스트 섹션 테스트 2건 추가 |
| `packages/rlsc/src/intent.ts` | 수정 | 텍스트 ConformanceViolation 규칙 3종 + `checkConformance()`에 텍스트 체커 |
| `packages/rlsc/src/intent.test.ts` | 수정 | 텍스트 적합성 테스트 3건 추가 |
| `packages/rlsc/src/monitor.ts` | 수정 | `trackText` 옵션 → 텍스트 점유 변화 감지 |
| `packages/rlsc/src/monitor.test.ts` | 수정 | 텍스트 모니터링 테스트 1건 추가 |

---

### Task 1: 타입 확장 — LayoutMetrics 텍스트 필드

**Files:**
- Modify: `packages/rlsc/src/types.ts`

- [ ] **Step 1: LayoutMetrics에 텍스트 메트릭 필드 추가**

`types.ts`의 `LayoutMetrics` 인터페이스 끝(`aspectRatioDistribution` 아래)에 추가:

```typescript
  /** 전체 가시 영역 대비 텍스트 점유 비율 (0–1). TextOccupancy 미제공 시 undefined */
  readonly textDensity?: number;
  /** 경계 접촉 노드 비율 (0–1). TextOccupancy 미제공 시 undefined */
  readonly textBoundaryContactRate?: number;
  /** 오버플로우 노드 수. TextOccupancy 미제공 시 undefined */
  readonly textOverflowCount?: number;
```

- [ ] **Step 2: LayoutPattern에 textDensityRange 추가**

`types.ts`의 `LayoutPattern` 인터페이스 끝(`proportions` 아래)에 추가:

```typescript
  /** 허용 텍스트 밀도 범위 [min, max] (0–1) */
  readonly textDensityRange?: readonly [number, number];
```

- [ ] **Step 3: ContextOptions.sections에 "text" 추가**

`types.ts`의 `ContextOptions.sections` 타입을 변경:

```typescript
  /** 포함할 섹션 */
  readonly sections?: readonly ("tree" | "grid" | "layers" | "relations" | "text")[];
```

- [ ] **Step 4: MonitorOptions에 trackText 추가**

`types.ts`의 `MonitorOptions` 인터페이스에 추가:

```typescript
  /** 텍스트 점유 변화 감지 여부. 기본 false */
  readonly trackText?: boolean;
  /** 텍스트 점유 변화 콜백 */
  readonly onTextOccupancyChange?: (occupancies: readonly TextOccupancy[]) => void;
```

- [ ] **Step 5: 타입체크 + 기존 테스트 확인**

Run: `pnpm --filter rlsc typecheck && pnpm --filter rlsc test`
Expected: 모두 PASS (타입 추가만이므로 기존 코드에 영향 없음)

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/types.ts
git commit -m "feat(rlsc): extend types — text metrics, pattern, context, monitor options"
```

---

### Task 2: metrics.ts — 텍스트 메트릭 통합

**Files:**
- Modify: `packages/rlsc/src/metrics.ts`
- Modify: `packages/rlsc/src/metrics.test.ts`

- [ ] **Step 1: 텍스트 메트릭 테스트 작성**

`metrics.test.ts` 파일 끝에 추가:

```typescript
import type { TextOccupancy } from "./types.js";

// ── 텍스트 메트릭 ────────────────────────────────────────────────────

function makeTextOcc(
  nodeId: string,
  fillX: number,
  fillY: number,
  overflows: boolean,
  contact: { top: boolean; right: boolean; bottom: boolean; left: boolean },
): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 0, y: 0, width: 160, height: 40 },
    fillX,
    fillY,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: contact,
    overflows,
  };
}

describe("measureLayout — textOccupancies", () => {
  it("TextOccupancy 미제공 시 텍스트 필드 undefined", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const m = measureLayout(doc);
    expect(m.textDensity).toBeUndefined();
    expect(m.textBoundaryContactRate).toBeUndefined();
    expect(m.textOverflowCount).toBeUndefined();
  });

  it("textDensity = 총 텍스트 면적 / 뷰포트 면적", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    // 텍스트 rect: 160×40 = 6400px² × 2건 = 12800
    // 뷰포트: 1024×768 = 786432
    const occs = [
      makeTextOcc("a", 0.8, 0.4, false, { top: true, right: false, bottom: false, left: true }),
      makeTextOcc("b", 0.6, 0.5, true, { top: false, right: false, bottom: false, left: false }),
    ];
    const m = measureLayout(doc, occs);
    expect(m.textDensity).toBeCloseTo(12800 / 786432, 4);
    expect(m.textBoundaryContactRate).toBeCloseTo(0.5); // 1/2 has contact
    expect(m.textOverflowCount).toBe(1);
  });

  it("모든 노드 contact 없고 overflow 없으면 rate=0, count=0", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const noContact = { top: false, right: false, bottom: false, left: false };
    const occs = [
      makeTextOcc("a", 0.5, 0.5, false, noContact),
    ];
    const m = measureLayout(doc, occs);
    expect(m.textBoundaryContactRate).toBe(0);
    expect(m.textOverflowCount).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- src/metrics.test.ts`
Expected: FAIL — `measureLayout`에 두 번째 인자 전달 시 무시됨, textDensity가 undefined가 아님 등

- [ ] **Step 3: measureLayout 시그니처 확장 + 텍스트 메트릭 산출**

`metrics.ts`에서 import 추가:

```typescript
import type { TextOccupancy } from "./types.js";
```

`measureLayout` 함수 시그니처와 구현 변경:

```typescript
export function measureLayout(
  doc: RLSCDocument,
  textOccupancies?: readonly TextOccupancy[],
): LayoutMetrics {
  const allNodes = flattenTree(doc.root);

  const balance = measureBalance(allNodes, doc.viewport);
  const dominantFlow = detectDominantFlow(doc.relations);
  const gridPattern = detectGridPattern(doc.grid);
  const goldenRatioScore = scoreGoldenRatio(doc.viewport);
  const proximityGroups = detectProximityGroups(allNodes);
  const columnSystem = detectColumnSystem(allNodes, doc.viewport);
  const { values: spacingValues, base: spacingBase } = measureSpacing(
    doc.relations,
    allNodes,
  );
  const aspectRatioDistribution = measureAspectRatios(allNodes);

  // 텍스트 메트릭 (optional)
  let textDensity: number | undefined;
  let textBoundaryContactRate: number | undefined;
  let textOverflowCount: number | undefined;

  if (textOccupancies && textOccupancies.length > 0) {
    const viewportArea = doc.viewport.width * doc.viewport.height;
    let totalTextArea = 0;
    let contactNodeCount = 0;
    let overflowCount = 0;

    for (const occ of textOccupancies) {
      totalTextArea += occ.renderedRect.width * occ.renderedRect.height;
      if (occ.overflows) overflowCount++;
      const hasContact =
        occ.boundaryContact.top ||
        occ.boundaryContact.right ||
        occ.boundaryContact.bottom ||
        occ.boundaryContact.left;
      if (hasContact) contactNodeCount++;
    }

    textDensity = viewportArea > 0 ? totalTextArea / viewportArea : 0;
    textBoundaryContactRate = contactNodeCount / textOccupancies.length;
    textOverflowCount = overflowCount;
  }

  return {
    balance,
    dominantFlow,
    gridPattern,
    goldenRatioScore,
    proximityGroups,
    columnSystem,
    spacingValues,
    spacingBase,
    aspectRatioDistribution,
    textDensity,
    textBoundaryContactRate,
    textOverflowCount,
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter rlsc test -- src/metrics.test.ts`
Expected: 모든 테스트 PASS (기존 25건 + 신규 3건 = 28건)

- [ ] **Step 5: 전체 테스트 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS (intent.ts가 measureLayout 호출하므로 시그니처 호환 확인)

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/metrics.ts packages/rlsc/src/metrics.test.ts
git commit -m "feat(rlsc): integrate text occupancy metrics into measureLayout"
```

---

### Task 3: context.ts — 텍스트 점유 섹션

**Files:**
- Modify: `packages/rlsc/src/context.ts`
- Modify: `packages/rlsc/src/context.test.ts`

- [ ] **Step 1: 텍스트 컨텍스트 테스트 작성**

`context.test.ts` 파일 끝에 추가:

```typescript
import type { TextOccupancy, TextRegionDensity } from "./types.js";

// ── 텍스트 점유 섹션 ─────────────────────────────────────────────────

function makeTextOcc(nodeId: string, overflows: boolean): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 10, y: 10, width: 160, height: 40 },
    fillX: 0.8,
    fillY: 0.4,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: { top: true, right: false, bottom: false, left: true },
    overflows,
  };
}

describe("텍스트 점유 섹션 (sections: text)", () => {
  it("sections에 text 포함 + textOccupancies 제공 시 prompt에 텍스트 분석 포함", () => {
    const doc = makeDoc();
    const occs = [makeTextOcc("p1", false), makeTextOcc("p2", true)];
    const ctx = generateDesignContext(doc, {
      sections: ["text"],
      textOccupancies: occs,
    });
    expect(ctx.prompt).toContain("텍스트 점유");
    expect(ctx.prompt).toContain("p2");
    expect(ctx.prompt).toContain("오버플로우");
  });

  it("textOccupancies 미제공 시 텍스트 섹션 비어있음", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { sections: ["text"] });
    // 텍스트 점유 데이터 없으므로 텍스트 섹션 없음
    expect(ctx.prompt).not.toContain("텍스트 점유");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- src/context.test.ts`
Expected: FAIL — `textOccupancies` 옵션 미지원

- [ ] **Step 3: context.ts 구현**

`context.ts` 수정 — import 추가:

```typescript
import type { TextOccupancy } from "./types.js";
```

`ContextOptions` 확장을 위해 `generateDesignContext` 파라미터에 `textOccupancies` 추가. `Partial<ContextOptions>` 대신 확장 타입 사용:

```typescript
interface GenerateContextOptions extends Partial<ContextOptions> {
  readonly textOccupancies?: readonly TextOccupancy[];
}
```

`generateDesignContext` 시그니처 변경:

```typescript
export function generateDesignContext(
  doc: RLSCDocument,
  options?: GenerateContextOptions,
): DesignContext {
```

`DEFAULT_SECTIONS` 변경:

```typescript
const DEFAULT_SECTIONS = ["tree", "grid", "layers", "relations"] as const satisfies readonly ContextOptions["sections"][number][];
```

`generateDesignContext` 내부에 텍스트 섹션 생성 로직 추가:

`relations` 변수 아래에:

```typescript
  // 텍스트 점유
  const textSection = opts.sections.includes("text") && options?.textOccupancies?.length
    ? generateTextSection(options.textOccupancies)
    : "";
```

`buildPrompt` 호출부에 `textSection` 전달:

```typescript
  const prompt = buildPrompt(opts.purpose, {
    summary,
    structure,
    matrix,
    layers,
    relations,
    focusDetail,
    textSection,
  });
```

`buildPrompt` 함수 data 파라미터에 `textSection` 추가하고 `{textSection}` 치환:

```typescript
function buildPrompt(
  purpose: ContextPurpose,
  data: {
    summary: string;
    structure: string;
    matrix: string;
    layers: string;
    relations: string;
    focusDetail?: string;
    textSection?: string;
  },
): string {
  let template = PROMPT_TEMPLATES[purpose];
  // ... 기존 치환 ...
  template = template.replace("{textSection}", data.textSection ?? "");
  return template;
}
```

`PROMPT_TEMPLATES`의 `layout-analysis` 템플릿에 `{textSection}` 추가 (focusSection 앞):

```typescript
{textSection}
{focusSection}
```

`generateTextSection` 함수 추가:

```typescript
function generateTextSection(
  occupancies: readonly TextOccupancy[],
): string {
  if (occupancies.length === 0) return "";

  const overflowing = occupancies.filter((o) => o.overflows);
  const contacted = occupancies.filter(
    (o) =>
      o.boundaryContact.top ||
      o.boundaryContact.right ||
      o.boundaryContact.bottom ||
      o.boundaryContact.left,
  );

  const lines: string[] = [
    `## 텍스트 점유 분석`,
    ``,
    `텍스트 노드: ${occupancies.length}개`,
  ];

  if (overflowing.length > 0) {
    lines.push(`오버플로우: ${overflowing.length}개`);
    for (const o of overflowing.slice(0, 5)) {
      lines.push(`  - ${o.nodeId}: fillX=${o.fillX.toFixed(2)} fillY=${o.fillY.toFixed(2)} (${o.lineCount}줄)`);
    }
  }

  if (contacted.length > 0) {
    lines.push(`경계 접촉: ${contacted.length}개`);
    for (const o of contacted.slice(0, 5)) {
      const dirs: string[] = [];
      if (o.boundaryContact.top) dirs.push("상");
      if (o.boundaryContact.right) dirs.push("우");
      if (o.boundaryContact.bottom) dirs.push("하");
      if (o.boundaryContact.left) dirs.push("좌");
      lines.push(`  - ${o.nodeId}: ${dirs.join("·")} 접촉`);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter rlsc test -- src/context.test.ts`
Expected: 모든 테스트 PASS (기존 9건 + 신규 2건 = 11건)

- [ ] **Step 5: 전체 테스트 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/context.ts packages/rlsc/src/context.test.ts
git commit -m "feat(rlsc): add text occupancy section to design context"
```

---

### Task 4: intent.ts — 텍스트 적합성 검증

**Files:**
- Modify: `packages/rlsc/src/intent.ts`
- Modify: `packages/rlsc/src/intent.test.ts`

- [ ] **Step 1: 텍스트 적합성 테스트 작성**

`intent.test.ts` 파일 끝에 추가:

```typescript
import type { TextOccupancy } from "./types.js";

function makeTextOcc(
  nodeId: string,
  opts: { overflows?: boolean; fillX?: number; fillY?: number; contact?: { top: boolean; right: boolean; bottom: boolean; left: boolean } },
): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 0, y: 0, width: 160, height: 40 },
    fillX: opts.fillX ?? 0.8,
    fillY: opts.fillY ?? 0.4,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: opts.contact ?? { top: false, right: false, bottom: false, left: false },
    overflows: opts.overflows ?? false,
  };
}

describe("checkConformance — 텍스트 규칙", () => {
  it("text-overflow: overflows 노드가 있으면 violation", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const occs = [makeTextOcc("p1", { overflows: true })];
    const result = checkConformance(doc, {}, occs);
    const v = result.violations.find((v) => v.rule === "text-overflow");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("warning");
  });

  it("textDensityRange: 밀도가 범위 밖이면 violation", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    // 160×40 = 6400 / (1000×1000) = 0.0064
    const occs = [makeTextOcc("p1", {})];
    const result = checkConformance(doc, { textDensityRange: [0.1, 0.5] }, occs);
    const v = result.violations.find((v) => v.rule === "textDensityRange");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("warning");
  });

  it("텍스트 규칙 없고 overflow 없으면 violation 없음", () => {
    const n = node("a", 0, 0, 500, 500);
    const doc = makeDoc([n]);
    const occs = [makeTextOcc("p1", {})];
    const result = checkConformance(doc, {}, occs);
    const textViolations = result.violations.filter(
      (v) => v.rule === "text-overflow" || v.rule === "textDensityRange",
    );
    expect(textViolations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- src/intent.test.ts`
Expected: FAIL — `checkConformance`에 3번째 인자 없음

- [ ] **Step 3: intent.ts 구현**

import 추가:

```typescript
import type { TextOccupancy } from "./types.js";
```

`checkConformance` 시그니처 확장:

```typescript
export function checkConformance(
  doc: RLSCDocument,
  declared: LayoutPattern,
  textOccupancies?: readonly TextOccupancy[],
): ConformanceResult {
```

기존 `violations` 배열에 텍스트 체커 추가:

```typescript
  const violations: ConformanceViolation[] = [
    ...checkBalance(declared, recognized),
    ...checkGrid(declared, recognized),
    ...checkFlow(declared, recognized),
    ...checkGoldenRatio(declared, recognized),
    ...checkGestalt(declared, recognized),
    ...checkGridSystem(declared, recognized),
    ...checkSpacing(declared, recognized),
    ...checkProportions(declared, recognized),
    ...checkTextOccupancy(declared, doc, textOccupancies),
  ];
```

`countDeclaredFields`에 `textDensityRange` 추가:

```typescript
function countDeclaredFields(pattern: LayoutPattern): number {
  return [
    pattern.gridPattern,
    pattern.balanceRatio,
    pattern.flowDirection,
    pattern.goldenRatio,
    pattern.gestalt,
    pattern.gridSystem,
    pattern.spacing,
    pattern.proportions,
    pattern.textDensityRange,
  ].filter((v) => v !== undefined).length;
}
```

텍스트 체커 함수 추가 (내부 체커들 아래):

```typescript
function checkTextOccupancy(
  declared: LayoutPattern,
  doc: RLSCDocument,
  textOccupancies?: readonly TextOccupancy[],
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (!textOccupancies || textOccupancies.length === 0) return violations;

  // text-overflow: 오버플로우 노드 경고
  const overflowing = textOccupancies.filter((o) => o.overflows);
  if (overflowing.length > 0) {
    violations.push({
      rule: "text-overflow",
      declared: "no overflow",
      recognized: `${overflowing.length}개 노드 오버플로우: ${overflowing.map((o) => o.nodeId).join(", ")}`,
      severity: "warning",
      description: `텍스트 오버플로우 감지: ${overflowing.length}개 노드`,
    });
  }

  // textDensityRange: 텍스트 밀도 범위 검증
  if (declared.textDensityRange) {
    const viewportArea = doc.viewport.width * doc.viewport.height;
    let totalTextArea = 0;
    for (const occ of textOccupancies) {
      totalTextArea += occ.renderedRect.width * occ.renderedRect.height;
    }
    const density = viewportArea > 0 ? totalTextArea / viewportArea : 0;
    const [min, max] = declared.textDensityRange;

    if (density < min || density > max) {
      violations.push({
        rule: "textDensityRange",
        declared: declared.textDensityRange,
        recognized: density,
        severity: "warning",
        description: `텍스트 밀도 범위 밖: ${density.toFixed(4)} (허용 ${min}–${max})`,
      });
    }
  }

  return violations;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter rlsc test -- src/intent.test.ts`
Expected: 모든 테스트 PASS (기존 9건 + 신규 3건 = 12건)

- [ ] **Step 5: 전체 테스트 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/intent.ts packages/rlsc/src/intent.test.ts
git commit -m "feat(rlsc): add text conformance rules — overflow + density range"
```

---

### Task 5: monitor.ts — 텍스트 점유 변화 감지

**Files:**
- Modify: `packages/rlsc/src/monitor.ts`
- Modify: `packages/rlsc/src/monitor.test.ts`

- [ ] **Step 1: 모니터 텍스트 추적 테스트 작성**

`monitor.test.ts`에서 `afterEach` 블록 뒤, debounce describe 끝에 추가:

```typescript
import type { TextOccupancy } from "./types.js";

describe("createLayoutMonitor — trackText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.mocked(collectLayout).mockReset();
  });

  let mutationCb2: ((records: MutationRecord[], observer: MutationObserver) => void) | undefined;

  function stubBrowserEnv2() {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    vi.stubGlobal("MutationObserver", class {
      constructor(cb: (records: MutationRecord[], obs: MutationObserver) => void) {
        mutationCb2 = cb;
      }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  }

  it("trackText: true일 때 onTextOccupancyChange 콜백 호출", () => {
    vi.useFakeTimers();
    vi.mocked(collectLayout).mockReturnValue(makeDoc());
    stubBrowserEnv2();

    const textCb = vi.fn();
    const monitor = createLayoutMonitor(undefined, {
      debounceMs: 50,
      trackText: true,
      onTextOccupancyChange: textCb,
    });
    monitor.start();

    mutationCb2!([], {} as MutationObserver);
    vi.advanceTimersByTime(50);

    // collectLayoutWithText → analyzeTextOccupancy 실행됨
    // doc에 텍스트 노드가 없으므로 빈 배열로 콜백
    expect(textCb).toHaveBeenCalledWith([]);

    monitor.stop();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter rlsc test -- src/monitor.test.ts`
Expected: FAIL — `trackText` 옵션 미지원

- [ ] **Step 3: monitor.ts 구현**

import 추가:

```typescript
import { collectLayoutWithText } from "./collector.js";
import { analyzeTextOccupancy } from "./text-occupancy.js";
```

`handleChange` 함수에서 `trackText` 옵션에 따라 분기:

```typescript
function handleChange() {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    let next: RLSCDocument;

    if (options?.trackText) {
      const { doc, textPrepared } = collectLayoutWithText(root, collectOptions);
      next = doc;
      if (options.onTextOccupancyChange) {
        const occupancies = analyzeTextOccupancy(doc, textPrepared);
        options.onTextOccupancyChange(occupancies);
      }
    } else {
      next = collectLayout(root, collectOptions);
    }

    const diffs = diffDocuments(current, next);
    // ... 이하 기존 로직 동일 ...
```

mock 확장 필요 — `monitor.test.ts`에서 collector mock에 `collectLayoutWithText` 추가:

```typescript
vi.mock("./collector.js", () => ({
  collectLayout: vi.fn(),
  collectLayoutWithText: vi.fn(() => ({
    doc: makeDoc(),
    textPrepared: new Map(),
  })),
}));
```

`text-occupancy.js` mock 추가:

```typescript
vi.mock("./text-occupancy.js", () => ({
  analyzeTextOccupancy: vi.fn(() => []),
}));
```

import도 추가:

```typescript
import { collectLayoutWithText } from "./collector.js";
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter rlsc test -- src/monitor.test.ts`
Expected: 모든 테스트 PASS (기존 3건 + 신규 1건 = 4건)

- [ ] **Step 5: 전체 테스트 확인**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add packages/rlsc/src/monitor.ts packages/rlsc/src/monitor.test.ts
git commit -m "feat(rlsc): add trackText option to layout monitor"
```

---

### Task 6: 빌드 확인 + TODO 갱신

**Files:**
- Modify: `docs/specs/rlsc/rlsc-text-occupancy.todo.md`

- [ ] **Step 1: 타입체크**

Run: `pnpm --filter rlsc typecheck`
Expected: PASS

- [ ] **Step 2: 빌드**

Run: `pnpm --filter rlsc build`
Expected: ESM + CJS 빌드 성공

- [ ] **Step 3: 전체 테스트**

Run: `pnpm --filter rlsc test`
Expected: 모든 테스트 PASS

- [ ] **Step 4: TODO 체크박스 갱신**

`rlsc-text-occupancy.todo.md`에서 Phase 4, 5, 6, 8의 해당 항목에 `[x]` 표시.

- [ ] **Step 5: 커밋**

```bash
git add docs/specs/rlsc/rlsc-text-occupancy.todo.md
git commit -m "docs(rlsc): mark text occupancy phases 4-8 as complete"
```
