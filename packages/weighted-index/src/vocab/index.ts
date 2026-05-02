// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * vocab/ — 문자열 ↔ 정수 매핑 모듈.
 *
 * LabelRegistry: entity ID ↔ 1-based index.
 * PrefixCodec: 레이블 조합 + 버전 관리 + encode/decode.
 * PartialBinder: 차원 부분 바인딩 (curried encoder).
 *
 * math/ 에 의존한다 (WeightedIndex, errors, validators).
 */

export {
  LabelRegistry,
  createLabelRegistry,
  type LabelVersionEntry,
  type EntityId,
  type InferLabelSchema,
} from "./label-registry.js";

export {
  PrefixCodec,
  type PrefixVersionEntry,
  type PrefixDefinition,
  type VersionedIndex,
  type PrefixVersionDiff,
  type CoordMigrator,
} from "./prefix-registry.js";

export {
  createBinder,
  type PartialBinder,
} from "./partial-binder.js";

export {
  DisjointUnionIndex,
  UnionKindError,
  type UnionVariant,
} from "./union-index.js";
