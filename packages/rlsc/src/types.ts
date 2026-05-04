// @def.boundary shared-utility-group
// @def.doc shared-utility-group

export type {
  ConformanceResult,
  ConformanceViolation,
  GestaltPattern,
  GridCell,
  GridSystemPattern,
  LayoutGrid,
  LayoutMetrics,
  LayoutPattern,
  LayoutRect,
  LayerRole,
  LayerStack,
  ProportionPattern,
  ProximityGroup,
  RelationType,
  RLSCDocument,
  RLSCNode,
  RLSCQuery,
  RLSCRelation,
  ScreenIdentifier,
  ScreenIdentifierKind,
  SpacingPattern,
  TextFontInfo,
  TextOccupancy,
  TextRegionDensity,
} from "@qa-sdk/rlsc-analysis";

import type {
  ConformanceResult,
  LayoutMetrics,
  LayoutPattern,
  LayoutRect,
  RLSCDocument,
  TextOccupancy,
} from "@qa-sdk/rlsc-analysis";

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
