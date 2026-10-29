// Generated from Catalog "demo" (hash: cc012d402486) by codegen-core@0.1.0
// catalogDigest: sha256:cc012d402486255e232f4dc53651d0299cf66098a91e0f1c0ed986e4797c2789 · sourceDigest: sha256:4fe36cb1b82c6248c9f2fc7d564b0d06d008cf2ed00bc6610fd5649a1e6cd545
// !! 자동 생성 파일 — 직접 수정 금지 !!

/** action — 액션 (entries: 4, capacity: 32) */
export const ACTION = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
} as const;
export type Action = (typeof ACTION)[keyof typeof ACTION];

/** address_state — 주소 상태 (entries: 4, capacity: 8) */
export const ADDRESS_STATE = {
  ACTIVE: 'active',
  RESERVED: 'reserved',
  INACTIVE: 'inactive',
  OPEN: 'open',
} as const;
export type AddressState = (typeof ADDRESS_STATE)[keyof typeof ADDRESS_STATE];

/** anomaly_kind — 이상 유형 (entries: 6, capacity: 16) */
export const ANOMALY_KIND = {
  UNCLASSIFIED: 'unclassified',
  RATIO_SHIFT: 'ratio_shift',
  VOLUME_SPIKE: 'volume_spike',
  NEW_SEQUENCE: 'new_sequence',
  ABNORMAL_SPEED: 'abnormal_speed',
  ABNORMAL_DURATION: 'abnormal_duration',
} as const;
export type AnomalyKind = (typeof ANOMALY_KIND)[keyof typeof ANOMALY_KIND];

/** anomaly_severity — 이상 심각도 (entries: 3, capacity: 8) */
export const ANOMALY_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITY)[keyof typeof ANOMALY_SEVERITY];

/** api_surface — 인터페이스 영역 (entries: 12, capacity: 32) */
export const API_SURFACE = {
  ENCODE_DECODE: 'encode-decode',
  STRIDE_CALC: 'stride-calc',
  BITMASK_OPS: 'bitmask-ops',
  DIM_EXTRACT: 'dim-extract',
  PERM_GRANT: 'perm-grant',
  PROTOCOL_CODEC: 'protocol-codec',
  STATE_LIFECYCLE: 'state-lifecycle',
  QUERY_RESOLVE: 'query-resolve',
  SCHEMA_VALIDATE: 'schema-validate',
  CONVERGENCE_ANALYSIS: 'convergence-analysis',
  DKG_GRAPH: 'dkg-graph',
  INTEGRATION: 'integration',
} as const;
export type ApiSurface = (typeof API_SURFACE)[keyof typeof API_SURFACE];

/** api_version — API 버전 (entries: 2, capacity: 32) */
export const API_VERSION = {
  V1: 'v1',
  V2: 'v2',
} as const;
export type ApiVersion = (typeof API_VERSION)[keyof typeof API_VERSION];

/** auth_action — 인증 행위 (entries: 3, capacity: 32) */
export const AUTH_ACTION = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_REFRESH: 'token_refresh',
} as const;
export type AuthAction = (typeof AUTH_ACTION)[keyof typeof AUTH_ACTION];

/** behavior_pattern — 행동 패턴 (entries: 12, capacity: 32) */
export const BEHAVIOR_PATTERN = {
  PURCHASE_COMPLETE: 'purchase_complete',
  BROWSE_ONLY: 'browse_only',
  CART_ABANDON: 'cart_abandon',
  CHECKOUT_FAIL: 'checkout_fail',
  ERROR_RECOVERY: 'error_recovery',
  RETURN_VISIT: 'return_visit',
  ANONYMOUS_BROWSE: 'anonymous_browse',
  ANONYMOUS_CART: 'anonymous_cart',
  API_INTEGRATION: 'api_integration',
  BOT_CRAWL: 'bot_crawl',
  HEALTH_CHECK: 'health_check',
  UNCLASSIFIED: 'unclassified',
} as const;
export type BehaviorPattern = (typeof BEHAVIOR_PATTERN)[keyof typeof BEHAVIOR_PATTERN];

/** build_result — 빌드결과 (entries: 4, capacity: 8) */
export const BUILD_RESULT = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  TYPE_ERROR: 'type-error',
  SKIPPED: 'skipped',
} as const;
export type BuildResult = (typeof BUILD_RESULT)[keyof typeof BUILD_RESULT];

/** bundle_state — 번들 상태 (entries: 6, capacity: 8) */
export const BUNDLE_STATE = {
  EMPTY: 'empty',
  PENDING: 'pending',
  GATHERING: 'gathering',
  PARTIAL: 'partial',
  COMPLETE: 'complete',
  DEGRADED: 'degraded',
} as const;
export type BundleState = (typeof BUNDLE_STATE)[keyof typeof BUNDLE_STATE];

/** cart_action — 장바구니 행위 (entries: 3, capacity: 32) */
export const CART_ACTION = {
  ADD: 'add',
  REMOVE: 'remove',
  CHECKOUT: 'checkout',
} as const;
export type CartAction = (typeof CART_ACTION)[keyof typeof CART_ACTION];

/** category — 카테고리 (entries: 4, capacity: 32) */
export const CATEGORY = {
  TECH: 'tech',
  DESIGN: 'design',
  PRODUCT: 'product',
  CULTURE: 'culture',
} as const;
export type Category = (typeof CATEGORY)[keyof typeof CATEGORY];

/** channel — 채널 (entries: 2, capacity: 32) */
export const CHANNEL = {
  WEB: 'web',
  MOBILE: 'mobile',
} as const;
export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/** cli_domain — CLI 도메인 (entries: 10, capacity: 16) */
export const CLI_DOMAIN = {
  DKG_GRAPH: 'dkg-graph',
  DKG_SKILL: 'dkg-skill',
  CONVERGENCE: 'convergence',
  SPEC: 'spec',
  COORDINATE: 'coordinate',
  REGISTRY: 'registry',
  CATALOG: 'catalog',
  SELF_REF: 'self-ref',
  SYSTEM: 'system',
  INGEST: 'ingest',
} as const;
export type CliDomain = (typeof CLI_DOMAIN)[keyof typeof CLI_DOMAIN];

/** cli_intent — CLI 의도 (entries: 7, capacity: 16) */
export const CLI_INTENT = {
  QUERY: 'query',
  ANALYZE: 'analyze',
  MUTATE: 'mutate',
  PUBLISH: 'publish',
  LIFECYCLE: 'lifecycle',
  INIT: 'init',
  BACKUP: 'backup',
} as const;
export type CliIntent = (typeof CLI_INTENT)[keyof typeof CLI_INTENT];

/** cli_subject — CLI 대상 (entries: 16, capacity: 32) */
export const CLI_SUBJECT = {
  AXIS: 'axis',
  PREFIX: 'prefix',
  DOMAIN: 'domain',
  DSL_BUNDLE: 'dsl-bundle',
  DECISION: 'decision',
  OBSERVATION: 'observation',
  CONSTRAINT: 'constraint',
  SKILL: 'skill',
  INTENT_LINK: 'intent-link',
  SYSTEM: 'system',
  VERSION: 'version',
  SPEC: 'spec',
  SCHEMA: 'schema',
  CATALOG: 'catalog',
  SERVICE: 'service',
  TABLE: 'table',
} as const;
export type CliSubject = (typeof CLI_SUBJECT)[keyof typeof CLI_SUBJECT];

