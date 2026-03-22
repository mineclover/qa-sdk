// Generated from Catalog "demo" (hash: 7e22b98a3ddc) at 2026-03-22T20:14:38
// !! 자동 생성 파일 — 직접 수정 금지 !!

/** Catalog prefix 이름 리터럴 유니온 (39개) */
export type PrefixId =
  | "auth_event"
  | "build_event"
  | "cart_event"
  | "cli_event"
  | "content"
  | "contract_check"
  | "data_policy"
  | "deploy_event"
  | "dkg_decision_event"
  | "dkg_event"
  | "dkg_observation_event"
  | "edge_activity"
  | "endpoint"
  | "engine_event"
  | "event"
  | "event_classification"
  | "execution_context"
  | "flow_point"
  | "gate_point"
  | "health_event"
  | "ingest_record"
  | "metric_point"
  | "observation_event"
  | "order_event"
  | "page_view"
  | "pattern_anomaly"
  | "pattern_match"
  | "permission"
  | "pipeline_point"
  | "rbac"
  | "relational"
  | "schema_event"
  | "schema_validation"
  | "service"
  | "skill_execution"
  | "spec_event"
  | "test_event"
  | "tracking"
  | "version_point";

export const PREFIX_IDS = ["auth_event", "build_event", "cart_event", "cli_event", "content", "contract_check", "data_policy", "deploy_event", "dkg_decision_event", "dkg_event", "dkg_observation_event", "edge_activity", "endpoint", "engine_event", "event", "event_classification", "execution_context", "flow_point", "gate_point", "health_event", "ingest_record", "metric_point", "observation_event", "order_event", "page_view", "pattern_anomaly", "pattern_match", "permission", "pipeline_point", "rbac", "relational", "schema_event", "schema_validation", "service", "skill_execution", "spec_event", "test_event", "tracking", "version_point"] as const;

/** Catalog axis 이름 리터럴 유니온 (74개) */
export type AxisId =
  | "action"
  | "address_state"
  | "anomaly_kind"
  | "anomaly_severity"
  | "api_surface"
  | "api_version"
  | "auth_action"
  | "behavior_pattern"
  | "build_result"
  | "cart_action"
  | "category"
  | "channel"
  | "cli_domain"
  | "cli_intent"
  | "cli_subject"
  | "constraint_op"
  | "constraint_rule"
  | "decision_type"
  | "deploy_action"
  | "dkg_op"
  | "dkg_target_kind"
  | "edge_type"
  | "env"
  | "event_category"
  | "event_lifecycle_stage"
  | "event_name"
  | "execution_mode"
  | "flow_name"
  | "flow_step"
  | "flow_variant"
  | "health_status"
  | "http_method"
  | "identification_mode"
  | "initiator"
  | "lifecycle_state"
  | "locale"
  | "mask_mode"
  | "metric_type"
  | "migration_pattern"
  | "namespace"
  | "node_source"
  | "objectKind"
  | "obs_source"
  | "observation_intent"
  | "order_action"
  | "page"
  | "pattern_confidence"
  | "pipeline_phase"
  | "predicate"
  | "qa_module"
  | "qa_pkg"
  | "rbac_role"
  | "record_type"
  | "region"
  | "resource"
  | "resource_location"
  | "resource_type"
  | "role"
  | "skill_category"
  | "skill_id"
  | "skill_outcome"
  | "spec_type"
  | "status"
  | "subjectKind"
  | "svc_name"
  | "tag"
  | "temporal_strategy"
  | "test_result"
  | "trackAction"
  | "userType"
  | "validation_layer"
  | "validation_mode"
  | "verdict_result"
  | "version_lifecycle";

export const AXIS_IDS = ["action", "address_state", "anomaly_kind", "anomaly_severity", "api_surface", "api_version", "auth_action", "behavior_pattern", "build_result", "cart_action", "category", "channel", "cli_domain", "cli_intent", "cli_subject", "constraint_op", "constraint_rule", "decision_type", "deploy_action", "dkg_op", "dkg_target_kind", "edge_type", "env", "event_category", "event_lifecycle_stage", "event_name", "execution_mode", "flow_name", "flow_step", "flow_variant", "health_status", "http_method", "identification_mode", "initiator", "lifecycle_state", "locale", "mask_mode", "metric_type", "migration_pattern", "namespace", "node_source", "objectKind", "obs_source", "observation_intent", "order_action", "page", "pattern_confidence", "pipeline_phase", "predicate", "qa_module", "qa_pkg", "rbac_role", "record_type", "region", "resource", "resource_location", "resource_type", "role", "skill_category", "skill_id", "skill_outcome", "spec_type", "status", "subjectKind", "svc_name", "tag", "temporal_strategy", "test_result", "trackAction", "userType", "validation_layer", "validation_mode", "verdict_result", "version_lifecycle"] as const;

/** Catalog table 이름 리터럴 유니온 (19개) */
export type TableId =
  | "cart_items"
  | "carts"
  | "dkg_edges"
  | "dkg_nodes"
  | "entry"
  | "event_records"
  | "items"
  | "members"
  | "orders"
  | "orgs"
  | "policy_rule"
  | "qa_sessions"
  | "tbl_version_lifecycle"
  | "traces"
  | "transition_state"
  | "transmissions"
  | "usage_snapshots"
  | "verdict_reports"
  | "version_usages";

export const TABLE_IDS = ["cart_items", "carts", "dkg_edges", "dkg_nodes", "entry", "event_records", "items", "members", "orders", "orgs", "policy_rule", "qa_sessions", "tbl_version_lifecycle", "traces", "transition_state", "transmissions", "usage_snapshots", "verdict_reports", "version_usages"] as const;

/** 빌드 시점 version 메타데이터 */
export const VERSION_META = {
  /** Catalog ID */
  catalogId: "demo" as const,
  /** Catalog 구조 content hash (SHA-256 prefix 12자) */
  contentHash: "7e22b98a3ddc" as const,
  /** 생성 시각 (ISO 8601) */
  generatedAt: "2026-03-22T20:14:38.355Z" as const,
  /** prefix별 version (생성 시점 기준) */
  prefixVersions: {
    "auth_event": "v2",
    "build_event": "v2",
    "cart_event": "v2",
    "cli_event": "v1",
    "content": "v1",
    "contract_check": "v1",
    "data_policy": "v1",
    "deploy_event": "v1",
    "dkg_decision_event": "v1",
    "dkg_event": "v1",
    "dkg_observation_event": "v1",
    "edge_activity": "v1",
    "endpoint": "v1",
    "engine_event": "v1",
    "event": "v4",
    "event_classification": "v1",
    "execution_context": "v1",
    "flow_point": "v2",
    "gate_point": "v1",
    "health_event": "v1",
    "ingest_record": "v1",
    "metric_point": "v1",
    "observation_event": "v1",
    "order_event": "v1",
    "page_view": "v2",
    "pattern_anomaly": "v2",
    "pattern_match": "v1",
    "permission": "v4",
    "pipeline_point": "v1",
    "rbac": "v1",
    "relational": "v2",
    "schema_event": "v1",
    "schema_validation": "v1",
    "service": "v1",
    "skill_execution": "v1",
    "spec_event": "v1",
    "test_event": "v2",
    "tracking": "v3",
    "version_point": "v1",
  } as const,
} as const;

/** GENERATION — 빌드 시점 version 식별자. SDK 부트 시 전달. */
export const GENERATION = "demo:7e22b98a3ddc" as const;
