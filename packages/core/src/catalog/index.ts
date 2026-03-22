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
  ColumnRef,
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
  DecodedPosition,
  ResolvedDimValue,
  ResolvedAddress,
  DecomposedDim,
} from "./runtime.js";
