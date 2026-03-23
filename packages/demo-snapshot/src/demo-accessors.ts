/**
 * demo-accessors.ts — DEMO_CATALOG 선택적 접근 API.
 *
 * 모든 구현은 @qa-sdk/core/catalog의 범용 runtime으로 이동.
 * 이 파일은 하위 호환을 위한 re-export.
 */

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
} from "@qa-sdk/core/catalog";

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
} from "@qa-sdk/core/catalog";
