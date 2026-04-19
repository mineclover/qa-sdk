// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * SplitPattern — 좌표계 데이터의 차원별 표현 패턴 정형화.
 *
 * prefix의 N차원 좌표를 시각적으로 어떻게 펼칠 것인가를 정의한다.
 *
 * 핵심 아이디어:
 *   prefix = N개 축의 교차 (예: page × locale × userType = 3D)
 *   이 N차원을 시각 공간의 x/y/z/color/size/opacity에 매핑하는 것이 SplitPattern.
 *
 * 패턴 종류:
 *
 *   0D — Scalar     단일 값 표시. 숫자, 라벨, 색상.
 *                    예: permission의 특정 좌표 하나 → 히트맵 셀 1개
 *
 *   1D — Row        한 축을 가로로 펼침.
 *                    예: flow_step [entry, processing, success, failure] → 4칸 행
 *
 *   2D — Grid       두 축을 x/z로 펼침. 행렬 형태.
 *                    예: page × userType → 8×3 그리드
 *
 *   3D — Cube       세 축을 x/y/z로 펼침. 큐브 볼륨.
 *                    예: flow_name × flow_step × flow_variant → 8×9×4 큐브
 *
 *   3D→1D — Spine   3D 큐브를 1D 행으로 압축. 확대하면 큐브 전개.
 *                    예: service의 5개 조합 → 5칸 행, 클릭하면 env×region×svc 큐브
 *
 *   3D→2D — Shelf   3D 큐브를 2D 행렬의 나열로 분해. 한 축은 "선반" 층.
 *                    예: flow_name별로 flow_step×flow_variant 그리드를 y축 나열
 *
 *   ND→Group — Nested  N차원을 계층적 그룹으로 분해. 각 그룹이 하위 패턴.
 *                    예: DSL 번들 → 각 prefix가 독립 패턴으로 표현
 */

// ═══════════════════════════════════════════════════
//  Base Types
// ═══════════════════════════════════════════════════

/** 시각 채널 — 축 값을 어떤 시각 속성에 매핑하는가 */
export type VisualChannel =
  | "x"        // 공간 x축
  | "y"        // 공간 y축
  | "z"        // 공간 z축
  | "color"    // 색상 (hue)
  | "opacity"  // 투명도
  | "size"     // 셀 크기
  | "label"    // 텍스트 라벨
  | "group"    // 상위 그룹 분류 (shelf/nested의 분할 축)
  | "collapse" // 축 압축 (3D→1D의 압축 대상)
  | "link"     // 연결선 (table_ref/prefix_ref 시각 연결)
  ;

/**
 * 축 역할 — 축의 의미적 역할. 시각 채널 추론의 근거.
 *
 *   classify:  분류 (flow_name, event_name) → group/shelf 후보
 *   sequence:  순서 (flow_step, pipeline_phase) → x축 (왼→오)
 *   variant:   변형 (flow_variant, api_version) → z축 또는 color
 *   identity:  식별 (svc_name, role) → x축 또는 label
 *   context:   컨텍스트 (env, region, svc_ref) → collapse 또는 link
 *   measure:   측정 (hit count, latency) → size/opacity
 */
export type AxisRole =
  | "classify"   // 분류 → group/shelf
  | "sequence"   // 순서 → x
  | "variant"    // 변형 → z or color
  | "identity"   // 식별 → x or label
  | "context"    // 컨텍스트 → collapse or link
  | "measure"    // 측정 → size/opacity
  ;

/** 축 → 시각 채널 매핑 */
export interface AxisMapping {
  /** prefix의 axis/label 이름 */
  readonly axis: string;
  /** 이 축을 어떤 시각 채널에 배치하는가 */
  readonly channel: VisualChannel;
  /** 축의 의미적 역할 */
  readonly role?: AxisRole;
  /** DimRef 종류 (axis/prefix_ref/table_ref) */
  readonly dimKind?: "axis" | "prefix_ref" | "table_ref";
  /** channel이 "group"이면: 그룹별 하위 패턴 */
  readonly subPattern?: SplitPatternType;
}

// ═══════════════════════════════════════════════════
//  Pattern Types
// ═══════════════════════════════════════════════════

export type SplitPatternType =
  | "scalar"   // 0D
  | "row"      // 1D
  | "grid"     // 2D
  | "cube"     // 3D
  | "spine"    // 3D→1D (축소 + 확대)
  | "shelf"    // 3D→2D (축별 선반)
  | "nested"   // ND→Group (계층 분해)
  ;

export interface SplitPattern {
  /** 패턴 타입 */
  readonly type: SplitPatternType;
  /** 대상 prefix ID */
  readonly prefixId: string;
  /** 축별 시각 채널 매핑 */
  readonly mappings: readonly AxisMapping[];
  /** 패턴 설명 */
  readonly description: string;
}

