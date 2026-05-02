import { createInstrumentedHarness } from "./harness.js";
import type { BenchmarkBridge, BenchmarkHarness } from "./types.js";

export function createBridgeBenchmarkHarness(bridge: BenchmarkBridge): BenchmarkHarness {
  return createInstrumentedHarness(bridge, { bridge });
}
