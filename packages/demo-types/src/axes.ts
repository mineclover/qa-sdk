// Generated from Catalog "demo" at 2026-03-22T05:01:54
// !! 자동 생성 파일 — 직접 수정 금지 !!

/** action — 액션 (entries: 4, capacity: 32) */
export const ACTION = {
  READ: "read",
  WRITE: "write",
  DELETE: "delete",
  ADMIN: "admin",
} as const;
export type Action = typeof ACTION[keyof typeof ACTION];

/** address_state — 주소 상태 (entries: 4, capacity: 8) */
export const ADDRESS_STATE = {
  ACTIVE: "active",
  RESERVED: "reserved",
  INACTIVE: "inactive",
  OPEN: "open",
} as const;
export type AddressState = typeof ADDRESS_STATE[keyof typeof ADDRESS_STATE];

/** anomaly_kind — 이상 유형 (entries: 6, capacity: 16) */
export const ANOMALY_KIND = {
  UNCLASSIFIED: "unclassified",
  RATIO_SHIFT: "ratio_shift",
  VOLUME_SPIKE: "volume_spike",
  NEW_SEQUENCE: "new_sequence",
  ABNORMAL_SPEED: "abnormal_speed",
  ABNORMAL_DURATION: "abnormal_duration",
} as const;
export type AnomalyKind = typeof ANOMALY_KIND[keyof typeof ANOMALY_KIND];

/** anomaly_severity — 이상 심각도 (entries: 3, capacity: 8) */
export const ANOMALY_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
} as const;
export type AnomalySeverity = typeof ANOMALY_SEVERITY[keyof typeof ANOMALY_SEVERITY];

/** api_surface — 인터페이스 영역 (entries: 12, capacity: 16) */
export const API_SURFACE = {
  ENCODE_DECODE: "encode-decode",
  STRIDE_CALC: "stride-calc",
  BITMASK_OPS: "bitmask-ops",
  DIM_EXTRACT: "dim-extract",
  PERM_GRANT: "perm-grant",
  PROTOCOL_CODEC: "protocol-codec",
  STATE_LIFECYCLE: "state-lifecycle",
  QUERY_RESOLVE: "query-resolve",
  SCHEMA_VALIDATE: "schema-validate",
  CONVERGENCE_ANALYSIS: "convergence-analysis",
  DKG_GRAPH: "dkg-graph",
  INTEGRATION: "integration",
} as const;
export type ApiSurface = typeof API_SURFACE[keyof typeof API_SURFACE];

/** api_version — API 버전 (entries: 2, capacity: 32) */
export const API_VERSION = {
  V1: "v1",
  V2: "v2",
} as const;
export type ApiVersion = typeof API_VERSION[keyof typeof API_VERSION];

/** auth_action — 인증 행위 (entries: 3, capacity: 32) */
export const AUTH_ACTION = {
  LOGIN: "login",
  LOGOUT: "logout",
  TOKEN_REFRESH: "token_refresh",
} as const;
export type AuthAction = typeof AUTH_ACTION[keyof typeof AUTH_ACTION];

/** behavior_pattern — 행동 패턴 (entries: 12, capacity: 32) */
export const BEHAVIOR_PATTERN = {
  PURCHASE_COMPLETE: "purchase_complete",
  BROWSE_ONLY: "browse_only",
  CART_ABANDON: "cart_abandon",
  CHECKOUT_FAIL: "checkout_fail",
  ERROR_RECOVERY: "error_recovery",
  RETURN_VISIT: "return_visit",
  ANONYMOUS_BROWSE: "anonymous_browse",
  ANONYMOUS_CART: "anonymous_cart",
  API_INTEGRATION: "api_integration",
  BOT_CRAWL: "bot_crawl",
  HEALTH_CHECK: "health_check",
  UNCLASSIFIED: "unclassified",
} as const;
export type BehaviorPattern = typeof BEHAVIOR_PATTERN[keyof typeof BEHAVIOR_PATTERN];

/** build_result — 빌드결과 (entries: 4, capacity: 8) */
export const BUILD_RESULT = {
  SUCCESS: "success",
  FAILURE: "failure",
  TYPE_ERROR: "type-error",
  SKIPPED: "skipped",
} as const;
export type BuildResult = typeof BUILD_RESULT[keyof typeof BUILD_RESULT];