/** cognitive_phase — 인지 단계 (entries: 7, capacity: 16) */
export const COGNITIVE_PHASE = {
  PERCEIVE: 'perceive',
  INTERPRET: 'interpret',
  EVALUATE: 'evaluate',
  DECIDE: 'decide',
  PLAN: 'plan',
  EXECUTE: 'execute',
  REFLECT: 'reflect',
} as const;
export type CognitivePhase = (typeof COGNITIVE_PHASE)[keyof typeof COGNITIVE_PHASE];

/** confidence_band — 확신 수준 (entries: 4, capacity: 8) */
export const CONFIDENCE_BAND = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EXACT: 'exact',
} as const;
export type ConfidenceBand = (typeof CONFIDENCE_BAND)[keyof typeof CONFIDENCE_BAND];

/** constraint_op — 제약 연산자 (entries: 7, capacity: 32) */
export const CONSTRAINT_OP = {
  EQ: 'eq',
  NEQ: 'neq',
  EXISTS: 'exists',
  GT: 'gt',
  LT: 'lt',
  CONTAINS: 'contains',
  MASKED: 'masked',
} as const;
export type ConstraintOp = (typeof CONSTRAINT_OP)[keyof typeof CONSTRAINT_OP];

/** constraint_rule — 제약 규칙 종류 (entries: 8, capacity: 32) */
export const CONSTRAINT_RULE = {
  REQUIRED: 'required',
  MAXCOUNT: 'maxCount',
  MINCOUNT: 'minCount',
  REQUIREDIF: 'requiredIf',
  EXCLUSIVE: 'exclusive',
  TYPE: 'type',
  MULTI: 'multi',
  UNKNOWNAXIS: 'unknownAxis',
} as const;
export type ConstraintRule = (typeof CONSTRAINT_RULE)[keyof typeof CONSTRAINT_RULE];

/** convergence_phase — 수렴 단계 (entries: 7, capacity: 16) */
export const CONVERGENCE_PHASE = {
  BUFFER: 'buffer',
  FLUSH: 'flush',
  AGGREGATE: 'aggregate',
  CLASSIFY: 'classify',
  METRICS: 'metrics',
  OBSERVATIONS: 'observations',
  PERSIST: 'persist',
} as const;
export type ConvergencePhase = (typeof CONVERGENCE_PHASE)[keyof typeof CONVERGENCE_PHASE];

/** convergence_result — 수렴 결과 (entries: 4, capacity: 8) */
export const CONVERGENCE_RESULT = {
  OK: 'ok',
  PARTIAL: 'partial',
  EMPTY: 'empty',
  ERROR: 'error',
} as const;
export type ConvergenceResult = (typeof CONVERGENCE_RESULT)[keyof typeof CONVERGENCE_RESULT];

/** decision_outcome — 결정 결과 (entries: 5, capacity: 16) */
export const DECISION_OUTCOME = {
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  BLOCKED: 'blocked',
  AUTO_RESOLVED: 'auto_resolved',
  ESCALATED: 'escalated',
} as const;
export type DecisionOutcome = (typeof DECISION_OUTCOME)[keyof typeof DECISION_OUTCOME];

/** decision_type — 의사결정 유형 (entries: 7, capacity: 16) */
export const DECISION_TYPE = {
  CAPACITY: 'capacity',
  NEW_AXIS: 'new-axis',
  NEW_PREFIX: 'new-prefix',
  DIM_ADD: 'dim-add',
  MERGE: 'merge',
  DEPRECATE: 'deprecate',
  SEPARATION: 'separation',
} as const;
export type DecisionType = (typeof DECISION_TYPE)[keyof typeof DECISION_TYPE];

/** def_layer — 문서 계층 (entries: 4, capacity: 8) */
export const DEF_LAYER = {
  DOMAIN: 'domain',
  OPERATION: 'operation',
  MEDIATION: 'mediation',
  EXPERIENCE: 'experience',
} as const;
export type DefLayer = (typeof DEF_LAYER)[keyof typeof DEF_LAYER];

/** def_level — 문서 역할 (entries: 3, capacity: 8) */
export const DEF_LEVEL = {
  GROUP: 'group',
  MODULE: 'module',
  LEAF: 'leaf',
} as const;
export type DefLevel = (typeof DEF_LEVEL)[keyof typeof DEF_LEVEL];

/** deploy_action — 배포 행위 (entries: 8, capacity: 32) */
export const DEPLOY_ACTION = {
  DEPLOY: 'deploy',
  ROLLBACK: 'rollback',
  SCALE_UP: 'scale_up',
  SCALE_DOWN: 'scale_down',
  RESTART: 'restart',
  CANARY_START: 'canary_start',
  CANARY_PROMOTE: 'canary_promote',
  MIGRATE: 'migrate',
} as const;
export type DeployAction = (typeof DEPLOY_ACTION)[keyof typeof DEPLOY_ACTION];

/** dkg_op — DKG 운영 (entries: 11, capacity: 32) */
export const DKG_OP = {
  CLAIM: 'claim',
  RELEASE: 'release',
  DECIDE: 'decide',
  OBSERVE: 'observe',
  RESOLVE: 'resolve',
  LINK: 'link',
  REFRESH: 'refresh',
  SELF_CHECK: 'self-check',
  CONVERGE: 'converge',
  TRACE: 'trace',
  PROMOTE: 'promote',
} as const;
export type DkgOp = (typeof DKG_OP)[keyof typeof DKG_OP];

/** dkg_target_kind — DKG 대상 종류 (entries: 17, capacity: 32) */
export const DKG_TARGET_KIND = {
  AXIS: 'axis',
  PREFIX: 'prefix',
  SPEC: 'spec',
  SCHEMA: 'schema',
  DECISION: 'decision',
  VERSION_EVENT: 'version-event',
  CONSTRAINT: 'constraint',
  OBSERVATION: 'observation',
  DOMAIN: 'domain',
  CONSUMER: 'consumer',
  INTENT_LINK: 'intent-link',
  DSL_BUNDLE: 'dsl-bundle',
  SKILL: 'skill',
  TRANSITION_SPEC: 'transition-spec',
  TABLE: 'table',
  FLOW_SCHEMA: 'flow-schema',
  SYSTEM: 'system',
} as const;
export type DkgTargetKind = (typeof DKG_TARGET_KIND)[keyof typeof DKG_TARGET_KIND];

/** edge_type — 관계 유형 (entries: 18, capacity: 32) */
export const EDGE_TYPE = {
  SATISFIES: 'satisfies',
  IMPLEMENTS: 'implements',
  TESTS: 'tests',
  TRACES_TO: 'traces-to',
  DEPENDS_ON: 'depends-on',
  COMPOSES: 'composes',
  REFERENCES: 'references',
  GOVERNS: 'governs',
  JUSTIFIES: 'justifies',
  CONSTRAINS: 'constrains',
  CONTAINS: 'contains',
  BRIDGES: 'bridges',
  CONSUMES: 'consumes',
  BINDS: 'binds',
  OBSERVES: 'observes',
  PROMPTS: 'prompts',
  EVOLVES_FROM: 'evolves-from',
  SUPERSEDES: 'supersedes',
} as const;
export type EdgeType = (typeof EDGE_TYPE)[keyof typeof EDGE_TYPE];

/** effect_kind — 전이 효과 유형 (entries: 6, capacity: 8) */
export const EFFECT_KIND = {
  CREATE: 'create',
  UPDATE: 'update',
  MOVE: 'move',
  CONSUME: 'consume',
  OPEN: 'open',
  CLOSE: 'close',
} as const;
export type EffectKind = (typeof EFFECT_KIND)[keyof typeof EFFECT_KIND];

