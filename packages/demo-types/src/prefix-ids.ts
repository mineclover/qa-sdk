// Generated from Catalog "demo" (hash: 9bf649aab9a4) at 2026-06-03T23:14:15
// !! 자동 생성 파일 — 직접 수정 금지 !!

/** Catalog prefix 이름 리터럴 유니온 (68개) */
export type PrefixId =
  | 'auth_event'
  | 'build_event'
  | 'bundle_observation'
  | 'cart_event'
  | 'cli_event'
  | 'cli_tracking'
  | 'content'
  | 'contract_check'
  | 'convergence_event'
  | 'data_policy'
  | 'decision_event'
  | 'decision_path'
  | 'deploy_event'
  | 'dkg_decision_event'
  | 'dkg_event'
  | 'dkg_observation_event'
  | 'edge_activity'
  | 'endpoint'
  | 'engine_event'
  | 'escalation_event'
  | 'event'
  | 'event_classification'
  | 'execution_context'
  | 'flow_point'
  | 'forcing_response'
  | 'gate_execution'
  | 'gate_point'
  | 'graph_event'
  | 'harness_guard'
  | 'harness_process_step'
  | 'harness_transition'
  | 'health_event'
  | 'ingest_record'
  | 'ir_data'
  | 'ir_intent_path'
  | 'ir_module'
  | 'ir_pipe'
  | 'metric_aggregate'
  | 'metric_point'
  | 'model_apply'
  | 'observation_event'
  | 'order_event'
  | 'page_view'
  | 'pattern_anomaly'
  | 'pattern_match'
  | 'permission'
  | 'pipeline_point'
  | 'quality_event'
  | 'rbac'
  | 'relational'
  | 'resource_lifecycle'
  | 'rpc_event'
  | 'schema_event'
  | 'schema_validation'
  | 'sdk_lifecycle'
  | 'service'
  | 'skill_execution'
  | 'spec_event'
  | 'tag_lifecycle'
  | 'task_event'
  | 'test_coverage'
  | 'test_event'
  | 'test_scenario'
  | 'tracking'
  | 'transition_event'
  | 'validation_event'
  | 'version_point'
  | 'version_state';

export const PREFIX_IDS = [
  'auth_event',
  'build_event',
  'bundle_observation',
  'cart_event',
  'cli_event',
  'cli_tracking',
  'content',
  'contract_check',
  'convergence_event',
  'data_policy',
  'decision_event',
  'decision_path',
  'deploy_event',
  'dkg_decision_event',
  'dkg_event',
  'dkg_observation_event',
  'edge_activity',
  'endpoint',
  'engine_event',
  'escalation_event',
  'event',
  'event_classification',
  'execution_context',
  'flow_point',
  'forcing_response',
  'gate_execution',
  'gate_point',
  'graph_event',
  'harness_guard',
  'harness_process_step',
  'harness_transition',
  'health_event',
  'ingest_record',
  'ir_data',
  'ir_intent_path',
  'ir_module',
  'ir_pipe',
  'metric_aggregate',
  'metric_point',
  'model_apply',
  'observation_event',
  'order_event',
  'page_view',
  'pattern_anomaly',
  'pattern_match',
  'permission',
  'pipeline_point',
  'quality_event',
  'rbac',
  'relational',
  'resource_lifecycle',
  'rpc_event',
  'schema_event',
  'schema_validation',
  'sdk_lifecycle',
  'service',
  'skill_execution',
  'spec_event',
  'tag_lifecycle',
  'task_event',
  'test_coverage',
  'test_event',
  'test_scenario',
  'tracking',
  'transition_event',
  'validation_event',
  'version_point',
  'version_state',
] as const;