/** cart_action — 장바구니 행위 (entries: 3, capacity: 32) */
export const CART_ACTION = {
  ADD: "add",
  REMOVE: "remove",
  CHECKOUT: "checkout",
} as const;
export type CartAction = typeof CART_ACTION[keyof typeof CART_ACTION];

/** category — 카테고리 (entries: 4, capacity: 32) */
export const CATEGORY = {
  TECH: "tech",
  DESIGN: "design",
  PRODUCT: "product",
  CULTURE: "culture",
} as const;
export type Category = typeof CATEGORY[keyof typeof CATEGORY];

/** channel — 채널 (entries: 2, capacity: 32) */
export const CHANNEL = {
  WEB: "web",
  MOBILE: "mobile",
} as const;
export type Channel = typeof CHANNEL[keyof typeof CHANNEL];

/** cli_domain — CLI 도메인 (entries: 9, capacity: 16) */
export const CLI_DOMAIN = {
  DKG_GRAPH: "dkg-graph",
  DKG_SKILL: "dkg-skill",
  CONVERGENCE: "convergence",
  SPEC: "spec",
  COORDINATE: "coordinate",
  REGISTRY: "registry",
  CATALOG: "catalog",
  SELF_REF: "self-ref",
  SYSTEM: "system",
} as const;
export type CliDomain = typeof CLI_DOMAIN[keyof typeof CLI_DOMAIN];

/** cli_intent — CLI 의도 (entries: 7, capacity: 16) */
export const CLI_INTENT = {
  QUERY: "query",
  ANALYZE: "analyze",
  MUTATE: "mutate",
  PUBLISH: "publish",
  LIFECYCLE: "lifecycle",
  INIT: "init",
  BACKUP: "backup",
} as const;
export type CliIntent = typeof CLI_INTENT[keyof typeof CLI_INTENT];

/** cli_subject — CLI 대상 (entries: 14, capacity: 32) */
export const CLI_SUBJECT = {
  AXIS: "axis",
  PREFIX: "prefix",
  DOMAIN: "domain",
  DSL_BUNDLE: "dsl-bundle",
  DECISION: "decision",
  OBSERVATION: "observation",
  CONSTRAINT: "constraint",
  SKILL: "skill",
  INTENT_LINK: "intent-link",
  SYSTEM: "system",
  VERSION: "version",
  SPEC: "spec",
  SCHEMA: "schema",
  CATALOG: "catalog",
} as const;
export type CliSubject = typeof CLI_SUBJECT[keyof typeof CLI_SUBJECT];

/** constraint_op — 제약 연산자 (entries: 7, capacity: 32) */
export const CONSTRAINT_OP = {
  EQ: "eq",
  NEQ: "neq",
  EXISTS: "exists",
  GT: "gt",
  LT: "lt",
  CONTAINS: "contains",
  MASKED: "masked",
} as const;
export type ConstraintOp = typeof CONSTRAINT_OP[keyof typeof CONSTRAINT_OP];

/** constraint_rule — 제약 규칙 종류 (entries: 8, capacity: 32) */
export const CONSTRAINT_RULE = {
  REQUIRED: "required",
  MAXCOUNT: "maxCount",
  MINCOUNT: "minCount",
  REQUIREDIF: "requiredIf",
  EXCLUSIVE: "exclusive",
  TYPE: "type",
  MULTI: "multi",
  UNKNOWNAXIS: "unknownAxis",
} as const;
export type ConstraintRule = typeof CONSTRAINT_RULE[keyof typeof CONSTRAINT_RULE];

/** decision_type — 의사결정 유형 (entries: 7, capacity: 16) */
export const DECISION_TYPE = {
  CAPACITY: "capacity",
  NEW_AXIS: "new-axis",
  NEW_PREFIX: "new-prefix",
  DIM_ADD: "dim-add",
  MERGE: "merge",
  DEPRECATE: "deprecate",
  SEPARATION: "separation",
} as const;
export type DecisionType = typeof DECISION_TYPE[keyof typeof DECISION_TYPE];