/** env — 환경 (entries: 5, capacity: 32) */
export const ENV = {
  DEV: 'dev',
  STAGE: 'stage',
  PROD: 'prod',
  TEST: 'test',
  LOCAL: 'local',
} as const;
export type Env = (typeof ENV)[keyof typeof ENV];

/** escalation_type — 에스컬레이션 유형 (entries: 6, capacity: 16) */
export const ESCALATION_TYPE = {
  STANDARD_PATTERN: 'standard_pattern',
  COMPLETENESS: 'completeness',
  TEST_COVERAGE: 'test_coverage',
  OBSERVABILITY: 'observability',
  SECURITY: 'security',
  TASTE: 'taste',
} as const;
export type EscalationType = (typeof ESCALATION_TYPE)[keyof typeof ESCALATION_TYPE];

/** event_category — 이벤트 카테고리 (entries: 8, capacity: 16) */
export const EVENT_CATEGORY = {
  USER_ACTION: 'user_action',
  SYSTEM_ACTION: 'system_action',
  NETWORK_ACTION: 'network_action',
  DATA_ACTION: 'data_action',
  AGENT_ACTION: 'agent_action',
  SDK_ACTION: 'sdk_action',
  ERROR: 'error',
  STATE_CHANGE: 'state_change',
} as const;
export type EventCategory = (typeof EVENT_CATEGORY)[keyof typeof EVENT_CATEGORY];

/** event_lifecycle_stage — 이벤트 생명주기 단계 (entries: 6, capacity: 16) */
export const EVENT_LIFECYCLE_STAGE = {
  INTERACTION: 'interaction',
  REQUEST: 'request',
  PROCESSING: 'processing',
  RESULT: 'result',
  SIDE_EFFECT: 'side_effect',
  COMPLETION: 'completion',
} as const;
export type EventLifecycleStage =
  (typeof EVENT_LIFECYCLE_STAGE)[keyof typeof EVENT_LIFECYCLE_STAGE];

/** event_name — 이벤트명 (entries: 10, capacity: 64) */
export const EVENT_NAME = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  PAYMENT_FAILED: 'payment.failed',
  SESSION_EXPIRED: 'session.expired',
  CONFIG_CHANGED: 'config.changed',
  PAYMENT_CANCEL_REQUESTED: 'payment.cancel_requested',
  PAYMENT_CANCEL_APPROVED: 'payment.cancel_approved',
  PAYMENT_REFUNDED: 'payment.refunded',
} as const;
export type EventName = (typeof EVENT_NAME)[keyof typeof EVENT_NAME];

/** evidence_kind — 근거 유형 (entries: 5, capacity: 16) */
export const EVIDENCE_KIND = {
  DATA: 'data',
  RULE: 'rule',
  PRECEDENT: 'precedent',
  INTUITION: 'intuition',
  EXTERNAL: 'external',
} as const;
export type EvidenceKind = (typeof EVIDENCE_KIND)[keyof typeof EVIDENCE_KIND];

/** execution_mode — 실행 모드 (entries: 4, capacity: 8) */
export const EXECUTION_MODE = {
  LIVE: 'live',
  TEST: 'test',
  SYNTHETIC: 'synthetic',
  REPLAY: 'replay',
} as const;
export type ExecutionMode = (typeof EXECUTION_MODE)[keyof typeof EXECUTION_MODE];

/** flow_name — 흐름명 (entries: 8, capacity: 64) */
export const FLOW_NAME = {
  CHECKOUT: 'checkout',
  SIGNUP: 'signup',
  ORDER_CANCEL: 'order_cancel',
  REFUND: 'refund',
  LOGIN: 'login',
  BROWSE: 'browse',
  CART_MANAGE: 'cart_manage',
  PAYMENT: 'payment',
} as const;
export type FlowName = (typeof FLOW_NAME)[keyof typeof FLOW_NAME];

/** flow_step — 흐름 단계 (entries: 9, capacity: 32) */
export const FLOW_STEP = {
  ENTRY: 'entry',
  PROCESSING: 'processing',
  BRANCH: 'branch',
  SUCCESS: 'success',
  FAILURE: 'failure',
  TIMEOUT: 'timeout',
  PAYMENT: 'payment',
  COMPLETE: 'complete',
  EXIT: 'exit',
} as const;
export type FlowStep = (typeof FLOW_STEP)[keyof typeof FLOW_STEP];

/** flow_type — 플로우 유형 (entries: 8, capacity: 16) */
export const FLOW_TYPE = {
  OFFICE_HOURS: 'office_hours',
  CEO_REVIEW: 'ceo_review',
  ENG_REVIEW: 'eng_review',
  DESIGN_REVIEW: 'design_review',
  CODE_REVIEW: 'code_review',
  INVESTIGATION: 'investigation',
  SHIP: 'ship',
  CUSTOM: 'custom',
} as const;
export type FlowType = (typeof FLOW_TYPE)[keyof typeof FLOW_TYPE];

/** flow_variant — 흐름 변형 (entries: 4, capacity: 32) */
export const FLOW_VARIANT = {
  DEFAULT: 'default',
  RETRY: 'retry',
  FALLBACK: 'fallback',
  MANUAL: 'manual',
} as const;
export type FlowVariant = (typeof FLOW_VARIANT)[keyof typeof FLOW_VARIANT];

/** forcing_question — 강제 질문 (entries: 6, capacity: 16) */
export const FORCING_QUESTION = {
  DEMAND_REALITY: 'demand_reality',
  STATUS_QUO: 'status_quo',
  DESPERATE_SPECIFICITY: 'desperate_specificity',
  NARROWEST_WEDGE: 'narrowest_wedge',
  OBSERVATION: 'observation',
  FUTURE_FIT: 'future_fit',
} as const;
export type ForcingQuestion = (typeof FORCING_QUESTION)[keyof typeof FORCING_QUESTION];

/** gate_kind — 게이트 유형 (entries: 19, capacity: 32) */
export const GATE_KIND = {
  TYPECHECK: 'typecheck',
  LINT: 'lint',
  STATIC_ANALYSIS: 'static-analysis',
  UNIT_TEST: 'unit-test',
  SNAPSHOT_TEST: 'snapshot-test',
  INTEGRATION_TEST: 'integration-test',
  TRANSACTION_TEST: 'transaction-test',
  API_CONTRACT: 'api-contract',
  E2E_TEST: 'e2e-test',
  VISUAL_CHECK: 'visual-check',
  PERF_BENCHMARK: 'perf-benchmark',
  BUILD: 'build',
  BUILD_AFFECTED: 'build-affected',
  SECURITY_AUDIT: 'security-audit',
  A11Y_CHECK: 'a11y-check',
  DOC_BUILD: 'doc-build',
  LICENSE_CHECK: 'license-check',
  EVAL_BENCHMARK: 'eval-benchmark',
  COST_TRACK: 'cost-track',
} as const;
export type GateKind = (typeof GATE_KIND)[keyof typeof GATE_KIND];

/** gate_scope — 게이트 범위 (entries: 7, capacity: 16) */
export const GATE_SCOPE = {
  STATIC: 'static',
  UNIT: 'unit',
  INTEGRATION: 'integration',
  SYSTEM: 'system',
  BUILD: 'build',
  AUDIT: 'audit',
  AI: 'ai',
} as const;
export type GateScope = (typeof GATE_SCOPE)[keyof typeof GATE_SCOPE];

