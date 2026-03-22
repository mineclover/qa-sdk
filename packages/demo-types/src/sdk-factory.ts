// Generated from Catalog "demo" (hash: 6554b4a976b6) at 2026-03-22T18:39:49
// !! 자동 생성 파일 — 직접 수정 금지 !!

import { createIndexSDK } from "@qa-sdk/codec";

const SCHEMA = {
  axes: {
    action: {
      entries: ["read", "write", "delete", "admin"],
      capacity: 32,
    },
    address_state: {
      entries: ["active", "reserved", "inactive", "open"],
      capacity: 8,
    },
    anomaly_kind: {
      entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"],
      capacity: 16,
    },
    anomaly_severity: {
      entries: ["info", "warning", "critical"],
      capacity: 8,
    },
    api_surface: {
      entries: ["encode-decode", "stride-calc", "bitmask-ops", "dim-extract", "perm-grant", "protocol-codec", "state-lifecycle", "query-resolve", "schema-validate", "convergence-analysis", "dkg-graph", "integration"],
      capacity: 32,
    },
    api_version: {
      entries: ["v1", "v2"],
      capacity: 32,
    },
    auth_action: {
      entries: ["login", "logout", "token_refresh"],
      capacity: 32,
    },
    behavior_pattern: {
      entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"],
      capacity: 32,
    },
    build_result: {
      entries: ["success", "failure", "type-error", "skipped"],
      capacity: 8,
    },
    cart_action: {
      entries: ["add", "remove", "checkout"],
      capacity: 32,
    },
    category: {
      entries: ["tech", "design", "product", "culture"],
      capacity: 32,
    },
    channel: {
      entries: ["web", "mobile"],
      capacity: 32,
    },
    cli_domain: {
      entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system"],
      capacity: 16,
    },
    cli_intent: {
      entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"],
      capacity: 16,
    },
    cli_subject: {
      entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog"],
      capacity: 32,
    },
    constraint_op: {
      entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"],
      capacity: 32,
    },
    constraint_rule: {
      entries: ["required", "maxCount", "minCount", "requiredIf", "exclusive", "type", "multi", "unknownAxis"],
      capacity: 32,
    },
    decision_type: {
      entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"],
      capacity: 16,
    },
    deploy_action: {
      entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote", "migrate"],
      capacity: 32,
    },
    dkg_op: {
      entries: ["claim", "release", "decide", "observe", "resolve", "link", "refresh", "self-check", "converge", "trace", "promote"],
      capacity: 32,
    },
    dkg_target_kind: {
      entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"],
      capacity: 16,
    },
    edge_type: {
      entries: ["satisfies", "implements", "tests", "traces-to", "depends-on", "composes", "references", "governs", "justifies", "constrains", "contains", "bridges", "consumes", "binds", "observes", "prompts", "evolves-from", "supersedes"],
      capacity: 32,
    },
    env: {
      entries: ["dev", "stage", "prod", "test", "local"],
      capacity: 32,
    },
    event_category: {
      entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"],
      capacity: 16,
    },
    event_lifecycle_stage: {
      entries: ["interaction", "request", "processing", "result", "side_effect", "completion"],
      capacity: 16,
    },
    event_name: {
      entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"],
      capacity: 64,
    },
    execution_mode: {
      entries: ["live", "test", "synthetic", "replay"],
      capacity: 8,
    },
    flow_name: {
      entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"],
      capacity: 64,
    },
    flow_step: {
      entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"],
      capacity: 32,
    },
    flow_variant: {
      entries: ["default", "retry", "fallback", "manual"],
      capacity: 32,
    },
    health_status: {
      entries: ["healthy", "degraded", "unhealthy", "maintenance"],
      capacity: 32,
    },
    http_method: {
      entries: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      capacity: 32,
    },
    identification_mode: {
      entries: ["anonymous", "identified", "pseudonymized", "service"],
      capacity: 8,
    },
    initiator: {
      entries: ["web", "mobile"],
      capacity: 32,
    },
    lifecycle_state: {
      entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"],
      capacity: 16,
    },
    locale: {
      entries: ["ko", "en", "ja"],
      capacity: 32,
    },
    mask_mode: {
      entries: ["raw", "mask", "drop", "hash"],
      capacity: 32,
    },
    metric_type: {
      entries: ["counter", "gauge", "histogram", "summary"],
      capacity: 8,
    },
    migration_pattern: {
      entries: ["identity", "reorder", "append_dim", "remove_dim", "composite", "unknown"],
      capacity: 32,
    },
    namespace: {
      entries: ["shop", "cms"],
      capacity: 32,
    },
    node_source: {
      entries: ["bootstrap", "manual", "auto"],
      capacity: 8,
    },
    objectKind: {
      entries: ["_", "role", "permission", "group", "resource", "queue", "metric_store", "constraint", "prefix_version"],
      capacity: 32,
    },
    obs_source: {
      entries: ["manual", "metric", "runtime", "review"],
      capacity: 8,
    },
    observation_intent: {
      entries: ["action_needed", "monitoring", "completed"],
      capacity: 8,
    },
    order_action: {
      entries: ["create", "cancel", "refund", "complete"],
      capacity: 32,
    },
    page: {
      entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"],
      capacity: 32,
    },
    pattern_confidence: {
      entries: ["exact", "high", "medium", "low", "unknown"],
      capacity: 16,
    },
    pipeline_phase: {
      entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"],
      capacity: 32,
    },
    predicate: {
      entries: ["_", "has", "can_access", "belongs_to", "has_capability", "evaluated", "migrated_to"],
      capacity: 32,
    },
    qa_module: {
      entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"],
      capacity: 64,
    },
    qa_pkg: {
      entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"],
      capacity: 64,
    },
    rbac_role: {
      entries: ["admin", "editor", "viewer"],
      capacity: 32,
    },
    record_type: {
      entries: ["log", "span", "metric"],
      capacity: 8,
    },
    region: {
      entries: ["asia", "usa"],
      capacity: 32,
    },
    resource: {
      entries: ["dashboard", "reports", "settings", "users"],
      capacity: 32,
    },
    resource_type: {
      entries: ["api", "page", "webhook", "grpc"],
      capacity: 32,
    },
    role: {
      entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"],
      capacity: 32,
    },
    skill_category: {
      entries: ["read", "write", "analysis", "chain"],
      capacity: 8,
    },
    skill_id: {
      entries: ["skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview", "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition", "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify", "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add", "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health", "skill-pattern-analysis", "skill-schema-health-audit", "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain", "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan", "skill-spec-manage", "skill-registry-publish", "skill-flow-trace", "skill-table-impact"],
      capacity: 64,
    },
    skill_outcome: {
      entries: ["ok", "warning", "error", "blocked", "skipped"],
      capacity: 16,
    },
    spec_type: {
      entries: ["req", "feat", "uc", "evt", "ls", "adr"],
      capacity: 16,
    },
    status: {
      entries: ["draft", "published", "archived"],
      capacity: 32,
    },
    subjectKind: {
      entries: ["_", "user", "role", "group", "service", "engine"],
      capacity: 32,
    },
    svc_name: {
      entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway", "registry", "ingest-server", "monitor", "content-service", "infra-controller"],
      capacity: 32,
    },
    tag: {
      entries: ["frontend", "backend", "devops", "ai", "database"],
      capacity: 32,
    },
    temporal_strategy: {
      entries: ["span_local", "global"],
      capacity: 32,
    },
    test_result: {
      entries: ["passed", "failed", "error", "skipped", "timeout"],
      capacity: 16,
    },
    trackAction: {
      entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"],
      capacity: 32,
    },
    userType: {
      entries: ["guest", "member", "premium"],
      capacity: 32,
    },
    validation_layer: {
      entries: ["vocabulary", "structural", "constraint"],
      capacity: 8,
    },
    validation_mode: {
      entries: ["strict", "warn", "off"],
      capacity: 32,
    },
    verdict_result: {
      entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"],
      capacity: 32,
    },
    version_lifecycle: {
      entries: ["draft", "locked", "released", "active", "deprecated"],
      capacity: 16,
    },
  },
  prefixes: {
    auth_event: { dims: ["action"] },
    build_event: { dims: ["qa_pkg", "qa_module", "build_result"] },
    cart_event: { dims: ["action"] },
    cli_event: { dims: ["cli_intent", "cli_domain", "cli_subject"] },
    content: { dims: ["tag", "category", "status", "locale", "channel"] },
    contract_check: { dims: ["qa_pkg", "api_surface", "test_result"] },
    data_policy: { dims: ["mask_mode"] },
    deploy_event: { dims: ["deploy_action"] },
    dkg_decision_event: { dims: ["decision_type", "dkg_target_kind", "node_source"] },
    dkg_event: { dims: ["dkg_op", "dkg_target_kind"] },
    dkg_observation_event: { dims: ["obs_source", "dkg_target_kind", "lifecycle_state"] },
    edge_activity: { dims: ["edge_type", "dkg_target_kind"] },
    endpoint: { dims: ["resource_type", "http_method", "api_version"] },
    engine_event: { dims: ["constraint_op", "verdict_result"] },
    event: { dims: ["event_name", "initiator"] },
    event_classification: { dims: ["event_category", "event_lifecycle_stage"] },
    execution_context: { dims: ["execution_mode"] },
    flow_point: { dims: ["flow_name", "flow_step", "flow_variant"] },
    gate_point: { dims: ["address_state"] },
    health_event: { dims: ["health_status"] },
    ingest_record: { dims: ["record_type"] },
    metric_point: { dims: ["metric_type", "record_type"] },
    observation_event: { dims: ["observation_intent", "dkg_target_kind"] },
    order_event: { dims: ["action"] },
    page_view: { dims: ["page", "locale", "userType"] },
    pattern_anomaly: { dims: ["anomaly_kind", "behavior_pattern", "anomaly_severity"] },
    pattern_match: { dims: ["identification_mode", "behavior_pattern", "pattern_confidence"] },
    permission: { dims: ["role"] },
    pipeline_point: { dims: ["pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"] },
    rbac: { dims: ["role", "action", "resource"] },
    relational: { dims: ["subjectKind", "predicate", "objectKind"] },
    schema_event: { dims: ["migration_pattern", "deploy_action"] },
    schema_validation: { dims: ["validation_layer", "constraint_rule", "verdict_result"] },
    service: { dims: ["env", "region", "svc_name", "namespace"] },
    skill_execution: { dims: ["skill_id", "skill_category", "skill_outcome"] },
    spec_event: { dims: ["spec_type", "lifecycle_state"] },
    test_event: { dims: ["qa_pkg", "qa_module", "test_result"] },
    tracking: { dims: ["trackAction", "page", "userType"] },
    version_point: { dims: ["version_lifecycle"] },
  },
} as const;

