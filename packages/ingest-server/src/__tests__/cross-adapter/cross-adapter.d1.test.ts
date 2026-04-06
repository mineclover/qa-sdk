import { describe } from "vitest";
import { recordStoreTests } from "./shared/record-store.shared.js";
import { traceStoreTests } from "./shared/trace-store.shared.js";
import { keyObservationStoreTests } from "./shared/key-observation-store.shared.js";
import { createD1RecordStore, createD1TraceStore, createD1KeyObservationStore } from "./factories/d1.factory.js";

describe("Cross-Adapter D1", () => {
  describe("RecordStore", () => recordStoreTests(async () => createD1RecordStore()));
  describe("TraceStore", () => traceStoreTests(async () => createD1TraceStore()));
  describe("KeyObservationStore", () => keyObservationStoreTests(async () => createD1KeyObservationStore()));
});
