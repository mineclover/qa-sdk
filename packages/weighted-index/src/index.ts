export { WeightedIndex } from "./weighted-index.js";
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
export { calcWeights, partialQueryBase, describeRangeFormula } from "./calc.js";
export {
  createMask, setBit, clearBit, hasBit,
  buildMask, hasAnyBit, hasAllBits, popcount,
  maskAnd, maskOr, masksOverlap,
} from "./bitmask.js";
export {
  LabelRegistry,
  createLabelRegistry,
  type LabelVersionEntry,
  type EntityId,
  type InferLabelSchema,
} from "./label-registry.js";
export {
  PrefixRegistry,
  type PrefixVersionEntry,
  type PrefixDefinition,
  type VersionedIndex,
  type PrefixVersionDiff,
  type CoordMigrator,
} from "./prefix-registry.js";
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
} from "./uuid-layout.js";
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
