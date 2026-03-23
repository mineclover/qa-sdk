/**
 * prefix-mapping — event_key → prefix 차원 자동 매핑.
 *
 * 개발자가 `qa.track("cart.add", { item_id: 7 })` 만 호출하면
 * SDK가 필요한 prefix와 차원 값을 자동으로 결정한다.
 *
 * 매핑 구성:
 *   - fixed: 이벤트에 항상 고정되는 차원 값
 *   - fromContext: 런타임 컨텍스트(page, userType 등)에서 파생
 *   - fromPayload: payload 필드에서 파생
 */

// ── Types ──────────────────────────────────────────

/** 차원 값의 출처 */
export type DimSource =
  | { kind: "fixed"; value: string }
  | { kind: "context"; contextKey: string }
  | { kind: "payload"; payloadKey: string; fallback?: string };

/** 하나의 prefix에 대한 차원 매핑 */
export interface PrefixDimMapping {
  [dimLabel: string]: DimSource;
}

/** 이벤트가 발생시키는 prefix와 차원 매핑 */
export interface EventPrefixEntry {
  prefixId: string;
  /** 차원별 값 출처 매핑 */
  dims: PrefixDimMapping;
  /** 조건부 — 특정 조건에서만 이 prefix를 포함 */
  condition?: "always" | "if_api" | "if_page_view";
}

/** 이벤트 → prefix 매핑 정의 */
export interface EventPrefixMapping {
  event_key: string;
  /** 이벤트의 도메인 (auth, commerce, navigation, ...) */
  domain: string;
  /** 기본 포함 prefix 목록 */
  prefixes: EventPrefixEntry[];
}

// ── Context ────────────────────────────────────────

/** 런타임 컨텍스트 — 현재 페이지, 사용자 등 */
export interface TrackingContext {
  page?: string;
  userType?: string;
  locale?: string;
  [key: string]: string | undefined;
}

// ── Resolver ───────────────────────────────────────

/** 매핑 + 컨텍스트 + payload → prefix dims 해석 */
export function resolvePrefixDims(
  mapping: EventPrefixMapping,
  context: TrackingContext,
  payload: Record<string, unknown> = {},
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  for (const entry of mapping.prefixes) {
    // 조건 평가
    if (entry.condition === "if_api" && !payload._isApiCall) continue;
    if (entry.condition === "if_page_view" && !context.page) continue;

    const dims: Record<string, string> = {};
    let skip = false;

    for (const [label, source] of Object.entries(entry.dims)) {
      switch (source.kind) {
        case "fixed":
          dims[label] = source.value;
          break;
        case "context": {
          const val = context[source.contextKey];
          if (val) dims[label] = val;
          else skip = true; // 필수 컨텍스트 없으면 prefix 스킵
          break;
        }
        case "payload": {
          const val = payload[source.payloadKey];
          if (val !== undefined) dims[label] = String(val);
          else if (source.fallback) dims[label] = source.fallback;
          else skip = true;
          break;
        }
      }
    }

    if (!skip) result[entry.prefixId] = dims;
  }

  return result;
}

// ── Helper ─────────────────────────────────────────

const fixed = (value: string): DimSource => ({ kind: "fixed", value });
const ctx = (contextKey: string): DimSource => ({ kind: "context", contextKey });
const pay = (payloadKey: string, fallback?: string): DimSource => ({ kind: "payload", payloadKey, fallback });

// ── 쇼핑 도메인 이벤트 매핑 ────────────────────────