/** deploy_action — 배포 행위 (entries: 8, capacity: 32) */
export const DEPLOY_ACTION = {
  DEPLOY: "deploy",
  ROLLBACK: "rollback",
  SCALE_UP: "scale_up",
  SCALE_DOWN: "scale_down",
  RESTART: "restart",
  CANARY_START: "canary_start",
  CANARY_PROMOTE: "canary_promote",
  MIGRATE: "migrate",
} as const;
export type DeployAction = typeof DEPLOY_ACTION[keyof typeof DEPLOY_ACTION];

/** dkg_op — DKG 운영 (entries: 11, capacity: 16) */
export const DKG_OP = {
  CLAIM: "claim",
  RELEASE: "release",
  DECIDE: "decide",
  OBSERVE: "observe",
  RESOLVE: "resolve",
  LINK: "link",
  REFRESH: "refresh",
  SELF_CHECK: "self-check",
  CONVERGE: "converge",
  TRACE: "trace",
  PROMOTE: "promote",
} as const;
export type DkgOp = typeof DKG_OP[keyof typeof DKG_OP];

/** dkg_target_kind — DKG 대상 종류 (entries: 10, capacity: 16) */
export const DKG_TARGET_KIND = {
  AXIS: "axis",
  PREFIX: "prefix",
  DOMAIN: "domain",
  DSL_BUNDLE: "dsl-bundle",
  DECISION: "decision",
  OBSERVATION: "observation",
  CONSTRAINT: "constraint",
  SKILL: "skill",
  INTENT_LINK: "intent-link",
  SYSTEM: "system",
} as const;
export type DkgTargetKind = typeof DKG_TARGET_KIND[keyof typeof DKG_TARGET_KIND];

/** edge_type — 관계 유형 (entries: 18, capacity: 32) */
export const EDGE_TYPE = {
  SATISFIES: "satisfies",
  IMPLEMENTS: "implements",
  TESTS: "tests",
  TRACES_TO: "traces-to",
  DEPENDS_ON: "depends-on",
  COMPOSES: "composes",
  REFERENCES: "references",
  GOVERNS: "governs",
  JUSTIFIES: "justifies",
  CONSTRAINS: "constrains",
  CONTAINS: "contains",
  BRIDGES: "bridges",
  CONSUMES: "consumes",
  BINDS: "binds",
  OBSERVES: "observes",
  PROMPTS: "prompts",
  EVOLVES_FROM: "evolves-from",
  SUPERSEDES: "supersedes",
} as const;
export type EdgeType = typeof EDGE_TYPE[keyof typeof EDGE_TYPE];

/** env — 환경 (entries: 5, capacity: 32) */
export const ENV = {
  DEV: "dev",
  STAGE: "stage",
  PROD: "prod",
  TEST: "test",
  LOCAL: "local",
} as const;
export type Env = typeof ENV[keyof typeof ENV];

/** event_category — 이벤트 카테고리 (entries: 8, capacity: 16) */
export const EVENT_CATEGORY = {
  USER_ACTION: "user_action",
  SYSTEM_ACTION: "system_action",
  NETWORK_ACTION: "network_action",
  DATA_ACTION: "data_action",
  AGENT_ACTION: "agent_action",
  SDK_ACTION: "sdk_action",
  ERROR: "error",
  STATE_CHANGE: "state_change",
} as const;
export type EventCategory = typeof EVENT_CATEGORY[keyof typeof EVENT_CATEGORY];

/** event_lifecycle_stage — 이벤트 생명주기 단계 (entries: 6, capacity: 16) */
export const EVENT_LIFECYCLE_STAGE = {
  INTERACTION: "interaction",
  REQUEST: "request",
  PROCESSING: "processing",
  RESULT: "result",
  SIDE_EFFECT: "side_effect",
  COMPLETION: "completion",
} as const;
export type EventLifecycleStage = typeof EVENT_LIFECYCLE_STAGE[keyof typeof EVENT_LIFECYCLE_STAGE];

/** event_name — 이벤트명 (entries: 10, capacity: 64) */
export const EVENT_NAME = {
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  ORDER_CREATED: "order.created",
  ORDER_PAID: "order.paid",
  PAYMENT_FAILED: "payment.failed",
  SESSION_EXPIRED: "session.expired",
  CONFIG_CHANGED: "config.changed",
  PAYMENT_CANCEL_REQUESTED: "payment.cancel_requested",
  PAYMENT_CANCEL_APPROVED: "payment.cancel_approved",
  PAYMENT_REFUNDED: "payment.refunded",
} as const;
export type EventName = typeof EVENT_NAME[keyof typeof EVENT_NAME];

