/**
 * PrefixDecoder — decode 전용 unified facade
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * MetaCodec(encode/decode)과 AddressProtocolManager(string 파싱/직렬화)를
 * 결합한 경량 facade. 마이크로서비스에서 DecodeMap 번들만 받아
 * number | string 혼합 입력을 자동 처리한다.
 *
 * ── 사용 시나리오 ──────────────────────────────────────────────────────────
 *
 * 1. 서버(MetaResolver)에서 getDecodeMapBundle()로 번들 생성
 * 2. JSON 직렬화 → 네트워크 전송
 * 3. 클라이언트에서 new PrefixDecoder(bundle)로 생성
 * 4. decode(42), decode("perm:v1:42"), decodeDeep(42) 등 사용
 *
 * ── index_ref 1-level 확장 ─────────────────────────────────────────────────
 *
 * decodeDeep()는 config.refs에 포함된 참조 index의 DecodeMap을 사용해
 * index_ref dim을 1-level까지 확장한다.
 * refs에 없는 index_ref는 raw number로 유지된다 (hasRef()로 확인 가능).
 */

import type { DecodeMap, EntityId, VersionedValue } from "./types.js";
import { MetaCodec, validateDecodeMap } from "./meta-codec.js";
import { AddressProtocolManager } from "./address-protocol-manager.js";
import { ValidationError } from "./errors.js";

// ── 공개 타입 ────────────────────────────────────────────────────────────────

export interface PrefixDecoderConfig {
  map: DecodeMap;
  /** indexId → 참조 prefix의 DecodeMap. index_ref dim 확장에 사용. */
  refs?: Record<string, DecodeMap>;
}

/**
 * decodeDeep() 결과.
 *
 * entities: 이 index의 entity record (decode() 결과와 동일).
 * refs: index_ref dim의 1-level 확장 결과.
 *        key = dimId, value = 참조 index의 entity record.
 *        refs에 해당 index 코덱이 없으면 해당 dim은 생략됨.
 */
export interface PrefixDeepDecodeResult {
  entities: Record<string, EntityId>;
  refs: Record<string, Record<string, EntityId>>;
}

// ── PrefixDecoder ────────────────────────────────────────────────────────────

export class PrefixDecoder {
  private readonly _codec: MetaCodec;
  private readonly _config: PrefixDecoderConfig;
  private _apm?: AddressProtocolManager;
  private readonly _refCodecs: Map<string, MetaCodec>;

  constructor(config: PrefixDecoderConfig) {
    validateDecodeMap(config.map);
    this._config = config;
    this._codec = new MetaCodec(config.map);

    // ref 코덱 빌드
    this._refCodecs = new Map();
    if (config.refs) {
      for (const [indexId, refMap] of Object.entries(config.refs)) {
        validateDecodeMap(refMap);
        this._refCodecs.set(indexId, new MetaCodec(refMap));
      }
    }

    // address config 있으면 즉시 APM 생성
    if (config.map.address) {
      this._apm = new AddressProtocolManager(config.map.address);
    }
  }

  // ── Identity (MetaCodec 위임) ─────────────────────────────────────────────

  get indexId(): string { return this._codec.indexId; }
  get versionId(): string { return this._codec.versionId; }
  get size(): number { return this._codec.size; }
  get shape(): readonly number[] { return this._codec.shape; }
  get strides(): readonly number[] { return this._codec.strides; }
  get dimIds(): readonly string[] { return this._codec.dimIds; }

  // ── Format detection ───────────────────────────────────────────────────────

  /**
   * 입력 문자열의 프로토콜을 감지해 이름을 반환한다.
   *
   * @example
   * decoder.detect("perm:v1:42")      // → "colon"
   * decoder.detect("wi://perm/v1/42") // → "uri"
   * decoder.detect("???")             // → null
   */
  detect(input: string): string | null {
    return this._ensureApm().detect(input);
  }

