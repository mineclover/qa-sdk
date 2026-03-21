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
