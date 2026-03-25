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
  readonly sections?: readonly ("tree" | "grid" | "layers" | "relations")[];
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

// ─── Monitor ────────────────────────────────────────────────────────

/** 레이아웃 변경 이벤트 */
export interface LayoutChange {
  readonly type: "added" | "removed" | "moved" | "resized" | "reordered";
  readonly nodeId: string;
  readonly before?: LayoutRect;
  readonly after?: LayoutRect;
  readonly timestamp: string;
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
}
