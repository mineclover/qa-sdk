/**
 * typed-sdk.ts — 제네릭 기반 타입 안전 인덱스 SDK 팩토리.
 *
 * TypeScript 5.0+ `const` 제네릭을 활용하여 스키마 정의 시점에
 * prefix/axis/entry를 리터럴 타입으로 추론한다.
 * 빌드 스텝 없이 LSP 자동완성을 제공한다.
 *
 * @example
 * ```ts
 * const sdk = createIndexSDK({
 *   axes: {
 *     role:   { entries: ["admin", "viewer"] },
 *     action: { entries: ["read", "write", "delete"] },
 *   },
 *   prefixes: {
 *     permission: { dims: ["role", "action"] },
 *   },
 * } as const);
 *
 * sdk.encode("permission", { role: "admin", action: "read" })  // ✓ 자동완성
 * sdk.encode("permission", { role: "nobody", action: "read" }) // ✗ 타입 오류
 * ```
 */

import { WeightedIndex } from "weighted-index";

// ── Schema constraint (validation without widening) ─────────────────────────

export interface AxisDef {
  readonly entries: readonly string[];
  readonly capacity?: number;
}

export interface PrefixDef {
  readonly dims: readonly string[];
}

export interface SdkSchema {
  readonly axes: Record<string, AxisDef>;
  readonly prefixes: Record<string, PrefixDef>;
}

// ── Type-level inference ────────────────────────────────────────────────────

/** 축 키에 대한 엔트리 유니온 추출 */
export type AxisEntries<S extends SdkSchema, K extends string> =
  K extends keyof S["axes"]
    ? S["axes"][K]["entries"][number]
    : string;

/** 모든 prefix 이름 */
export type PrefixNames<S extends SdkSchema> = keyof S["prefixes"] & string;

/** prefix의 차원 라벨 튜플 */
export type PrefixDims<S extends SdkSchema, P extends string> =
  P extends keyof S["prefixes"]
    ? S["prefixes"][P]["dims"]
    : never;

/** prefix 좌표 레코드: { dimLabel: AxisEntries<S, dimLabel> } */
export type PrefixCoord<S extends SdkSchema, P extends string> = {
  [K in PrefixDims<S, P>[number] & string]: AxisEntries<S, K>;
};

// ── Typed SDK interface ─────────────────────────────────────────────────────

export interface TypedIndexSDK<S extends SdkSchema> {
  /**
   * 차원별 의미값 → 1D 정수 주소.
   *
   * @param prefix  prefix 이름 (LSP 자동완성 제공)
   * @param coord   차원별 엔트리 값 (LSP 자동완성 제공)
   */
  encode<P extends PrefixNames<S>>(
    prefix: P,
    coord: PrefixCoord<S, P>,
  ): number;

  /**
   * 1D 정수 주소 → 차원별 의미값.
   *
   * @param prefix   prefix 이름
   * @param address  정수 주소
   */
  decode<P extends PrefixNames<S>>(
    prefix: P,
    address: number,
  ): PrefixCoord<S, P>;
}

// ── 내부: prefix별 런타임 메타데이터 ────────────────────────────────────────

interface PrefixRuntime {
  readonly wi: WeightedIndex;
  readonly dimLabels: readonly string[];
  /** dimLabel → axis key (dims 배열에서 label === axis key) */
  readonly entryToIndex: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly indexToEntry: ReadonlyMap<string, ReadonlyMap<number, string>>;
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * 타입 안전 인덱스 SDK를 생성한다.
 *
 * `const S` 제네릭으로 스키마의 리터럴 타입을 보존하여
 * encode/decode 호출 시 prefix 이름, 차원 라벨, 엔트리 값에 대해
 * LSP 자동완성과 컴파일 타임 검증을 제공한다.
 *
 * 내부적으로 WeightedIndex(mixed-radix)를 사용하여 O(d) encode/decode를 수행한다.
 */
export function createIndexSDK<const S extends SdkSchema>(schema: S): TypedIndexSDK<S> {
  // prefix별 런타임 메타데이터 빌드
  const prefixMap = new Map<string, PrefixRuntime>();

  for (const [prefixId, prefixDef] of Object.entries(schema.prefixes)) {
    const dimLabels = prefixDef.dims;
    const shape: number[] = [];
    const entryToIndex = new Map<string, Map<string, number>>();
    const indexToEntry = new Map<string, Map<number, string>>();

    for (const label of dimLabels) {
      const axisDef = schema.axes[label];
      if (!axisDef) {
        throw new Error(`Prefix "${prefixId}" references unknown axis "${label}"`);
      }

      const cap = axisDef.capacity ?? axisDef.entries.length;
      shape.push(cap);

      // entry string → 1-based index
      const e2i = new Map<string, number>();
      const i2e = new Map<number, string>();
      for (let pos = 0; pos < axisDef.entries.length; pos++) {
        const entry = axisDef.entries[pos];
        e2i.set(entry, pos + 1); // WeightedIndex는 1-based
        i2e.set(pos + 1, entry);
      }
      entryToIndex.set(label, e2i);
      indexToEntry.set(label, i2e);
    }

    const wi = new WeightedIndex(shape, [...dimLabels]);
    prefixMap.set(prefixId, { wi, dimLabels, entryToIndex, indexToEntry });
  }

  return {
    encode<P extends PrefixNames<S>>(
      prefix: P,
      coord: PrefixCoord<S, P>,
    ): number {
      const rt = prefixMap.get(prefix);
      if (!rt) throw new Error(`Unknown prefix: "${prefix}"`);

      const coords: number[] = new Array(rt.dimLabels.length);
      for (let i = 0; i < rt.dimLabels.length; i++) {
        const label = rt.dimLabels[i];
        const value = (coord as Record<string, string>)[label];
        if (value === undefined) {
          throw new Error(`Missing dim "${label}" for prefix "${prefix}"`);
        }
        const e2i = rt.entryToIndex.get(label)!;
        const idx = e2i.get(value);
        if (idx === undefined) {
          throw new Error(
            `Unknown entry "${value}" for axis "${label}". ` +
            `Valid: [${[...e2i.keys()].join(", ")}]`,
          );
        }
        coords[i] = idx;
      }
      return rt.wi.encode(coords);
    },

    decode<P extends PrefixNames<S>>(
      prefix: P,
      address: number,
    ): PrefixCoord<S, P> {
      const rt = prefixMap.get(prefix);
      if (!rt) throw new Error(`Unknown prefix: "${prefix}"`);

      const coords = rt.wi.decode(address);
      const result: Record<string, string> = {};
      for (let i = 0; i < rt.dimLabels.length; i++) {
        const label = rt.dimLabels[i];
        const idx = coords[i];
        const i2e = rt.indexToEntry.get(label)!;
        const entry = i2e.get(idx);
        if (entry === undefined) {
          // headroom 영역 — capacity > entries.length
          result[label] = `(reserved:${idx})`;
        } else {
          result[label] = entry;
        }
      }
      return result as PrefixCoord<S, P>;
    },
  };
}
