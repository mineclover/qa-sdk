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
const _pay = (payloadKey: string, fallback?: string): DimSource => ({ kind: "payload", payloadKey, fallback });

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

// ── 하네스 상태 모델 이벤트 매핑 ──────────────────

const pay = (payloadKey: string, fallback?: string): DimSource => ({ kind: "payload", payloadKey, fallback });

export const HARNESS_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "harness.transition",
    domain: "harness",
    prefixes: [
      {
        prefixId: "harness_transition",
        dims: {
          svc_ref: ctx("service"),
          harness_machine: pay("machine_id"),
          harness_state: pay("to_state"),
          harness_trigger: pay("trigger", "system_auto"),
        },
      },
    ],
  },
  {
    event_key: "harness.process_step",
    domain: "harness",
    prefixes: [
      {
        prefixId: "harness_process_step",
        dims: {
          svc_ref: ctx("service"),
          harness_process: pay("process_id"),
          harness_machine: pay("machine_id"),
          harness_verdict: pay("success_verdict", "pass"),
        },
      },
    ],
  },
  {
    event_key: "harness.guard_check",
    domain: "harness",
    prefixes: [
      {
        prefixId: "harness_guard",
        dims: {
          svc_ref: ctx("service"),
          harness_machine: pay("target_machine"),
          harness_state: pay("target_state"),
          harness_verdict: pay("verdict", "pass"),
        },
      },
    ],
  },
];

registerMappings(HARNESS_EVENT_MAPPINGS);

// ── 게이트 런타임 이벤트 매핑 ────────────────────────

export const GATE_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "gate.execution",
    domain: "harness",
    prefixes: [
      {
        prefixId: "gate_execution",
        dims: {
          svc_ref: ctx("service"),
          gate_kind: pay("gate_kind"),
          gate_scope: pay("gate_scope"),
          gate_state: pay("to_state"),
        },
      },
    ],
  },
  {
    event_key: "bundle.observation",
    domain: "harness",
    prefixes: [
      {
        prefixId: "bundle_observation",
        dims: {
          svc_ref: ctx("service"),
          bundle_state: pay("bundle_state"),
        },
      },
    ],
  },
];

registerMappings(GATE_EVENT_MAPPINGS);

// ── 전이 엔진 이벤트 매핑 ────────────────────────────

export const TRANSITION_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "transition.applied",
    domain: "transition",
    prefixes: [
      {
        prefixId: "transition_event",
        dims: {
          svc_ref: ctx("service"),
          effect_kind: pay("effect_kind"),
          match_mode: pay("match_mode", "single"),
        },
      },
    ],
  },
];

registerMappings(TRANSITION_EVENT_MAPPINGS);

// ── 수렴 파이프라인 이벤트 매핑 ──────────────────────

export const CONVERGENCE_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "convergence.phase",
    domain: "convergence",
    prefixes: [
      {
        prefixId: "convergence_event",
        dims: {
          svc_ref: ctx("service"),
          convergence_phase: pay("phase"),
          convergence_result: pay("result", "ok"),
        },
      },
    ],
  },
];

registerMappings(CONVERGENCE_EVENT_MAPPINGS);

// ── 품질 관측 이벤트 매핑 ────────────────────────────

export const QUALITY_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "error",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("error"),
          quality_kind: fixed("error"),
        },
      },
    ],
  },
  {
    event_key: "warning",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("warning"),
          quality_kind: pay("kind", "error"),
        },
      },
    ],
  },
  {
    event_key: "assertion",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: pay("severity", "info"),
          quality_kind: fixed("assertion"),
        },
      },
    ],
  },
  {
    event_key: "mask_applied",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("info"),
          quality_kind: fixed("mask"),
        },
      },
    ],
  },
  {
    event_key: "field_present",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("info"),
          quality_kind: fixed("field_check"),
        },
      },
    ],
  },
  {
    event_key: "field_missing",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("warning"),
          quality_kind: fixed("field_check"),
        },
      },
    ],
  },
  {
    event_key: "policy_violation",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("error"),
          quality_kind: fixed("policy_violation"),
        },
      },
    ],
  },
  {
    event_key: "unexpected_event",
    domain: "quality",
    prefixes: [
      {
        prefixId: "quality_event",
        dims: {
          svc_ref: ctx("service"),
          quality_severity: fixed("warning"),
          quality_kind: fixed("unexpected"),
        },
      },
    ],
  },
];

registerMappings(QUALITY_EVENT_MAPPINGS);

// ── 실행 관측 이벤트 매핑 ────────────────────────────

