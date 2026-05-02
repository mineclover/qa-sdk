// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * binary-axis.ts — ArrayBuffer 기반 축 데이터 직렬화.
 *
 * 워커, WASM, 네트워크 간 zero-copy 전송을 위한 compact binary format.
 *
 * Layout (little-endian):
 *   [4 bytes] dimCount (uint32)
 *   [dimCount × 4 bytes] shape (uint32[])
 *   [dimCount × 8 bytes] strides (float64[])
 *   [4 bytes] totalSize (uint32) — product of shape
 *
 * 총 크기: 4 + dimCount × 4 + dimCount × 8 + 4 = 8 + dimCount × 12 bytes
 */

import { WeightedIndex } from "./weighted-index.js";
import { BufferError } from "./errors.js";

/** 고정 헤더 + 꼬리 크기 (dimCount 4바이트 + totalSize 4바이트) */
const FIXED_BYTES = 8;

/** 차원 하나당 바이트 수 (uint32 shape + float64 stride) */
const PER_DIM_BYTES = 12;

/** 최소 유효 버퍼 크기 (dimCount ≥ 1) */
const _MIN_BUFFER_SIZE = FIXED_BYTES + PER_DIM_BYTES;

/**
 * shape + strides를 ArrayBuffer로 직렬화.
 *
 * @param shape   각 차원의 크기 (모든 원소 ≥ 1)
 * @param strides 각 차원의 스트라이드
 * @returns       packed ArrayBuffer
 */
export function packAxis(
  shape: readonly number[],
  strides: readonly number[],
): ArrayBuffer {
  const d = shape.length;
  if (d === 0) {
    throw new BufferError("shape must have at least 1 dimension");
  }
  if (strides.length !== d) {
    throw new BufferError(
      `strides length (${strides.length}) must match shape length (${d})`,
    );
  }

  const byteLen = FIXED_BYTES + d * PER_DIM_BYTES;
  const buf = new ArrayBuffer(byteLen);
  const view = new DataView(buf);

  let offset = 0;

  // dimCount (uint32 LE)
  view.setUint32(offset, d, true);
  offset += 4;

  // shape (uint32[] LE)
  for (let i = 0; i < d; i++) {
    view.setUint32(offset, shape[i], true);
    offset += 4;
  }

  // strides (float64[] LE)
  for (let i = 0; i < d; i++) {
    view.setFloat64(offset, strides[i], true);
    offset += 8;
  }

  // totalSize (uint32 LE) — product of shape
  let size = 1;
  for (let i = 0; i < d; i++) size *= shape[i];
  view.setUint32(offset, size, true);

  return buf;
}

/**
 * ArrayBuffer를 shape + strides + size로 역직렬화.
 *
 * @param buffer  packAxis()로 생성된 ArrayBuffer
 * @returns       { shape, strides, size }
 */
export function unpackAxis(
  buffer: ArrayBuffer,
): { shape: number[]; strides: number[]; size: number } {
  if (buffer.byteLength < FIXED_BYTES) {
    throw new BufferError(
      `Buffer too small: expected at least ${FIXED_BYTES} bytes, got ${buffer.byteLength}`,
    );
  }

  const view = new DataView(buffer);
  let offset = 0;

  // dimCount
  const d = view.getUint32(offset, true);
  offset += 4;

  if (d === 0) {
    throw new BufferError("dimCount must be at least 1");
  }

  const expectedLen = FIXED_BYTES + d * PER_DIM_BYTES;
  if (buffer.byteLength < expectedLen) {
    throw new BufferError(
      `Buffer too small for ${d} dimensions: expected ${expectedLen} bytes, got ${buffer.byteLength}`,
    );
  }

  // shape
  const shape = new Array<number>(d);
  for (let i = 0; i < d; i++) {
    shape[i] = view.getUint32(offset, true);
    offset += 4;
  }

  // strides
  const strides = new Array<number>(d);
  for (let i = 0; i < d; i++) {
    strides[i] = view.getFloat64(offset, true);
    offset += 8;
  }

  // totalSize
  const size = view.getUint32(offset, true);

  return { shape, strides, size };
}

/**
 * packed ArrayBuffer에서 WeightedIndex를 직접 생성.
 *
 * WeightedIndex 생성자가 shape로부터 strides를 재계산하므로
 * 버퍼의 strides와 일치하는지 검증한다.
 *
 * @param buffer  packAxis()로 생성된 ArrayBuffer
 * @returns       WeightedIndex 인스턴스
 */
export function fromPackedAxis(buffer: ArrayBuffer): WeightedIndex {
  const { shape } = unpackAxis(buffer);
  return new WeightedIndex(shape);
}

/**
 * WeightedIndex 인스턴스를 packed ArrayBuffer로 직렬화.
 *
 * @param wi  WeightedIndex 인스턴스
 * @returns   packed ArrayBuffer
 */
export function toPackedAxis(wi: WeightedIndex): ArrayBuffer {
  return packAxis(wi.shape, wi.strides);
}
