/**
 * index-meta/client — 경량 클라이언트 SDK 진입점
 *
 * Node.js 전용 의존성(better-sqlite3, SQL 어댑터) 없이
 * encode/decode/matchRanges만 사용하는 환경을 위한 진입점.
 *
 * 브라우저·프론트엔드·Edge 런타임에서 안전하게 사용 가능하다.
 * 전체 기능(SQL 어댑터, 마이그레이션, 분산 클라이언트 등)은
 * "index-meta" 메인 진입점을 사용한다.
 *
 * @example
 * ```ts
 * import { createIndexSDK } from "index-meta/client";
 *
 * const sdk = createIndexSDK({ dims: { ... }, indices: { ... } });
 * const tracking = sdk.client("tracking", "v1");
 *
 * const vv = tracking.encode({ action: "click", page: "home" });
 * const decoded = tracking.decode(vv);
 * ```
 */

// ── SDK ────────────────────────────────────────────────────────────────────────

export { createIndexSDK, RESERVED_TOKENS } from "./index-sdk.js";
export type { IndexSDK, IndexClient } from "./index-sdk.js";

// ── Core ───────────────────────────────────────────────────────────────────────

export { MetaRegistry } from "./meta-registry.js";
export { MetaCodec, validateDecodeMap } from "./meta-codec.js";
export { MetaResolver } from "./meta-resolver.js";

// ── Errors ─────────────────────────────────────────────────────────────────────

export {
  IndexMetaError,
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
  NegotiationError,
} from "./errors.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type {
  EntityId,
  DimKind,
  EntryStatus,
  EntryFlag,
  EntryIndexRef,
  DimSnapshotInput,
  DimSnapshotMigration,
  DimInput,
  IndexVersionInput,
  IndexInput,
  AddressConfig,
  MetaRegistryInput,
  DimDef,
  DimSnapshot,
  IndexDef,
  IndexVersion,
  VersionedValue,
  DimActiveSet,
  IndexActiveManifest,
  DecodeMap,
} from "./types.js";