/** execution_mode — 실행 모드 (entries: 4, capacity: 8) */
export const EXECUTION_MODE = {
  LIVE: "live",
  TEST: "test",
  SYNTHETIC: "synthetic",
  REPLAY: "replay",
} as const;
export type ExecutionMode = typeof EXECUTION_MODE[keyof typeof EXECUTION_MODE];

/** flow_name — 흐름명 (entries: 8, capacity: 64) */
export const FLOW_NAME = {
  CHECKOUT: "checkout",
  SIGNUP: "signup",
  ORDER_CANCEL: "order_cancel",
  REFUND: "refund",
  LOGIN: "login",
  BROWSE: "browse",
  CART_MANAGE: "cart_manage",
  PAYMENT: "payment",
} as const;
export type FlowName = typeof FLOW_NAME[keyof typeof FLOW_NAME];

/** flow_step — 흐름 단계 (entries: 9, capacity: 32) */
export const FLOW_STEP = {
  ENTRY: "entry",
  PROCESSING: "processing",
  BRANCH: "branch",
  SUCCESS: "success",
  FAILURE: "failure",
  TIMEOUT: "timeout",
  PAYMENT: "payment",
  COMPLETE: "complete",
  EXIT: "exit",
} as const;
export type FlowStep = typeof FLOW_STEP[keyof typeof FLOW_STEP];

/** flow_variant — 흐름 변형 (entries: 4, capacity: 32) */
export const FLOW_VARIANT = {
  DEFAULT: "default",
  RETRY: "retry",
  FALLBACK: "fallback",
  MANUAL: "manual",
} as const;
export type FlowVariant = typeof FLOW_VARIANT[keyof typeof FLOW_VARIANT];

/** health_status — 헬스 상태 (entries: 4, capacity: 32) */
export const HEALTH_STATUS = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
  MAINTENANCE: "maintenance",
} as const;
export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];

/** http_method — HTTP 메서드 (entries: 5, capacity: 32) */
export const HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
} as const;
export type HttpMethod = typeof HTTP_METHOD[keyof typeof HTTP_METHOD];

/** identification_mode — 식별 모드 (entries: 4, capacity: 8) */
export const IDENTIFICATION_MODE = {
  ANONYMOUS: "anonymous",
  IDENTIFIED: "identified",
  PSEUDONYMIZED: "pseudonymized",
  SERVICE: "service",
} as const;
export type IdentificationMode = typeof IDENTIFICATION_MODE[keyof typeof IDENTIFICATION_MODE];

/** initiator — 발생 채널 (entries: 2, capacity: 32) */
export const INITIATOR = {
  WEB: "web",
  MOBILE: "mobile",
} as const;
export type Initiator = typeof INITIATOR[keyof typeof INITIATOR];

/** lifecycle_state — 생명주기 상태 (entries: 6, capacity: 16) */
export const LIFECYCLE_STATE = {
  DRAFT: "draft",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  ARCHIVED: "archived",
  SUPERSEDED: "superseded",
  REVERSED: "reversed",
} as const;
export type LifecycleState = typeof LIFECYCLE_STATE[keyof typeof LIFECYCLE_STATE];

/** locale — 로케일 (entries: 3, capacity: 32) */
export const LOCALE = {
  KO: "ko",
  EN: "en",
  JA: "ja",
} as const;
export type Locale = typeof LOCALE[keyof typeof LOCALE];

/** mask_mode — 마스킹 모드 (entries: 4, capacity: 32) */
export const MASK_MODE = {
  RAW: "raw",
  MASK: "mask",
  DROP: "drop",
  HASH: "hash",
} as const;
export type MaskMode = typeof MASK_MODE[keyof typeof MASK_MODE];

/** metric_type — 메트릭 유형 (entries: 4, capacity: 8) */
export const METRIC_TYPE = {
  COUNTER: "counter",
  GAUGE: "gauge",
  HISTOGRAM: "histogram",
  SUMMARY: "summary",
} as const;
export type MetricType = typeof METRIC_TYPE[keyof typeof METRIC_TYPE];