/** gate_state — 게이트 상태 (entries: 9, capacity: 16) */
export const GATE_STATE = {
  IDLE: 'idle',
  BLOCKED: 'blocked',
  READY: 'ready',
  GATHERING: 'gathering',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  STALE: 'stale',
  SKIPPED: 'skipped',
} as const;
export type GateState = (typeof GATE_STATE)[keyof typeof GATE_STATE];

/** graph_action — 그래프 액션 (entries: 6, capacity: 8) */
export const GRAPH_ACTION = {
  LINK_ADD: 'link_add',
  LINK_REMOVE: 'link_remove',
  PROMOTE: 'promote',
  DEMOTE: 'demote',
  SPLIT: 'split',
  MERGE: 'merge',
} as const;
export type GraphAction = (typeof GRAPH_ACTION)[keyof typeof GRAPH_ACTION];

/** harness_machine — 상태 머신 (entries: 11, capacity: 16) */
export const HARNESS_MACHINE = {
  DOC_LIFECYCLE: 'doc-lifecycle',
  SPEC_IMPL: 'spec-impl',
  CONVENTION_COMPLIANCE: 'convention-compliance',
  DB_SYNC: 'db-sync',
  ADDRESS_STATE: 'address-state',
  VERSION_LIFECYCLE: 'version-lifecycle',
  DECISION_FLOW: 'decision-flow',
  SERVICE_STATUS: 'service-status',
  EVENT_STATUS: 'event-status',
  METRIC_HEALTH: 'metric-health',
  POLICY_CANDIDATE: 'policy-candidate',
} as const;
export type HarnessMachine = (typeof HARNESS_MACHINE)[keyof typeof HARNESS_MACHINE];

/** harness_process — 하네스 프로세스 (entries: 3, capacity: 8) */
export const HARNESS_PROCESS = {
  PREFIX_RELEASE: 'prefix-release',
  DOC_APPROVAL: 'doc-approval',
  SERVICE_DEPRECATION: 'service-deprecation',
} as const;
export type HarnessProcess = (typeof HARNESS_PROCESS)[keyof typeof HARNESS_PROCESS];

/** harness_state — 엔티티 상태 (entries: 34, capacity: 64) */
export const HARNESS_STATE = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OPEN: 'open',
  RESERVED: 'reserved',
  RELEASED: 'released',
  PENDING: 'pending',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  BLOCKED: 'blocked',
  RETIRED: 'retired',
  OK: 'ok',
  WARNING: 'warning',
  CRITICAL: 'critical',
  DESIGNED: 'designed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  VERIFIED: 'verified',
  SOURCE_REFERENCED: 'source-referenced',
  UNVERIFIED: 'unverified',
  PARTIAL: 'partial',
  COMPLIANT: 'compliant',
  VIOLATED: 'violated',
  OUT_OF_SYNC: 'out-of-sync',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  DRIFT_DETECTED: 'drift-detected',
  CANDIDATE: 'candidate',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
} as const;
export type HarnessState = (typeof HARNESS_STATE)[keyof typeof HARNESS_STATE];

/** harness_trigger — 전이 트리거 (entries: 10, capacity: 16) */
export const HARNESS_TRIGGER = {
  USER_ACTION: 'user_action',
  SYSTEM_AUTO: 'system_auto',
  CASCADE: 'cascade',
  GUARD_PASS: 'guard_pass',
  GUARD: 'guard',
  NOTIFY: 'notify',
  TIMEOUT: 'timeout',
  ERROR: 'error',
  SCHEDULE: 'schedule',
  API_CALL: 'api_call',
} as const;
export type HarnessTrigger = (typeof HARNESS_TRIGGER)[keyof typeof HARNESS_TRIGGER];

/** harness_verdict — 검증 결과 (entries: 2, capacity: 4) */
export const HARNESS_VERDICT = {
  PASS: 'pass',
  FAIL: 'fail',
} as const;
export type HarnessVerdict = (typeof HARNESS_VERDICT)[keyof typeof HARNESS_VERDICT];

/** health_status — 헬스 상태 (entries: 4, capacity: 32) */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  MAINTENANCE: 'maintenance',
} as const;
export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

/** http_method — HTTP 메서드 (entries: 5, capacity: 32) */
export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;
export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

/** identification_mode — 식별 모드 (entries: 4, capacity: 8) */
export const IDENTIFICATION_MODE = {
  ANONYMOUS: 'anonymous',
  IDENTIFIED: 'identified',
  PSEUDONYMIZED: 'pseudonymized',
  SERVICE: 'service',
} as const;
export type IdentificationMode = (typeof IDENTIFICATION_MODE)[keyof typeof IDENTIFICATION_MODE];

/** initiator — 발생 채널 (entries: 2, capacity: 32) */
export const INITIATOR = {
  WEB: 'web',
  MOBILE: 'mobile',
} as const;
export type Initiator = (typeof INITIATOR)[keyof typeof INITIATOR];

/** ir_call_kind — 호출 종류 (entries: 4, capacity: 8) */
export const IR_CALL_KIND = {
  METHOD_CALL: 'method-call',
  EVENT_EMIT: 'event-emit',
  HTTP_REQUEST: 'http-request',
  DB_QUERY: 'db-query',
} as const;
export type IrCallKind = (typeof IR_CALL_KIND)[keyof typeof IR_CALL_KIND];

/** ir_certainty — 타입 확신도 (entries: 2, capacity: 4) */
export const IR_CERTAINTY = {
  STRICT: 'strict',
  FLEXIBLE: 'flexible',
} as const;
export type IrCertainty = (typeof IR_CERTAINTY)[keyof typeof IR_CERTAINTY];

/** ir_pipe_state — 파이프 트랜잭션 상태 (entries: 3, capacity: 8) */
export const IR_PIPE_STATE = {
  PENDING: 'pending',
  COMMITTED: 'committed',
  ROLLEDBACK: 'rolledBack',
} as const;
export type IrPipeState = (typeof IR_PIPE_STATE)[keyof typeof IR_PIPE_STATE];

/** ir_retention — 데이터 보존 (entries: 3, capacity: 8) */
export const IR_RETENTION = {
  EPHEMERAL: 'ephemeral',
  SESSION: 'session',
  PERSISTENT: 'persistent',
} as const;
export type IrRetention = (typeof IR_RETENTION)[keyof typeof IR_RETENTION];

/** ir_storage_type — 저장 유형 (entries: 3, capacity: 8) */
export const IR_STORAGE_TYPE = {
  MEMORY: 'memory',
  DB: 'db',
  EVENT_STREAM: 'event-stream',
} as const;
export type IrStorageType = (typeof IR_STORAGE_TYPE)[keyof typeof IR_STORAGE_TYPE];

/** ir_transaction_scope — 트랜잭션 범위 (entries: 2, capacity: 4) */
export const IR_TRANSACTION_SCOPE = {
  LOCAL: 'local',
  DISTRIBUTED: 'distributed',
} as const;
export type IrTransactionScope = (typeof IR_TRANSACTION_SCOPE)[keyof typeof IR_TRANSACTION_SCOPE];

/** lifecycle_state — 생명주기 상태 (entries: 6, capacity: 16) */
export const LIFECYCLE_STATE = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
  SUPERSEDED: 'superseded',
  REVERSED: 'reversed',
} as const;
export type LifecycleState = (typeof LIFECYCLE_STATE)[keyof typeof LIFECYCLE_STATE];

