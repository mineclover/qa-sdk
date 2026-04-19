// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * G-6: GPU vs CPU 실측 벤치마크.
 *
 * batch 10K / 100K 기준 WebGPU vs CPU 비교 (브라우저 환경).
 *
 * 이 파일은 브라우저에서 실행해야 합니다.
 * 실행 방법:
 *   1. HTML 파일에서 <script type="module" src="bench.ts"> 로 import
 *   2. 또는 vite 등 dev server로 serve 후 브라우저에서 접속
 *
 * Node.js에서는 GPU 미지원으로 CPU 결과만 출력합니다.
 */

import { GPUEncoder } from "./index.js";

// ── CPU 기준 구현 (JS pure) ────────────────────────────────────────

function cpuEncodeBatch(
  strides: readonly number[],
  coordsBatch: readonly (readonly number[])[],
): Uint32Array {
  const n = coordsBatch.length;
  const dims = strides.length;
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

function cpuDecodeBatch(
  strides: readonly number[],
  shape: readonly number[],
  addrs: Uint32Array,
): number[][] {
  const n = addrs.length;
  const dims = strides.length;
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

function cpuReduce(keys: Uint32Array): Map<number, number> {
  const m = new Map<number, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

// ── 벤치마크 유틸 ──────────────────────────────────────────────────

function generateCoords(n: number, dims: number, shape: readonly number[]): (readonly number[])[] {
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const coords: number[] = [];
    for (let d = 0; d < dims; d++) coords.push(1 + (i % shape[d]));
    result.push(coords);
  }
  return result;
}

interface BenchResult {
  label: string;
  batchSize: number;
  opsPerSec: number;
  avgMs: number;
}

function bench(label: string, fn: () => void, iterations: number): BenchResult {
  // 워밍업
  for (let i = 0; i < Math.min(10, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, batchSize: 0, opsPerSec, avgMs };
}

async function benchAsync(label: string, fn: () => Promise<void>, iterations: number): Promise<BenchResult> {
  // 워밍업
  for (let i = 0; i < Math.min(3, iterations); i++) await fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, batchSize: 0, opsPerSec, avgMs };
}

// ── 메인 ───────────────────────────────────────────────────────────

export async function runBenchmark(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  console.log("=== G-6: GPU vs CPU 벤치마크 ===\n");

  // 4D shape
  const shape = [10, 7, 5, 2];
  const strides = [70, 10, 2, 1];
  const batches = [10_000, 100_000];

  // GPU 초기화 시도
  const gpu = await GPUEncoder.create(shape);
  console.log(`GPU: ${gpu ? "WebGPU 사용 가능" : "미지원 (CPU만 측정)"}\n`);

  for (const n of batches) {
    const coords = generateCoords(n, 4, shape);
    const flatCoords = new Uint32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 4; j++) flatCoords[i * 4 + j] = coords[i][j];
    }

    const iters = Math.max(5, Math.floor(1000 / Math.sqrt(n)));

    console.log(`── encodeBatch (n=${n.toLocaleString()}) ──`);

    // CPU
    const cpuEnc = bench(`CPU encode`, () => cpuEncodeBatch(strides, coords), iters);
    cpuEnc.batchSize = n;
    results.push(cpuEnc);
    console.log(`  CPU: ${cpuEnc.avgMs.toFixed(3)}ms (${cpuEnc.opsPerSec} ops/s)`);

    // GPU
    if (gpu) {
      const gpuEnc = await benchAsync(`GPU encode`, () => gpu.encodeBatch(flatCoords), iters);
      gpuEnc.batchSize = n;
      results.push(gpuEnc);
      console.log(`  GPU: ${gpuEnc.avgMs.toFixed(3)}ms (${gpuEnc.opsPerSec} ops/s)`);
      console.log(`  GPU/CPU: ${(cpuEnc.avgMs / gpuEnc.avgMs).toFixed(2)}×`);
    }

    // Decode
    console.log(`── decodeBatch (n=${n.toLocaleString()}) ──`);
    const addrs = new Uint32Array(n);
    for (let i = 0; i < n; i++) addrs[i] = i % 700;

    const cpuDec = bench(`CPU decode`, () => cpuDecodeBatch(strides, shape, addrs), iters);
    cpuDec.batchSize = n;
    results.push(cpuDec);
    console.log(`  CPU: ${cpuDec.avgMs.toFixed(3)}ms (${cpuDec.opsPerSec} ops/s)`);

    if (gpu) {
      const gpuDec = await benchAsync(`GPU decode`, () => gpu.decodeBatch(addrs), iters);
      gpuDec.batchSize = n;
      results.push(gpuDec);
      console.log(`  GPU: ${gpuDec.avgMs.toFixed(3)}ms (${gpuDec.opsPerSec} ops/s)`);
      console.log(`  GPU/CPU: ${(cpuDec.avgMs / gpuDec.avgMs).toFixed(2)}×`);
    }

    // Reduce (group-by)
    console.log(`── reduce (n=${n.toLocaleString()}) ──`);
    const keys = new Uint32Array(n);
    for (let i = 0; i < n; i++) keys[i] = i % 100;

    const cpuRed = bench(`CPU reduce`, () => cpuReduce(keys), iters);
    cpuRed.batchSize = n;
    results.push(cpuRed);
    console.log(`  CPU: ${cpuRed.avgMs.toFixed(3)}ms (${cpuRed.opsPerSec} ops/s)`);

    if (gpu) {
      const gpuRed = await benchAsync(`GPU reduce`, () => gpu.reduce(keys, 100), iters);
      gpuRed.batchSize = n;
      results.push(gpuRed);
      console.log(`  GPU: ${gpuRed.avgMs.toFixed(3)}ms (${gpuRed.opsPerSec} ops/s)`);
      console.log(`  GPU/CPU: ${(cpuRed.avgMs / gpuRed.avgMs).toFixed(2)}×`);
    }

    console.log("");
  }

  if (gpu) gpu.destroy();

  console.log("=== 완료 ===");
  return results;
}

// 브라우저에서 직접 실행 시
if (typeof window !== "undefined") {
  void runBenchmark();
}