/** migration_pattern — 마이그레이션 패턴 (entries: 6, capacity: 32) */
export const MIGRATION_PATTERN = {
  IDENTITY: "identity",
  REORDER: "reorder",
  APPEND_DIM: "append_dim",
  REMOVE_DIM: "remove_dim",
  COMPOSITE: "composite",
  UNKNOWN: "unknown",
} as const;
export type MigrationPattern = typeof MIGRATION_PATTERN[keyof typeof MIGRATION_PATTERN];

/** namespace — 네임스페이스 (entries: 2, capacity: 32) */
export const NAMESPACE = {
  SHOP: "shop",
  CMS: "cms",
} as const;
export type Namespace = typeof NAMESPACE[keyof typeof NAMESPACE];

/** node_source — 노드 원천 (entries: 3, capacity: 8) */
export const NODE_SOURCE = {
  BOOTSTRAP: "bootstrap",
  MANUAL: "manual",
  AUTO: "auto",
} as const;
export type NodeSource = typeof NODE_SOURCE[keyof typeof NODE_SOURCE];

/** objectKind — 객체 종류 (entries: 9, capacity: 32) */
export const OBJECTKIND = {
  _: "_",
  ROLE: "role",
  PERMISSION: "permission",
  GROUP: "group",
  RESOURCE: "resource",
  QUEUE: "queue",
  METRIC_STORE: "metric_store",
  CONSTRAINT: "constraint",
  PREFIX_VERSION: "prefix_version",
} as const;
export type Objectkind = typeof OBJECTKIND[keyof typeof OBJECTKIND];

/** obs_source — 관측 원천 (entries: 4, capacity: 8) */
export const OBS_SOURCE = {
  MANUAL: "manual",
  METRIC: "metric",
  RUNTIME: "runtime",
  REVIEW: "review",
} as const;
export type ObsSource = typeof OBS_SOURCE[keyof typeof OBS_SOURCE];

/** observation_intent — 관측 의도 (entries: 3, capacity: 8) */
export const OBSERVATION_INTENT = {
  ACTION_NEEDED: "action_needed",
  MONITORING: "monitoring",
  COMPLETED: "completed",
} as const;
export type ObservationIntent = typeof OBSERVATION_INTENT[keyof typeof OBSERVATION_INTENT];

/** order_action — 주문 행위 (entries: 4, capacity: 32) */
export const ORDER_ACTION = {
  CREATE: "create",
  CANCEL: "cancel",
  REFUND: "refund",
  COMPLETE: "complete",
} as const;
export type OrderAction = typeof ORDER_ACTION[keyof typeof ORDER_ACTION];

/** page — 페이지 (entries: 8, capacity: 32) */
export const PAGE = {
  HOME: "home",
  PRODUCT_LIST: "product_list",
  PRODUCT_DETAIL: "product_detail",
  CART: "cart",
  CHECKOUT: "checkout",
  ORDER_COMPLETE: "order_complete",
  MYPAGE: "mypage",
  LOGIN: "login",
} as const;
export type Page = typeof PAGE[keyof typeof PAGE];

/** pattern_confidence — 패턴 신뢰도 (entries: 5, capacity: 8) */
export const PATTERN_CONFIDENCE = {
  EXACT: "exact",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown",
} as const;
export type PatternConfidence = typeof PATTERN_CONFIDENCE[keyof typeof PATTERN_CONFIDENCE];

/** pipeline_phase — 파이프라인 단계 (entries: 5, capacity: 32) */
export const PIPELINE_PHASE = {
  INGEST: "ingest",
  RECONSTRUCT: "reconstruct",
  VERDICT: "verdict",
  AGGREGATE: "aggregate",
  PROPAGATE: "propagate",
} as const;
export type PipelinePhase = typeof PIPELINE_PHASE[keyof typeof PIPELINE_PHASE];

/** predicate — 술어 (entries: 7, capacity: 32) */
export const PREDICATE = {
  _: "_",
  HAS: "has",
  CAN_ACCESS: "can_access",
  BELONGS_TO: "belongs_to",
  HAS_CAPABILITY: "has_capability",
  EVALUATED: "evaluated",
  MIGRATED_TO: "migrated_to",
} as const;
export type Predicate = typeof PREDICATE[keyof typeof PREDICATE];