export const EXECUTION_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "task_start",
    domain: "execution",
    prefixes: [
      {
        prefixId: "task_event",
        dims: {
          svc_ref: ctx("service"),
          task_type: pay("task_type", "task"),
          task_phase: fixed("start"),
        },
      },
    ],
  },
  {
    event_key: "task_finish",
    domain: "execution",
    prefixes: [
      {
        prefixId: "task_event",
        dims: {
          svc_ref: ctx("service"),
          task_type: pay("task_type", "task"),
          task_phase: fixed("finish"),
        },
      },
    ],
  },
  {
    event_key: "job_start",
    domain: "execution",
    prefixes: [
      {
        prefixId: "task_event",
        dims: {
          svc_ref: ctx("service"),
          task_type: fixed("job"),
          task_phase: fixed("start"),
        },
      },
    ],
  },
  {
    event_key: "job_finish",
    domain: "execution",
    prefixes: [
      {
        prefixId: "task_event",
        dims: {
          svc_ref: ctx("service"),
          task_type: fixed("job"),
          task_phase: fixed("finish"),
        },
      },
    ],
  },
];

registerMappings(EXECUTION_EVENT_MAPPINGS);

// ── SDK 생명주기 이벤트 매핑 ─────────────────────────

export const SDK_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "sdk_init",
    domain: "sdk",
    prefixes: [
      {
        prefixId: "sdk_lifecycle",
        dims: {
          svc_ref: ctx("service"),
          sdk_action: fixed("init"),
          sdk_channel: pay("channel", "browser"),
        },
      },
    ],
  },
  {
    event_key: "sdk_flush",
    domain: "sdk",
    prefixes: [
      {
        prefixId: "sdk_lifecycle",
        dims: {
          svc_ref: ctx("service"),
          sdk_action: fixed("flush"),
          sdk_channel: pay("channel", "browser"),
        },
      },
    ],
  },
];

registerMappings(SDK_EVENT_MAPPINGS);

// ── RPC/WebSocket 이벤트 매핑 ────────────────────────

export const RPC_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "rpc_request",
    domain: "network",
    prefixes: [
      {
        prefixId: "rpc_event",
        dims: {
          svc_ref: ctx("service"),
          rpc_protocol: pay("protocol", "grpc"),
          rpc_phase: fixed("request"),
        },
      },
    ],
  },
  {
    event_key: "rpc_response",
    domain: "network",
    prefixes: [
      {
        prefixId: "rpc_event",
        dims: {
          svc_ref: ctx("service"),
          rpc_protocol: pay("protocol", "grpc"),
          rpc_phase: fixed("response"),
        },
      },
    ],
  },
  {
    event_key: "websocket_open",
    domain: "network",
    prefixes: [
      {
        prefixId: "rpc_event",
        dims: {
          svc_ref: ctx("service"),
          rpc_protocol: fixed("websocket"),
          rpc_phase: fixed("open"),
        },
      },
    ],
  },
  {
    event_key: "websocket_message",
    domain: "network",
    prefixes: [
      {
        prefixId: "rpc_event",
        dims: {
          svc_ref: ctx("service"),
          rpc_protocol: fixed("websocket"),
          rpc_phase: fixed("message"),
        },
      },
    ],
  },
  {
    event_key: "websocket_close",
    domain: "network",
    prefixes: [
      {
        prefixId: "rpc_event",
        dims: {
          svc_ref: ctx("service"),
          rpc_protocol: fixed("websocket"),
          rpc_phase: fixed("close"),
        },
      },
    ],
  },
];

registerMappings(RPC_EVENT_MAPPINGS);

// ── Group A: Decision-Flow 관측 이벤트 매핑 ──────────

export const DECISION_OBSERVE_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "flow.path_resolved",
    domain: "decision",
    prefixes: [
      {
        prefixId: "decision_path",
        dims: {
          flow_type: pay("flow_type"),
          decision_outcome: pay("decision_outcome"),
          scope_mode: pay("scope_mode", "hold"),
        },
      },
    ],
  },
  {
    event_key: "flow.model_applied",
    domain: "decision",
    prefixes: [
      {
        prefixId: "model_apply",
        dims: {
          mental_model: pay("mental_model"),
          reversibility: pay("reversibility"),
          magnitude: pay("magnitude"),
        },
      },
    ],
  },
];

registerMappings(DECISION_OBSERVE_MAPPINGS);

// ── Group B: 인프라 시스템 관측 이벤트 매핑 ──────────
// 이 prefix들은 서비스가 address_context를 직접 생성한다.
// 매핑 등록은 이벤트 레지스트리 완결성을 위한 것.