/** link_type — 관계 유형 (entries: 8, capacity: 16) */
export const LINK_TYPE = {
  DEPENDS_ON: 'depends_on',
  IMPLEMENTS: 'implements',
  REFINES: 'refines',
  CONSTRAINS: 'constrains',
  TRACES_TO: 'traces_to',
  CONTAINS: 'contains',
  EVOLVES_FROM: 'evolves_from',
  SUPERSEDES: 'supersedes',
} as const;
export type LinkType = (typeof LINK_TYPE)[keyof typeof LINK_TYPE];

/** locale — 로케일 (entries: 3, capacity: 32) */
export const LOCALE = {
  KO: 'ko',
  EN: 'en',
  JA: 'ja',
} as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];

/** magnitude — 영향 범위 (entries: 4, capacity: 8) */
export const MAGNITUDE = {
  MINOR: 'minor',
  MODERATE: 'moderate',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const;
export type Magnitude = (typeof MAGNITUDE)[keyof typeof MAGNITUDE];

/** mask_mode — 마스킹 모드 (entries: 4, capacity: 32) */
export const MASK_MODE = {
  RAW: 'raw',
  MASK: 'mask',
  DROP: 'drop',
  HASH: 'hash',
} as const;
export type MaskMode = (typeof MASK_MODE)[keyof typeof MASK_MODE];

/** match_mode — 매칭 모드 (entries: 4, capacity: 8) */
export const MATCH_MODE = {
  SINGLE: 'single',
  ORDERED: 'ordered',
  UNORDERED: 'unordered',
  WINDOWED: 'windowed',
} as const;
export type MatchMode = (typeof MATCH_MODE)[keyof typeof MATCH_MODE];

/** mental_model — 인지 모델 (entries: 13, capacity: 32) */
export const MENTAL_MODEL = {
  BEZOS_DOORS: 'bezos_doors',
  MUNGER_INVERSION: 'munger_inversion',
  JOBS_SUBTRACTION: 'jobs_subtraction',
  SPEED_CALIBRATION: 'speed_calibration',
  PROXY_SKEPTICISM: 'proxy_skepticism',
  BOIL_THE_LAKE: 'boil_the_lake',
  THREE_LAYER: 'three_layer',
  NARRATIVE_COHERENCE: 'narrative_coherence',
  TEMPORAL_DEPTH: 'temporal_depth',
  FOUNDER_MODE: 'founder_mode',
  WARTIME_AWARENESS: 'wartime_awareness',
  DESIGN_TRUST: 'design_trust',
  EDGE_PARANOIA: 'edge_paranoia',
} as const;
export type MentalModel = (typeof MENTAL_MODEL)[keyof typeof MENTAL_MODEL];

/** metric_type — 메트릭 유형 (entries: 4, capacity: 8) */
export const METRIC_TYPE = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary',
} as const;
export type MetricType = (typeof METRIC_TYPE)[keyof typeof METRIC_TYPE];

/** migration_pattern — 마이그레이션 패턴 (entries: 6, capacity: 32) */
export const MIGRATION_PATTERN = {
  IDENTITY: 'identity',
  REORDER: 'reorder',
  APPEND_DIM: 'append_dim',
  REMOVE_DIM: 'remove_dim',
  COMPOSITE: 'composite',
  UNKNOWN: 'unknown',
} as const;
export type MigrationPattern = (typeof MIGRATION_PATTERN)[keyof typeof MIGRATION_PATTERN];

/** namespace — 네임스페이스 (entries: 2, capacity: 32) */
export const NAMESPACE = {
  SHOP: 'shop',
  CMS: 'cms',
} as const;
export type Namespace = (typeof NAMESPACE)[keyof typeof NAMESPACE];

/** node_source — 노드 원천 (entries: 3, capacity: 8) */
export const NODE_SOURCE = {
  BOOTSTRAP: 'bootstrap',
  MANUAL: 'manual',
  AUTO: 'auto',
} as const;
export type NodeSource = (typeof NODE_SOURCE)[keyof typeof NODE_SOURCE];

/** objectKind — 객체 종류 (entries: 9, capacity: 32) */
export const OBJECTKIND = {
  _: '_',
  ROLE: 'role',
  PERMISSION: 'permission',
  GROUP: 'group',
  RESOURCE: 'resource',
  QUEUE: 'queue',
  METRIC_STORE: 'metric_store',
  CONSTRAINT: 'constraint',
  PREFIX_VERSION: 'prefix_version',
} as const;
export type Objectkind = (typeof OBJECTKIND)[keyof typeof OBJECTKIND];

/** obs_source — 관측 원천 (entries: 4, capacity: 8) */
export const OBS_SOURCE = {
  MANUAL: 'manual',
  METRIC: 'metric',
  RUNTIME: 'runtime',
  REVIEW: 'review',
} as const;
export type ObsSource = (typeof OBS_SOURCE)[keyof typeof OBS_SOURCE];

/** observation_intent — 관측 의도 (entries: 3, capacity: 8) */
export const OBSERVATION_INTENT = {
  ACTION_NEEDED: 'action_needed',
  MONITORING: 'monitoring',
  COMPLETED: 'completed',
} as const;
export type ObservationIntent = (typeof OBSERVATION_INTENT)[keyof typeof OBSERVATION_INTENT];

/** order_action — 주문 행위 (entries: 4, capacity: 32) */
export const ORDER_ACTION = {
  CREATE: 'create',
  CANCEL: 'cancel',
  REFUND: 'refund',
  COMPLETE: 'complete',
} as const;
export type OrderAction = (typeof ORDER_ACTION)[keyof typeof ORDER_ACTION];

/** page — 페이지 (entries: 8, capacity: 32) */
export const PAGE = {
  HOME: 'home',
  PRODUCT_LIST: 'product_list',
  PRODUCT_DETAIL: 'product_detail',
  CART: 'cart',
  CHECKOUT: 'checkout',
  ORDER_COMPLETE: 'order_complete',
  MYPAGE: 'mypage',
  LOGIN: 'login',
} as const;
export type Page = (typeof PAGE)[keyof typeof PAGE];

/** pattern_confidence — 패턴 신뢰도 (entries: 5, capacity: 16) */
export const PATTERN_CONFIDENCE = {
  EXACT: 'exact',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
} as const;
export type PatternConfidence = (typeof PATTERN_CONFIDENCE)[keyof typeof PATTERN_CONFIDENCE];

/** pipeline_phase — 파이프라인 단계 (entries: 5, capacity: 32) */
export const PIPELINE_PHASE = {
  INGEST: 'ingest',
  RECONSTRUCT: 'reconstruct',
  VERDICT: 'verdict',
  AGGREGATE: 'aggregate',
  PROPAGATE: 'propagate',
} as const;
export type PipelinePhase = (typeof PIPELINE_PHASE)[keyof typeof PIPELINE_PHASE];

/** predicate — 술어 (entries: 7, capacity: 32) */
export const PREDICATE = {
  _: '_',
  HAS: 'has',
  CAN_ACCESS: 'can_access',
  BELONGS_TO: 'belongs_to',
  HAS_CAPABILITY: 'has_capability',
  EVALUATED: 'evaluated',
  MIGRATED_TO: 'migrated_to',
} as const;
export type Predicate = (typeof PREDICATE)[keyof typeof PREDICATE];