  // ── L1 Address: input → VersionedValue ────────────────────────────────────

  /**
   * number | string → VersionedValue.
   *
   * - number: 직접 VersionedValue 구성
   * - string: APM auto-detect 파싱 (colon/URI/UUID/compact)
   */
  resolve(input: number | string): VersionedValue {
    if (typeof input === "number") {
      return {
        indexId: this._codec.indexId,
        versionId: this._codec.versionId,
        value: input,
      };
    }
    return this._ensureApm().parse(input);
  }

  // ── L2 Info: input → entity record ────────────────────────────────────────

  /**
   * number | string → entity ID record.
   *
   * @example
   * decoder.decode(42)
   * decoder.decode("perm:v1:42")
   * // → { role: "admin", action: "read", resource: 10 }
   */
  decode(input: number | string): Readonly<Record<string, EntityId>> {
    if (typeof input === "number") {
      return this._codec.decodeValue(input);
    }
    const vv = this.resolve(input);
    return this._codec.decode(vv);
  }

  // ── L2+ Deep: index_ref dim을 1-level 확장 ────────────────────────────────

  /**
   * decode() + index_ref dim의 1-level 확장.
   *
   * refs에 해당 index 코덱이 있으면 확장, 없으면 raw number 유지.
   *
   * @example
   * decoder.decodeDeep(42)
   * // → {
   * //     entities: { role: "admin", perm_svc: 42 },
   * //     refs: { perm_svc: { env: "prod", region: "asia", ... } }
   * //   }
   */
  decodeDeep(input: number | string): PrefixDeepDecodeResult {
    const entities = { ...this.decode(input) };
    const refs: Record<string, Record<string, EntityId>> = {};

    for (const dim of this._config.map.dims) {
      if (dim.kind.type === "index_ref") {
        const refCodec = this._refCodecs.get(dim.kind.indexId);
        if (refCodec) {
          const refValue = entities[dim.dimId];
          if (typeof refValue === "number") {
            refs[dim.dimId] = { ...refCodec.decodeValue(refValue) };
          }
        }
      }
    }

    return { entities, refs };
  }

  // ── Batch ─────────────────────────────────────────────────────────────────

  /**
   * 다수의 number | string 입력을 한 번에 decode.
   */
  decodeBatch(inputs: readonly (number | string)[]): Readonly<Record<string, EntityId>>[] {
    return inputs.map((input) => this.decode(input));
  }

  // ── Query (MetaCodec 위임) ────────────────────────────────────────────────

  matchRanges(partial: Record<string, EntityId | null>): [number, number][] {
    return this._codec.matchRanges(partial);
  }

  enumerate(partial: Record<string, EntityId | null>): number[] {
    return this._codec.enumerate(partial);
  }

  // ── Ref ───────────────────────────────────────────────────────────────────

  /**
   * index_ref dim의 참조값을 ref 코덱으로 해석.
   *
   * @param value 이 코덱의 주소 공간에서의 value
   * @param dimId 해석할 index_ref dim의 ID
   */
  resolveRef(value: number, dimId: string): Readonly<Record<string, EntityId>> {
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
    return refCodec.decodeValue(refValue);
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

  encode(entities: Record<string, EntityId>): VersionedValue {
    return this._codec.encode(entities);
  }

  // ── Serialize (APM 위임) ──────────────────────────────────────────────────

  /**
   * VersionedValue → 프로토콜 문자열.
   */
  serialize(vv: VersionedValue, protocol?: string): string {
    return this._ensureApm().serialize(vv, protocol);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  toDecodeMap(): DecodeMap {
    return this._codec.toDecodeMap();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /** Lazy APM 초기화. address config 없으면 기본(colon/URI/compact만) APM 생성. */
  private _ensureApm(): AddressProtocolManager {
    if (!this._apm) {
      this._apm = new AddressProtocolManager();
    }
    return this._apm;
  }
}
