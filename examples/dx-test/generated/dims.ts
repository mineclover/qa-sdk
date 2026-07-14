// Generated from Catalog "demo" (hash: 3ccbf6145735) at 2026-03-23T03:53:59
// !! 자동 생성 파일 — 직접 수정 금지 !!

import type * as Axes from './axes.js';

/** auth_event — 인증 이벤트 */
export interface AuthEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  /** table_ref → members */
  actor: number;
  action: Axes.AuthAction;
}

/** build_event — 빌드 이벤트 */
export interface BuildEventDims {
  qa_pkg: Axes.QaPkg;
  qa_module: Axes.QaModule;
  build_result: Axes.BuildResult;
}

/** cart_event — 장바구니 이벤트 */
export interface CartEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  /** table_ref → members */
  actor: number;
  action: Axes.CartAction;
  /** table_ref → items */
  target: number;
}

/** cli_event — CLI 활동 이벤트 */
export interface CliEventDims {
  cli_intent: Axes.CliIntent;
  cli_domain: Axes.CliDomain;
  cli_subject: Axes.CliSubject;
}

/** cli_tracking — CLI 실행 결과 추적 */
export interface CliTrackingDims {
  cli_intent: Axes.CliIntent;
  cli_domain: Axes.CliDomain;
  cli_subject: Axes.CliSubject;
  skill_outcome: Axes.SkillOutcome;
}

/** content — 콘텐츠 플랫폼 */
export interface ContentDims {
  tag: Axes.Tag;
  category: Axes.Category;
  status: Axes.Status;
  locale: Axes.Locale;
  channel: Axes.Channel;
}

/** contract_check — 인터페이스 계약 검증 */
export interface ContractCheckDims {
  qa_pkg: Axes.QaPkg;
  api_surface: Axes.ApiSurface;
  test_result: Axes.TestResult;
}

/** data_policy — 데이터 정책 관측 */
export interface DataPolicyDims {
  /** prefix_ref → service */
  svc_ref: number;
  mask_mode: Axes.MaskMode;
}

/** deploy_event — 배포 이벤트 */
export interface DeployEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  deploy_action: Axes.DeployAction;
  /** table_ref → members */
  actor: number;
}

/** dkg_decision_event — 의사결정 이벤트 */
export interface DkgDecisionEventDims {
  decision_type: Axes.DecisionType;
  dkg_target_kind: Axes.DkgTargetKind;
  node_source: Axes.NodeSource;
}

/** dkg_event — DKG 운영 이벤트 */
export interface DkgEventDims {
  dkg_op: Axes.DkgOp;
  dkg_target_kind: Axes.DkgTargetKind;
}

/** dkg_observation_event — 관측 이벤트 */
export interface DkgObservationEventDims {
  obs_source: Axes.ObsSource;
  dkg_target_kind: Axes.DkgTargetKind;
  lifecycle_state: Axes.LifecycleState;
}

/** edge_activity — 관계 활동 이벤트 */
export interface EdgeActivityDims {
  edge_type: Axes.EdgeType;
  dkg_target_kind: Axes.DkgTargetKind;
}

/** endpoint — 엔드포인트 관측 */
export interface EndpointDims {
  /** prefix_ref → service */
  svc_ref: number;
  resource_type: Axes.ResourceType;
  http_method: Axes.HttpMethod;
  api_version: Axes.ApiVersion;
}

/** engine_event — 엔진 평가 이벤트 */
export interface EngineEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  constraint_op: Axes.ConstraintOp;
  verdict_result: Axes.VerdictResult;
}

/** event — 이벤트 */
export interface EventDims {
  /** prefix_ref → service */
  evt_svc: number;
  event_name: Axes.EventName;
  initiator: Axes.Initiator;
}

/** event_classification — 이벤트 분류 */
export interface EventClassificationDims {
  /** prefix_ref → service */
  svc_ref: number;
  event_category: Axes.EventCategory;
  event_lifecycle_stage: Axes.EventLifecycleStage;
}

/** execution_context — 실행 컨텍스트 */
export interface ExecutionContextDims {
  /** prefix_ref → service */
  svc_ref: number;
  execution_mode: Axes.ExecutionMode;
}