/** Catalog "demo" 기반 타입 안전 SDK */
export const sdk = createIndexSDK(SCHEMA);

/** prefix별 snapshot supply 전략 */
export const SNAPSHOT_SUPPLY = {
  "auth_event": "implicit" as const,
  "build_event": "implicit" as const,
  "cart_event": "implicit" as const,
  "cli_event": "implicit" as const,
  "content": "implicit" as const,
  "contract_check": "implicit" as const,
  "data_policy": "envelope" as const,
  "deploy_event": "envelope" as const,
  "dkg_decision_event": "implicit" as const,
  "dkg_event": "implicit" as const,
  "dkg_observation_event": "implicit" as const,
  "edge_activity": "implicit" as const,
  "endpoint": "envelope" as const,
  "engine_event": "envelope" as const,
  "event": "envelope" as const,
  "event_classification": "envelope" as const,
  "execution_context": "envelope" as const,
  "flow_point": "envelope" as const,
  "gate_point": "envelope" as const,
  "health_event": "envelope" as const,
  "ingest_record": "envelope" as const,
  "metric_point": "envelope" as const,
  "observation_event": "implicit" as const,
  "order_event": "envelope" as const,
  "page_view": "envelope" as const,
  "pattern_anomaly": "envelope" as const,
  "pattern_match": "envelope" as const,
  "permission": "envelope" as const,
  "pipeline_point": "envelope" as const,
  "rbac": "implicit" as const,
  "relational": "implicit" as const,
  "schema_event": "envelope" as const,
  "schema_validation": "envelope" as const,
  "service": "implicit" as const,
  "skill_execution": "implicit" as const,
  "spec_event": "implicit" as const,
  "test_event": "implicit" as const,
  "tracking": "implicit" as const,
  "version_point": "envelope" as const,
} as const;