export const INFRA_OBSERVE_MAPPINGS: readonly EventPrefixMapping[] = [
  // 메트릭/관측
  {
    event_key: "metric.collected",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "metric_point", dims: { svc_ref: ctx("service"), metric_kind: pay("metric_kind"), lifecycle_state: pay("lifecycle_state", "active") } },
      { prefixId: "metric_aggregate", dims: { svc_ref: ctx("service"), metric_kind: pay("metric_kind"), lifecycle_state: pay("lifecycle_state", "active") } },
    ],
  },
  // 패턴 분류/이상 감지
  {
    event_key: "pattern.classified",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "pattern_match", dims: { svc_ref: ctx("service"), dkg_target_kind: pay("target_kind"), verdict_result: pay("verdict", "pass") } },
      { prefixId: "event_classification", dims: { svc_ref: ctx("service"), dkg_target_kind: pay("target_kind"), lifecycle_state: pay("lifecycle_state", "active") } },
    ],
  },
  {
    event_key: "pattern.anomaly_detected",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "pattern_anomaly", dims: { svc_ref: ctx("service"), dkg_target_kind: pay("target_kind"), verdict_result: pay("verdict", "fail") } },
    ],
  },
  // 스키마 검증
  {
    event_key: "schema.validated",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "schema_validation", dims: { svc_ref: ctx("service"), resource_type: pay("resource_type"), verdict_result: pay("verdict", "pass") } },
    ],
  },
  // 레코드 수집
  {
    event_key: "record.ingested",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "ingest_record", dims: { svc_ref: ctx("service"), record_type: pay("record_type", "event") } },
    ],
  },
  // 데이터 정책
  {
    event_key: "policy.evaluated",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "data_policy", dims: { svc_ref: ctx("service"), constraint_op: pay("constraint_op"), constraint_scope: pay("constraint_scope") } },
    ],
  },
  // 버전/게이트 관측
  {
    event_key: "version.observed",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "version_point", dims: { svc_ref: ctx("service"), version_lifecycle: pay("version_lifecycle", "active") } },
      { prefixId: "version_state", dims: { svc_ref: ctx("service"), lifecycle_state: pay("lifecycle_state", "active"), qa_pkg: pay("qa_pkg") } },
    ],
  },
  {
    event_key: "gate.observed",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "gate_point", dims: { svc_ref: ctx("service"), address_state: pay("address_state", "active") } },
    ],
  },
  // 리소스/태그 생명주기
  {
    event_key: "resource.lifecycle_changed",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "resource_lifecycle", dims: { svc_ref: ctx("service"), resource_type: pay("resource_type"), lifecycle_state: pay("lifecycle_state") } },
    ],
  },
  {
    event_key: "tag.lifecycle_changed",
    domain: "infrastructure",
    prefixes: [
      { prefixId: "tag_lifecycle", dims: { svc_ref: ctx("service"), tag: pay("tag"), resource_type: pay("resource_type"), lifecycle_state: pay("lifecycle_state") } },
    ],
  },
];

registerMappings(INFRA_OBSERVE_MAPPINGS);

// ── Group C: CLI 관측 이벤트 매핑 ────────────────────

export const CLI_OBSERVE_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "cli.tracking",
    domain: "cli",
    prefixes: [
      { prefixId: "cli_tracking", dims: { qa_pkg: pay("qa_pkg"), qa_module: pay("qa_module"), flow_type: pay("flow_type", "custom") } },
    ],
  },
  {
    event_key: "test.coverage_report",
    domain: "cli",
    prefixes: [
      { prefixId: "test_coverage", dims: { qa_pkg: pay("qa_pkg"), qa_module: pay("qa_module"), test_result: pay("test_result", "pass"), flow_variant: pay("flow_variant", "default") } },
    ],
  },
];

registerMappings(CLI_OBSERVE_MAPPINGS);

// ── 문서 그래프 이벤트 매핑 ──────────────────────────

export const GRAPH_EVENT_MAPPINGS: readonly EventPrefixMapping[] = [
  {
    event_key: "graph.structure_changed",
    domain: "definition",
    prefixes: [
      {
        prefixId: "graph_event",
        dims: {
          svc_ref: ctx("service"),
          def_level: pay("level", "leaf"),
          graph_action: pay("action"),
          link_type: pay("link_type", "depends_on"),
        },
      },
    ],
  },
];

registerMappings(GRAPH_EVENT_MAPPINGS);
