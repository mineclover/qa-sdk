/**
 * self-check-analyzer — self-check의 순수 분석 로직.
 *
 * CLI의 dkg self-check에서 추출한 Layer 2 (FAST).
 * execSync 없음. Store 의존 없음. 순수 함수.
 *
 * 컨벤션:
 *   - 입력: SelfCheckResult[] (빌드/테스트 결과) + DemoCatalog
 *   - 출력: SelfCheckAnalysis (좌표 인코딩 + convergence + invariant)
 *   - CI에서 결과를 JSON으로 저장 → 이 모듈로 분석 → CLI/테스트에서 소비
 *
 * @layer 측정 (Measurement)
 */

import type { DemoCatalog } from "demo-snapshot";
import { encodePrefixByValue, latestPrefixVersion } from "demo-snapshot";
import { aggregateUsageData, analyzeCollectionHealth } from "./usage-aggregator.js";
import { analyzeEntryCoverage } from "./entry-coverage.js";
import type { UsageData, CollectionHealthReport, CoverageReport } from "./convergence.types.js";
import type { AddressContextRecord } from "./usage-aggregator.js";


// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface SelfCheckResult {
  readonly pkg: string;
  readonly kind: "build" | "test";
  readonly result: string;
  readonly module?: string;
  readonly tests?: number;
  readonly passed?: number;
  readonly failed?: number;
  readonly durationMs?: number;
}

export interface InvariantViolation {
  readonly pkg: string;
  readonly message: string;
}

export interface SelfCheckAnalysis {
  readonly records: readonly AddressContextRecord[];
  readonly usage: UsageData;
  readonly health: CollectionHealthReport;
  readonly coverage: CoverageReport;
  readonly invariantViolations: readonly InvariantViolation[];
  readonly buildSummary: { success: number; failure: number; skipped: number; total: number };
  readonly testSummary: { passed: number; failed: number; tests: number; total: number };
  readonly bizRecords: number;
}

// ═══════════════════════════════════════════════════════════════
//  합성 이벤트 정의 — 도메인별 커버리지 확장
// ═══════════════════════════════════════════════════════════════

interface SyntheticEvent {
  readonly prefix: string;
  readonly dims: Record<string, string | number>;
  /** prefix_ref 차원 이름 (있을 경우 refEntries 첫 값을 자동 주입) */
  readonly refDims?: readonly string[];
}

/**
 * 도메인별 합성 이벤트 — version은 latestPrefixVersion으로 동적 결정.
 * encodePrefixByValue로 인코딩하여 해당 entry를 관측 상태로 전환한다.
 * prefix_ref 차원은 refEntries의 첫 번째 값을 자동 주입한다.
 */