/** flow_point — 흐름 관측 포인트 */
export interface FlowPointDims {
  /** prefix_ref → service */
  svc_ref: number;
  flow_name: Axes.FlowName;
  flow_step: Axes.FlowStep;
  flow_variant: Axes.FlowVariant;
}

/** gate_point — 주소 상태 관측 */
export interface GatePointDims {
  /** prefix_ref → service */
  svc_ref: number;
  address_state: Axes.AddressState;
}

/** health_event — 헬스 이벤트 */
export interface HealthEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  health_status: Axes.HealthStatus;
}

/** ingest_record — 수집 레코드 */
export interface IngestRecordDims {
  /** prefix_ref → service */
  svc_ref: number;
  record_type: Axes.RecordType;
}

/** metric_aggregate — 다차원 메트릭 집계 */
export interface MetricAggregateDims {
  /** prefix_ref → service */
  svc_ref: number;
  metric_type: Axes.MetricType;
  execution_mode: Axes.ExecutionMode;
  health_status: Axes.HealthStatus;
}

/** metric_point — 메트릭 수집 포인트 */
export interface MetricPointDims {
  /** prefix_ref → service */
  svc_ref: number;
  metric_type: Axes.MetricType;
  record_type: Axes.RecordType;
}

/** observation_event — 관측 의도 이벤트 */
export interface ObservationEventDims {
  observation_intent: Axes.ObservationIntent;
  dkg_target_kind: Axes.DkgTargetKind;
}

/** order_event — 주문 이벤트 */
export interface OrderEventDims {
  /** prefix_ref → service */
  service_ctx: number;
  /** table_ref → members */
  actor: number;
  action: Axes.OrderAction;
  /** table_ref → orders */
  order: number;
}

/** page_view — 화면 관측 */
export interface PageViewDims {
  /** prefix_ref → service */
  svc_ref: number;
  page: Axes.Page;
  locale: Axes.Locale;
  userType: Axes.Usertype;
}

/** pattern_anomaly — 이상 패턴 감지 */
export interface PatternAnomalyDims {
  /** prefix_ref → service */
  svc_ref: number;
  anomaly_kind: Axes.AnomalyKind;
  behavior_pattern: Axes.BehaviorPattern;
  anomaly_severity: Axes.AnomalySeverity;
}

/** pattern_match — 패턴 매칭 결과 */
export interface PatternMatchDims {
  /** prefix_ref → service */
  svc_ref: number;
  identification_mode: Axes.IdentificationMode;
  behavior_pattern: Axes.BehaviorPattern;
  pattern_confidence: Axes.PatternConfidence;
}

/** permission — 권한 */
export interface PermissionDims {
  /** prefix_ref → service */
  perm_svc: number;
  role: Axes.Role;
}

/** pipeline_point — 파이프라인 관측 포인트 */
export interface PipelinePointDims {
  /** prefix_ref → service */
  svc_ref: number;
  pipeline_phase: Axes.PipelinePhase;
  validation_mode: Axes.ValidationMode;
  verdict_result: Axes.VerdictResult;
  temporal_strategy: Axes.TemporalStrategy;
}

/** rbac — 역할 기반 접근 제어 */
export interface RbacDims {
  role: Axes.RbacRole;
  action: Axes.Action;
  resource: Axes.Resource;
}

/** relational — 관계 모델 */
export interface RelationalDims {
  subjectKind: Axes.Subjectkind;
  predicate: Axes.Predicate;
  objectKind: Axes.Objectkind;
}

/** resource_lifecycle — 리소스 수명 추적 */
export interface ResourceLifecycleDims {
  /** prefix_ref → service */
  svc_ref: number;
  resource_type: Axes.ResourceType;
  lifecycle_state: Axes.LifecycleState;
  resource_location: Axes.ResourceLocation;
}

/** schema_event — 스키마 마이그레이션 이벤트 */
export interface SchemaEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  migration_pattern: Axes.MigrationPattern;
  deploy_action: Axes.DeployAction;
}

/** schema_validation — 스키마 검증 이벤트 */
export interface SchemaValidationDims {
  /** prefix_ref → service */
  svc_ref: number;
  validation_layer: Axes.ValidationLayer;
  constraint_rule: Axes.ConstraintRule;
  verdict_result: Axes.VerdictResult;
}

