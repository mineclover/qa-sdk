// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── Catalog Types ─────────────────────────────────────────────
export type {
  VisualShape,
  DetailKind,
  PrefixCategory,
  LayerLevel,
  PrefixMeta,
  AxisVersionSnapshot,
  VersionedAxis,
  DimRef,
  PrefixVersionDef,
  PrefixDef,
  AddressModel,
  AxisCondition,
  EventTransition,
  BranchRoute,
  PathSegment,
  ColumnRef,
  TableRefSource,
  TableSchema,
  Catalog,
  PrefixIds,
  AxisIds,
} from "./catalog.types.js";

// ── Provider ──────────────────────────────────────────────────
export type { CatalogProvider, CatalogInfo } from "./catalog-provider.js";
export { StaticCatalogProvider } from "./static-provider.js";
export { CatalogRegistry } from "./catalog-registry.js";

// ── Derive Meta ───────────────────────────────────────────────
export { deriveMeta } from "./derive-meta.js";

// ── DKG Config ────────────────────────────────────────────────
export type {
  DomainDef,
  ConsumerDef,
  ConstraintDef,
  DslBundleDef,
  IntentLinkDef,
  SkillDef,
  SpecDef,
  FlowGatePhase,
  FlowGateWeight,
  FlowBranchDef,
  FlowGateDependencyDef,
  FlowGateDef,
  FlowOutcomeDef,
  FlowSchemaDef,
  FlowSchemaRefDef,
  ReviewPairDef,
  DkgConfig,
} from "./dkg-config.types.js";

// ── Browser Flatten ───────────────────────────────────────────
export type { BrowserDimDef, BrowserPrefixDef, BrowserCatalog } from "./browser-flatten.js";
export { flattenForBrowser } from "./browser-flatten.js";

// ── Runtime (Catalog Accessors) ──────────────────────────────
export {
  latestPrefixVersion,
  getPrefixStructure,
  getPrefixShape,
  getPrefixEntries,
  getPrefixProfile,
  encodePrefix,
  decodePrefix,
  encodePrefixByValue,
  resolveAddress,
  decomposeAddress,
  verifyRoundTrip,
} from "./runtime.js";

export type {
  PrefixStructure,
  PrefixShape,
  PrefixEntries,
  DimCapacityInfo,
  PrefixDimProfile,
  DecodedPosition,
  ResolvedDimValue,
  ResolvedAddress,
  DecomposedDim,
} from "./runtime.js";

export {
  decodePrefixAsResult,
  resolveAddressAsResult,
  decomposeAddressAsResult,
} from "./runtime.js";

// ── 통일 Decode 결과 타입 ────────────────────────────────────
export type { DecodeResult, DecodedDim } from "./decode-result.js";
export { entitiesToDecodeResult, decodeResultToEntities, decodeResultToDeep } from "./decode-result.js";

// ── Path Summation (경로 합산) ──────────────────────────────
export {
  createSegment, chainSegments,
  encodeBySegment, decodeBySegment,
  totalSize, collectTransitions, productToSegment,
  validateSegments, validatePrefixSegments, validateManifestSegments,
} from "./path-summation.js";
export type { DecodedPath, TransitionEntry } from "./path-summation.js";

// ── Axis Usage Analysis ─────────────────────────────────────
export type { AxisUsageEntry, AxisUsageSummary, CollectAxisUsageOptions } from "./axis-usage.js";
export { collectAxisUsage, summarizeAxisUsage, findUnusedAxes } from "./axis-usage.js";

// ── Table Ref Validation ────────────────────────────────────
export type { TableRefIssue } from "./table-ref-validate.js";
export { validateTableRefs } from "./table-ref-validate.js";

// ── Transition Bridge (좌표 ↔ 제어 흐름 정합성) ────────────
export type { TransitionBridgeIssue, TransitionSummary } from "./transition-bridge.js";
export {
  collectCoordinateTransitions,
  collectControlFlowTransitions,
  summarizeTransitions,
  validateTransitionBridge,
} from "./transition-bridge.js";