/** qa_module — 모듈 (entries: 21, capacity: 64) */
export const QA_MODULE = {
  SHARED: 'shared',
  SCHEMA: 'schema',
  EXPORT_SURFACE: 'export-surface',
  SPEC: 'spec',
  LOADER: 'loader',
  CODEGEN: 'codegen',
  DKG: 'dkg',
  DKG_SKILLS: 'dkg-skills',
  CONVERGENCE: 'convergence',
  PROPAGATION: 'propagation',
  STORE: 'store',
  VISUALIZATION: 'visualization',
  SHOPPING_FLOW: 'shopping-flow',
  EVENT_PIPELINE: 'event-pipeline',
  IFRAME_INTEGRATION: 'iframe-integration',
  SCENARIO_SELECTOR: 'scenario-selector',
  SHOP_INGEST_INTEGRATION: 'shop-ingest-integration',
  ANONYMOUS_BROWSE: 'anonymous-browse',
  CART_ABANDON: 'cart-abandon',
  MULTI_PRODUCT_PURCHASE: 'multi-product-purchase',
  _ALL: '_all',
} as const;
export type QaModule = (typeof QA_MODULE)[keyof typeof QA_MODULE];

/** qa_pkg — 패키지 (entries: 108, capacity: 256) */
export const QA_PKG = {
  ARCHI: 'archi',
  TAXONOMY_WEB: 'taxonomy-web',
  CLI: 'cli',
  CLI_COMMAND: 'cli-command',
  TAXONOMY_ENGINE: 'taxonomy-engine',
  TAXONOMY_DECISION_BRIDGE: 'taxonomy-decision-bridge',
  DEFINITION_CATALOG: 'definition-catalog',
  DECISION_FLOW: 'decision-flow',
  PLATFORM_DEMO: 'platform-demo',
  E2E: 'e2e',
  TEST_TYPES: 'test-types',
  SNAPSHOT_IO: 'snapshot-io',
  SIM_SERVICE_CATALOG: 'sim-service-catalog',
  SIM_OUTBOX_VIEW: 'sim-outbox-view',
  INDEX_META_WORKERS: 'index-meta-workers',
  DOCS_EXPLORER: 'docs-explorer',
  DETERMINISTIC_LABEL_REGISTRY: 'deterministic-label-registry',
  CONTEXT: 'context',
  CONFIG_LOADER: 'config-loader',
  CODEC: 'codec',
  CANVAS_VIEWPORT: 'canvas-viewport',
  VISBUG_BRIDGE: 'visbug-bridge',
  DEMO_SNAPSHOT: 'demo-snapshot',
  DEFINITION_DATA_SOURCE: 'definition-data-source',
  SIMULATION_TESTS: 'simulation-tests',
  VITEPLUS_SDK_SMOKE: 'viteplus-sdk-smoke',
  FACET_TESTS: 'facet-tests',
  INFRA_ENV_KIT: 'infra-env-kit',
  CORE: 'core',
  INGEST_SERVER: 'ingest-server',
  REGISTRY_SERVICE: 'registry-service',
  ONTOLOGY_PACK_VALIDATE: 'ontology-pack-validate',
  DKG: 'dkg',
  INFRA_ENGINE: 'infra-engine',
  AUDIT_RECORDER_STORE: 'audit-recorder-store',
  SPEC_TRANSITION: 'spec-transition',
  RESOURCE_POLICY_STORE: 'resource-policy-store',
  QUERY_SERVICE: 'query-service',
  MOTION_WORKSPACE_SERVICE: 'motion-workspace-service',
  GATE_SERVICE: 'gate-service',
  DEFINITION_SERVICE: 'definition-service',
  DECODE_SERVICE: 'decode-service',
  DECISION_SERVICE: 'decision-service',
  AUTHORIZATION_ONTOLOGY: 'authorization-ontology',
  VIZ_CORE: 'viz-core',
  REVIEW_LEDGER: 'review-ledger',
  PIPE_STORE_SQLITE: 'pipe-store-sqlite',
  OPERATIONAL_ONTOLOGY: 'operational-ontology',
  ADDRESS_INDEX: 'address-index',
  APM: 'apm',
  ARCHITECTURE_SCHEMATICS: 'architecture-schematics',
  AUTHORIZATION_MONITOR_WEB: 'authorization-monitor-web',
  BENCH: 'bench',
  BIT_INDEX: 'bit-index',
  BROWSER_CODEC: 'browser-codec',
  BROWSER_SDK: 'browser-sdk',
  CODEC_PROTO: 'codec-proto',
  CODEGEN_CORE: 'codegen-core',
  CONVERGENCE: 'convergence',
  DATA_OBJECT_CODEGEN: 'data-object-codegen',
  DB_BOOTSTRAP: 'db-bootstrap',
  DB_TRAFFIC_CONTROL: 'db-traffic-control',
  DECISION_FLOW_STORE: 'decision-flow-store',
  DEFINITION_CLIENT: 'definition-client',
  DEMO_TESTS: 'demo-tests',
  DEMO_TYPES: 'demo-types',
  DOC_ENVELOPE: 'doc-envelope',
  ENGINE: 'engine',
  EVENT_CATALOG: 'event-catalog',
  GATEWAY: 'gateway',
  GIT_UTILS: 'git-utils',
  INDEX_META: 'index-meta',
  LOGGER: 'logger',
  MOTION_CONTENT: 'motion-content',
  MOTION_WORKSPACE_CLIENT: 'motion-workspace-client',
  MOTION_WORKSPACE: 'motion-workspace',
  NEST_SERVICE_KIT: 'nest-service-kit',
  OPERATIONAL_ONTOLOGY_WEB: 'operational-ontology-web',
  OTEL: 'otel',
  PACKAGE_CLASSIFIER: 'package-classifier',
  PERMISSION_ENGINE: 'permission-engine',
  PINO: 'pino',
  PLATFORM_DEMO_API: 'platform-demo-api',
  QUALITY_LEDGER: 'quality-ledger',
  RALPH_TUI_INTEGRATION: 'ralph-tui-integration',
  REGISTRY_CLIENT: 'registry-client',
  REGISTRY_UI: 'registry-ui',
  ROLEPLAY_WEB: 'roleplay-web',
  SDK: 'sdk',
  SHOP_WEB: 'shop-web',
  SIM_DECISION_VIEW: 'sim-decision-view',
  SIM_IDENTIFIER_GRAMMAR: 'sim-identifier-grammar',
  SIM_INTERNAL_NETWORK: 'sim-internal-network',
  SPEC_ANALYZER: 'spec-analyzer',
  SPEC_CORE: 'spec-core',
  SPEC_SCHEMA: 'spec-schema',
  SPEC_TRACKER: 'spec-tracker',
  STORE: 'store',
  TAG_SEARCH: 'tag-search',
  TEST_SCENARIO_STORE: 'test-scenario-store',
  VIZ_3D: 'viz-3d',
  VIZ_WEB: 'viz-web',
  WEIGHTED_GPU: 'weighted-gpu',
  WEIGHTED_INDEX_EXPLORER: 'weighted-index-explorer',
  WEIGHTED_INDEX: 'weighted-index',
  WEIGHTED_UI: 'weighted-ui',
  WEIGHTED_WASM: 'weighted-wasm',
  WORK_DOMAIN: 'work-domain',
} as const;
export type QaPkg = (typeof QA_PKG)[keyof typeof QA_PKG];

/** quality_kind — 품질 유형 (entries: 6, capacity: 8) */
export const QUALITY_KIND = {
  ERROR: 'error',
  ASSERTION: 'assertion',
  MASK: 'mask',
  FIELD_CHECK: 'field_check',
  POLICY_VIOLATION: 'policy_violation',
  UNEXPECTED: 'unexpected',
} as const;
export type QualityKind = (typeof QUALITY_KIND)[keyof typeof QUALITY_KIND];

