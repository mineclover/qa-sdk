import { describe, expect, it } from "vitest";
import {
  newDlqId,
  newLogId,
  newQaSessionId,
  newSpanId,
  newTraceId,
  newTransmissionId,
  newVerdictId,
} from "./id.js";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe("ID generators", () => {
  describe("newTransmissionId", () => {
    it("returns a string with txm_ prefix", () => {
      const id = newTransmissionId();
      expect(id).toMatch(/^txm_/);
    });

    it("ULID part is 26 Crockford Base32 characters", () => {
      const id = newTransmissionId();
      expect(id.slice(4)).toMatch(ULID_PATTERN);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newTransmissionId()).not.toBe(newTransmissionId());
    });
  });

  describe("newLogId", () => {
    it("returns a string with log_ prefix", () => {
      expect(newLogId()).toMatch(/^log_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newLogId()).not.toBe(newLogId());
    });
  });

  describe("newTraceId", () => {
    it("returns a string with trc_ prefix", () => {
      expect(newTraceId()).toMatch(/^trc_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newTraceId()).not.toBe(newTraceId());
    });
  });

  describe("newSpanId", () => {
    it("returns a string with spn_ prefix", () => {
      expect(newSpanId()).toMatch(/^spn_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newSpanId()).not.toBe(newSpanId());
    });
  });

  describe("newQaSessionId", () => {
    it("returns a string with qas_ prefix", () => {
      expect(newQaSessionId()).toMatch(/^qas_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newQaSessionId()).not.toBe(newQaSessionId());
    });
  });

  describe("newVerdictId", () => {
    it("returns a string with vrd_ prefix", () => {
      expect(newVerdictId()).toMatch(/^vrd_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newVerdictId()).not.toBe(newVerdictId());
    });
  });

  describe("newDlqId", () => {
    it("returns a string with dlq_ prefix", () => {
      expect(newDlqId()).toMatch(/^dlq_/);
    });

    it("produces unique IDs on successive calls", () => {
      expect(newDlqId()).not.toBe(newDlqId());
    });
  });

  it("all generators produce different IDs from each other", () => {
    const ids = [
      newTransmissionId(),
      newLogId(),
      newTraceId(),
      newSpanId(),
      newQaSessionId(),
      newVerdictId(),
      newDlqId(),
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
