// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * CrossView — 임의의 축을 교차하여 시각화 뷰를 구성.
 *
 * prefix 경계를 넘어 원하는 축 조합으로 셀 그리드를 만든다.
 *
 * 핵심 개념:
 *   닫힌 좌표계의 축들 → 사용자가 2~3개 선택 → 교차 그리드 생성
 *   각 셀 = 축 값의 조합 = 좌표 공간의 한 지점
 *   이벤트가 해당 좌표에 도달하면 셀 활성화
 *
 * SplitPattern과의 관계:
 *   SplitPattern: prefix → 시각 패턴 (prefix 내부 축만)
 *   CrossView: 축 자체를 선택 → 교차 뷰 (prefix 경계 무시)
 */

// ═══════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════

/** 축 정의 — 카탈로그에서 추출 */
export interface AxisDef {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly string[];
  /** 이 축을 사용하는 prefix ID 목록 */
  readonly usedBy: readonly string[];
}

/** 시각 채널 배정 */
export interface ChannelAssignment {
  readonly axis: AxisDef;
  readonly channel: 'x' | 'y' | 'z' | 'color' | 'group';
}

/** 교차 뷰 정의 */
export interface CrossViewDef {
  readonly id: string;
  readonly name: string;
  /** 시각 채널 배정 (2~5개) */
  readonly channels: readonly ChannelAssignment[];
  /** 필터: 특정 축 값만 포함 */
  readonly filters?: Record<string, readonly string[]>;
}

/** 교차 셀 */
export interface CrossCell {
  /** 축 값 조합 (예: {page:"checkout", flow_step:"success"}) */
  readonly coords: Record<string, string>;
  /** 셀 키 — 축 값을 ":"으로 연결 */
  readonly key: string;
  /** 공간 위치 */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** group 채널의 값 */
  readonly group?: string;
  /** color 채널의 값 */
  readonly colorValue?: string;
}

/** 교차 뷰 레이아웃 */
export interface CrossViewLayout {
  readonly def: CrossViewDef;
  readonly cells: readonly CrossCell[];
  readonly xEntries: readonly string[];
  readonly yEntries: readonly string[];
  readonly zEntries: readonly string[];
  readonly groups: readonly string[];
  readonly totalCells: number;
  readonly bounds: { width: number; height: number; depth: number };
}

// ═══════════════════════════════════════════════════
//  Layout Computation
// ═══════════════════════════════════════════════════

/**
 * 교차 뷰 레이아웃을 계산한다.
 *
 * channels에 배정된 축을 교차하여 모든 셀 위치를 생성.
 * filters로 특정 값만 포함 가능.
 */
export function computeCrossViewLayout(
  def: CrossViewDef,
  cellSize: number = 0.42,
  cellGap: number = 0.1,
): CrossViewLayout {
  const step = cellSize + cellGap;

  const xAxis = def.channels.find((c) => c.channel === 'x');
  const yAxis = def.channels.find((c) => c.channel === 'y');
  const zAxis = def.channels.find((c) => c.channel === 'z');
  const groupAxis = def.channels.find((c) => c.channel === 'group');
  const colorAxis = def.channels.find((c) => c.channel === 'color');

  const filter = (axis: AxisDef | undefined): readonly string[] => {
    if (!axis) return ['_'];
    const f = def.filters?.[axis.id];
    return f ?? axis.entries;
  };

  const xEntries = filter(xAxis?.axis);
  const yEntries = filter(yAxis?.axis);
  const zEntries = filter(zAxis?.axis);
  const groupEntries = filter(groupAxis?.axis);

  const cells: CrossCell[] = [];

  for (const ge of groupEntries) {
    const groupOffset = groupEntries.indexOf(ge) * (xEntries.length * step + step * 3);

    for (const xe of xEntries) {
      for (const ye of yEntries) {
        for (const ze of zEntries) {
          const xi = xEntries.indexOf(xe);
          const yi = yEntries.indexOf(ye);
          const zi = zEntries.indexOf(ze);

          const coords: Record<string, string> = {};
          if (xAxis) coords[xAxis.axis.id] = xe;
          if (yAxis) coords[yAxis.axis.id] = ye;
          if (zAxis) coords[zAxis.axis.id] = ze;
          if (groupAxis && ge !== '_') coords[groupAxis.axis.id] = ge;

          const keyParts = Object.values(coords);
          const key = keyParts.join(':');

          cells.push({
            coords,
            key,
            x: groupOffset + xi * step,
            y: yi * step,
            z: zi * step,
            group: ge !== '_' ? ge : undefined,
            colorValue: colorAxis ? coords[colorAxis.axis.id] : undefined,
          });
        }
      }
    }
  }

  return {
    def,
    cells,
    xEntries: xEntries as string[],
    yEntries: yEntries as string[],
    zEntries: zEntries as string[],
    groups: groupEntries.filter((g) => g !== '_') as string[],
    totalCells: cells.length,
    bounds: {
      width: (groupEntries.length > 1 ? groupEntries.length : 1) * xEntries.length * step,
      height: yEntries.length * step,
      depth: zEntries.length * step,
    },
  };
}

// ═══════════════════════════════════════════════════
//  이벤트 매칭 — address_context를 교차 셀에 매핑
// ═══════════════════════════════════════════════════

