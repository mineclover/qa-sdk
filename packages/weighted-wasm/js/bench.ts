/**
 * G-5: JS vs WASM 실측 벤치마크.
 *
 * batch 1K / 10K / 100K 기준 JS fallback vs WASM 성능 비교.
 *
 * 실행: npx tsx packages/weighted-wasm/js/bench.ts
 *
 * WASM 빌드 필요: cd packages/weighted-wasm && pnpm build:wasm
 * WASM 미빌드 시 JS fallback만 측정.
 */

import {
  initWasm,
  isWasmAvailable,
  encodeBatch,
  decodeBatch,
  popcountWasm,
  maskAndWasm,
} from "./index.js";

// ── 테스트 데이터 생성 ─────────────────────────────────────────────

function generateCoords(n: number, dims: number, shape: readonly number[]): (readonly number[])[] {
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const coords: number[] = [];
    for (let d = 0; d < dims; d++) {
      coords.push(1 + (i % shape[d]));
    }
    result.push(coords);
  }
  return result;
}

function generateMask(byteLen: number): Uint8Array {
  const mask = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) mask[i] = Math.floor(Math.random() * 256);
  return mask;
}

// ── 벤치마크 유틸 ──────────────────────────────────────────────────

function bench(label: string, fn: () => void, iterations: number): { opsPerSec: number; avgNs: number } {
  // 워밍업
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / iterations;
  const avgNs = avgMs * 1_000_000;
  const opsPerSec = Math.round(1000 / avgMs);

  console.log(`  ${label}: ${formatOps(opsPerSec)} ops/s (${formatNs(avgNs)}/op)`);
  return { opsPerSec, avgNs };
}

function formatOps(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function formatNs(ns: number): string {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)}ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(1)}μs`;
  return `${ns.toFixed(0)}ns`;
}

// ── 메인 ───────────────────────────────────────────────────────────

async function main() {
  console.log("=== G-5: JS vs WASM 벤치마크 ===\n");

  // 4D shape: [10, 7, 5, 2] = 700 주소 공간
  const shape4D = [10, 7, 5, 2] as const;
  const strides4D = [70, 10, 2, 1]; // pre-computed
  const dims4D = 4;

  // 8D shape: [8, 6, 5, 4, 3, 3, 2, 2] = 172,800 주소 공간
  const shape8D = [8, 6, 5, 4, 3, 3, 2, 2] as const;
  const strides8D = [21600, 3600, 720, 180, 60, 20, 10, 5]; // 대략적
  const dims8D = 8;

  const batches = [1_000, 10_000, 100_000];

  // WASM 초기화 시도
  const wasmReady = await initWasm();
  console.log(`WASM: ${wasmReady ? "로드 완료" : "미사용 (JS fallback만 측정)"}\n`);

  // ── encodeBatch ───────────────────────────────────────────────────

  console.log("── encodeBatch (4D, shape=[10,7,5,2]) ──");
  for (const n of batches) {
    const coords = generateCoords(n, dims4D, shape4D);
    const iters = Math.max(10, Math.floor(10_000 / n));

    if (!wasmReady) {
      bench(`JS  ${n.toLocaleString().padStart(7)}`, () => encodeBatch(strides4D, coords), iters);
    } else {
      // WASM 모드 (initWasm 후에는 WASM 경로 사용)
      bench(`WASM ${n.toLocaleString().padStart(7)}`, () => encodeBatch(strides4D, coords), iters);
    }
  }

  console.log("\n── encodeBatch (8D, shape=[8,6,5,4,3,3,2,2]) ──");
  for (const n of batches) {
    const coords = generateCoords(n, dims8D, shape8D);
    const iters = Math.max(10, Math.floor(5_000 / n));

    if (!wasmReady) {
      bench(`JS  ${n.toLocaleString().padStart(7)}`, () => encodeBatch(strides8D, coords), iters);
    } else {
      bench(`WASM ${n.toLocaleString().padStart(7)}`, () => encodeBatch(strides8D, coords), iters);
    }
  }

  // ── decodeBatch ───────────────────────────────────────────────────

  console.log("\n── decodeBatch (4D) ──");
  for (const n of batches) {
    const addrs = new Uint32Array(n);
    for (let i = 0; i < n; i++) addrs[i] = i % 700;
    const iters = Math.max(10, Math.floor(10_000 / n));

    const label = wasmReady ? "WASM" : "JS  ";
    bench(`${label} ${n.toLocaleString().padStart(7)}`, () => decodeBatch(strides4D, [...shape4D], addrs), iters);
  }

  // ── bitmask popcount ──────────────────────────────────────────────

  console.log("\n── popcount (1KB / 10KB / 100KB mask) ──");
  for (const kb of [1, 10, 100]) {
    const mask = generateMask(kb * 1024);
    const iters = Math.max(100, Math.floor(100_000 / kb));

    const label = wasmReady ? "WASM" : "JS  ";
    bench(`${label} ${String(kb).padStart(3)}KB`, () => popcountWasm(mask), iters);
  }

  // ── bitmask AND ───────────────────────────────────────────────────

  console.log("\n── maskAnd (1KB / 10KB / 100KB mask) ──");
  for (const kb of [1, 10, 100]) {
    const a = generateMask(kb * 1024);
    const b = generateMask(kb * 1024);
    const iters = Math.max(100, Math.floor(100_000 / kb));

    const label = wasmReady ? "WASM" : "JS  ";
    bench(`${label} ${String(kb).padStart(3)}KB`, () => maskAndWasm(a, b), iters);
  }

  console.log("\n=== 완료 ===");
}

main().catch(console.error);
