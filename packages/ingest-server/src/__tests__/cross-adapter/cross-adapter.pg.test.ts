import { afterAll, describe } from "vitest";
import { recordStoreTests } from "./shared/record-store.shared.js";
import { traceStoreTests } from "./shared/trace-store.shared.js";
import { keyObservationStoreTests } from "./shared/key-observation-store.shared.js";
import { createPgRecordStore, createPgTraceStore, createPgKeyObservationStore, hasPgUrl, closePgConnection } from "./factories/pg.factory.js";

const describePg = hasPgUrl() ? describe : describe.skip;

describePg("Cross-Adapter PG", () => {
  afterAll(async () => closePgConnection());

  describe("RecordStore", () => recordStoreTests(createPgRecordStore));
  describe("TraceStore", () => traceStoreTests(createPgTraceStore));
  describe("KeyObservationStore", () => keyObservationStoreTests(createPgKeyObservationStore));
});
