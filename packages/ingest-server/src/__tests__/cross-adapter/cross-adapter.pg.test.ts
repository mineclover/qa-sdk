import { afterAll, describe } from "vitest";
import { recordStoreTests } from "./shared/record-store.shared.js";
import { traceStoreTests } from "./shared/trace-store.shared.js";
import { keyObservationStoreTests } from "./shared/key-observation-store.shared.js";
import { sessionStoreTests } from "./shared/session-store.shared.js";
import { verdictStoreTests } from "./shared/verdict-store.shared.js";
import { graphStoreTests } from "./shared/graph-store.shared.js";
import { scenarioSpecStoreTests } from "./shared/scenario-spec-store.shared.js";
import { transmissionStoreTests } from "./shared/transmission-store.shared.js";
import { dlqStoreTests } from "./shared/dlq-store.shared.js";
import {
  createPgRecordStore,
  createPgTraceStore,
  createPgKeyObservationStore,
  createPgSessionStore,
  createPgVerdictStore,
  createPgGraphStore,
  createPgScenarioSpecStore,
  createPgTransmissionStore,
  createPgDlqStore,
  hasPgUrl,
  closePgConnection,
} from "./factories/pg.factory.js";

const describePg = hasPgUrl() ? describe : describe.skip;

describePg("Cross-Adapter PG", () => {
  afterAll(async () => closePgConnection());

  describe("RecordStore", () => recordStoreTests(createPgRecordStore));
  describe("TraceStore", () => traceStoreTests(createPgTraceStore));
  describe("KeyObservationStore", () => keyObservationStoreTests(createPgKeyObservationStore));
  describe("SessionStore", () => sessionStoreTests(createPgSessionStore));
  describe("VerdictStore", () => verdictStoreTests(createPgVerdictStore));
  describe("GraphStore", () => graphStoreTests(createPgGraphStore));
  describe("ScenarioSpecStore", () => scenarioSpecStoreTests(createPgScenarioSpecStore));
  describe("TransmissionStore", () => transmissionStoreTests(createPgTransmissionStore));
  describe("DlqStore", () => dlqStoreTests(createPgDlqStore));
});
