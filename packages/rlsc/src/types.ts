// ─── R.L.S.C.™ Core Types ───────────────────────────────────────────

/** 뷰포트 기준 물리적 위치와 크기 */
export interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** R.L.S.C. 마크업의 기본 단위 */
export interface RLSCNode {
  /** 고유 식별자 (tag#id 또는 자동 생성) */
  readonly id: string;
  /** HTML 태그 */
  readonly tag: string;
  /** CSS 클래스 목록 */
  readonly classes: readonly string[];
  /** ARIA role 또는 의미론적 역할 */
  readonly role?: string;
  /** 뷰포트 기준 위치와 크기 */
  readonly rect: LayoutRect;
  /** z-index 값 */
  readonly zIndex: number;
  /** DOM 깊이 (root=0) */
  readonly depth: number;
  /** display 속성 */
  readonly display: string;
  /** position 속성 */
  readonly position: string;
  /** overflow 속성 */
  readonly overflow: string;
  /** 뷰포트 내 가시 여부 */
  readonly visible: boolean;
  /** 가시 텍스트 (최대 80자) */
  readonly textContent?: string;
  /** 기존 좌표계 주소 (data-qa-address 등에서 추출) */
  readonly address?: string;
  /** 폰트 정보 (텍스트가 있는 노드에만 존재) */
  readonly fontInfo?: TextFontInfo;
  /** 의미론적 속성 (data-*, aria-*) */
  readonly attributes: Readonly<Record<string, string>>;
  /** 자식 노드 */
  readonly children: readonly RLSCNode[];
}

/** 수집 옵션 */
export interface CollectorOptions {
  /** 수집 대상 최소 크기 (px). 기본 4 */
  readonly minSize?: number;
  /** 수집 대상 최대 DOM 깊이. 기본 20 */
  readonly maxDepth?: number;
  /** 숨겨진 요소 포함 여부. 기본 false */
  readonly includeHidden?: boolean;
  /** 텍스트 내용 최대 길이. 기본 80 */
  readonly maxTextLength?: number;
  /** 좌표계 주소 추출 속성명. 기본 "data-qa-address" */
  readonly addressAttribute?: string;
  /** 텍스트 노드의 폰트 정보 수집 여부. 기본 true */
  readonly collectFontInfo?: boolean;
}

// ─── Grid ───────────────────────────────────────────────────────────

/** 그리드 셀 하나 */
export interface GridCell {
  /** 이 셀을 점유하는 노드 ID들 */
  readonly nodeIds: readonly string[];
  /** z-index 순서로 정렬된 노드 ID (아래→위) */
  readonly zStack: readonly string[];
  /** 가장 넓은 면적을 차지하는 노드 */
  readonly dominant?: string;
  /** 셀 내 점유율 (0–1) */
  readonly coverage: number;
}

/** 레이아웃 그리드 — 뷰포트를 셀로 분할한 행렬 */
export interface LayoutGrid {
  /** 셀 크기 (px) */
  readonly cellSize: number;
  /** 열 수 */
  readonly cols: number;
  /** 행 수 */
  readonly rows: number;
  /** [row][col] 순서 행렬 */
  readonly cells: readonly (readonly GridCell[])[];
}

// ─── Layers ─────────────────────────────────────────────────────────

/** z-index 기반 레이어 역할 */
export type LayerRole =
  | "background"
  | "content"
  | "sticky"
  | "overlay"
  | "modal"
  | "tooltip";

/** z-index 레이어 스택 */
export interface LayerStack {
  readonly zIndex: number;
  readonly role: LayerRole;
  readonly nodeIds: readonly string[];
  readonly totalArea: number;
}

// ─── Relations ──────────────────────────────────────────────────────

/** 노드 간 공간 관계 유형 */
export type RelationType =
  | "contains"
  | "overlaps"
  | "adjacent-x"
  | "adjacent-y"
  | "aligned-x"
  | "aligned-y"
  | "stacked"
  | "flow";

/** 노드 간 공간 관계 */
export interface RLSCRelation {
  readonly type: RelationType;
  readonly source: string;
  readonly target: string;
  /** 관계 강도 (0–1) */
  readonly strength?: number;
}

// ─── Document ───────────────────────────────────────────────────────

/** R.L.S.C. 전체 문서 */
export interface RLSCDocument {
  readonly version: "1.0";
  readonly viewport: { readonly width: number; readonly height: number };
  readonly url: string;
  readonly timestamp: string;
  /** 기존 좌표계 주소 (문서 단위) */
  readonly address?: string;
  /** 루트 노드 트리 */
  readonly root: RLSCNode;
  /** 그리드 분석 결과 */
  readonly grid: LayoutGrid;
  /** z-index 레이어 스택 */
  readonly layers: readonly LayerStack[];
  /** 공간 관계 */
  readonly relations: readonly RLSCRelation[];
}

