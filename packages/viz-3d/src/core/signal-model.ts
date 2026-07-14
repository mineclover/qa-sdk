// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * SignalModel — 트래킹의 상위 개념 구조.
 *
 * "트래킹 포인트"는 코드의 호출 지점이지 좌표계의 개념이 아니다.
 * 좌표계의 개념은 "Signal" — 시스템에서 발생한 의미있는 순간.
 *
 * Signal = 여러 prefix가 동시에 활성화되는 하나의 순간.
 * 각 prefix는 Signal의 다른 측면(role)을 설명한다.
 *
 * ┌─────────────────────────────────────────────┐
 * │  Signal("auth.login")                        │
 * │                                              │
 * │  context:  service(prod/asia/web)             │ ← 어디서
 * │            page_view(login)                   │
 * │  trigger:  tracking(submit)                   │ ← 유저가 뭘 했는가
 * │            auth_event(login)                  │ ← 시스템에 무슨 일이
 * │  channel:  endpoint(POST/api)                 │ ← 어떤 경로로
 * │  state:    flow_point(login/entry)             │ ← 흐름 어디
 * │  guard:    permission(customer)               │ ← 어떤 조건으로
 * │  effect:   (없음)                             │ ← 결과
 * │  data:     members/id, members/role           │ ← 데이터 접점
 * └─────────────────────────────────────────────┘
 *
 * 용어 정의:
 *   Signal     = 의미있는 순간. 1번의 qaTrack() 호출 = 1개의 Signal.
 *   SignalRole = prefix가 Signal 내에서 담당하는 역할.
 *   SignalDef  = Signal의 정의 (어떤 prefix를 어떤 role로 사용하는가).
 *   SignalInstance = 런타임에 발생한 Signal (address_context + timestamp).
 */

// ═══════════════════════════════════════════════════
//  Signal Role — prefix가 Signal에서 담당하는 역할
// ═══════════════════════════════════════════════════

export type SignalRole =
  | 'context' // 어디서 — service, page_view (환경/위치)
  | 'trigger' // 뭘 했는가 — tracking, *_event (유저 행동/시스템 이벤트)
  | 'channel' // 어떤 경로로 — endpoint (API/webhook/gRPC)
  | 'state' // 흐름 어디 — flow_point (비즈니스 흐름 위치)
  | 'guard' // 어떤 조건 — permission, rbac (권한/정책)
  | 'effect' // 결과 — pipeline_point, health_event, deploy_event
  | 'data'; // 데이터 접점 — table refs (DB 읽기/쓰기)

export const SIGNAL_ROLE_LABELS: Record<SignalRole, string> = {
  context: '어디서',
  trigger: '뭘 했는가',
  channel: '어떤 경로',
  state: '흐름 어디',
  guard: '어떤 조건',
  effect: '결과',
  data: '데이터 접점',
};

export const SIGNAL_ROLE_COLORS: Record<SignalRole, string> = {
  context: '#546e7a',
  trigger: '#ff9100',
  channel: '#00e5ff',
  state: '#b388ff',
  guard: '#00e676',
  effect: '#ff5252',
  data: '#fd79a8',
};

// ═══════════════════════════════════════════════════
//  prefix → role 매핑
// ═══════════════════════════════════════════════════

const PREFIX_ROLE_MAP: Record<string, SignalRole> = {
  // context
  service: 'context',
  page_view: 'context',
  // trigger
  tracking: 'trigger',
  cart_event: 'trigger',
  auth_event: 'trigger',
  order_event: 'trigger',
  event: 'trigger',
  engine_event: 'trigger',
  schema_event: 'trigger',
  // channel
  endpoint: 'channel',
  // state
  flow_point: 'state',
  // guard
  permission: 'guard',
  rbac: 'guard',
  // effect
  pipeline_point: 'effect',
  health_event: 'effect',
  deploy_event: 'effect',
  data_policy: 'effect',
  // data
  members: 'data',
  orders: 'data',
  items: 'data',
  orgs: 'data',
  carts: 'data',
  cart_items: 'data',
  // relation
  relational: 'context',
  content: 'context',
};

export function getPrefixRole(prefixId: string): SignalRole {
  return PREFIX_ROLE_MAP[prefixId] ?? 'trigger';
}

// ═══════════════════════════════════════════════════
//  Signal Definition — 설계 시점
// ═══════════════════════════════════════════════════