/** qa_module — 모듈 (entries: 21, capacity: 32) */
export const QA_MODULE = {
  SHARED: "shared",
  SCHEMA: "schema",
  EXPORT_SURFACE: "export-surface",
  SPEC: "spec",
  LOADER: "loader",
  CODEGEN: "codegen",
  DKG: "dkg",
  DKG_SKILLS: "dkg-skills",
  CONVERGENCE: "convergence",
  PROPAGATION: "propagation",
  STORE: "store",
  VISUALIZATION: "visualization",
  SHOPPING_FLOW: "shopping-flow",
  EVENT_PIPELINE: "event-pipeline",
  IFRAME_INTEGRATION: "iframe-integration",
  SCENARIO_SELECTOR: "scenario-selector",
  SHOP_INGEST_INTEGRATION: "shop-ingest-integration",
  ANONYMOUS_BROWSE: "anonymous-browse",
  CART_ABANDON: "cart-abandon",
  MULTI_PRODUCT_PURCHASE: "multi-product-purchase",
  _ALL: "_all",
} as const;
export type QaModule = typeof QA_MODULE[keyof typeof QA_MODULE];

/** qa_pkg — 패키지 (entries: 28, capacity: 64) */
export const QA_PKG = {
  SPEC_CORE: "spec-core",
  CLI: "cli",
  SDK: "sdk",
  DEMO_SNAPSHOT: "demo-snapshot",
  WEIGHTED_INDEX: "weighted-index",
  BIT_INDEX: "bit-index",
  PERMISSION_ENGINE: "permission-engine",
  INDEX_META: "index-meta",
  PLATFORM_DEMO: "platform-demo",
  INGEST_SERVER: "ingest-server",
  REGISTRY_SERVICE: "registry-service",
  E2E: "e2e",
  CORE: "core",
  ENGINE: "engine",
  STORE: "store",
  GATE_SERVICE: "gate-service",
  QUERY_SERVICE: "query-service",
  DECODE_SERVICE: "decode-service",
  REGISTRY_SERVER: "registry-server",
  REGISTRY_CLIENT: "registry-client",
  APM: "apm",
  BROWSER_SDK: "browser-sdk",
  EVENT_CATALOG: "event-catalog",
  PINO: "pino",
  VIZ_3D: "viz-3d",
  VIZ_WEB: "viz-web",
  DEMO_TESTS: "demo-tests",
  WEIGHTED_WASM: "weighted-wasm",
} as const;
export type QaPkg = typeof QA_PKG[keyof typeof QA_PKG];

