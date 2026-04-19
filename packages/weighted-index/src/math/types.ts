// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * math/types.ts — 수학 레이어 공유 타입.
 *
 * weighted-index, weighted-wasm, weighted-gpu가 공유하는
 * 좌표계 타입과 배치 연산 인터페이스를 정의한다.
 *
 * ── 좌표 규약 ──────────────────────────────────────────────────────────────
 *   Shape:   각 차원의 크기 (가능한 값의 수). 모든 원소 ≥ 1.
 *   Coord:   1-based 좌표. coord[i] ∈ [1, shape[i]].
 *   Strides: stride[i] = Π_{j>i} shape[j]. 마지막 차원은 항상 1.
 *   Address: 0-based 정수. address ∈ [0, Π shape[i] - 1].
 *
 * ── 인코딩 공식 ────────────────────────────────────────────────────────────
 *   encode: address = Σ (coord[i] - 1) × strides[i]
 *   decode: coord[i] = ⌊address / strides[i]⌋ % shape[i] + 1
 */

/** 각 차원의 크기. 모든 원소 ≥ 1. */
export type Shape = readonly number[];

/** 1-based 좌표 배열. coord[i] ∈ [1, shape[i]]. */
export type Coord = readonly number[];

/** stride 배열. strides[i] = Π_{j>i} shape[j]. */
export type Strides = readonly number[];

/**
 * 동기 배치 인코더/디코더 인터페이스.
 *
 * weighted-index (JS), weighted-wasm (Rust/WASM)이 구현한다.
 * 입력/출력 규약은 좌표 규약을 따른다.
 */
export interface BatchEncoder {
  encodeBatch(coords: readonly Coord[]): Uint32Array;
  decodeBatch(addrs: Uint32Array): number[][];
}

/**
 * 비동기 배치 인코더/디코더 인터페이스.
 *
 * weighted-gpu (WebGPU)가 구현한다.
 * GPU dispatch → readback 사이클이 비동기이므로 Promise를 반환.
 */
export interface AsyncBatchEncoder {
  encodeBatch(coords: readonly Coord[]): Promise<Uint32Array>;
  decodeBatch(addrs: Uint32Array): Promise<number[][]>;
}

/**
 * Float64Array 기반 zero-copy 배치 인코더/디코더 인터페이스.
 *
 * coords는 row-major 패킹: [coord0_dim0, coord0_dim1, ..., coord1_dim0, ...]
 */
export interface FlatBatchEncoder {
  encodeBatchFlat(coordsBuf: Float64Array, itemCount: number): Float64Array;
  decodeBatchFlat(addrsBuf: Float64Array, itemCount: number): Float64Array;
}