export interface SignalMember {
  readonly prefixId: string;
  readonly role: SignalRole;
  /** 이 멤버에서 사용하는 축 값 (설계 시 고정 가능) */
  readonly fixedValues?: Record<string, string>;
}

export interface SignalDef {
  /** Signal 식별자 (예: "auth.login", "cart.add") */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 이 Signal을 구성하는 prefix들과 역할 */
  readonly members: readonly SignalMember[];
  /** 선행 Signal (이 Signal 전에 발생해야 하는 것) */
  readonly requires?: readonly string[];
  /** 이 Signal이 속하는 DSL */
  readonly dsl?: string;
}

// ═══════════════════════════════════════════════════
//  Signal Instance — 런타임
// ═══════════════════════════════════════════════════

export interface SignalInstance {
  readonly signalId: string;
  readonly timestamp: string;
  readonly traceId: string;
  readonly addressContext: Record<string, string>;
  /** role별 분류된 address */
  readonly byRole: Record<SignalRole, readonly { prefixId: string; serialized: string }[]>;
}

/**
 * address_context를 role별로 분류한다.
 */
export function classifyByRole(
  addressContext: Record<string, string>,
): Record<SignalRole, { prefixId: string; serialized: string }[]> {
  const result: Record<SignalRole, { prefixId: string; serialized: string }[]> = {
    context: [],
    trigger: [],
    channel: [],
    state: [],
    guard: [],
    effect: [],
    data: [],
  };
  for (const [prefixId, serialized] of Object.entries(addressContext)) {
    const role = getPrefixRole(prefixId);
    result[role].push({ prefixId, serialized });
  }
  return result;
}

// ═══════════════════════════════════════════════════
//  Signal Catalog — 프리셋 Signal 정의
// ═══════════════════════════════════════════════════

