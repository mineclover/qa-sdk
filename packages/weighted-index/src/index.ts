/**
 * weighted-index — 닫힌 패턴의 좌표 압축 라이브러리.
 *
 * 내부 모듈 구조:
 *   math/      — 순수 정수 연산 (encode/decode, stride, bitmask)
 *   vocab/     — 문자열 ↔ 정수 매핑 (LabelRegistry, PrefixCodec)
 *   protocol/  — 직렬화 형식 (PackFormat, SemanticAddress, UUID layout)
 *   obfuscate/ — 주소 난독화 변환
 *
 * 외부 API는 모두 이 파일에서 re-export. 기존 import 경로 호환.
 */

// ── math ────────────────────────────────────────────────────────────────────
export type {
  Shape,
  Coord,
  Strides,
  BatchEncoder,
  AsyncBatchEncoder,
  FlatBatchEncoder,
} from "./math/types.js";

export { WeightedIndex } from "./math/weighted-index.js";
export { WeightedIndexBig } from "./math/weighted-index-big.js";
export {
  calcWeightsBig,
  calcAddressRangesBig,
  mergeRangesBig,
  containsAddressBig,
} from "./math/calc-big.js";
export {
  calcWeights,
  partialQueryBase,
  describeRangeFormula,
  mergeRanges,
  intersectRanges,
  subtractRanges,
  complementRanges,
  containsAddress,
  positionsToConstraint,
  calcAddressRanges,
  parseConstraintSegments,
  expandRanges,
  type CoordConstraint,
} from "./math/calc.js";
export {
  rangesToConstraint,
  constraintContains,
  patternContains,
  patternMeet,
  patternJoin,
  patternSpecificity,
  coordMatchesPattern,
} from "./math/pattern-lattice.js";
export {
  createMask, setBit, clearBit, hasBit,
  buildMask, hasAnyBit, hasAllBits, popcount,
  maskAnd, maskOr, masksOverlap,
  isPowerOf2, nextPowerOf2,
} from "./math/bitmask.js";
export {
  WeightedIndexError,
  ShapeError,
  CoordError,
  IndexRangeError,
  BufferError,
  LabelNotFoundError,
  VersionNotFoundError,
  EntityNotFoundError,
  PrefixNotFoundError,
  SerializeError,
  MigrateError,
} from "./math/errors.js";
export {
  packAxis,
  unpackAxis,
  fromPackedAxis,
  toPackedAxis,
} from "./math/binary-axis.js";
export {
  analyzeLayoutSim,
  clampShape,
  computeLayoutViewModel,
  dimMaxForBudget,
  dimMaxBig,
  dimMaxApprox,
  productExcluding,
  shapeProduct,
  shapeProductUncapped,
  autoBalancedShape,
  simDecode,
  simDecodeBig,
  simEncode,
  simEncodeBig,
  simPackUUID,
  simPackUUIDBig,
  simPackHex,
  simPackHexBig,
  fieldMaxVal,
  logScalePercent,
  valToSlider,
  sliderToVal,
  varintByteSize,
  formatLargeNumber,
  maxProductBig,
  utilizationBig,
  type LayoutSimConfig,
  type LayoutSimAnalysis,
  type LayoutViewModel,
  type LayoutViewMode,
  type DimViewModel,
} from "./math/layout-fit.js";

// ── vocab ───────────────────────────────────────────────────────────────────
export {
  LabelRegistry,
  createLabelRegistry,
  type LabelVersionEntry,
  type EntityId,
  type InferLabelSchema,
} from "./vocab/label-registry.js";
export {
  PrefixCodec,
  type PrefixVersionEntry,
  type PrefixDefinition,
  type VersionedIndex,
  type PrefixVersionDiff,
  type CoordMigrator,
} from "./vocab/prefix-registry.js";
export {
  createBinder,
  type PartialBinder,
} from "./vocab/partial-binder.js";

// ── protocol ────────────────────────────────────────────────────────────────
export {
  createUUIDLayout,
  packUUID,
  unpackUUID,
  charsForMax,
  planLayout,
  type UUIDSlot,
  type UUIDLayoutDef,
  type UUIDLayout,
  type LayoutFieldSpec,
  type PlannedField,
  type LayoutPlan,
} from "./protocol/uuid-layout.js";
export {
  PACK_FORMATS,
  PACK_FORMAT_LIST,
  defineFormat,
  FormatRegistry,
  createFormatRegistry,
  formatHex,
  parseHex,
  hexBoundary,
  hexCeil,
  hexFloor,
  type PackFormat,
  type BuiltinFormatName,
  type DefineFormatOptions,
  type HexBoundary,
} from "./protocol/pack-format.js";
export {
  fitShape,
  fitLayout,
  planCapacity,
  type CapacityPlanDim,
  type PlanCapacityOptions,
  type CapacityRecommendation,
  type CapacityPlanResult,
  type FitShapeOptions,
  type FitShapeResult,
  type FitLayoutOptions,
  type FitLayoutResult,
} from "./protocol/capacity-planner.js";
export {
  CANONICAL_TEXT_PROTOCOL,
  CANONICAL_BINARY_PREFIX,
  colonProtocol,
  uriProtocol,
  compactProtocol,
  detectProtocol,
  parseAddress,
  serializeAddress,
  convertAddress,
  fromVersionedIndex,
  toVersionedIndex,
  fromVersionedValue,
  toVersionedValue,
  createLayoutProtocol,
  createLayoutProtocolBig,
  fromVersionedValueBig,
  toVersionedValueBig,
  AddressConverter,
  createAddressConverter,
  type SemanticAddress,
  type SemanticAddressBig,
  type VersionedValue,
  type VersionedValueBig,
  type AddressProtocol,
  type AddressProtocolBig,
  type LayoutProtocolOptions,
  type ShardingStrategy,
} from "./protocol/semantic-address.js";
export {
  bitsForMax,
  createBitFieldLayout,
  bitPack,
  bitUnpack,
  bigintToBytes,
  bytesToBigint,
  bitPackToBytes,
  bitUnpackFromBytes,
  bitPackToHex,
  bitUnpackFromHex,
  analyzeBitVsHex,
  type BitFieldSpec,
  type BitField,
  type BitFieldLayout,
  type BitVsHexField,
  type BitVsHexAnalysis,
} from "./protocol/bit-field-layout.js";

// ── obfuscate ───────────────────────────────────────────────────────────────
export {
  calcBitWidth,
  xorObfuscate,
  rotateLeft,
  rotateRight,
  reverseBits,
  compose,
  toHex,
  fromHex,
  toUUID,
  fromUUID,
  toStructuredUUID,
  fromStructuredUUID,
  toNanoId,
  fromNanoId,
  type UUIDField,
  type ObfuscateTransform,
} from "./obfuscate/index.js";