export const SHOP_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  // ── 네비게이션 ──
  {
    event_key: "page.view",
    domain: "navigation",
    prefixes: [
      { prefixId: "page_view", dims: { page: ctx("page"), locale: ctx("locale"), userType: ctx("userType") } },
      { prefixId: "tracking", dims: { trackAction: fixed("view"), page: ctx("page"), userType: ctx("userType") } },
    ],
  },

  // ── 인증 ──
  {
    event_key: "auth.login",
    domain: "auth",
    prefixes: [
      { prefixId: "page_view", dims: { page: fixed("login"), locale: ctx("locale"), userType: fixed("guest") } },
      { prefixId: "tracking", dims: { trackAction: fixed("submit"), page: fixed("login"), userType: fixed("guest") } },
      { prefixId: "auth_event", dims: { action: fixed("login") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("POST"), api_version: fixed("v1") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("login"), flow_step: fixed("entry"), flow_variant: fixed("default") } },
      { prefixId: "permission", dims: { role: fixed("customer") } },
    ],
  },
  {
    event_key: "auth.logout",
    domain: "auth",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("close"), page: ctx("page"), userType: ctx("userType") } },
      { prefixId: "auth_event", dims: { action: fixed("logout") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("POST"), api_version: fixed("v1") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("browse"), flow_step: fixed("exit"), flow_variant: fixed("default") } },
    ],
  },

  // ── 상품 ──
  {
    event_key: "product.list",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("view"), page: fixed("product_list"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("GET"), api_version: fixed("v1") } },
    ],
  },
  {
    event_key: "product.detail",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: fixed("product_detail"), locale: ctx("locale"), userType: ctx("userType") } },
      { prefixId: "tracking", dims: { trackAction: fixed("click"), page: fixed("product_detail"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("GET"), api_version: fixed("v1") } },
    ],
  },

  // ── 장바구니 ──
  {
    event_key: "cart.add",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("add_to_cart"), page: ctx("page"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("POST"), api_version: fixed("v1") } },
      { prefixId: "cart_event", dims: { action: fixed("add") } },
    ],
  },
  {
    event_key: "cart.remove",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("click"), page: fixed("cart"), userType: ctx("userType") } },
      { prefixId: "cart_event", dims: { action: fixed("remove") } },
    ],
  },

  // ── 결제 ──
  {
    event_key: "checkout.entry",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: fixed("checkout"), locale: ctx("locale"), userType: ctx("userType") } },
      { prefixId: "tracking", dims: { trackAction: fixed("navigate"), page: fixed("checkout"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("page"), http_method: fixed("GET"), api_version: fixed("v1") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("checkout"), flow_step: fixed("entry"), flow_variant: fixed("default") } },
      { prefixId: "permission", dims: { role: fixed("customer") } },
    ],
  },
  {
    event_key: "checkout.process",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: fixed("checkout"), locale: ctx("locale"), userType: ctx("userType") } },
      { prefixId: "tracking", dims: { trackAction: fixed("submit"), page: fixed("checkout"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("POST"), api_version: fixed("v1") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("checkout"), flow_step: fixed("processing"), flow_variant: fixed("default") } },
      { prefixId: "permission", dims: { role: fixed("customer") } },
      { prefixId: "order_event", dims: { action: fixed("create") } },
    ],
  },
  {
    event_key: "payment.process",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("submit"), page: fixed("checkout"), userType: ctx("userType") } },
      { prefixId: "endpoint", dims: { resource_type: fixed("api"), http_method: fixed("POST"), api_version: fixed("v1") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("payment"), flow_step: fixed("payment"), flow_variant: fixed("default") } },
      { prefixId: "pipeline_point", dims: { pipeline_phase: fixed("ingest"), validation_mode: fixed("strict"), verdict_result: fixed("pass"), temporal_strategy: fixed("span_local") } },
    ],
  },
  {
    event_key: "payment.success",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: fixed("purchase"), page: fixed("checkout"), userType: ctx("userType") } },
      { prefixId: "order_event", dims: { action: fixed("complete") } },
      { prefixId: "flow_point", dims: { flow_name: fixed("checkout"), flow_step: fixed("success"), flow_variant: fixed("default") } },
      { prefixId: "pipeline_point", dims: { pipeline_phase: fixed("verdict"), validation_mode: fixed("strict"), verdict_result: fixed("pass"), temporal_strategy: fixed("span_local") } },
    ],
  },
];

// ── Registry ──────────────────────────────────────

const _mappingMap = new Map<string, EventPrefixMapping>();

export function registerMappings(mappings: readonly EventPrefixMapping[]): void {
  for (const m of mappings) _mappingMap.set(m.event_key, m);
}

export function getMapping(eventKey: string): EventPrefixMapping | undefined {
  return _mappingMap.get(eventKey);
}

export function getAllMappings(): readonly EventPrefixMapping[] {
  return [..._mappingMap.values()];
}

// 기본 쇼핑 도메인 등록
registerMappings(SHOP_EVENT_MAPPINGS);