/** quality_severity — 품질 심각도 (entries: 3, capacity: 8) */
export const QUALITY_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;
export type QualitySeverity = (typeof QUALITY_SEVERITY)[keyof typeof QUALITY_SEVERITY];

/** rbac_role — 역할 (entries: 3, capacity: 32) */
export const RBAC_ROLE = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;
export type RbacRole = (typeof RBAC_ROLE)[keyof typeof RBAC_ROLE];

/** record_type — 레코드 유형 (entries: 3, capacity: 8) */
export const RECORD_TYPE = {
  LOG: 'log',
  SPAN: 'span',
  METRIC: 'metric',
} as const;
export type RecordType = (typeof RECORD_TYPE)[keyof typeof RECORD_TYPE];

/** region — 리전 (entries: 2, capacity: 32) */
export const REGION = {
  ASIA: 'asia',
  USA: 'usa',
} as const;
export type Region = (typeof REGION)[keyof typeof REGION];

/** resource — 리소스 (entries: 4, capacity: 32) */
export const RESOURCE = {
  DASHBOARD: 'dashboard',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  USERS: 'users',
} as const;
export type Resource = (typeof RESOURCE)[keyof typeof RESOURCE];

/** resource_location — 자원 위치 (entries: 4, capacity: 8) */
export const RESOURCE_LOCATION = {
  ORIGIN: 'origin',
  CACHE: 'cache',
  QUEUE: 'queue',
  EXTERNAL: 'external',
} as const;
export type ResourceLocation = (typeof RESOURCE_LOCATION)[keyof typeof RESOURCE_LOCATION];

/** resource_type — 리소스 유형 (entries: 4, capacity: 32) */
export const RESOURCE_TYPE = {
  API: 'api',
  PAGE: 'page',
  WEBHOOK: 'webhook',
  GRPC: 'grpc',
} as const;
export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE];

/** reversibility — 가역성 (entries: 2, capacity: 4) */
export const REVERSIBILITY = {
  ONE_WAY: 'one_way',
  TWO_WAY: 'two_way',
} as const;
export type Reversibility = (typeof REVERSIBILITY)[keyof typeof REVERSIBILITY];

/** role — 역할 (entries: 7, capacity: 32) */
export const ROLE = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  READONLY: 'readonly',
  CUSTOMER: 'customer',
  AUDITOR: 'auditor',
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

/** rpc_phase — RPC 단계 (entries: 6, capacity: 8) */
export const RPC_PHASE = {
  OPEN: 'open',
  MESSAGE: 'message',
  CLOSE: 'close',
  REQUEST: 'request',
  RESPONSE: 'response',
  ERROR: 'error',
} as const;
export type RpcPhase = (typeof RPC_PHASE)[keyof typeof RPC_PHASE];

/** rpc_protocol — RPC 프로토콜 (entries: 3, capacity: 8) */
export const RPC_PROTOCOL = {
  GRPC: 'grpc',
  WEBSOCKET: 'websocket',
  HTTP2: 'http2',
} as const;
export type RpcProtocol = (typeof RPC_PROTOCOL)[keyof typeof RPC_PROTOCOL];

/** scope_mode — 스코프 모드 (entries: 4, capacity: 8) */
export const SCOPE_MODE = {
  EXPANSION: 'expansion',
  SELECTIVE: 'selective',
  HOLD: 'hold',
  REDUCTION: 'reduction',
} as const;
export type ScopeMode = (typeof SCOPE_MODE)[keyof typeof SCOPE_MODE];

/** sdk_action — SDK 동작 (entries: 4, capacity: 8) */
export const SDK_ACTION = {
  INIT: 'init',
  FLUSH: 'flush',
  ERROR: 'error',
  RECONNECT: 'reconnect',
} as const;
export type SdkAction = (typeof SDK_ACTION)[keyof typeof SDK_ACTION];

/** sdk_channel — SDK 채널 (entries: 4, capacity: 8) */
export const SDK_CHANNEL = {
  BROWSER: 'browser',
  NODE: 'node',
  MOBILE: 'mobile',
  AGENT: 'agent',
} as const;
export type SdkChannel = (typeof SDK_CHANNEL)[keyof typeof SDK_CHANNEL];

/** skill_category — 스킬 카테고리 (entries: 4, capacity: 8) */
export const SKILL_CATEGORY = {
  READ: 'read',
  WRITE: 'write',
  ANALYSIS: 'analysis',
  CHAIN: 'chain',
} as const;
export type SkillCategory = (typeof SKILL_CATEGORY)[keyof typeof SKILL_CATEGORY];

/** skill_id — 스킬 ID (entries: 37, capacity: 64) */
export const SKILL_ID = {
  SKILL_TRACE: 'skill-trace',
  SKILL_EXPLORE_SERVICE: 'skill-explore-service',
  SKILL_EXPLORE_PREFIX: 'skill-explore-prefix',
  SKILL_EXPLORE_DSL: 'skill-explore-dsl',
  SKILL_SYSTEM_OVERVIEW: 'skill-system-overview',
  SKILL_RECORD_DECISION: 'skill-record-decision',
  SKILL_RECORD_OBSERVATION: 'skill-record-observation',
  SKILL_CLAIM: 'skill-claim',
  SKILL_RELEASE: 'skill-release',
  SKILL_LIFECYCLE_TRANSITION: 'skill-lifecycle-transition',
  SKILL_CHECKOUT_FLOW_VERIFY: 'skill-checkout-flow-verify',
  SKILL_COMMERCE_SKEW_AUDIT: 'skill-commerce-skew-audit',
  SKILL_OBSERVATION_COVERAGE: 'skill-observation-coverage',
  SKILL_INFRA_IMPACT_VERIFY: 'skill-infra-impact-verify',
  SKILL_PIPELINE_PHASE_VERIFY: 'skill-pipeline-phase-verify',
  SKILL_EVENT_ACTION_CHECK: 'skill-event-action-check',
  SKILL_SVC_BINDING_CHECK: 'skill-svc-binding-check',
  SKILL_SAFE_ENTRY_ADD: 'skill-safe-entry-add',
  SKILL_DECISION_SCAFFOLD: 'skill-decision-scaffold',
  SKILL_ANALYZE_IMPACT: 'skill-analyze-impact',
  SKILL_INFER_MIGRATOR: 'skill-infer-migrator',
  SKILL_DOMAIN_HEALTH: 'skill-domain-health',
  SKILL_PATTERN_ANALYSIS: 'skill-pattern-analysis',
  SKILL_SCHEMA_HEALTH_AUDIT: 'skill-schema-health-audit',
  SKILL_ENTRY_ADD_CHAIN: 'skill-entry-add-chain',
  SKILL_SYSTEM_HEALTH_CHAIN: 'skill-system-health-chain',
  SKILL_CONVERGE_CHAIN: 'skill-converge-chain',
  SKILL_SELF_CHECK_ANALYZE: 'skill-self-check-analyze',
  SKILL_CLI_COVERAGE: 'skill-cli-coverage',
  SKILL_PROMOTE_SCAN: 'skill-promote-scan',
  SKILL_SPEC_MANAGE: 'skill-spec-manage',
  SKILL_REGISTRY_PUBLISH: 'skill-registry-publish',
  SKILL_FLOW_TRACE: 'skill-flow-trace',
  SKILL_TABLE_IMPACT: 'skill-table-impact',
  SKILL_PREFIX_CAPACITY_AUDIT: 'skill-prefix-capacity-audit',
  SKILL_POLICY_RULE_VERIFY: 'skill-policy-rule-verify',
  SKILL_GATE_REFENTRIES_CHECK: 'skill-gate-refentries-check',
} as const;
export type SkillId = (typeof SKILL_ID)[keyof typeof SKILL_ID];

