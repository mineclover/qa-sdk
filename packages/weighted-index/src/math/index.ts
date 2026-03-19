/**
 * math/ — 순수 정수 연산 모듈.
 *
 * 좌표 ↔ 주소 변환, stride 계산, bitmask, 레이아웃 시뮬레이션.
 * string 처리 없음. 외부 의존 없음.
 *
 * 가속기(weighted-wasm, weighted-gpu)가 구현하는 동일 수학의 기준 구현.
 */

// ── 공유 타입 (가속기 패키지도 import) ──────────────────────────────────────
export type {
  Shape,
  Coord,
  Strides,
  BatchEncoder,
  AsyncBatchEncoder,
} from "./types.js";

// ── 에러 ────────────────────────────────────────────────────────────────────
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
} from "./errors.js";

// ── 검증 ────────────────────────────────────────────────────────────────────
export {
  formatList,
  assertNoColon,
  assertPositiveInt,
  assertNonEmptyArray,
} from "./validators.js";

// ── 순수 계산 ───────────────────────────────────────────────────────────────
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
} from "./calc.js";

export {
  calcWeightsBig,
  calcAddressRangesBig,
  mergeRangesBig,
  containsAddressBig,
} from "./calc-big.js";

// ── 인덱스 클래스 ───────────────────────────────────────────────────────────
export { WeightedIndex } from "./weighted-index.js";
export { WeightedIndexBig } from "./weighted-index-big.js";

// ── 비트마스크 ──────────────────────────────────────────────────────────────
export {
  createMask, setBit, clearBit, hasBit,
  buildMask, hasAnyBit, hasAllBits, popcount,
  maskAnd, maskOr, masksOverlap,
} from "./bitmask.js";

// ── 레이아웃 시뮬레이션 ─────────────────────────────────────────────────────
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
} from "./layout-fit.js";

// ── 패턴 격자 ───────────────────────────────────────────────────────────────
export {
  rangesToConstraint,
  constraintContains,
  patternContains,
  patternMeet,
  patternJoin,
  patternSpecificity,
  coordMatchesPattern,
} from "./pattern-lattice.js";
