// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PrefixDecoderBig — BigInt index용 decode 전용 unified facade
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * PrefixDecoder의 BigInt 대응 버전. MetaCodecBig를 내부적으로 사용하여
 * Number.MAX_SAFE_INTEGER(2^53) 한계를 초과하는 주소 공간을 지원한다.
 *
 * PrefixDecoder는 numberType === "bigint"인 DecodeMap을 거부하므로,
 * BigInt 주소 공간을 가진 index는 이 클래스를 사용해야 한다.
 *
 * ── 제한 사항 ──────────────────────────────────────────────────────────────
 *
 * - 입력은 bigint만 받는다 (string address 파싱 미지원).
 *   BigInt 주소 공간에서는 텍스트 프로토콜(colon, URI 등)의 value 부분이
 *   bigint여야 하므로 별도 파싱 체계가 필요하다.
 * - enumerate() 미지원 — BigInt 범위 전개는 메모리 위험이 크므로
 *   matchRanges()만 제공한다.
 * - encode()도 지원 (대칭 API).
 */

import type { DecodeMap, EntityId, VersionedValueBig } from "./types.js";
import { MetaCodecBig } from "./meta-codec-big.js";
import { ValidationError } from "./errors.js";

// ── 공개 타입 ────────────────────────────────────────────────────────────────

export interface PrefixDecoderBigConfig {
  map: DecodeMap;
  /** indexId → 참조 prefix의 DecodeMap. index_ref dim 확장에 사용. */
  refs?: Record<string, DecodeMap>;
}

/**
 * decodeDeep() 결과 (BigInt 버전).
 *
 * entities: 이 index의 entity record (decode() 결과와 동일).
 * refs: index_ref dim의 1-level 확장 결과.
 *        key = dimId, value = 참조 index의 entity record.
 *        refs에 해당 index 코덱이 없으면 해당 dim은 생략됨.
 */
export interface PrefixDeepDecodeResultBig {
  entities: Record<string, EntityId>;
  refs: Record<string, Record<string, EntityId>>;
}

/**
 * decodeDeepDetailed() 결과 (BigInt 버전).
 * decodeDeep() 결과에 unresolved ref dim 목록을 추가.
 */
export interface PrefixDeepDecodeDetailedResultBig extends PrefixDeepDecodeResultBig {
  /** ref 코덱이 없어 확장하지 못한 index_ref dim ID 목록. */
  unresolved: string[];
}

// ── PrefixDecoderBig ────────────────────────────────────────────────────────

export class PrefixDecoderBig {
  private readonly _codec: MetaCodecBig;
  private readonly _config: PrefixDecoderBigConfig;
  private readonly _refCodecs: Map<string, MetaCodecBig>;

  constructor(config: PrefixDecoderBigConfig) {
    // numberType 검증: "bigint"이어야 한다 (없으면 허용 — 호출자가 명시적으로 BigInt 사용)
    if (config.map.numberType === "number") {
      throw new ValidationError(
        `PrefixDecoderBig requires BigInt-typed index, but "${config.map.indexId}/${config.map.versionId}" has numberType "number". ` +
        `Use PrefixDecoder instead.`
      );
    }
    this._config = config;
    this._codec = new MetaCodecBig(config.map);

    // ref 코덱 빌드
    this._refCodecs = new Map();
    if (config.refs) {
      for (const [indexId, refMap] of Object.entries(config.refs)) {
        // ref는 BigInt/Number 어느 쪽이든 허용.
        // BigInt ref → MetaCodecBig, Number ref → MetaCodecBig도 처리 가능 (shape를 BigInt로 변환).
        this._refCodecs.set(indexId, new MetaCodecBig(refMap));
      }
    }
  }

  // ── Identity (MetaCodecBig 위임) ──────────────────────────────────────────

  get indexId(): string { return this._codec.indexId; }
  get versionId(): string { return this._codec.versionId; }
  get size(): bigint { return this._codec.size; }
  get shape(): readonly bigint[] { return this._codec.shape; }
  get strides(): readonly bigint[] { return this._codec.strides; }
  get dimIds(): readonly string[] { return this._codec.dimIds; }

  // ── L1 Address: bigint → VersionedValueBig ────────────────────────────────

