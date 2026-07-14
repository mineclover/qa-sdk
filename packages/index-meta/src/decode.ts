// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * index-meta/decode — decode 전용 경량 진입점
 *
 * MetaRegistry나 SQL 어댑터 없이 DecodeMap 번들만으로
 * encode/decode/matchRanges를 수행하는 환경을 위한 진입점.
 *
 * 마이크로서비스·Edge·브라우저에서 안전하게 사용 가능하다.
 *
 * @example
 * ```ts
 * import { PrefixDecoder } from "index-meta/decode";
 *
 * // 서버에서 받은 번들로 생성
 * const decoder = new PrefixDecoder(bundle);
 *
 * // number | string 혼합 입력 자동 처리
 * const entities = decoder.decode(42);
 * const fromColon = decoder.decode("perm:v1:42");
 * const deep = decoder.decodeDeep(42);
 * ```
 */

// ── PrefixDecoder facade ────────────────────────────────────────────────────

export { PrefixDecoder } from './prefix-decoder.js';
export type { PrefixDecoderConfig, PrefixDeepDecodeResult } from './prefix-decoder.js';

// ── Core codecs ─────────────────────────────────────────────────────────────

export { MetaCodec, validateDecodeMap } from './meta-codec.js';
export { AddressProtocolManager } from './address-protocol-manager.js';
export type { FallbackStats } from './address-protocol-manager.js';

// ── Errors ──────────────────────────────────────────────────────────────────

export {
  IndexMetaError,
  EntryNotFoundError,
  ValidationError,
  ParseError,
  NegotiationError,
} from './errors.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type { EntityId, VersionedValue, DecodeMap, DimKind, AddressConfig } from './types.js';
