import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WeightedIndex } from '../../weighted-index/dist/index.js';

const publicExports = [
  'decodeBatch',
  'encodeBatch',
  'initWasm',
  'isWasmAvailable',
  'maskAndWasm',
  'maskOrWasm',
  'masksOverlapWasm',
  'popcountWasm',
] as const;

const shape = [3, 4, 2] as const;
const coordsBatch = [
  [1, 1, 1],
  [1, 1, 2],
  [1, 2, 1],
  [1, 4, 2],
  [2, 1, 1],
  [2, 3, 2],
  [3, 1, 1],
  [3, 2, 2],
  [3, 4, 1],
  [3, 4, 2],
] as const satisfies readonly (readonly number[])[];

const weightedIndex = new WeightedIndex([...shape]);
const expectedAddrs = coordsBatch.map((coords) => weightedIndex.encode([...coords]));
const expectedDecoded = expectedAddrs.map((addr) => weightedIndex.decode(addr));

async function loadWrapper(options?: { mockMissingWasm?: boolean }) {
  vi.resetModules();

  if (options?.mockMissingWasm) {
    vi.doMock('../pkg/weighted_wasm.js', () => {
      throw new Error('missing wasm artifact');
    });
  } else {
    vi.doUnmock('../pkg/weighted_wasm.js');
  }

  return import('./index.ts');
}

async function loadInitializedWrapper() {
  const wrapper = await loadWrapper();
  expect(await wrapper.initWasm()).toBe(true);
  expect(wrapper.isWasmAvailable()).toBe(true);
  return wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../pkg/weighted_wasm.js');
});

describe('weighted-wasm JS wrapper', () => {
  it('confirms the wasm build artifact is present', () => {
    const wasmPath = new URL('../pkg/weighted_wasm_bg.wasm', import.meta.url);
    expect(existsSync(wasmPath)).toBe(true);
  });

  it('exports the full public JS wrapper surface', async () => {
    const wrapper = await loadWrapper();
    const wrapperRecord = wrapper as Record<string, unknown>;

    expect(Object.keys(wrapperRecord).toSorted()).toEqual([...publicExports].toSorted());

    for (const exportName of publicExports) {
      expect(typeof wrapperRecord[exportName]).toBe('function');
    }
  });

  it('initializes the wasm module and binds callable exports', async () => {
    const wrapper = await loadInitializedWrapper();

    expect(Array.from(wrapper.maskAndWasm(Uint8Array.of(0xff), Uint8Array.of(0x0f)))).toEqual([
      0x0f,
    ]);
    expect(wrapper.popcountWasm(Uint8Array.of(0xff))).toBe(8);
  });

  it('falls back to JS implementations when wasm initialization fails', async () => {
    const wrapper = await loadWrapper({ mockMissingWasm: true });

    expect(await wrapper.initWasm()).toBe(false);
    expect(wrapper.isWasmAvailable()).toBe(false);
    expect(Array.from(wrapper.encodeBatch(weightedIndex.strides, coordsBatch))).toEqual(
      expectedAddrs,
    );
    expect(wrapper.popcountWasm(Uint8Array.of(0xaa, 0xff))).toBe(12);
  });

  it('encodeBatch matches WeightedIndex.encode for a 10-row batch', async () => {
    const wrapper = await loadInitializedWrapper();

    const encoded = wrapper.encodeBatch(weightedIndex.strides, coordsBatch);

    expect(Array.from(encoded)).toEqual(expectedAddrs);
  });

  it('decodeBatch matches WeightedIndex.decode for a 10-row batch', async () => {
    const wrapper = await loadInitializedWrapper();

    const decoded = wrapper.decodeBatch(
      weightedIndex.strides,
      weightedIndex.shape,
      Uint32Array.from(expectedAddrs),
    );

    expect(decoded).toEqual(expectedDecoded);
  });

  it('popcountWasm counts known bit patterns', async () => {
    const wrapper = await loadInitializedWrapper();
    const cases = [
      { mask: Uint8Array.of(0x00), expected: 0 },
      { mask: Uint8Array.of(0xff), expected: 8 },
      { mask: Uint8Array.of(0xaa), expected: 4 },
      { mask: Uint8Array.of(0x55), expected: 4 },
      { mask: Uint8Array.of(0x0f, 0xf0), expected: 8 },
    ];

    for (const { mask, expected } of cases) {
      expect(wrapper.popcountWasm(mask)).toBe(expected);
    }
  });

  it('maskAndWasm and maskOrWasm apply bitwise operations correctly', async () => {
    const wrapper = await loadInitializedWrapper();
    const a = Uint8Array.from([0x00, 0xff, 0xaa, 0x0f]);
    const b = Uint8Array.from([0xff, 0x0f, 0x55, 0xf0]);

    expect(Array.from(wrapper.maskAndWasm(a, b))).toEqual([0x00, 0x0f, 0x00, 0x00]);
    expect(Array.from(wrapper.maskOrWasm(a, b))).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('masksOverlapWasm detects overlapping and disjoint masks', async () => {
    const wrapper = await loadInitializedWrapper();

    expect(
      wrapper.masksOverlapWasm(Uint8Array.from([0xf0, 0x00]), Uint8Array.from([0x10, 0x00])),
    ).toBe(true);

    expect(
      wrapper.masksOverlapWasm(Uint8Array.from([0xf0, 0x00]), Uint8Array.from([0x0f, 0xff])),
    ).toBe(false);
  });
});