  /**
   * bigint → VersionedValueBig.
   */
  resolve(input: bigint): VersionedValueBig {
    return {
      indexId: this._codec.indexId,
      versionId: this._codec.versionId,
      value: input,
    };
  }

  // ── L2 Info: bigint → entity record ───────────────────────────────────────

  /**
   * bigint → entity ID record.
   *
   * @example
   * decoder.decode(42n)
   * // → { role: "admin", action: "read", resource: 10 }
   */
  decode(input: bigint): Readonly<Record<string, EntityId>> {
    return this._codec.decodeValue(input);
  }

  // ── L2+ Deep: index_ref dim을 1-level 확장 ────────────────────────────────

  /**
   * decode() + index_ref dim의 1-level 확장.
   *
   * refs에 해당 index 코덱이 있으면 확장, 없으면 raw number 유지.
   */
  decodeDeep(input: bigint): PrefixDeepDecodeResultBig {
    const entities = { ...this.decode(input) };
    const refs: Record<string, Record<string, EntityId>> = {};

    for (const dim of this._config.map.dims) {
      if (dim.kind.type === "index_ref") {
        const refCodec = this._refCodecs.get(dim.kind.indexId);
        if (refCodec) {
          const refValue = entities[dim.dimId];
          if (typeof refValue === "number") {
            refs[dim.dimId] = { ...refCodec.decodeValue(BigInt(refValue)) };
          }
        }
      }
    }

    return { entities, refs };
  }

  /**
   * decodeDeep() + unresolved ref 수집.
   */
  decodeDeepDetailed(input: bigint): PrefixDeepDecodeDetailedResultBig {
    const result = this.decodeDeep(input);
    const unresolved: string[] = [];
    for (const dim of this._config.map.dims) {
      if (dim.kind.type === "index_ref" && !this.hasRef(dim.dimId)) {
        unresolved.push(dim.dimId);
      }
    }
    return { ...result, unresolved };
  }

  // ── Batch ─────────────────────────────────────────────────────────────────

  /**
   * 다수의 bigint 입력을 한 번에 decode.
   */
  decodeBatch(inputs: readonly bigint[]): Readonly<Record<string, EntityId>>[] {
    return inputs.map((input) => this.decode(input));
  }

  // ── Query (MetaCodecBig 위임) ─────────────────────────────────────────────

  matchRanges(partial: Record<string, EntityId | null>): [bigint, bigint][] {
    return this._codec.matchRanges(partial);
  }

  // ── Ref ───────────────────────────────────────────────────────────────────

  /**
   * index_ref dim의 참조값을 ref 코덱으로 해석.
   *
   * @param value 이 코덱의 주소 공간에서의 bigint value
   * @param dimId 해석할 index_ref dim의 ID
   */
  resolveRef(value: bigint, dimId: string): Readonly<Record<string, EntityId>> {
    const dim = this._config.map.dims.find((d) => d.dimId === dimId);
    if (!dim) {
      throw new ValidationError(
        `resolveRef: unknown dim "${dimId}" in "${this._codec.indexId}/${this._codec.versionId}"`
      );
    }
    if (dim.kind.type !== "index_ref") {
      throw new ValidationError(
        `resolveRef: dim "${dimId}" is "${dim.kind.type}", expected "index_ref"`
      );
    }
    const refCodec = this._refCodecs.get(dim.kind.indexId);
    if (!refCodec) {
      throw new ValidationError(
        `resolveRef: no ref codec for index "${dim.kind.indexId}"`
      );
    }
    const decoded = this._codec.decodeValue(value);
    const refValue = decoded[dimId];
    if (typeof refValue !== "number") {
      throw new ValidationError(
        `resolveRef: dim "${dimId}" entry is not a number`
      );
    }
    return refCodec.decodeValue(BigInt(refValue));
  }

  /**
   * 해당 dimId가 index_ref이고 ref 코덱이 존재하는지 확인.
   */
  hasRef(dimId: string): boolean {
    const dim = this._config.map.dims.find((d) => d.dimId === dimId);
    if (!dim || dim.kind.type !== "index_ref") return false;
    return this._refCodecs.has(dim.kind.indexId);
  }

  // ── Encode (대칭) ─────────────────────────────────────────────────────────

  encode(entities: Record<string, EntityId>): VersionedValueBig {
    return this._codec.encode(entities);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  toDecodeMap(): DecodeMap {
    return this._codec.toDecodeMap();
  }
}