// ─── Context Engineering ────────────────────────────────────────────

/** 프롬프트 템플릿 유형 */
export type ContextPurpose =
  | "layout-analysis"
  | "component-search"
  | "design-generation"
  | "design-diff"
  | "accessibility-audit";

/** Context Engineering 옵션 */
export interface ContextOptions {
  /** 목적에 따른 포맷 */
  readonly purpose: ContextPurpose;
  /** 포커스 영역 (노드 ID 또는 rect) */
  readonly focus?: string | LayoutRect;
  /** 포함할 섹션 */
  readonly sections?: readonly ("tree" | "grid" | "layers" | "relations" | "text")[];
  /** 최대 토큰 수 (근사). 기본 4000 */
  readonly maxTokens?: number;
}

/** LLM에 주입할 디자인 컨텍스트 */
export interface DesignContext {
  /** 목적 */
  readonly purpose: ContextPurpose;
  /** 자연어 레이아웃 요약 */
  readonly summary: string;
  /** R.L.S.C. 마크업 (트리 부분) */
  readonly structure: string;
  /** 그리드 표현 */
  readonly matrix: string;
  /** 관계 요약 */
  readonly relations: string;
  /** 포커스 영역 상세 */
  readonly focusDetail?: string;
  /** 전체 텍스트 (프롬프트에 바로 사용) */
  readonly prompt: string;
}

// ─── Query ──────────────────────────────────────────────────────────

/** 노드 검색 조건 */
export interface RLSCQuery {
  /** 태그 이름 */
  readonly tag?: string;
  /** role */
  readonly role?: string;
  /** 클래스 포함 */
  readonly hasClass?: string;
  /** 텍스트 포함 */
  readonly textContains?: string;
  /** 영역 내 위치 */
  readonly withinRect?: LayoutRect;
  /** 최소 면적 (px²) */
  readonly minArea?: number;
  /** 최대 면적 (px²) */
  readonly maxArea?: number;
  /** z-index 범위 */
  readonly zRange?: { readonly min?: number; readonly max?: number };
  /** 가시 요소만 */
  readonly visibleOnly?: boolean;
}

// ─── Metrics ────────────────────────────────────────────────────────

/** 게슈탈트 근접성으로 묶인 노드 집합 */
export interface ProximityGroup {
  readonly nodeIds: readonly string[];
  readonly centroid: { readonly x: number; readonly y: number };
  readonly boundingRect: LayoutRect;
}

/** 레이아웃 수치 측정값 집합 */
export interface LayoutMetrics {
  // 페이지 수준
  /** 좌:우 / 상:하 시각적 무게 비율 (면적 기준, 1.0 = 균형) */
  readonly balance: { readonly x: number; readonly y: number };
  /** 주 흐름 방향 */
  readonly dominantFlow: "horizontal" | "vertical" | "grid" | "free";
  /** 감지된 도미넌트 영역 그리드 */
  readonly gridPattern: { readonly cols: number; readonly rows: number } | null;
  /** 황금비 적합도 (0–1) */
  readonly goldenRatioScore: number;
  /** 근접성 클러스터 */
  readonly proximityGroups: readonly ProximityGroup[];
  // 구조 단위 수준
  /** 감지된 컬럼 그리드 시스템 */
  readonly columnSystem: {
    readonly cols: number;
    readonly gutterPx: number;
    readonly marginPx: number;
    readonly rowGapPx?: number;
  } | null;
  /** 감지된 gap·margin 수치 목록 (오름차순, 중복 제거) */
  readonly spacingValues: readonly number[];
  /** 가장 작은 공약수 단위. null = 미감지 */
  readonly spacingBase: number | null;
  /** 가시 노드 width/height 비율 분포 (count 내림차순) */
  readonly aspectRatioDistribution: readonly { readonly ratio: number; readonly count: number }[];
  /** 전체 가시 영역 대비 텍스트 점유 비율 (0–1). TextOccupancy 미제공 시 undefined */
  readonly textDensity?: number;
  /** 경계 접촉 노드 비율 (0–1). TextOccupancy 미제공 시 undefined */
  readonly textBoundaryContactRate?: number;
  /** 오버플로우 노드 수. TextOccupancy 미제공 시 undefined */
  readonly textOverflowCount?: number;
}