/** skill_outcome — 스킬 실행 결과 (entries: 5, capacity: 16) */
export const SKILL_OUTCOME = {
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped',
} as const;
export type SkillOutcome = (typeof SKILL_OUTCOME)[keyof typeof SKILL_OUTCOME];

/** spec_type — 스펙 유형 (entries: 6, capacity: 16) */
export const SPEC_TYPE = {
  REQ: 'req',
  FEAT: 'feat',
  UC: 'uc',
  EVT: 'evt',
  LS: 'ls',
  ADR: 'adr',
} as const;
export type SpecType = (typeof SPEC_TYPE)[keyof typeof SPEC_TYPE];

/** status — 상태 (entries: 3, capacity: 32) */
export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

/** subjectKind — 주체 종류 (entries: 6, capacity: 32) */
export const SUBJECTKIND = {
  _: '_',
  USER: 'user',
  ROLE: 'role',
  GROUP: 'group',
  SERVICE: 'service',
  ENGINE: 'engine',
} as const;
export type Subjectkind = (typeof SUBJECTKIND)[keyof typeof SUBJECTKIND];

/** svc_name — 서비스명 (entries: 16, capacity: 32) */
export const SVC_NAME = {
  SHOPPING_WEB: 'shopping-web',
  SHOPPING_BACKEND: 'shopping-backend',
  AUTH: 'auth',
  PAYMENT: 'payment',
  GATEWAY: 'gateway',
  REGISTRY_SERVICE: 'registry-service',
  INGEST_SERVER: 'ingest-server',
  PLATFORM_DEMO: 'platform-demo',
  CONTENT_SERVICE: 'content-service',
  INFRA_CONTROLLER: 'infra-controller',
  GATE_SERVICE: 'gate-service',
  QUERY_SERVICE: 'query-service',
  DECODE_SERVICE: 'decode-service',
  PLATFORM_DEMO_API: 'platform-demo-api',
  ROLEPLAY_WEB: 'roleplay-web',
  VITEPLUS_SDK_SMOKE: 'viteplus-sdk-smoke',
} as const;
export type SvcName = (typeof SVC_NAME)[keyof typeof SVC_NAME];

/** tag — 태그 (entries: 5, capacity: 32) */
export const TAG = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  DEVOPS: 'devops',
  AI: 'ai',
  DATABASE: 'database',
} as const;
export type Tag = (typeof TAG)[keyof typeof TAG];

/** task_phase — 작업 단계 (entries: 5, capacity: 8) */
export const TASK_PHASE = {
  START: 'start',
  FINISH: 'finish',
  RETRY: 'retry',
  TIMEOUT: 'timeout',
  CANCEL: 'cancel',
} as const;
export type TaskPhase = (typeof TASK_PHASE)[keyof typeof TASK_PHASE];

/** task_type — 작업 유형 (entries: 4, capacity: 8) */
export const TASK_TYPE = {
  TASK: 'task',
  JOB: 'job',
  CRON: 'cron',
  PIPELINE: 'pipeline',
} as const;
export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];

/** temporal_strategy — 시간 전략 (entries: 2, capacity: 32) */
export const TEMPORAL_STRATEGY = {
  SPAN_LOCAL: 'span_local',
  GLOBAL: 'global',
} as const;
export type TemporalStrategy = (typeof TEMPORAL_STRATEGY)[keyof typeof TEMPORAL_STRATEGY];

/** test_kind — 테스트 유형 (entries: 8, capacity: 16) */
export const TEST_KIND = {
  UNIT: 'unit',
  UI_LOGIC: 'ui-logic',
  UI: 'ui',
  DB_TRANSACTION: 'db-transaction',
  DATA_EXCHANGE: 'data-exchange',
  AUTH_FLOW: 'auth-flow',
  E2E: 'e2e',
  SIMULATION: 'simulation',
} as const;
export type TestKind = (typeof TEST_KIND)[keyof typeof TEST_KIND];

/** test_phase — 테스트 단계 (entries: 11, capacity: 32) */
export const TEST_PHASE = {
  PRECONDITION: 'precondition',
  FIXTURE: 'fixture',
  ARRANGE: 'arrange',
  ACT: 'act',
  OBSERVE: 'observe',
  ASSERT_PRIMARY: 'assert-primary',
  ASSERT_SIDE: 'assert-side',
  ASSERT_NEGATIVE: 'assert-negative',
  SNAPSHOT: 'snapshot',
  TEARDOWN: 'teardown',
  REPORT: 'report',
} as const;
export type TestPhase = (typeof TEST_PHASE)[keyof typeof TEST_PHASE];

/** test_result — 테스트결과 (entries: 5, capacity: 16) */
export const TEST_RESULT = {
  PASSED: 'passed',
  FAILED: 'failed',
  ERROR: 'error',
  SKIPPED: 'skipped',
  TIMEOUT: 'timeout',
} as const;
export type TestResult = (typeof TEST_RESULT)[keyof typeof TEST_RESULT];

/** test_scope — 테스트 범위 (entries: 4, capacity: 8) */
export const TEST_SCOPE = {
  SINGLE: 'single',
  PAIR: 'pair',
  MULTI: 'multi',
  SYSTEM: 'system',
} as const;
export type TestScope = (typeof TEST_SCOPE)[keyof typeof TEST_SCOPE];

/** trackAction — 행동 (entries: 8, capacity: 32) */
export const TRACKACTION = {
  CLICK: 'click',
  VIEW: 'view',
  SCROLL: 'scroll',
  SUBMIT: 'submit',
  NAVIGATE: 'navigate',
  ADD_TO_CART: 'add_to_cart',
  PURCHASE: 'purchase',
  CLOSE: 'close',
} as const;
export type Trackaction = (typeof TRACKACTION)[keyof typeof TRACKACTION];

/** userType — 사용자 유형 (entries: 3, capacity: 32) */
export const USERTYPE = {
  GUEST: 'guest',
  MEMBER: 'member',
  PREMIUM: 'premium',
} as const;
export type Usertype = (typeof USERTYPE)[keyof typeof USERTYPE];

/** validation_layer — 검증 레이어 (entries: 3, capacity: 8) */
export const VALIDATION_LAYER = {
  VOCABULARY: 'vocabulary',
  STRUCTURAL: 'structural',
  CONSTRAINT: 'constraint',
} as const;
export type ValidationLayer = (typeof VALIDATION_LAYER)[keyof typeof VALIDATION_LAYER];

/** validation_mode — 검증 모드 (entries: 3, capacity: 32) */
export const VALIDATION_MODE = {
  STRICT: 'strict',
  WARN: 'warn',
  OFF: 'off',
} as const;
export type ValidationMode = (typeof VALIDATION_MODE)[keyof typeof VALIDATION_MODE];

/** verdict_result — 판정 결과 (entries: 6, capacity: 32) */
export const VERDICT_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  WARN: 'warn',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown',
  SKIPPED: 'skipped',
} as const;
export type VerdictResult = (typeof VERDICT_RESULT)[keyof typeof VERDICT_RESULT];

/** version_lifecycle — 버전 생명주기 (entries: 5, capacity: 16) */
export const VERSION_LIFECYCLE = {
  DRAFT: 'draft',
  LOCKED: 'locked',
  RELEASED: 'released',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
} as const;
export type VersionLifecycle = (typeof VERSION_LIFECYCLE)[keyof typeof VERSION_LIFECYCLE];