const SYNTHETIC_EVENTS: readonly SyntheticEvent[] = [
  // ── 쇼핑 도메인 ──────────────────────────────────────────────
  // service: env × region × svc_name × namespace (직접 axis — refDim 없음)
  { prefix: "service", dims: { env: "dev", region: "asia", svc_name: "shopping-web", namespace: "shop" } },
  { prefix: "service", dims: { env: "prod", region: "asia", svc_name: "shopping-backend", namespace: "shop" } },
  { prefix: "service", dims: { env: "stage", region: "usa", svc_name: "auth", namespace: "cms" } },
  { prefix: "service", dims: { env: "test", region: "asia", svc_name: "payment", namespace: "shop" } },
  { prefix: "service", dims: { env: "local", region: "asia", svc_name: "gateway", namespace: "shop" } },

  // tracking: trackAction × page × userType
  { prefix: "tracking", dims: { trackAction: "click", page: "home", userType: "guest" } },
  { prefix: "tracking", dims: { trackAction: "view", page: "product_detail", userType: "member" } },
  { prefix: "tracking", dims: { trackAction: "scroll", page: "product_list", userType: "premium" } },
  { prefix: "tracking", dims: { trackAction: "submit", page: "checkout", userType: "member" } },
  { prefix: "tracking", dims: { trackAction: "navigate", page: "cart", userType: "guest" } },
  { prefix: "tracking", dims: { trackAction: "add_to_cart", page: "product_detail", userType: "member" } },
  { prefix: "tracking", dims: { trackAction: "purchase", page: "order_complete", userType: "member" } },
  { prefix: "tracking", dims: { trackAction: "close", page: "mypage", userType: "member" } },

  // page_view: svc_ref × page × locale × userType
  { prefix: "page_view", dims: { page: "home", locale: "ko", userType: "guest" }, refDims: ["svc_ref"] },
  { prefix: "page_view", dims: { page: "product_detail", locale: "en", userType: "member" }, refDims: ["svc_ref"] },
  { prefix: "page_view", dims: { page: "cart", locale: "ja", userType: "premium" }, refDims: ["svc_ref"] },
  { prefix: "page_view", dims: { page: "login", locale: "ko", userType: "guest" }, refDims: ["svc_ref"] },

  // rbac: role(rbac_role) × action × resource
  { prefix: "rbac", dims: { role: "admin", action: "read", resource: "dashboard" } },
  { prefix: "rbac", dims: { role: "editor", action: "write", resource: "reports" } },
  { prefix: "rbac", dims: { role: "viewer", action: "delete", resource: "settings" } },
  { prefix: "rbac", dims: { role: "admin", action: "admin", resource: "users" } },

  // content: tag × category × status × locale × channel
  { prefix: "content", dims: { tag: "frontend", category: "tech", status: "published", locale: "ko", channel: "web" } },
  { prefix: "content", dims: { tag: "backend", category: "design", status: "draft", locale: "en", channel: "mobile" } },
  { prefix: "content", dims: { tag: "devops", category: "product", status: "archived", locale: "ja", channel: "web" } },
  { prefix: "content", dims: { tag: "ai", category: "culture", status: "published", locale: "ko", channel: "mobile" } },
  { prefix: "content", dims: { tag: "database", category: "tech", status: "draft", locale: "en", channel: "web" } },

  // flow_point: svc_ref × flow_name × flow_step × flow_variant
  { prefix: "flow_point", dims: { flow_name: "checkout", flow_step: "entry", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "signup", flow_step: "processing", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "order_cancel", flow_step: "branch", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "refund", flow_step: "success", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "login", flow_step: "entry", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "browse", flow_step: "complete", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "cart_manage", flow_step: "exit", flow_variant: "default" }, refDims: ["svc_ref"] },
  { prefix: "flow_point", dims: { flow_name: "payment", flow_step: "payment", flow_variant: "default" }, refDims: ["svc_ref"] },

  // endpoint: svc_ref × resource_type × http_method × api_version
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "POST", api_version: "v1" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "GET", api_version: "v1" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "page", http_method: "GET", api_version: "v1" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "webhook", http_method: "POST", api_version: "v2" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "grpc", http_method: "POST", api_version: "v1" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "PUT", api_version: "v1" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "DELETE", api_version: "v2" }, refDims: ["svc_ref"] },
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "PATCH", api_version: "v1" }, refDims: ["svc_ref"] },

  // permission: perm_svc × role
  { prefix: "permission", dims: { role: "admin" }, refDims: ["perm_svc"] },
  { prefix: "permission", dims: { role: "developer" }, refDims: ["perm_svc"] },
  { prefix: "permission", dims: { role: "operator" }, refDims: ["perm_svc"] },
  { prefix: "permission", dims: { role: "viewer" }, refDims: ["perm_svc"] },
  { prefix: "permission", dims: { role: "customer" }, refDims: ["perm_svc"] },
  { prefix: "permission", dims: { role: "auditor" }, refDims: ["perm_svc"] },

  // event: evt_svc × event_name × initiator
  { prefix: "event", dims: { event_name: "user.login", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "order.created", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "user.logout", initiator: "mobile" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "order.paid", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "payment.failed", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "session.expired", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "config.changed", initiator: "web" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "payment.cancel_requested", initiator: "mobile" }, refDims: ["evt_svc"] },
  { prefix: "event", dims: { event_name: "payment.refunded", initiator: "web" }, refDims: ["evt_svc"] },

  // relational: subjectKind × predicate × objectKind
  { prefix: "relational", dims: { subjectKind: "user", predicate: "has", objectKind: "role" } },
  { prefix: "relational", dims: { subjectKind: "role", predicate: "can_access", objectKind: "permission" } },
  { prefix: "relational", dims: { subjectKind: "group", predicate: "belongs_to", objectKind: "group" } },
  { prefix: "relational", dims: { subjectKind: "service", predicate: "has_capability", objectKind: "resource" } },
  { prefix: "relational", dims: { subjectKind: "engine", predicate: "evaluated", objectKind: "constraint" } },

  // ── DKG 도메인 ──────────────────────────────────────────────
  // dkg_event: dkg_op × dkg_target_kind
  { prefix: "dkg_event", dims: { dkg_op: "claim", dkg_target_kind: "prefix" } },
  { prefix: "dkg_event", dims: { dkg_op: "decide", dkg_target_kind: "decision" } },
  { prefix: "dkg_event", dims: { dkg_op: "observe", dkg_target_kind: "observation" } },
  { prefix: "dkg_event", dims: { dkg_op: "resolve", dkg_target_kind: "observation" } },
  { prefix: "dkg_event", dims: { dkg_op: "link", dkg_target_kind: "intent-link" } },
  { prefix: "dkg_event", dims: { dkg_op: "refresh", dkg_target_kind: "system" } },
  { prefix: "dkg_event", dims: { dkg_op: "self-check", dkg_target_kind: "system" } },
  { prefix: "dkg_event", dims: { dkg_op: "converge", dkg_target_kind: "system" } },
  { prefix: "dkg_event", dims: { dkg_op: "trace", dkg_target_kind: "skill" } },
  { prefix: "dkg_event", dims: { dkg_op: "release", dkg_target_kind: "axis" } },
  { prefix: "dkg_event", dims: { dkg_op: "promote", dkg_target_kind: "constraint" } },

  // dkg_decision_event: decision_type × dkg_target_kind × node_source
  { prefix: "dkg_decision_event", dims: { decision_type: "capacity", dkg_target_kind: "axis", node_source: "bootstrap" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "new-axis", dkg_target_kind: "axis", node_source: "manual" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "new-prefix", dkg_target_kind: "prefix", node_source: "auto" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "dim-add", dkg_target_kind: "domain", node_source: "manual" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "merge", dkg_target_kind: "prefix", node_source: "auto" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "deprecate", dkg_target_kind: "axis", node_source: "manual" } },
  { prefix: "dkg_decision_event", dims: { decision_type: "separation", dkg_target_kind: "dsl-bundle", node_source: "bootstrap" } },

  // dkg_observation_event: obs_source × dkg_target_kind × lifecycle_state
  { prefix: "dkg_observation_event", dims: { obs_source: "manual", dkg_target_kind: "prefix", lifecycle_state: "draft" } },
  { prefix: "dkg_observation_event", dims: { obs_source: "metric", dkg_target_kind: "axis", lifecycle_state: "active" } },
  { prefix: "dkg_observation_event", dims: { obs_source: "runtime", dkg_target_kind: "observation", lifecycle_state: "active" } },
  { prefix: "dkg_observation_event", dims: { obs_source: "review", dkg_target_kind: "decision", lifecycle_state: "deprecated" } },
  { prefix: "dkg_observation_event", dims: { obs_source: "metric", dkg_target_kind: "constraint", lifecycle_state: "archived" } },
  { prefix: "dkg_observation_event", dims: { obs_source: "manual", dkg_target_kind: "system", lifecycle_state: "superseded" } },

  // skill_execution: skill_id × skill_category × skill_outcome
  { prefix: "skill_execution", dims: { skill_id: "skill-trace", skill_category: "read", skill_outcome: "ok" } },
  { prefix: "skill_execution", dims: { skill_id: "skill-explore-prefix", skill_category: "read", skill_outcome: "ok" } },
  { prefix: "skill_execution", dims: { skill_id: "skill-record-decision", skill_category: "write", skill_outcome: "ok" } },
  { prefix: "skill_execution", dims: { skill_id: "skill-domain-health", skill_category: "analysis", skill_outcome: "warning" } },
  { prefix: "skill_execution", dims: { skill_id: "skill-converge-chain", skill_category: "chain", skill_outcome: "ok" } },
  { prefix: "skill_execution", dims: { skill_id: "skill-schema-health-audit", skill_category: "analysis", skill_outcome: "ok" } },

  // cli_event: cli_intent × cli_domain × cli_subject
  { prefix: "cli_event", dims: { cli_intent: "query", cli_domain: "dkg-graph", cli_subject: "prefix" } },
  { prefix: "cli_event", dims: { cli_intent: "analyze", cli_domain: "convergence", cli_subject: "observation" } },
  { prefix: "cli_event", dims: { cli_intent: "mutate", cli_domain: "dkg-graph", cli_subject: "decision" } },
  { prefix: "cli_event", dims: { cli_intent: "publish", cli_domain: "registry", cli_subject: "version" } },
  { prefix: "cli_event", dims: { cli_intent: "lifecycle", cli_domain: "dkg-skill", cli_subject: "skill" } },
  { prefix: "cli_event", dims: { cli_intent: "init", cli_domain: "catalog", cli_subject: "catalog" } },
  { prefix: "cli_event", dims: { cli_intent: "backup", cli_domain: "system", cli_subject: "system" } },

  // contract_check: qa_pkg × api_surface × test_result
  { prefix: "contract_check", dims: { qa_pkg: "weighted-index", api_surface: "encode-decode", test_result: "passed" } },
  { prefix: "contract_check", dims: { qa_pkg: "permission-engine", api_surface: "perm-grant", test_result: "passed" } },
  { prefix: "contract_check", dims: { qa_pkg: "spec-core", api_surface: "convergence-analysis", test_result: "passed" } },
  { prefix: "contract_check", dims: { qa_pkg: "bit-index", api_surface: "dim-extract", test_result: "passed" } },

  // observation_event: observation_intent × dkg_target_kind
  { prefix: "observation_event", dims: { observation_intent: "action_needed", dkg_target_kind: "prefix" } },
  { prefix: "observation_event", dims: { observation_intent: "monitoring", dkg_target_kind: "axis" } },
  { prefix: "observation_event", dims: { observation_intent: "completed", dkg_target_kind: "observation" } },

  // spec_event: spec_type × lifecycle_state
  { prefix: "spec_event", dims: { spec_type: "req", lifecycle_state: "draft" } },
  { prefix: "spec_event", dims: { spec_type: "feat", lifecycle_state: "active" } },
  { prefix: "spec_event", dims: { spec_type: "adr", lifecycle_state: "active" } },
  { prefix: "spec_event", dims: { spec_type: "uc", lifecycle_state: "archived" } },
  { prefix: "spec_event", dims: { spec_type: "evt", lifecycle_state: "active" } },
  { prefix: "spec_event", dims: { spec_type: "ls", lifecycle_state: "reversed" } },

  // edge_activity: edge_type × dkg_target_kind
  { prefix: "edge_activity", dims: { edge_type: "satisfies", dkg_target_kind: "prefix" } },
  { prefix: "edge_activity", dims: { edge_type: "implements", dkg_target_kind: "domain" } },
  { prefix: "edge_activity", dims: { edge_type: "tests", dkg_target_kind: "dsl-bundle" } },
  { prefix: "edge_activity", dims: { edge_type: "depends-on", dkg_target_kind: "skill" } },
  { prefix: "edge_activity", dims: { edge_type: "consumes", dkg_target_kind: "constraint" } },
  { prefix: "edge_activity", dims: { edge_type: "observes", dkg_target_kind: "observation" } },
  { prefix: "edge_activity", dims: { edge_type: "supersedes", dkg_target_kind: "decision" } },

  // ── 인프라 도메인 ──────────────────────────────────────────────
  // deploy_event: svc_ref × deploy_action × actor(table_ref — 자동 건너뜀)
  { prefix: "deploy_event", dims: { deploy_action: "deploy" }, refDims: ["svc_ref"] },
  { prefix: "deploy_event", dims: { deploy_action: "scale_up" }, refDims: ["svc_ref"] },
  { prefix: "deploy_event", dims: { deploy_action: "restart" }, refDims: ["svc_ref"] },
  { prefix: "deploy_event", dims: { deploy_action: "scale_down" }, refDims: ["svc_ref"] },
  { prefix: "deploy_event", dims: { deploy_action: "migrate" }, refDims: ["svc_ref"] },

  // health_event: svc_ref × health_status
  { prefix: "health_event", dims: { health_status: "healthy" }, refDims: ["svc_ref"] },
  { prefix: "health_event", dims: { health_status: "degraded" }, refDims: ["svc_ref"] },

  // pipeline_point: svc_ref × pipeline_phase × validation_mode × verdict_result × temporal_strategy
  { prefix: "pipeline_point", dims: { pipeline_phase: "ingest", validation_mode: "strict", verdict_result: "pass", temporal_strategy: "span_local" }, refDims: ["svc_ref"] },
  { prefix: "pipeline_point", dims: { pipeline_phase: "reconstruct", validation_mode: "warn", verdict_result: "pass", temporal_strategy: "global" }, refDims: ["svc_ref"] },
  { prefix: "pipeline_point", dims: { pipeline_phase: "verdict", validation_mode: "strict", verdict_result: "warn", temporal_strategy: "span_local" }, refDims: ["svc_ref"] },
  { prefix: "pipeline_point", dims: { pipeline_phase: "aggregate", validation_mode: "off", verdict_result: "pass", temporal_strategy: "global" }, refDims: ["svc_ref"] },
  { prefix: "pipeline_point", dims: { pipeline_phase: "propagate", validation_mode: "strict", verdict_result: "pass", temporal_strategy: "span_local" }, refDims: ["svc_ref"] },

  // engine_event: svc_ref × constraint_op × verdict_result
  { prefix: "engine_event", dims: { constraint_op: "eq", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "exists", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "gt", verdict_result: "warn" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "contains", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "neq", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "lt", verdict_result: "skipped" }, refDims: ["svc_ref"] },
  { prefix: "engine_event", dims: { constraint_op: "masked", verdict_result: "pass" }, refDims: ["svc_ref"] },

  // schema_event: svc_ref × migration_pattern × deploy_action
  { prefix: "schema_event", dims: { migration_pattern: "identity", deploy_action: "deploy" }, refDims: ["svc_ref"] },
  { prefix: "schema_event", dims: { migration_pattern: "reorder", deploy_action: "migrate" }, refDims: ["svc_ref"] },
  { prefix: "schema_event", dims: { migration_pattern: "append_dim", deploy_action: "deploy" }, refDims: ["svc_ref"] },
  { prefix: "schema_event", dims: { migration_pattern: "remove_dim", deploy_action: "migrate" }, refDims: ["svc_ref"] },
  { prefix: "schema_event", dims: { migration_pattern: "composite", deploy_action: "deploy" }, refDims: ["svc_ref"] },

  // schema_validation: svc_ref × validation_layer × constraint_rule × verdict_result
  { prefix: "schema_validation", dims: { validation_layer: "vocabulary", constraint_rule: "required", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "schema_validation", dims: { validation_layer: "structural", constraint_rule: "maxCount", verdict_result: "pass" }, refDims: ["svc_ref"] },
  { prefix: "schema_validation", dims: { validation_layer: "constraint", constraint_rule: "exclusive", verdict_result: "warn" }, refDims: ["svc_ref"] },

  // data_policy: svc_ref × mask_mode
  { prefix: "data_policy", dims: { mask_mode: "raw" }, refDims: ["svc_ref"] },
  { prefix: "data_policy", dims: { mask_mode: "mask" }, refDims: ["svc_ref"] },
  { prefix: "data_policy", dims: { mask_mode: "drop" }, refDims: ["svc_ref"] },
  { prefix: "data_policy", dims: { mask_mode: "hash" }, refDims: ["svc_ref"] },

  // ── 패턴 도메인 ──────────────────────────────────────────────
  // pattern_match: svc_ref × identification_mode × behavior_pattern × pattern_confidence
  { prefix: "pattern_match", dims: { identification_mode: "anonymous", behavior_pattern: "browse_only", pattern_confidence: "medium" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "identified", behavior_pattern: "purchase_complete", pattern_confidence: "high" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "pseudonymized", behavior_pattern: "cart_abandon", pattern_confidence: "low" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "service", behavior_pattern: "api_integration", pattern_confidence: "exact" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "anonymous", behavior_pattern: "anonymous_browse", pattern_confidence: "high" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "service", behavior_pattern: "health_check", pattern_confidence: "exact" }, refDims: ["svc_ref"] },
  { prefix: "pattern_match", dims: { identification_mode: "service", behavior_pattern: "bot_crawl", pattern_confidence: "unknown" }, refDims: ["svc_ref"] },

  // pattern_anomaly: svc_ref × anomaly_kind × behavior_pattern × anomaly_severity
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "ratio_shift", behavior_pattern: "browse_only", anomaly_severity: "warning" }, refDims: ["svc_ref"] },
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "volume_spike", behavior_pattern: "api_integration", anomaly_severity: "info" }, refDims: ["svc_ref"] },
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "new_sequence", behavior_pattern: "unclassified", anomaly_severity: "info" }, refDims: ["svc_ref"] },
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "abnormal_speed", behavior_pattern: "checkout_fail", anomaly_severity: "warning" }, refDims: ["svc_ref"] },
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "unclassified", behavior_pattern: "error_recovery", anomaly_severity: "info" }, refDims: ["svc_ref"] },
  { prefix: "pattern_anomaly", dims: { anomaly_kind: "abnormal_duration", behavior_pattern: "return_visit", anomaly_severity: "info" }, refDims: ["svc_ref"] },

  // ── 내부 로직 도메인 ──────────────────────────────────────────
  // version_point: svc_ref × version_lifecycle
  { prefix: "version_point", dims: { version_lifecycle: "draft" }, refDims: ["svc_ref"] },
  { prefix: "version_point", dims: { version_lifecycle: "locked" }, refDims: ["svc_ref"] },
  { prefix: "version_point", dims: { version_lifecycle: "released" }, refDims: ["svc_ref"] },
  { prefix: "version_point", dims: { version_lifecycle: "active" }, refDims: ["svc_ref"] },
  { prefix: "version_point", dims: { version_lifecycle: "deprecated" }, refDims: ["svc_ref"] },

  // gate_point: svc_ref × address_state
  { prefix: "gate_point", dims: { address_state: "active" }, refDims: ["svc_ref"] },
  { prefix: "gate_point", dims: { address_state: "reserved" }, refDims: ["svc_ref"] },
  { prefix: "gate_point", dims: { address_state: "inactive" }, refDims: ["svc_ref"] },
  { prefix: "gate_point", dims: { address_state: "open" }, refDims: ["svc_ref"] },

  // execution_context: svc_ref × execution_mode
  { prefix: "execution_context", dims: { execution_mode: "live" }, refDims: ["svc_ref"] },
  { prefix: "execution_context", dims: { execution_mode: "test" }, refDims: ["svc_ref"] },
  { prefix: "execution_context", dims: { execution_mode: "synthetic" }, refDims: ["svc_ref"] },
  { prefix: "execution_context", dims: { execution_mode: "replay" }, refDims: ["svc_ref"] },

  // ingest_record: svc_ref × record_type
  { prefix: "ingest_record", dims: { record_type: "log" }, refDims: ["svc_ref"] },
  { prefix: "ingest_record", dims: { record_type: "span" }, refDims: ["svc_ref"] },
  { prefix: "ingest_record", dims: { record_type: "metric" }, refDims: ["svc_ref"] },

  // ── table_ref prefix (axis 차원만 인코딩) ──────────────────────
  // cart_event: actor(table_ref) × action(cart_action) × target(table_ref) — action만 인코딩
  { prefix: "cart_event", dims: { action: "add" } },
  { prefix: "cart_event", dims: { action: "remove" } },
  { prefix: "cart_event", dims: { action: "checkout" } },

  // auth_event: actor(table_ref) × action(auth_action) — action만 인코딩
  { prefix: "auth_event", dims: { action: "login" } },
  { prefix: "auth_event", dims: { action: "logout" } },
  { prefix: "auth_event", dims: { action: "token_refresh" } },

  // order_event: service_ctx(prefix_ref) × actor(table_ref) × action(order_action) × order(table_ref)
  { prefix: "order_event", dims: { action: "create" }, refDims: ["service_ctx"] },
  { prefix: "order_event", dims: { action: "cancel" }, refDims: ["service_ctx"] },
  { prefix: "order_event", dims: { action: "refund" }, refDims: ["service_ctx"] },
  { prefix: "order_event", dims: { action: "complete" }, refDims: ["service_ctx"] },
];

