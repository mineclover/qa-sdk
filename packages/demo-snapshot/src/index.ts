// @def.boundary platform-chain-system
export {
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS,
  DEMO_ROLES_V1, DEMO_ROLES_V2, DEMO_ROLES_V3, DEMO_ROLES_V4,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2, DEMO_EVENTS_V3, DEMO_EVENTS_V4,
  DEMO_ROLE_CAP, DEMO_EVENT_CAP,
  DEMO_INITIATORS, DEMO_KO,
  DEMO_SVC_SHAPE, DEMO_SVC_STRIDES,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  demoEncodeSvc, demoDecodeSvc,
  demoRolesFor, demoRoleStride, demoEventsFor, demoEvtStride,
  demoCalcPermAddr, demoCalcEvtAddr,
  demoDecodePerm, demoDecodeEvt,
  DEMO_LOG_TEMPLATES,
  type DemoVer, type DemoPermDecoded, type DemoEvtDecoded,
  type DemoLogLevel, type DemoLogTemplate,
} from "./demo-snapshot.js";

export {
  DEMO_SVC,
  DEMO_ROLE_POS_V1, DEMO_ROLE_POS_V2, DEMO_ROLE_POS_V3, DEMO_ROLE_POS_V4, demoRolePos,
  DEMO_FEATURES_V1, DEMO_FEATURES_V2, DEMO_FEATURES_V3, DEMO_FEATURES_V4, demoFeatures,
  DEMO_FEATURE_KO, DEMO_FEATURE_CAP,
  buildDemoRegistryInput,
  type DemoFeatureDef,
} from "./demo-schema.js";

// ── 축(Axis) 기반 데이터 카탈로그 ─────────────────────────────────────────────
export {
  // 축 타입 + 카탈로그
  AXIS,
  type Axis, type AxisId,
  // 도메인 타입 + 인스턴스
  type Domain,
  DEMO_RBAC, DEMO_CONTENT, DEMO_TRACKING, DEMO_RELATIONAL,
  DEMO_DOMAINS, type DemoDomainId,
  // 정책 / 예약 토큰
  DEMO_RBAC_POLICIES, type RbacPolicyRule,
  RELATIONAL_RESERVED,
  // 쇼핑 서비스 컨텍스트
  DEMO_SHOPPING_SERVICES, type ShoppingServiceContext,
  // SchemaSnapshot
  buildDemoSchemaSnapshot,
  type AxisSnapshot, type DomainSnapshot, type SchemaSnapshot,
} from "./demo-domains.js";

// ── 통합 카탈로그 (신규) ──────────────────────────────────────────────────────
export {
  DEMO_CATALOG,
  type AxisVersionSnapshot, type VersionedAxis,
  type DimRef,
  type PrefixVersionDef, type PrefixDef, type PrefixMeta,
  type ColumnRef, type TableSchema,
  type DemoCatalog,
  type DemoPrefixId,
  type DemoAxisId,
  type DemoTableId,
} from "./demo-catalog.js";

export {
  latestPrefixVersion,
  getPrefixStructure, getPrefixShape, getPrefixEntries, getPrefixProfile,
  encodePrefix, decodePrefix, encodePrefixByValue,
  resolveAddress, decomposeAddress,
  verifyRoundTrip,
  type PrefixStructure, type PrefixShape, type PrefixEntries, type DimCapacityInfo, type PrefixDimProfile,
  type DecodedPosition, type ResolvedDimValue, type ResolvedAddress,
  type DecomposedDim,
} from "./demo-accessors.js";

export {
  catalogToRegistryInput,
  catalogToPrefixCodecInput,
  type LabelRegistryInput, type PrefixCodecPrefixInput, type PrefixCodecInput,
} from "./demo-bridge.js";

export {
  SCENARIO_LOGIN,
  SCENARIO_CHECKOUT_ENTRY,
  SCENARIO_CHECKOUT_COMPLETE,
  SCENARIO_FULL_PURCHASE,
  SCENARIO_CART_ABANDON,
  SCENARIO_DEPLOY_HEALTH,
  SCENARIO_PIPELINE_INGEST,
  SCENARIO_BUILD_TEST,
  DEMO_SCENARIOS,
} from "./demo-scenarios.js";