/** service — 서비스 */
export interface ServiceDims {
  env: Axes.Env;
  region: Axes.Region;
  svc_name: Axes.SvcName;
  namespace: Axes.Namespace;
}

/** skill_execution — 스킬 실행 이벤트 */
export interface SkillExecutionDims {
  skill_id: Axes.SkillId;
  skill_category: Axes.SkillCategory;
  skill_outcome: Axes.SkillOutcome;
}

/** spec_event — 스펙 문서 이벤트 */
export interface SpecEventDims {
  spec_type: Axes.SpecType;
  lifecycle_state: Axes.LifecycleState;
}

/** tag_lifecycle — 태그 수명 추적 */
export interface TagLifecycleDims {
  /** prefix_ref → service */
  svc_ref: number;
  tag: Axes.Tag;
  resource_type: Axes.ResourceType;
  lifecycle_state: Axes.LifecycleState;
}

/** test_coverage — 테스트 커버리지 매트릭스 */
export interface TestCoverageDims {
  qa_pkg: Axes.QaPkg;
  qa_module: Axes.QaModule;
  test_result: Axes.TestResult;
  flow_variant: Axes.FlowVariant;
}

/** test_event — 테스트 이벤트 */
export interface TestEventDims {
  qa_pkg: Axes.QaPkg;
  qa_module: Axes.QaModule;
  test_result: Axes.TestResult;
}

/** tracking — 사용자 행동 추적 */
export interface TrackingDims {
  /** prefix_ref → service */
  svc_ref: number;
  trackAction: Axes.Trackaction;
  page: Axes.Page;
  userType: Axes.Usertype;
}

/** validation_event — 검증 연산 이벤트 */
export interface ValidationEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  validation_layer: Axes.ValidationLayer;
  constraint_op: Axes.ConstraintOp;
  verdict_result: Axes.VerdictResult;
}

/** version_point — 버전 생명주기 관측 */
export interface VersionPointDims {
  /** prefix_ref → service */
  svc_ref: number;
  version_lifecycle: Axes.VersionLifecycle;
}

/** version_state — 버전 롤아웃 상태 */
export interface VersionStateDims {
  /** prefix_ref → service */
  svc_ref: number;
  version_lifecycle: Axes.VersionLifecycle;
  address_state: Axes.AddressState;
}

/** prefix → dims 매핑 타입 */
export interface PrefixDimsMap {
  auth_event: AuthEventDims;
  build_event: BuildEventDims;
  cart_event: CartEventDims;
  cli_event: CliEventDims;
  cli_tracking: CliTrackingDims;
  content: ContentDims;
  contract_check: ContractCheckDims;
  data_policy: DataPolicyDims;
  deploy_event: DeployEventDims;
  dkg_decision_event: DkgDecisionEventDims;
  dkg_event: DkgEventDims;
  dkg_observation_event: DkgObservationEventDims;
  edge_activity: EdgeActivityDims;
  endpoint: EndpointDims;
  engine_event: EngineEventDims;
  event: EventDims;
  event_classification: EventClassificationDims;
  execution_context: ExecutionContextDims;
  flow_point: FlowPointDims;
  gate_point: GatePointDims;
  health_event: HealthEventDims;
  ingest_record: IngestRecordDims;
  metric_aggregate: MetricAggregateDims;
  metric_point: MetricPointDims;
  observation_event: ObservationEventDims;
  order_event: OrderEventDims;
  page_view: PageViewDims;
  pattern_anomaly: PatternAnomalyDims;
  pattern_match: PatternMatchDims;
  permission: PermissionDims;
  pipeline_point: PipelinePointDims;
  rbac: RbacDims;
  relational: RelationalDims;
  resource_lifecycle: ResourceLifecycleDims;
  schema_event: SchemaEventDims;
  schema_validation: SchemaValidationDims;
  service: ServiceDims;
  skill_execution: SkillExecutionDims;
  spec_event: SpecEventDims;
  tag_lifecycle: TagLifecycleDims;
  test_coverage: TestCoverageDims;
  test_event: TestEventDims;
  tracking: TrackingDims;
  validation_event: ValidationEventDims;
  version_point: VersionPointDims;
  version_state: VersionStateDims;
}
