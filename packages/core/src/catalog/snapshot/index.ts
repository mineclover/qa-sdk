// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export { canonicalJson } from './canonical-json.js';
export {
  CATALOG_DIGEST_ALGORITHM,
  sha256Hex,
  digestCanonical,
  computeCatalogDigest,
  shortDigest,
} from './digest.js';
export {
  CODEC_ERROR_CODES,
  CodecContractError,
  isCodecContractError,
  type CodecErrorCode,
} from './codec-errors.js';
export {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  LEGACY_V1_CODEC,
  SUPPORTED_CODEC_VERSIONS,
  isSupportedCodecVersion,
  prefixLayoutKey,
  type CodecVersion,
  type PrefixLayoutKey,
  type DimensionLayout,
  type PrefixLayout,
  type CatalogSnapshotRef,
  type CatalogSnapshot,
  type SnapshotLayoutIssue,
  type CatalogSnapshotBuildResult,
  type BuildCatalogSnapshotOptions,
} from './catalog-snapshot.types.js';
export { buildCatalogSnapshot } from './build-snapshot.js';
export {
  classifyLayoutChange,
  findUnversionedBreakingChanges,
  resolveDecodeLayout,
  assertAddressInLayout,
  type LayoutBreakingReason,
  type LayoutChange,
  type UnversionedBreakingChange,
  type DecodeLayoutRequest,
  type SnapshotLookup,
  type SnapshotIdentity,
} from './compatibility.js';
export {
  RESERVED_ENTRY_PREFIX,
  reservedEntryLabel,
  layoutToDecodeMap,
  type LayoutDecodeMap,
  type LayoutDecodeMapDim,
} from './decode-map.js';
export { toSnapshotIdentity, toSnapshotWire } from './wire.js';
