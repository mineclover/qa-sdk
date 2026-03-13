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
  type ObfuscateTransform,
} from "./obfuscate.js";
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
