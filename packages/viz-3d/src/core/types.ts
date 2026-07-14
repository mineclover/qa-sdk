// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * viz-3d 핵심 타입 — 3D 큐브 매트릭스의 선언적 API.
 *
 * 사용자는 CellGrid 구성을 선언하면,
 * 렌더러가 Three.js 씬을 자동 구성한다.
 */

// ═══════════════════════════════════════════════════
//  색상/테마
// ═══════════════════════════════════════════════════

export interface CategoryTheme {
  readonly color: number;
  readonly emissive: number;
}

export interface VizTheme {
  readonly background: number;
  readonly categories: Record<string, CategoryTheme>;
  readonly layerColors: readonly number[];
  /** 셀 기본 opacity (0~1) */
  readonly cellOpacity: number;
  /** 활성 셀 최대 opacity */
  readonly activeOpacity: number;
  /** 빔 opacity */
  readonly beamOpacity: number;
}

export const DEFAULT_THEME: VizTheme = {
  background: 0x050508,
  categories: {
    observation: { color: 0x00e5ff, emissive: 0x0097a7 },
    event: { color: 0xff9100, emissive: 0xbf6c00 },
    policy: { color: 0x00e676, emissive: 0x009624 },
    relation: { color: 0xb388ff, emissive: 0x7c4dff },
    entity: { color: 0x546e7a, emissive: 0x37474f },
    table: { color: 0xff5252, emissive: 0xc62828 },
  },
  layerColors: [0x64ffda, 0xff9f43, 0x7c5cfc, 0xff3860],
  cellOpacity: 0.12,
  activeOpacity: 0.85,
  beamOpacity: 0.4,
};

// ═══════════════════════════════════════════════════
//  셀 그리드 정의
// ═══════════════════════════════════════════════════

export interface CellGridDef {
  /** prefix ID */
  readonly id: string;
  /** schema category */
  readonly category: string;
  /** 계층 (0=UI, 1=Business, 2=Infra, 3=Data) */
  readonly layer: number;
  /** 이 그리드의 셀 entry 목록 */
  readonly entries: readonly string[];
  /** 그리드 열 수 */
  readonly cols: number;
  /** DSL 번들 소속 */
  readonly dsl?: string;
  /** 서비스 소유자 */
  readonly service?: string;

  /**
   * 3D 큐브 배치 — entries를 여러 축으로 분해.
   * 미지정 시 2D 판 (x/z만 사용).
   *
   * 예: page_view의 8개 page를 4×2 판이 아니라
   *     page(x) × userType(y) × locale(z) = 8×3×3 큐브로.
   */
  readonly axes3d?: {
    /** x축 entries */
    readonly x: { label: string; entries: readonly string[] };
    /** y축 entries (높이) */
    readonly y?: { label: string; entries: readonly string[] };
    /** z축 entries (깊이) */
    readonly z?: { label: string; entries: readonly string[] };
  };
}

export interface CellState {
  /** 활성 강도 (0~1+, decay됨) */
  glow: number;
  /** 누적 히트 수 */
  hits: number;
}

export interface CellRef {
  /** "prefix/entry" 형식의 키 */
  readonly key: string;
  readonly gridId: string;
  readonly entry: string;
  readonly category: string;
  readonly layer: number;
  readonly state: CellState;
}

// ═══════════════════════════════════════════════════
//  뷰 모드
// ═══════════════════════════════════════════════════

export type ViewMode = 'layer' | 'category' | 'dsl' | 'service';

export interface ViewPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ═══════════════════════════════════════════════════
//  매트릭스 스택 (큐브 겹침)
// ═══════════════════════════════════════════════════

export type StackAxis = 'x' | 'y' | 'z';

export interface MatrixStackDef {
  /** 스택 ID */
  readonly id: string;
  /** 포함할 grid ID 목록 */
  readonly grids: readonly string[];
  /** 스택 방향 (기본: y) */
  readonly axis: StackAxis;
  /** 그리드 간 간격 */
  readonly gap: number;
  /** 스택 위치 */
  readonly position: ViewPosition;
}

// ═══════════════════════════════════════════════════
//  이벤트/콜백
// ═══════════════════════════════════════════════════

export interface ActivationEvent {
  readonly keys: readonly string[];
  readonly source: 'demo' | 'live' | 'manual';
  readonly timestamp: string;
  readonly addressContext?: Record<string, string>;
}

export interface VizCallbacks {
  /** 셀 클릭 시 */
  onCellClick?: (cell: CellRef) => void;
  /** 뷰 모드 변경 시 */
  onViewChange?: (mode: ViewMode) => void;
  /** 활성화 이벤트 처리 후 */
  onActivation?: (event: ActivationEvent) => void;
}

// ═══════════════════════════════════════════════════
//  최상위 설정
// ═══════════════════════════════════════════════════

export interface VizConfig {
  /** 그리드 정의 목록 */
  readonly grids: readonly CellGridDef[];
  /** 계층별 Y 좌표 */
  readonly layerHeights: readonly number[];
  /** 테마 (기본: DEFAULT_THEME) */
  readonly theme?: VizTheme;
  /** 매트릭스 스택 정의 (큐브 겹침) */
  readonly stacks?: readonly MatrixStackDef[];
  /** 콜백 */
  readonly callbacks?: VizCallbacks;
  /** 카메라 초기 위치 */
  readonly camera?: { x: number; y: number; z: number };
  /** 셀 크기 (기본: 0.4) */
  readonly cellSize?: number;
  /** 셀 간격 (기본: 0.08) */
  readonly cellGap?: number;
  /** 빔 최대 수 (기본: 50) */
  readonly maxBeams?: number;
  /** 앰비언트 파티클 수 (기본: 300) */
  readonly particleCount?: number;
}