// ═══════════════════════════════════════════════════════════════
//  SELF_CHECK_PKGS — 패키지 빌드/테스트 가능 여부 (CLI과 동일)
// ═══════════════════════════════════════════════════════════════

export const SELF_CHECK_PKG_NAMES = [
  "spec-core", "cli", "sdk", "demo-snapshot", "weighted-index",
  "bit-index", "permission-engine", "index-meta", "platform-demo",
  "ingest-server", "registry-service", "e2e",
  "core", "engine", "store",
  "gate-service", "query-service", "decode-service",
  "registry-server", "registry-client",
  "apm", "browser-sdk", "event-catalog", "pino",
  "viz-3d", "viz-web", "demo-tests", "weighted-wasm",
] as const;

// ═══════════════════════════════════════════════════════════════
//  분석 (Layer 2 — 순수 함수)
// ═══════════════════════════════════════════════════════════════

/**
 * self-check 결과를 분석한다. execSync 없음. Store 없음.
 *
 * @param results - 빌드/테스트 결과 (CI에서 수집하거나 mock)
 * @param catalog - DEMO_CATALOG
 * @param runId - 실행 식별자
 */
export function analyzeSelfCheck(
  results: readonly SelfCheckResult[],
  catalog: DemoCatalog,
  runId: string = `analysis-${Date.now()}`,
): SelfCheckAnalysis {
  const now = new Date().toISOString();
  const records: AddressContextRecord[] = [];

  // ── 1. 결과 → AddressContextRecord 인코딩 ──
  for (const r of results) {
    const prefixId = r.kind === "build" ? "build_event" : "test_event";
    const resultAxis = r.kind === "build" ? "build_result" : "test_result";
    const qaModule = r.module ?? "_all";
    try {
      const ver = latestPrefixVersion(catalog, prefixId);
      const address = encodePrefixByValue(catalog, prefixId, ver, {
        qa_pkg: r.pkg,
        qa_module: qaModule,
        [resultAxis]: r.result,
      });
      records.push({
        address_context: { [prefixId]: `${prefixId}:${ver}:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `${r.kind}:${r.pkg}`,
        execution_mode: "live",
        execution_id: runId,
      });
    } catch {
      // entry가 축에 없으면 건너뜀
    }
  }

  // ── 2. 합성 이벤트 시뮬레이션 ──
  let bizRecords = 0;
  for (const se of SYNTHETIC_EVENTS) {
    try {
      const ver = latestPrefixVersion(catalog, se.prefix);
      const prefixDef = (catalog as any).prefixes?.[se.prefix];
      const verDef = prefixDef?.versions?.find((v: any) => v.version === ver);

      // prefix_ref 차원의 refEntries 첫 번째 값을 자동 주입
      const dims: Record<string, string | number> = { ...se.dims };
      if (se.refDims) {
        for (const refDim of se.refDims) {
          const refVal = verDef?.refEntries?.[refDim]?.values?.[0];
          if (refVal !== undefined) dims[refDim] = refVal;
        }
      }

      const address = encodePrefixByValue(catalog, se.prefix, ver, dims);
      records.push({
        address_context: { [se.prefix]: `${se.prefix}:${ver}:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `synthetic:${se.prefix}`,
        execution_mode: "synthetic",
        execution_id: runId,
      });
      bizRecords++;
    } catch { /* 인코딩 실패 시 건너뜀 */ }
  }

  // ── 3. 집계 ──
  const usage = aggregateUsageData(catalog, records);

  // ── 4. convergence 분석 ──
  const health = analyzeCollectionHealth(catalog, records);
  const coverage = analyzeEntryCoverage(catalog, usage.entryUsages, usage.addressUsages);

  // ── 5. invariant 검증 ──
  const invariantViolations: InvariantViolation[] = [];

  // "빌드 실패 후 테스트 금지" (skipped 제외)
  for (const r of results) {
    if (r.kind !== "build" || r.result === "success" || r.result === "skipped") continue;
    const testRan = results.find(t => t.kind === "test" && t.pkg === r.pkg);
    if (testRan) {
      invariantViolations.push({ pkg: r.pkg, message: `빌드 ${r.result}인데 테스트 실행됨 (${testRan.result})` });
    }
  }

  // "테스트 실패 시 빌드 성공 선행" (hasBuild=false 제외)
  for (const r of results) {
    if (r.kind !== "test" || r.result === "passed") continue;
    const buildResult = results.find(b => b.kind === "build" && b.pkg === r.pkg);
    // hasBuild=false인 패키지는 빌드 결과가 없으므로 건너뜀
    if (!buildResult) continue;
    if (buildResult.result !== "success" && buildResult.result !== "skipped") {
      invariantViolations.push({ pkg: r.pkg, message: `테스트 ${r.result}인데 빌드 성공이 선행되지 않음` });
    }
  }

  // ── 6. 요약 ──
  const buildSummary = { success: 0, failure: 0, skipped: 0, total: 0 };
  const testSummary = { passed: 0, failed: 0, tests: 0, total: 0 };
  for (const r of results) {
    if (r.kind === "build") {
      buildSummary.total++;
      if (r.result === "success") buildSummary.success++;
      else if (r.result === "skipped") buildSummary.skipped++;
      else buildSummary.failure++;
    } else {
      testSummary.total++;
      testSummary.tests += r.tests ?? 0;
      testSummary.passed += r.passed ?? 0;
      testSummary.failed += r.failed ?? 0;
    }
  }

  return {
    records,
    usage,
    health,
    coverage,
    invariantViolations,
    buildSummary,
    testSummary,
    bizRecords,
  };
}
