// Generated from Catalog "demo" (hash: fd5672339df7) by codegen-core@0.1.0
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

/** bundle_observation — 번들 관측 */
export interface BundleObservationDims {
  /** prefix_ref → service */
  svc_ref: number;
  bundle_state: Axes.BundleState;
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

/** convergence_event — 수렴 파이프라인 이벤트 */
export interface ConvergenceEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  convergence_phase: Axes.ConvergencePhase;
  convergence_result: Axes.ConvergenceResult;
}

/** data_policy — 데이터 정책 관측 */
export interface DataPolicyDims {
  /** prefix_ref → service */
  svc_ref: number;
  mask_mode: Axes.MaskMode;
}

/** decision_event — 분기 선택 이벤트 */
export interface DecisionEventDims {
  flow_type: Axes.FlowType;
  cognitive_phase: Axes.CognitivePhase;
  evidence_kind: Axes.EvidenceKind;
  confidence_band: Axes.ConfidenceBand;
}

/** decision_path — 의사결정 경로 */
export interface DecisionPathDims {
  flow_type: Axes.FlowType;
  decision_outcome: Axes.DecisionOutcome;
  scope_mode: Axes.ScopeMode;
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

/** escalation_event — 에스컬레이션 이벤트 */
export interface EscalationEventDims {
  flow_type: Axes.FlowType;
  escalation_type: Axes.EscalationType;
  cognitive_phase: Axes.CognitivePhase;
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

/** forcing_response — 강제 질문 응답 */
export interface ForcingResponseDims {
  forcing_question: Axes.ForcingQuestion;
  evidence_kind: Axes.EvidenceKind;
  confidence_band: Axes.ConfidenceBand;
}

/** gate_execution — 게이트 실행 */
export interface GateExecutionDims {
  /** prefix_ref → service */
  svc_ref: number;
  gate_kind: Axes.GateKind;
  gate_scope: Axes.GateScope;
  gate_state: Axes.GateState;
}

/** gate_point — 주소 상태 관측 */
export interface GatePointDims {
  /** prefix_ref → service */
  svc_ref: number;
  address_state: Axes.AddressState;
}

/** graph_event — 그래프 이벤트 */
export interface GraphEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  def_level: Axes.DefLevel;
  graph_action: Axes.GraphAction;
  link_type: Axes.LinkType;
}

/** harness_guard — 하네스 가드 검증 */
export interface HarnessGuardDims {
  /** prefix_ref → service */
  svc_ref: number;
  harness_machine: Axes.HarnessMachine;
  harness_state: Axes.HarnessState;
  harness_verdict: Axes.HarnessVerdict;
}

/** harness_process_step — 하네스 프로세스 스텝 */
export interface HarnessProcessStepDims {
  /** prefix_ref → service */
  svc_ref: number;
  harness_process: Axes.HarnessProcess;
  harness_machine: Axes.HarnessMachine;
  harness_verdict: Axes.HarnessVerdict;
}

/** harness_transition — 하네스 상태 전이 */
export interface HarnessTransitionDims {
  /** prefix_ref → service */
  svc_ref: number;
  harness_machine: Axes.HarnessMachine;
  harness_state: Axes.HarnessState;
  harness_trigger: Axes.HarnessTrigger;
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

/** ir_data — 데이터 수명 관측 */
export interface IrDataDims {
  ir_certainty: Axes.IrCertainty;
  ir_transaction_scope: Axes.IrTransactionScope;
  ir_retention: Axes.IrRetention;
  ir_storage_type: Axes.IrStorageType;
}

/** ir_intent_path — 시공간 경로 관측 */
export interface IrIntentPathDims {
  /** prefix_ref → service */
  svc_ref: number;
  ir_call_kind: Axes.IrCallKind;
  ir_pipe_state: Axes.IrPipeState;
}

/** ir_module — 모듈 정의 관측 */
export interface IrModuleDims {
  def_level: Axes.DefLevel;
  def_layer: Axes.DefLayer;
  ir_certainty: Axes.IrCertainty;
}

/** ir_pipe — 파이프 트랜잭션 관측 */
export interface IrPipeDims {
  /** prefix_ref → service */
  svc_ref: number;
  ir_pipe_state: Axes.IrPipeState;
  ir_call_kind: Axes.IrCallKind;
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

/** model_apply — 인지 모델 적용 */
export interface ModelApplyDims {
  mental_model: Axes.MentalModel;
  reversibility: Axes.Reversibility;
  magnitude: Axes.Magnitude;
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

/** quality_event — 품질 이벤트 */
export interface QualityEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  quality_severity: Axes.QualitySeverity;
  quality_kind: Axes.QualityKind;
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

/** rpc_event — RPC 이벤트 */
export interface RpcEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  rpc_protocol: Axes.RpcProtocol;
  rpc_phase: Axes.RpcPhase;
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

/** sdk_lifecycle — SDK 생명주기 */
export interface SdkLifecycleDims {
  /** prefix_ref → service */
  svc_ref: number;
  sdk_action: Axes.SdkAction;
  sdk_channel: Axes.SdkChannel;
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

/** task_event — 작업 이벤트 */
export interface TaskEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  task_type: Axes.TaskType;
  task_phase: Axes.TaskPhase;
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

/** test_scenario — 테스트 시나리오 */
export interface TestScenarioDims {
  test_kind: Axes.TestKind;
  test_scope: Axes.TestScope;
  test_phase: Axes.TestPhase;
}

/** tracking — 사용자 행동 추적 */
export interface TrackingDims {
  /** prefix_ref → service */
  svc_ref: number;
  trackAction: Axes.Trackaction;
  page: Axes.Page;
  userType: Axes.Usertype;
}

/** transition_event — 전이 이벤트 */
export interface TransitionEventDims {
  /** prefix_ref → service */
  svc_ref: number;
  effect_kind: Axes.EffectKind;
  match_mode: Axes.MatchMode;
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
  bundle_observation: BundleObservationDims;
  cart_event: CartEventDims;
  cli_event: CliEventDims;
  cli_tracking: CliTrackingDims;
  content: ContentDims;
  contract_check: ContractCheckDims;
  convergence_event: ConvergenceEventDims;
  data_policy: DataPolicyDims;
  decision_event: DecisionEventDims;
  decision_path: DecisionPathDims;
  deploy_event: DeployEventDims;
  dkg_decision_event: DkgDecisionEventDims;
  dkg_event: DkgEventDims;
  dkg_observation_event: DkgObservationEventDims;
  edge_activity: EdgeActivityDims;
  endpoint: EndpointDims;
  engine_event: EngineEventDims;
  escalation_event: EscalationEventDims;
  event: EventDims;
  event_classification: EventClassificationDims;
  execution_context: ExecutionContextDims;
  flow_point: FlowPointDims;
  forcing_response: ForcingResponseDims;
  gate_execution: GateExecutionDims;
  gate_point: GatePointDims;
  graph_event: GraphEventDims;
  harness_guard: HarnessGuardDims;
  harness_process_step: HarnessProcessStepDims;
  harness_transition: HarnessTransitionDims;
  health_event: HealthEventDims;
  ingest_record: IngestRecordDims;
  ir_data: IrDataDims;
  ir_intent_path: IrIntentPathDims;
  ir_module: IrModuleDims;
  ir_pipe: IrPipeDims;
  metric_aggregate: MetricAggregateDims;
  metric_point: MetricPointDims;
  model_apply: ModelApplyDims;
  observation_event: ObservationEventDims;
  order_event: OrderEventDims;
  page_view: PageViewDims;
  pattern_anomaly: PatternAnomalyDims;
  pattern_match: PatternMatchDims;
  permission: PermissionDims;
  pipeline_point: PipelinePointDims;
  quality_event: QualityEventDims;
  rbac: RbacDims;
  relational: RelationalDims;
  resource_lifecycle: ResourceLifecycleDims;
  rpc_event: RpcEventDims;
  schema_event: SchemaEventDims;
  schema_validation: SchemaValidationDims;
  sdk_lifecycle: SdkLifecycleDims;
  service: ServiceDims;
  skill_execution: SkillExecutionDims;
  spec_event: SpecEventDims;
  tag_lifecycle: TagLifecycleDims;
  task_event: TaskEventDims;
  test_coverage: TestCoverageDims;
  test_event: TestEventDims;
  test_scenario: TestScenarioDims;
  tracking: TrackingDims;
  transition_event: TransitionEventDims;
  validation_event: ValidationEventDims;
  version_point: VersionPointDims;
  version_state: VersionStateDims;
}