// ═══════════════════════════════════════════════════
//  Pattern Definitions
// ═══════════════════════════════════════════════════

/** 0D — 단일 값 (히트맵 셀, KPI) */
export function scalar(prefixId: string, axis: string): SplitPattern {
  return {
    type: "scalar",
    prefixId,
    mappings: [{ axis, channel: "color" }],
    description: `${prefixId}.${axis} → 단일 값 표시`,
  };
}

/** 1D — 한 축을 가로로 펼침 */
export function row(prefixId: string, axis: string): SplitPattern {
  return {
    type: "row",
    prefixId,
    mappings: [{ axis, channel: "x" }],
    description: `${prefixId}.${axis} → 가로 행`,
  };
}

/** 2D — 두 축을 x/z 그리드로 펼침 */
export function grid(prefixId: string, xAxis: string, zAxis: string): SplitPattern {
  return {
    type: "grid",
    prefixId,
    mappings: [
      { axis: xAxis, channel: "x" },
      { axis: zAxis, channel: "z" },
    ],
    description: `${prefixId}: ${xAxis}(x) × ${zAxis}(z) → 2D 그리드`,
  };
}

/** 3D — 세 축을 x/y/z 큐브로 펼침 */
export function cube(prefixId: string, xAxis: string, yAxis: string, zAxis: string): SplitPattern {
  return {
    type: "cube",
    prefixId,
    mappings: [
      { axis: xAxis, channel: "x" },
      { axis: yAxis, channel: "y" },
      { axis: zAxis, channel: "z" },
    ],
    description: `${prefixId}: ${xAxis}(x) × ${yAxis}(y) × ${zAxis}(z) → 3D 큐브`,
  };
}

/** 3D→1D — 큐브를 1D 행으로 압축. 확대 시 전개. */
export function spine(prefixId: string, visibleAxis: string, collapsedAxes: string[]): SplitPattern {
  return {
    type: "spine",
    prefixId,
    mappings: [
      { axis: visibleAxis, channel: "x" },
      ...collapsedAxes.map(a => ({ axis: a, channel: "collapse" as VisualChannel })),
    ],
    description: `${prefixId}: ${visibleAxis}(x), [${collapsedAxes.join(",")}] 압축 → 확대 시 큐브`,
  };
}

/** 3D→2D — 한 축을 "선반 층"으로, 나머지를 그리드로 */
export function shelf(prefixId: string, shelfAxis: string, xAxis: string, zAxis: string): SplitPattern {
  return {
    type: "shelf",
    prefixId,
    mappings: [
      { axis: shelfAxis, channel: "group", subPattern: "grid" },
      { axis: xAxis, channel: "x" },
      { axis: zAxis, channel: "z" },
    ],
    description: `${prefixId}: ${shelfAxis}별 선반, 각 선반 = ${xAxis}(x) × ${zAxis}(z) 그리드`,
  };
}

/** ND→Group — N차원을 계층적 그룹으로 분해 */
export function nested(prefixId: string, groupAxis: string, subPattern: SplitPatternType): SplitPattern {
  return {
    type: "nested",
    prefixId,
    mappings: [
      { axis: groupAxis, channel: "group", subPattern },
    ],
    description: `${prefixId}: ${groupAxis}별 그룹, 각 그룹 = ${subPattern}`,
  };
}

// ═══════════════════════════════════════════════════
//  Layout Calculator
// ═══════════════════════════════════════════════════

export interface CellPosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** group 채널의 값 (shelf/nested에서 그룹 이름) */
  readonly group?: string;
  /** collapse 채널 값 (spine에서 압축된 축의 값) */
  readonly collapsed?: Record<string, string>;
}

export interface PatternLayout {
  readonly pattern: SplitPattern;
  readonly cells: readonly CellPosition[];
  readonly bounds: { width: number; height: number; depth: number };
}

/**
 * SplitPattern과 축 entries에서 셀 위치를 계산한다.
 */