/**
 * decode된 이벤트 값이 교차 뷰의 어떤 셀에 매칭되는지 찾는다.
 *
 * @param decodedValues 모든 prefix의 decode 결과를 평탄화한 값
 *   예: {page:"checkout", flow_step:"success", http_method:"POST", ...}
 * @param layout 교차 뷰 레이아웃
 * @returns 매칭된 셀 키 목록
 */
export function matchEventToCells(
  decodedValues: Record<string, string>,
  layout: CrossViewLayout,
): string[] {
  const matched: string[] = [];

  for (const cell of layout.cells) {
    let isMatch = true;
    for (const [axisId, value] of Object.entries(cell.coords)) {
      if (decodedValues[axisId] !== value) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) matched.push(cell.key);
  }

  return matched;
}

// ═══════════════════════════════════════════════════
//  프리셋 교차 뷰
// ═══════════════════════════════════════════════════

/** 프리셋 축 정의 — DEMO_CATALOG에서 추출 */
export const PRESET_AXES: Record<string, AxisDef> = {
  page: {
    id: 'page',
    name: '페이지',
    entries: [
      'home',
      'product_list',
      'product_detail',
      'cart',
      'checkout',
      'order_complete',
      'mypage',
      'login',
    ],
    usedBy: ['page_view', 'tracking'],
  },
  flow_step: {
    id: 'flow_step',
    name: '흐름 단계',
    entries: ['entry', 'processing', 'success', 'failure', 'payment', 'complete', 'exit'],
    usedBy: ['flow_point'],
  },
  flow_name: {
    id: 'flow_name',
    name: '흐름명',
    entries: ['checkout', 'login', 'browse', 'payment'],
    usedBy: ['flow_point'],
  },
  http_method: {
    id: 'http_method',
    name: 'HTTP 메서드',
    entries: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    usedBy: ['endpoint'],
  },
  verdict_result: {
    id: 'verdict_result',
    name: '판정 결과',
    entries: ['pass', 'fail', 'warn', 'degraded', 'unknown'],
    usedBy: ['pipeline_point', 'engine_event'],
  },
  health_status: {
    id: 'health_status',
    name: '헬스 상태',
    entries: ['healthy', 'degraded', 'unhealthy', 'maintenance'],
    usedBy: ['health_event'],
  },
  pipeline_phase: {
    id: 'pipeline_phase',
    name: '파이프라인 단계',
    entries: ['ingest', 'reconstruct', 'verdict', 'aggregate', 'propagate'],
    usedBy: ['pipeline_point'],
  },
  svc_name: {
    id: 'svc_name',
    name: '서비스',
    entries: ['shopping-web', 'shopping-backend', 'auth', 'payment', 'gateway'],
    usedBy: ['service'],
  },
  role: {
    id: 'role',
    name: '역할',
    entries: ['admin', 'developer', 'operator', 'viewer', 'customer', 'auditor'],
    usedBy: ['permission'],
  },
  userType: {
    id: 'userType',
    name: '사용자유형',
    entries: ['guest', 'member', 'premium'],
    usedBy: ['page_view', 'tracking'],
  },
  trackAction: {
    id: 'trackAction',
    name: '행동',
    entries: ['click', 'view', 'scroll', 'submit', 'navigate', 'add_to_cart', 'purchase', 'close'],
    usedBy: ['tracking'],
  },
};

/** 프리셋 교차 뷰 */
export const PRESET_VIEWS: CrossViewDef[] = [
  {
    id: 'page-x-flowstep',
    name: '페이지 × 흐름 단계',
    channels: [
      { axis: PRESET_AXES.page, channel: 'x' },
      { axis: PRESET_AXES.flow_step, channel: 'z' },
    ],
  },
  {
    id: 'method-x-verdict',
    name: 'HTTP 메서드 × 판정 결과',
    channels: [
      { axis: PRESET_AXES.http_method, channel: 'x' },
      { axis: PRESET_AXES.verdict_result, channel: 'z' },
    ],
  },
  {
    id: 'svc-x-phase-x-health',
    name: '서비스 × 파이프라인 × 헬스 (3D 큐브)',
    channels: [
      { axis: PRESET_AXES.svc_name, channel: 'x' },
      { axis: PRESET_AXES.pipeline_phase, channel: 'y' },
      { axis: PRESET_AXES.health_status, channel: 'z' },
    ],
  },
  {
    id: 'page-x-action-by-usertype',
    name: '페이지 × 행동, 사용자유형별 그룹',
    channels: [
      { axis: PRESET_AXES.userType, channel: 'group' },
      { axis: PRESET_AXES.page, channel: 'x' },
      { axis: PRESET_AXES.trackAction, channel: 'z' },
    ],
  },
  {
    id: 'role-x-method',
    name: '역할 × HTTP 메서드',
    channels: [
      { axis: PRESET_AXES.role, channel: 'x' },
      { axis: PRESET_AXES.http_method, channel: 'z' },
    ],
  },
  {
    id: 'flow-x-step-by-svc',
    name: '흐름 × 단계, 서비스별',
    channels: [
      { axis: PRESET_AXES.svc_name, channel: 'group' },
      { axis: PRESET_AXES.flow_name, channel: 'x' },
      { axis: PRESET_AXES.flow_step, channel: 'z' },
    ],
    filters: { flow_name: ['checkout', 'login', 'payment'] },
  },
];