/** Catalog axis 이름 리터럴 유니온 (119개) */
export type AxisId =
  | 'action'
  | 'address_state'
  | 'anomaly_kind'
  | 'anomaly_severity'
  | 'api_surface'
  | 'api_version'
  | 'auth_action'
  | 'behavior_pattern'
  | 'build_result'
  | 'bundle_state'
  | 'cart_action'
  | 'category'
  | 'channel'
  | 'cli_domain'
  | 'cli_intent'
  | 'cli_subject'
  | 'cognitive_phase'
  | 'confidence_band'
  | 'constraint_op'
  | 'constraint_rule'
  | 'convergence_phase'
  | 'convergence_result'
  | 'decision_outcome'
  | 'decision_type'
  | 'def_layer'
  | 'def_level'
  | 'deploy_action'
  | 'dkg_op'
  | 'dkg_target_kind'
  | 'edge_type'
  | 'effect_kind'
  | 'env'
  | 'escalation_type'
  | 'event_category'
  | 'event_lifecycle_stage'
  | 'event_name'
  | 'evidence_kind'
  | 'execution_mode'
  | 'flow_name'
  | 'flow_step'
  | 'flow_type'
  | 'flow_variant'
  | 'forcing_question'
  | 'gate_kind'
  | 'gate_scope'
  | 'gate_state'
  | 'graph_action'
  | 'harness_machine'
  | 'harness_process'
  | 'harness_state'
  | 'harness_trigger'
  | 'harness_verdict'
  | 'health_status'
  | 'http_method'
  | 'identification_mode'
  | 'initiator'
  | 'ir_call_kind'
  | 'ir_certainty'
  | 'ir_pipe_state'
  | 'ir_retention'
  | 'ir_storage_type'
  | 'ir_transaction_scope'
  | 'lifecycle_state'
  | 'link_type'
  | 'locale'
  | 'magnitude'
  | 'mask_mode'
  | 'match_mode'
  | 'mental_model'
  | 'metric_type'
  | 'migration_pattern'
  | 'namespace'
  | 'node_source'
  | 'objectKind'
  | 'obs_source'
  | 'observation_intent'
  | 'order_action'
  | 'page'
  | 'pattern_confidence'
  | 'pipeline_phase'
  | 'predicate'
  | 'qa_module'
  | 'qa_pkg'
  | 'quality_kind'
  | 'quality_severity'
  | 'rbac_role'
  | 'record_type'
  | 'region'
  | 'resource'
  | 'resource_location'
  | 'resource_type'
  | 'reversibility'
  | 'role'
  | 'rpc_phase'
  | 'rpc_protocol'
  | 'scope_mode'
  | 'sdk_action'
  | 'sdk_channel'
  | 'skill_category'
  | 'skill_id'
  | 'skill_outcome'
  | 'spec_type'
  | 'status'
  | 'subjectKind'
  | 'svc_name'
  | 'tag'
  | 'task_phase'
  | 'task_type'
  | 'temporal_strategy'
  | 'test_kind'
  | 'test_phase'
  | 'test_result'
  | 'test_scope'
  | 'trackAction'
  | 'userType'
  | 'validation_layer'
  | 'validation_mode'
  | 'verdict_result'
  | 'version_lifecycle';

export const AXIS_IDS = [
  'action',
  'address_state',
  'anomaly_kind',
  'anomaly_severity',
  'api_surface',
  'api_version',
  'auth_action',
  'behavior_pattern',
  'build_result',
  'bundle_state',
  'cart_action',
  'category',
  'channel',
  'cli_domain',
  'cli_intent',
  'cli_subject',
  'cognitive_phase',
  'confidence_band',
  'constraint_op',
  'constraint_rule',
  'convergence_phase',
  'convergence_result',
  'decision_outcome',
  'decision_type',
  'def_layer',
  'def_level',
  'deploy_action',
  'dkg_op',
  'dkg_target_kind',
  'edge_type',
  'effect_kind',
  'env',
  'escalation_type',
  'event_category',
  'event_lifecycle_stage',
  'event_name',
  'evidence_kind',
  'execution_mode',
  'flow_name',
  'flow_step',
  'flow_type',
  'flow_variant',
  'forcing_question',
  'gate_kind',
  'gate_scope',
  'gate_state',
  'graph_action',
  'harness_machine',
  'harness_process',
  'harness_state',
  'harness_trigger',
  'harness_verdict',
  'health_status',
  'http_method',
  'identification_mode',
  'initiator',
  'ir_call_kind',
  'ir_certainty',
  'ir_pipe_state',
  'ir_retention',
  'ir_storage_type',
  'ir_transaction_scope',
  'lifecycle_state',
  'link_type',
  'locale',
  'magnitude',
  'mask_mode',
  'match_mode',
  'mental_model',
  'metric_type',
  'migration_pattern',
  'namespace',
  'node_source',
  'objectKind',
  'obs_source',
  'observation_intent',
  'order_action',
  'page',
  'pattern_confidence',
  'pipeline_phase',
  'predicate',
  'qa_module',
  'qa_pkg',
  'quality_kind',
  'quality_severity',
  'rbac_role',
  'record_type',
  'region',
  'resource',
  'resource_location',
  'resource_type',
  'reversibility',
  'role',
  'rpc_phase',
  'rpc_protocol',
  'scope_mode',
  'sdk_action',
  'sdk_channel',
  'skill_category',
  'skill_id',
  'skill_outcome',
  'spec_type',
  'status',
  'subjectKind',
  'svc_name',
  'tag',
  'task_phase',
  'task_type',
  'temporal_strategy',
  'test_kind',
  'test_phase',
  'test_result',
  'test_scope',
  'trackAction',
  'userType',
  'validation_layer',
  'validation_mode',
  'verdict_result',
  'version_lifecycle',
] as const;

