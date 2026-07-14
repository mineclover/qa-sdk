/**
 * weighted-wasm JS 래퍼.
 *
 * WASM 모듈을 로드하고 weighted-index 호환 인터페이스를 제공한다.
 * WASM 미사용 시 JS fallback으로 동작.
 */

type WasmModule = typeof import('../pkg/weighted_wasm.js');

// wasm-pack 빌드 산출물 (pkg/ 디렉토리)
let wasm: WasmModule | null = null;

function isNodeRuntime(): boolean {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } };
  };
  return typeof maybeProcess.process?.versions?.node === 'string';
}

async function getNodeWasmBytes(): Promise<Uint8Array | undefined> {
  if (!isNodeRuntime()) {
    return undefined;
  }

  const { readFile } = await import('node:fs/promises');
  return readFile(new URL('../pkg/weighted_wasm_bg.wasm', import.meta.url));
}

/**
 * WASM 모듈 초기화.
 * wasm-pack 빌드 후 pkg/weighted_wasm.js를 동적 import.
 */
export async function initWasm(): Promise<boolean> {
  if (wasm) {
    return true;
  }

  try {
    const wasmModule = await import('../pkg/weighted_wasm.js');
    const moduleOrPath = await getNodeWasmBytes();

    if (typeof wasmModule.default !== 'function') {
      throw new TypeError('weighted-wasm init export is missing');
    }

    if (moduleOrPath) {
      await wasmModule.default({ module_or_path: moduleOrPath });
    } else {
      await wasmModule.default();
    }

    wasm = wasmModule;
    return true;
  } catch {
    wasm = null;
    return false;
  }
}

/** WASM 모듈 로드 여부. */
export function isWasmAvailable(): boolean {
  return wasm !== null;
}

// ── Batch Encode / Decode ─────────────────────────────────────────────────

/**
 * 배치 인코딩.
 *
 * @param strides — WeightedIndex.strides (readonly number[])
 * @param coordsBatch — N × d 좌표 배열 (각 1-based)
 * @returns N개의 주소 배열 (0-based)
 */
export function encodeBatch(
  strides: readonly number[],
  coordsBatch: readonly (readonly number[])[],
): Uint32Array {
  const dims = strides.length;
  const n = coordsBatch.length;

  if (wasm) {
    // flatten coords
    const flat = new Uint32Array(n * dims);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < dims; j++) {
        flat[i * dims + j] = coordsBatch[i][j];
      }
    }
    const result = wasm.encodeBatch(new Uint32Array(strides), flat, dims, n);
    return new Uint32Array(result);
  }

  // JS fallback
  const result = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let addr = 0;
    for (let j = 0; j < dims; j++) {
      addr += (coordsBatch[i][j] - 1) * strides[j];
    }
    result[i] = addr;
  }
  return result;
}

/**
 * 배치 디코딩.
 *
 * @param strides — WeightedIndex.strides
 * @param shape — WeightedIndex.shape
 * @param addrs — 주소 배열 (0-based)
 * @returns N × d 좌표 배열 (각 1-based)
 */
export function decodeBatch(
  strides: readonly number[],
  shape: readonly number[],
  addrs: Uint32Array,
): number[][] {
  const dims = strides.length;
  const n = addrs.length;

  if (wasm) {
    const flat: Uint32Array = wasm.decodeBatch(
      new Uint32Array(strides),
      new Uint32Array(shape),
      addrs,
      dims,
    );
    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      result.push(Array.from(flat.subarray(i * dims, (i + 1) * dims)));
    }
    return result;
  }

  // JS fallback
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const coords: number[] = [];
    let rem = addrs[i];
    for (let j = 0; j < dims; j++) {
      const c = Math.floor(rem / strides[j]);
      rem %= strides[j];
      coords.push((c % shape[j]) + 1);
    }
    result.push(coords);
  }
  return result;
}

// ── Bitmask Operations ──────────────────────────────────────────────────

/**
 * Population count.
 * WASM 사용 시 u64 단위 count_ones로 8~16× 빠름.
 */
export function popcountWasm(mask: Uint8Array): number {
  if (wasm) return wasm.popcountWasm(mask);

  // JS fallback (byte-by-byte)
  let n = 0;
  for (const byte of mask) {
    let b = byte;
    while (b) {
      n += b & 1;
      b >>>= 1;
    }
  }
  return n;
}

/** Bitwise AND. */
export function maskAndWasm(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (wasm) return new Uint8Array(wasm.maskAndWasm(a, b));

  const len = Math.min(a.length, b.length);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = a[i] & b[i];
  return out;
}

/** Bitwise OR. */
export function maskOrWasm(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (wasm) return new Uint8Array(wasm.maskOrWasm(a, b));

  const len = Math.min(a.length, b.length);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = a[i] | b[i];
  return out;
}

/** Overlap check. */
export function masksOverlapWasm(a: Uint8Array, b: Uint8Array): boolean {
  if (wasm) return wasm.masksOverlapWasm(a, b);

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] & b[i]) return true;
  }
  return false;
}