// ─── Pattern ────────────────────────────────────────────────────────

/** 컬럼 기반 그리드 시스템 패턴 */
export interface GridSystemPattern {
  readonly columns: number;
  readonly gutter: number;
  readonly margin?: number;
  readonly rowGap?: number;
  readonly columnWidthPx?: number;
}

/** 여백·간격 패턴 */
export interface SpacingPattern {
  readonly base?: number;
  readonly scale: readonly number[];
  readonly consistent: boolean;
}

/** 요소 비율 패턴 */
export interface ProportionPattern {
  readonly dominant?: number;
  readonly namedRatio?: "1:1" | "4:3" | "16:9" | "golden" | "2:1" | "3:1";
  readonly distribution: readonly { readonly ratio: number; readonly count: number }[];
}

/** 게슈탈트 관련 패턴 */
export interface GestaltPattern {
  readonly proximity?: "tight" | "loose";
  readonly continuity?: "strong" | "weak";
  readonly minGroupCount?: number;
}

/** 레이아웃 패턴 어휘 — 선언(top-down)과 인식(bottom-up)이 공유하는 중립 타입 */
export interface LayoutPattern {
  // 페이지 수준
  readonly gridPattern?: "3x3" | "2-col" | "1-col" | { readonly cols: number; readonly rows: number };
  readonly balanceRatio?: { readonly x?: readonly [number, number]; readonly y?: readonly [number, number] };
  readonly flowDirection?: "left-to-right" | "right-to-left" | "top-to-bottom" | "grid";
  readonly goldenRatio?: boolean;
  readonly gestalt?: GestaltPattern;
  // 구조 단위 수준
  readonly gridSystem?: GridSystemPattern;
  readonly spacing?: SpacingPattern;
  readonly proportions?: ProportionPattern;
  /** 허용 텍스트 밀도 범위 [min, max] (0–1) */
  readonly textDensityRange?: readonly [number, number];
}

// ─── Conformance ────────────────────────────────────────────────────

/** 레이아웃 프레임 위반 항목 */
export interface ConformanceViolation {
  readonly rule: string;
  readonly declared: unknown;
  readonly recognized: unknown;
  readonly severity: "error" | "warning";
  readonly description: string;
}

/** 레이아웃 프레임 검증 결과 */
export interface ConformanceResult {
  readonly declared: LayoutPattern;
  readonly recognized: LayoutPattern;
  readonly metrics: LayoutMetrics;
  readonly violations: readonly ConformanceViolation[];
  /** 0–1. 선언된 필드 중 일치 비율. 선언 없으면 1.0 */
  readonly score: number;
}

// ─── Canvas ─────────────────────────────────────────────────────────

/** 캔버스 렌더링 옵션 */
export interface CanvasRenderOptions {
  readonly colorBy?: "role" | "layer" | "depth" | "custom";
  readonly palette?: Readonly<Record<string, string>>;
  readonly opacity?: number;
  readonly showGrid?: boolean;
  readonly showGroups?: boolean;
  readonly showBalance?: boolean;
  readonly showFlow?: boolean;
  /** 오버레이에 사용할 측정값 (showGroups/showBalance/showFlow 활성 시 필요) */
  readonly metrics?: LayoutMetrics;
}

// ─── Monitor ────────────────────────────────────────────────────────

/** 레이아웃 변경 이벤트 */
export interface LayoutChange {
  readonly type: "added" | "removed" | "moved" | "resized" | "reordered";
  readonly nodeId: string;
  readonly before?: LayoutRect;
  readonly after?: LayoutRect;
  readonly timestamp: string;
}

/** 레이아웃 모니터 옵션 */
export interface MonitorOptions {
  readonly intent?: LayoutPattern;
  readonly debounceMs?: number;
  readonly collectOptions?: CollectorOptions;
  readonly onConformanceChange?: (result: ConformanceResult) => void;
  /** 텍스트 점유 변화 감지 여부. 기본 false */
  readonly trackText?: boolean;
  /** 텍스트 점유 변화 콜백 */
  readonly onTextOccupancyChange?: (occupancies: readonly TextOccupancy[]) => void;
}

/** 레이아웃 모니터 */
export interface LayoutMonitor {
  /** 모니터링 시작 */
  start(): void;
  /** 모니터링 중지 */
  stop(): void;
  /** 현재 스냅샷 */
  snapshot(): RLSCDocument;
  /** 변경 이력 */
  readonly changes: readonly LayoutChange[];
  /** 적합성 변경 콜백 (intent 설정 시 활성) */
  onConformanceChange?: (result: ConformanceResult) => void;
}

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