/** Catalog table 이름 리터럴 유니온 (19개) */
export type TableId =
  | 'cart_items'
  | 'carts'
  | 'dkg_edges'
  | 'dkg_nodes'
  | 'entry'
  | 'event_records'
  | 'items'
  | 'members'
  | 'orders'
  | 'orgs'
  | 'policy_rule'
  | 'qa_sessions'
  | 'tbl_version_lifecycle'
  | 'traces'
  | 'transition_state'
  | 'transmissions'
  | 'usage_snapshots'
  | 'verdict_reports'
  | 'version_usages';

export const TABLE_IDS = [
  'cart_items',
  'carts',
  'dkg_edges',
  'dkg_nodes',
  'entry',
  'event_records',
  'items',
  'members',
  'orders',
  'orgs',
  'policy_rule',
  'qa_sessions',
  'tbl_version_lifecycle',
  'traces',
  'transition_state',
  'transmissions',
  'usage_snapshots',
  'verdict_reports',
  'version_usages',
] as const;

/** 빌드 시점 version 메타데이터 */
export const VERSION_META = {
  /** Catalog ID */
  catalogId: 'demo' as const,
  /** Catalog 구조 content hash (SHA-256 prefix 12자) */
  contentHash: '9bf649aab9a4' as const,
  /** 생성 시각 (ISO 8601) */
  generatedAt: '2026-06-03T23:14:15.219Z' as const,
  /** prefix별 version (생성 시점 기준) */
  prefixVersions: {
    auth_event: 'v2',
    build_event: 'v2',
    bundle_observation: 'v1',
    cart_event: 'v2',
    cli_event: 'v1',
    cli_tracking: 'v1',
    content: 'v1',
    contract_check: 'v1',
    convergence_event: 'v1',
    data_policy: 'v1',
    decision_event: 'v1',
    decision_path: 'v1',
    deploy_event: 'v1',
    dkg_decision_event: 'v1',
    dkg_event: 'v1',
    dkg_observation_event: 'v1',
    edge_activity: 'v1',
    endpoint: 'v1',
    engine_event: 'v1',
    escalation_event: 'v1',
    event: 'v4',
    event_classification: 'v1',
    execution_context: 'v1',
    flow_point: 'v2',
    forcing_response: 'v1',
    gate_execution: 'v1',
    gate_point: 'v1',
    graph_event: 'v1',
    harness_guard: 'v1',
    harness_process_step: 'v1',
    harness_transition: 'v1',
    health_event: 'v1',
    ingest_record: 'v1',
    ir_data: 'v1',
    ir_intent_path: 'v1',
    ir_module: 'v1',
    ir_pipe: 'v1',
    metric_aggregate: 'v1',
    metric_point: 'v1',
    model_apply: 'v1',
    observation_event: 'v1',
    order_event: 'v1',
    page_view: 'v2',
    pattern_anomaly: 'v2',
    pattern_match: 'v1',
    permission: 'v4',
    pipeline_point: 'v1',
    quality_event: 'v1',
    rbac: 'v1',
    relational: 'v2',
    resource_lifecycle: 'v1',
    rpc_event: 'v1',
    schema_event: 'v1',
    schema_validation: 'v1',
    sdk_lifecycle: 'v1',
    service: 'v1',
    skill_execution: 'v1',
    spec_event: 'v1',
    tag_lifecycle: 'v1',
    task_event: 'v1',
    test_coverage: 'v1',
    test_event: 'v2',
    test_scenario: 'v1',
    tracking: 'v3',
    transition_event: 'v1',
    validation_event: 'v1',
    version_point: 'v1',
    version_state: 'v1',
  } as const,
} as const;

/** GENERATION — 빌드 시점 version 식별자. SDK 부트 시 전달. */
export const GENERATION = 'demo:9bf649aab9a4' as const;
