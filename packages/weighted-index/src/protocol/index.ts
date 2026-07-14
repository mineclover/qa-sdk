// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * protocol/ — 직렬화 형식 모듈.
 *
 * UUID 레이아웃, hex 포맷, 시맨틱 주소, 용량 계획, 비트 필드 패킹.
 * math/ 및 vocab/ 에 의존하지 않는다.
 */

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
} from './uuid-layout.js';

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
} from './pack-format.js';

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
} from './capacity-planner.js';

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
} from './semantic-address.js';

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
} from './bit-field-layout.js';
