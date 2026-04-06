import { describe } from "vitest";
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
  createD1RecordStore,
  createD1TraceStore,
  createD1KeyObservationStore,
  createD1SessionStore,
  createD1VerdictStore,
  createD1GraphStore,
  createD1ScenarioSpecStore,
  createD1TransmissionStore,
  createD1DlqStore,
} from "./factories/d1.factory.js";

describe("Cross-Adapter D1", () => {
  describe("RecordStore", () => recordStoreTests(async () => createD1RecordStore()));
  describe("TraceStore", () => traceStoreTests(async () => createD1TraceStore()));
  describe("KeyObservationStore", () => keyObservationStoreTests(async () => createD1KeyObservationStore()));
  describe("SessionStore", () => sessionStoreTests(async () => createD1SessionStore()));
  describe("VerdictStore", () => verdictStoreTests(async () => createD1VerdictStore()));
  describe("GraphStore", () => graphStoreTests(async () => createD1GraphStore()));
  describe("ScenarioSpecStore", () => scenarioSpecStoreTests(async () => createD1ScenarioSpecStore()));
  describe("TransmissionStore", () => transmissionStoreTests(async () => createD1TransmissionStore()));
  describe("DlqStore", () => dlqStoreTests(async () => createD1DlqStore()));
});