/** rbac_role — 역할 (entries: 3, capacity: 32) */
export const RBAC_ROLE = {
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;
export type RbacRole = typeof RBAC_ROLE[keyof typeof RBAC_ROLE];

/** record_type — 레코드 유형 (entries: 3, capacity: 8) */
export const RECORD_TYPE = {
  LOG: "log",
  SPAN: "span",
  METRIC: "metric",
} as const;
export type RecordType = typeof RECORD_TYPE[keyof typeof RECORD_TYPE];

/** region — 리전 (entries: 2, capacity: 32) */
export const REGION = {
  ASIA: "asia",
  USA: "usa",
} as const;
export type Region = typeof REGION[keyof typeof REGION];

/** resource — 리소스 (entries: 4, capacity: 32) */
export const RESOURCE = {
  DASHBOARD: "dashboard",
  REPORTS: "reports",
  SETTINGS: "settings",
  USERS: "users",
} as const;
export type Resource = typeof RESOURCE[keyof typeof RESOURCE];

/** resource_location — 자원 위치 (entries: 4, capacity: 8) */
export const RESOURCE_LOCATION = {
  ORIGIN: "origin",
  CACHE: "cache",
  QUEUE: "queue",
  EXTERNAL: "external",
} as const;
export type ResourceLocation = typeof RESOURCE_LOCATION[keyof typeof RESOURCE_LOCATION];

/** resource_type — 리소스 유형 (entries: 4, capacity: 32) */
export const RESOURCE_TYPE = {
  API: "api",
  PAGE: "page",
  WEBHOOK: "webhook",
  GRPC: "grpc",
} as const;
export type ResourceType = typeof RESOURCE_TYPE[keyof typeof RESOURCE_TYPE];

/** role — 역할 (entries: 7, capacity: 32) */
export const ROLE = {
  ADMIN: "admin",
  DEVELOPER: "developer",
  OPERATOR: "operator",
  VIEWER: "viewer",
  READONLY: "readonly",
  CUSTOMER: "customer",
  AUDITOR: "auditor",
} as const;
export type Role = typeof ROLE[keyof typeof ROLE];

/** skill_category — 스킬 카테고리 (entries: 4, capacity: 8) */
export const SKILL_CATEGORY = {
  READ: "read",
  WRITE: "write",
  ANALYSIS: "analysis",
  CHAIN: "chain",
} as const;
export type SkillCategory = typeof SKILL_CATEGORY[keyof typeof SKILL_CATEGORY];

/** skill_id — 스킬 ID (entries: 32, capacity: 64) */
export const SKILL_ID = {
  SKILL_TRACE: "skill-trace",
  SKILL_EXPLORE_SERVICE: "skill-explore-service",
  SKILL_EXPLORE_PREFIX: "skill-explore-prefix",
  SKILL_EXPLORE_DSL: "skill-explore-dsl",
  SKILL_SYSTEM_OVERVIEW: "skill-system-overview",
  SKILL_RECORD_DECISION: "skill-record-decision",
  SKILL_RECORD_OBSERVATION: "skill-record-observation",
  SKILL_CLAIM: "skill-claim",
  SKILL_RELEASE: "skill-release",
  SKILL_LIFECYCLE_TRANSITION: "skill-lifecycle-transition",
  SKILL_CHECKOUT_FLOW_VERIFY: "skill-checkout-flow-verify",
  SKILL_COMMERCE_SKEW_AUDIT: "skill-commerce-skew-audit",
  SKILL_OBSERVATION_COVERAGE: "skill-observation-coverage",
  SKILL_INFRA_IMPACT_VERIFY: "skill-infra-impact-verify",
  SKILL_PIPELINE_PHASE_VERIFY: "skill-pipeline-phase-verify",
  SKILL_EVENT_ACTION_CHECK: "skill-event-action-check",
  SKILL_SVC_BINDING_CHECK: "skill-svc-binding-check",
  SKILL_SAFE_ENTRY_ADD: "skill-safe-entry-add",
  SKILL_DECISION_SCAFFOLD: "skill-decision-scaffold",
  SKILL_ANALYZE_IMPACT: "skill-analyze-impact",
  SKILL_INFER_MIGRATOR: "skill-infer-migrator",
  SKILL_DOMAIN_HEALTH: "skill-domain-health",
  SKILL_PATTERN_ANALYSIS: "skill-pattern-analysis",
  SKILL_SCHEMA_HEALTH_AUDIT: "skill-schema-health-audit",
  SKILL_ENTRY_ADD_CHAIN: "skill-entry-add-chain",
  SKILL_SYSTEM_HEALTH_CHAIN: "skill-system-health-chain",
  SKILL_CONVERGE_CHAIN: "skill-converge-chain",
  SKILL_SELF_CHECK_ANALYZE: "skill-self-check-analyze",
  SKILL_CLI_COVERAGE: "skill-cli-coverage",
  SKILL_PROMOTE_SCAN: "skill-promote-scan",
  SKILL_SPEC_MANAGE: "skill-spec-manage",
  SKILL_REGISTRY_PUBLISH: "skill-registry-publish",
} as const;
export type SkillId = typeof SKILL_ID[keyof typeof SKILL_ID];

/** skill_outcome — 스킬 실행 결과 (entries: 5, capacity: 8) */
export const SKILL_OUTCOME = {
  OK: "ok",
  WARNING: "warning",
  ERROR: "error",
  BLOCKED: "blocked",
  SKIPPED: "skipped",
} as const;
export type SkillOutcome = typeof SKILL_OUTCOME[keyof typeof SKILL_OUTCOME];

/** spec_type — 스펙 유형 (entries: 6, capacity: 16) */
export const SPEC_TYPE = {
  REQ: "req",
  FEAT: "feat",
  UC: "uc",
  EVT: "evt",
  LS: "ls",
  ADR: "adr",
} as const;
export type SpecType = typeof SPEC_TYPE[keyof typeof SPEC_TYPE];

/** status — 상태 (entries: 3, capacity: 32) */
export const STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;
export type Status = typeof STATUS[keyof typeof STATUS];

/** subjectKind — 주체 종류 (entries: 6, capacity: 32) */
export const SUBJECTKIND = {
  _: "_",
  USER: "user",
  ROLE: "role",
  GROUP: "group",
  SERVICE: "service",
  ENGINE: "engine",
} as const;
export type Subjectkind = typeof SUBJECTKIND[keyof typeof SUBJECTKIND];

/** svc_name — 서비스명 (entries: 5, capacity: 32) */
export const SVC_NAME = {
  SHOPPING_WEB: "shopping-web",
  SHOPPING_BACKEND: "shopping-backend",
  AUTH: "auth",
  PAYMENT: "payment",
  GATEWAY: "gateway",
} as const;
export type SvcName = typeof SVC_NAME[keyof typeof SVC_NAME];

/** tag — 태그 (entries: 5, capacity: 32) */
export const TAG = {
  FRONTEND: "frontend",
  BACKEND: "backend",
  DEVOPS: "devops",
  AI: "ai",
  DATABASE: "database",
} as const;
export type Tag = typeof TAG[keyof typeof TAG];

/** temporal_strategy — 시간 전략 (entries: 2, capacity: 32) */
export const TEMPORAL_STRATEGY = {
  SPAN_LOCAL: "span_local",
  GLOBAL: "global",
} as const;
export type TemporalStrategy = typeof TEMPORAL_STRATEGY[keyof typeof TEMPORAL_STRATEGY];

/** test_result — 테스트결과 (entries: 5, capacity: 8) */
export const TEST_RESULT = {
  PASSED: "passed",
  FAILED: "failed",
  ERROR: "error",
  SKIPPED: "skipped",
  TIMEOUT: "timeout",
} as const;
export type TestResult = typeof TEST_RESULT[keyof typeof TEST_RESULT];

/** trackAction — 행동 (entries: 8, capacity: 32) */
export const TRACKACTION = {
  CLICK: "click",
  VIEW: "view",
  SCROLL: "scroll",
  SUBMIT: "submit",
  NAVIGATE: "navigate",
  ADD_TO_CART: "add_to_cart",
  PURCHASE: "purchase",
  CLOSE: "close",
} as const;
export type Trackaction = typeof TRACKACTION[keyof typeof TRACKACTION];

/** userType — 사용자 유형 (entries: 3, capacity: 32) */
export const USERTYPE = {
  GUEST: "guest",
  MEMBER: "member",
  PREMIUM: "premium",
} as const;
export type Usertype = typeof USERTYPE[keyof typeof USERTYPE];

/** validation_layer — 검증 레이어 (entries: 3, capacity: 8) */
export const VALIDATION_LAYER = {
  VOCABULARY: "vocabulary",
  STRUCTURAL: "structural",
  CONSTRAINT: "constraint",
} as const;
export type ValidationLayer = typeof VALIDATION_LAYER[keyof typeof VALIDATION_LAYER];

/** validation_mode — 검증 모드 (entries: 3, capacity: 32) */
export const VALIDATION_MODE = {
  STRICT: "strict",
  WARN: "warn",
  OFF: "off",
} as const;
export type ValidationMode = typeof VALIDATION_MODE[keyof typeof VALIDATION_MODE];

/** verdict_result — 판정 결과 (entries: 6, capacity: 32) */
export const VERDICT_RESULT = {
  PASS: "pass",
  FAIL: "fail",
  WARN: "warn",
  DEGRADED: "degraded",
  UNKNOWN: "unknown",
  SKIPPED: "skipped",
} as const;
export type VerdictResult = typeof VERDICT_RESULT[keyof typeof VERDICT_RESULT];

/** version_lifecycle — 버전 생명주기 (entries: 5, capacity: 8) */
export const VERSION_LIFECYCLE = {
  DRAFT: "draft",
  LOCKED: "locked",
  RELEASED: "released",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
} as const;
export type VersionLifecycle = typeof VERSION_LIFECYCLE[keyof typeof VERSION_LIFECYCLE];
