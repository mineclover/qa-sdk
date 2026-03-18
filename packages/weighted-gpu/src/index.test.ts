import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { GPUEncoder } from "./index";

describe("GPUEncoder fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false from isAvailable when WebGPU is unavailable", async () => {
    vi.stubGlobal("navigator", undefined);
    await expect(GPUEncoder.isAvailable()).resolves.toBe(false);

    vi.stubGlobal("navigator", {});
    await expect(GPUEncoder.isAvailable()).resolves.toBe(false);
  });

  it("returns null from create when WebGPU is unavailable", async () => {
    vi.stubGlobal("navigator", undefined);
    await expect(GPUEncoder.create([10, 7, 2])).resolves.toBeNull();

    vi.stubGlobal("navigator", {});
    await expect(GPUEncoder.create([10, 7, 2])).resolves.toBeNull();
  });

  it("exposes the documented instance API contract", () => {
    expect(typeof GPUEncoder.prototype.encodeBatch).toBe("function");
    expect(typeof GPUEncoder.prototype.decodeBatch).toBe("function");
    expect(typeof GPUEncoder.prototype.reduceByKey).toBe("function");
    expect(typeof GPUEncoder.prototype.destroy).toBe("function");

    expectTypeOf<Pick<GPUEncoder, "encodeBatch" | "decodeBatch" | "reduceByKey" | "destroy">>().toEqualTypeOf<{
      encodeBatch(coordsBatch: readonly (readonly number[])[]): Promise<Uint32Array>;
      decodeBatch(addrs: Uint32Array): Promise<number[][]>;
      reduceByKey(keys: Uint32Array, maxKey: number): Promise<Map<number, number>>;
      destroy(): void;
    }>();
  });
});