export const DEMO_SIGNALS: SignalDef[] = [
  {
    id: 'auth.login',
    name: '로그인',
    description: '사용자 인증 → 세션 생성',
    dsl: 'dsl-auth',
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'login' } },
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'submit' } },
      { prefixId: 'auth_event', role: 'trigger', fixedValues: { action: 'login' } },
      { prefixId: 'endpoint', role: 'channel', fixedValues: { http_method: 'POST' } },
      {
        prefixId: 'flow_point',
        role: 'state',
        fixedValues: { flow_name: 'login', flow_step: 'entry' },
      },
      { prefixId: 'permission', role: 'guard', fixedValues: { role: 'customer' } },
    ],
  },
  {
    id: 'page.view',
    name: '화면 조회',
    description: '사용자가 페이지를 방문 (generic)',
    members: [
      { prefixId: 'page_view', role: 'context' },
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'view' } },
    ],
  },
  {
    id: 'page.home',
    name: '홈 화면',
    description: '홈 페이지 방문',
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'home' } },
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'view', page: 'home' } },
    ],
  },
  {
    id: 'page.product',
    name: '상품 상세',
    description: '상품 상세 페이지 방문',
    requires: ['page.home'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'product_detail' } },
      {
        prefixId: 'tracking',
        role: 'trigger',
        fixedValues: { trackAction: 'click', page: 'product_detail' },
      },
      {
        prefixId: 'endpoint',
        role: 'channel',
        fixedValues: { resource_type: 'api', http_method: 'GET' },
      },
    ],
  },
  {
    id: 'page.mypage',
    name: '마이페이지',
    description: '마이페이지 방문',
    requires: ['auth.login'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'mypage' } },
      {
        prefixId: 'tracking',
        role: 'trigger',
        fixedValues: { trackAction: 'view', page: 'mypage' },
      },
    ],
  },
  {
    id: 'page.order_complete',
    name: '주문 완료',
    description: '주문 완료 페이지',
    requires: ['payment.success'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'order_complete' } },
      {
        prefixId: 'tracking',
        role: 'trigger',
        fixedValues: { trackAction: 'view', page: 'order_complete' },
      },
    ],
  },
  {
    id: 'api.call',
    name: 'API 호출',
    description: '서버 API 요청',
    members: [{ prefixId: 'endpoint', role: 'channel' }],
  },
  {
    id: 'cart.add',
    name: '장바구니 담기',
    description: '상품을 장바구니에 추가',
    dsl: 'dsl-commerce',
    requires: ['auth.login'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'product_detail' } },
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'add_to_cart' } },
      { prefixId: 'endpoint', role: 'channel', fixedValues: { http_method: 'POST' } },
      { prefixId: 'cart_event', role: 'trigger', fixedValues: { action: 'add' } },
    ],
  },
  {
    id: 'checkout.entry',
    name: '결제 진입',
    description: '결제 페이지 진입',
    dsl: 'dsl-checkout',
    requires: ['cart.add'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'checkout' } },
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'navigate' } },
      {
        prefixId: 'endpoint',
        role: 'channel',
        fixedValues: { resource_type: 'page', http_method: 'GET' },
      },
      {
        prefixId: 'flow_point',
        role: 'state',
        fixedValues: { flow_name: 'checkout', flow_step: 'entry' },
      },
      { prefixId: 'permission', role: 'guard', fixedValues: { role: 'customer' } },
    ],
  },
  {
    id: 'checkout.process',
    name: '주문 생성',
    description: '주문 데이터 생성 + 결제 요청',
    dsl: 'dsl-checkout',
    requires: ['checkout.entry'],
    members: [
      { prefixId: 'page_view', role: 'context', fixedValues: { page: 'checkout' } },
      { prefixId: 'endpoint', role: 'channel', fixedValues: { http_method: 'POST' } },
      {
        prefixId: 'flow_point',
        role: 'state',
        fixedValues: { flow_name: 'checkout', flow_step: 'processing' },
      },
      { prefixId: 'permission', role: 'guard', fixedValues: { role: 'customer' } },
      { prefixId: 'order_event', role: 'trigger', fixedValues: { action: 'create' } },
      { prefixId: 'pipeline_point', role: 'effect', fixedValues: { pipeline_phase: 'ingest' } },
    ],
  },
  {
    id: 'payment.success',
    name: '결제 성공',
    description: '결제 완료 → 주문 확정',
    dsl: 'dsl-checkout',
    requires: ['checkout.process'],
    members: [
      { prefixId: 'order_event', role: 'trigger', fixedValues: { action: 'complete' } },
      {
        prefixId: 'flow_point',
        role: 'state',
        fixedValues: { flow_name: 'checkout', flow_step: 'success' },
      },
      { prefixId: 'health_event', role: 'effect', fixedValues: { health_status: 'healthy' } },
      { prefixId: 'pipeline_point', role: 'effect', fixedValues: { pipeline_phase: 'verdict' } },
    ],
  },
  {
    id: 'auth.logout',
    name: '로그아웃',
    description: '세션 종료',
    dsl: 'dsl-auth',
    members: [
      { prefixId: 'tracking', role: 'trigger', fixedValues: { trackAction: 'close' } },
      { prefixId: 'auth_event', role: 'trigger', fixedValues: { action: 'logout' } },
      { prefixId: 'endpoint', role: 'channel', fixedValues: { http_method: 'POST' } },
      {
        prefixId: 'flow_point',
        role: 'state',
        fixedValues: { flow_name: 'browse', flow_step: 'exit' },
      },
    ],
  },
];

// ═══════════════════════════════════════════════════
//  Signal → address_context 유효성 검증
// ═══════════════════════════════════════════════════

export interface SignalValidation {
  readonly signalId: string;
  readonly valid: boolean;
  readonly missingRoles: readonly SignalRole[];
  readonly extraPrefixes: readonly string[];
  readonly matchedMembers: number;
  readonly totalMembers: number;
}

/**
 * address_context가 SignalDef에 맞는지 검증한다.
 */
export function validateSignal(
  signalDef: SignalDef,
  addressContext: Record<string, string>,
): SignalValidation {
  const presentPrefixes = new Set(Object.keys(addressContext));
  const expectedPrefixes = new Set(signalDef.members.map((m) => m.prefixId));

  let matched = 0;
  const missingRoles = new Set<SignalRole>();

  for (const member of signalDef.members) {
    if (presentPrefixes.has(member.prefixId)) {
      matched++;
    } else {
      missingRoles.add(member.role);
    }
  }

  const extraPrefixes = [...presentPrefixes].filter(
    (p) => !expectedPrefixes.has(p) && p !== 'service',
  );

  return {
    signalId: signalDef.id,
    valid: matched === signalDef.members.length,
    missingRoles: [...missingRoles],
    extraPrefixes,
    matchedMembers: matched,
    totalMembers: signalDef.members.length,
  };
}