export function computePatternLayout(
  pattern: SplitPattern,
  axisEntries: Record<string, readonly string[]>,
  cellSize: number = 0.4,
  cellGap: number = 0.08,
): PatternLayout {
  const step = cellSize + cellGap;
  const cells: CellPosition[] = [];

  const xMapping = pattern.mappings.find(m => m.channel === "x");
  const yMapping = pattern.mappings.find(m => m.channel === "y");
  const zMapping = pattern.mappings.find(m => m.channel === "z");
  const groupMapping = pattern.mappings.find(m => m.channel === "group");
  const collapseAxes = pattern.mappings.filter(m => m.channel === "collapse").map(m => m.axis);

  const xEntries = xMapping ? (axisEntries[xMapping.axis] || []) : ["_"];
  const yEntries = yMapping ? (axisEntries[yMapping.axis] || []) : ["_"];
  const zEntries = zMapping ? (axisEntries[zMapping.axis] || []) : ["_"];
  const groupEntries = groupMapping ? (axisEntries[groupMapping.axis] || []) : ["_"];

  switch (pattern.type) {
    case "scalar":
      cells.push({ key: `${pattern.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;

    case "row":
      xEntries.forEach((e, i) => {
        cells.push({ key: `${pattern.prefixId}/${e}`, x: i * step, y: 0, z: 0 });
      });
      break;

    case "grid":
      xEntries.forEach((ex, xi) => {
        zEntries.forEach((ez, zi) => {
          cells.push({ key: `${pattern.prefixId}/${ex}_${ez}`, x: xi * step, y: 0, z: zi * step });
        });
      });
      break;

    case "cube":
      xEntries.forEach((ex, xi) => {
        yEntries.forEach((ey, yi) => {
          zEntries.forEach((ez, zi) => {
            cells.push({ key: `${pattern.prefixId}/${ex}_${ey}_${ez}`, x: xi * step, y: yi * step, z: zi * step });
          });
        });
      });
      break;

    case "spine":
      // 주 축만 펼치고, collapsed 축은 메타데이터로 보존
      xEntries.forEach((e, i) => {
        const collapsed: Record<string, string> = {};
        for (const ca of collapseAxes) {
          collapsed[ca] = `(${(axisEntries[ca] || []).length} entries)`;
        }
        cells.push({ key: `${pattern.prefixId}/${e}`, x: i * step, y: 0, z: 0, collapsed });
      });
      break;

    case "shelf":
      // 그룹별로 y 오프셋을 주고, 각 그룹 내에서 x/z 그리드
      groupEntries.forEach((ge, gi) => {
        const yOffset = gi * (zEntries.length * step + step * 2);
        xEntries.forEach((ex, xi) => {
          zEntries.forEach((ez, zi) => {
            cells.push({
              key: `${pattern.prefixId}/${ge}_${ex}_${ez}`,
              x: xi * step,
              y: yOffset,
              z: zi * step,
              group: ge,
            });
          });
        });
      });
      break;

    case "nested":
      // 그룹별로 x 오프셋을 주고, 각 그룹은 하위 패턴 (여기선 row로 기본)
      groupEntries.forEach((ge, gi) => {
        const xOffset = gi * (xEntries.length * step + step * 2);
        xEntries.forEach((ex, xi) => {
          cells.push({
            key: `${pattern.prefixId}/${ge}/${ex}`,
            x: xOffset + xi * step,
            y: 0,
            z: 0,
            group: ge,
          });
        });
      });
      break;
  }

  const xs = cells.map(c => c.x);
  const ys = cells.map(c => c.y);
  const zs = cells.map(c => c.z);

  return {
    pattern,
    cells,
    bounds: {
      width: cells.length > 0 ? Math.max(...xs) - Math.min(...xs) + cellSize : 0,
      height: cells.length > 0 ? Math.max(...ys) - Math.min(...ys) + cellSize : 0,
      depth: cells.length > 0 ? Math.max(...zs) - Math.min(...zs) + cellSize : 0,
    },
  };
}

// ═══════════════════════════════════════════════════
//  프리셋 패턴 — DEMO_CATALOG용
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
//  축 역할 추론
// ═══════════════════════════════════════════════════

/** 축 이름에서 역할을 추론 */
export function inferRole(axisName: string, dimKind: string): AxisRole {
  if (dimKind === "prefix_ref") return "context";
  if (dimKind === "table_ref") return "context";

  // 이름 기반 추론
  const name = axisName.toLowerCase();
  if (name.includes("step") || name.includes("phase") || name.includes("stage")) return "sequence";
  if (name.includes("variant") || name.includes("version") || name.includes("mode")) return "variant";
  if (name.endsWith("_name") || name === "flow_name" || name === "event_name" || name.endsWith("_type") || name === "resource_type") return "classify";
  if (name.includes("action") || name.includes("method") || name.includes("op") || name === "role" || name === "resource") return "identity";
  return "identity";
}

/** 역할 기반 시각 채널 결정 */
function _roleToChannel(role: AxisRole): VisualChannel {
  switch (role) {
    case "classify": return "group";
    case "sequence": return "x";
    case "variant": return "z";
    case "identity": return "x";
    case "context": return "collapse";
    case "measure": return "size";
  }
}

export interface DimInfo {
  readonly label: string;
  readonly kind: "axis" | "prefix_ref" | "table_ref";
}

/** 자동 패턴 추론 — 축 역할 기반 */
export function inferPattern(prefixId: string, axes: string[]): SplitPattern;
export function inferPattern(prefixId: string, dims: DimInfo[]): SplitPattern;
export function inferPattern(prefixId: string, input: string[] | DimInfo[]): SplitPattern {
  // normalize input
  const dims: DimInfo[] = typeof input[0] === "string"
    ? (input as string[]).map(label => ({ label, kind: "axis" as const }))
    : input as DimInfo[];

  const axisDims = dims.filter(d => d.kind === "axis");
  const refDims = dims.filter(d => d.kind === "prefix_ref");
  const tableDims = dims.filter(d => d.kind === "table_ref");

  // 역할 추론
  const roles = axisDims.map(d => Object.assign({}, d, { role: inferRole(d.label, d.kind) }));
  const classifiers = roles.filter(r => r.role === "classify");
  const sequences = roles.filter(r => r.role === "sequence");
  const variants = roles.filter(r => r.role === "variant");
  const identities = roles.filter(r => r.role === "identity");

  // 매핑 구성
  const mappings: AxisMapping[] = [];

  // context 축 (prefix_ref) → collapse
  for (const d of refDims) {
    mappings.push({ axis: d.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  }

  // table_ref → link
  for (const d of tableDims) {
    mappings.push({ axis: d.label, channel: "link", role: "context", dimKind: "table_ref" });
  }

  // 분류 축이 있으면 shelf/nested
  if (classifiers.length > 0) {
    const classifier = classifiers[0];
    const rest = roles.filter(r => r !== classifier);

    if (rest.length === 0) {
      mappings.push({ axis: classifier.label, channel: "x", role: "classify" });
      return { type: "row", prefixId, mappings, description: `${prefixId}: ${classifier.label}(x) → 행` };
    }

    if (rest.length === 1) {
      mappings.push({ axis: classifier.label, channel: "group", role: "classify", subPattern: "row" });
      mappings.push({ axis: rest[0].label, channel: "x", role: rest[0].role });
      return { type: "shelf", prefixId, mappings, description: `${prefixId}: ${classifier.label}별 선반, ${rest[0].label}(x)` };
    }

    // 2+ rest → shelf with grid
    mappings.push({ axis: classifier.label, channel: "group", role: "classify", subPattern: "grid" });
    const xAxis = sequences[0] || rest[0];
    const zAxis = variants[0] || rest.find(r => r !== xAxis) || rest[1];
    if (xAxis) mappings.push({ axis: xAxis.label, channel: "x", role: xAxis.role });
    if (zAxis && zAxis !== xAxis) mappings.push({ axis: zAxis.label, channel: "z", role: zAxis.role });
    return { type: "shelf", prefixId, mappings, description: `${prefixId}: ${classifier.label}별 선반, ${xAxis?.label}(x) × ${zAxis?.label}(z)` };
  }

  // 분류 축 없음 → 순수 identity/sequence/variant
  const allAxes = [...sequences, ...identities, ...variants];

  if (allAxes.length === 0) {
    return { type: "scalar", prefixId, mappings: [{ axis: "_", channel: "color" }], description: `${prefixId}: scalar` };
  }
  if (allAxes.length === 1) {
    mappings.push({ axis: allAxes[0].label, channel: "x", role: allAxes[0].role });
    return { type: "row", prefixId, mappings, description: `${prefixId}: ${allAxes[0].label}(x)` };
  }
  if (allAxes.length === 2) {
    mappings.push({ axis: allAxes[0].label, channel: "x", role: allAxes[0].role });
    mappings.push({ axis: allAxes[1].label, channel: "z", role: allAxes[1].role });
    return { type: "grid", prefixId, mappings, description: `${prefixId}: ${allAxes[0].label}(x) × ${allAxes[1].label}(z)` };
  }

  // 3+ → cube
  mappings.push({ axis: allAxes[0].label, channel: "x", role: allAxes[0].role });
  mappings.push({ axis: allAxes[1].label, channel: "y", role: allAxes[1].role });
  mappings.push({ axis: allAxes[2].label, channel: "z", role: allAxes[2].role });
  return { type: "cube", prefixId, mappings, description: `${prefixId}: ${allAxes[0].label}(x) × ${allAxes[1].label}(y) × ${allAxes[2].label}(z)` };
}

/** prefix 정의에서 차원 정보 추출 */
export function extractDims(prefixDims: Record<string, { kind: string }>): DimInfo[] {
  return Object.entries(prefixDims).map(([label, d]) => ({
    label,
    kind: d.kind as "axis" | "prefix_ref" | "table_ref",
  }));
}

/** 후방 호환: 축 이름만 추출 */
export function extractAxes(prefixDims: Record<string, { kind: string }>): string[] {
  return Object.entries(prefixDims)
    .filter(([, d]) => d.kind === "axis")
    .map(([label]) => label);
}
