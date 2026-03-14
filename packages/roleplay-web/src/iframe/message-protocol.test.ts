import { describe, it, expect } from "vitest";
import { isContextMessage, isEventEmittedMessage } from "./message-protocol.js";

describe("isContextMessage", () => {
  it("유효한 context 메시지를 인식한다", () => {
    expect(isContextMessage({
      type: "context",
      traceId: "trc_001",
      sessionId: "ses_001",
      scenarioId: "checkout_v1",
    })).toBe(true);
  });

  it("type이 다르면 false", () => {
    expect(isContextMessage({
      type: "event:emitted",
      traceId: "trc_001",
      sessionId: "ses_001",
      scenarioId: "checkout_v1",
    })).toBe(false);
  });

  it("scenarioId 누락 시 false", () => {
    expect(isContextMessage({
      type: "context",
      traceId: "trc_001",
      sessionId: "ses_001",
    })).toBe(false);
  });

  it("traceId 또는 sessionId 누락 시 false", () => {
    expect(isContextMessage({ type: "context", sessionId: "ses_001", scenarioId: "sc" })).toBe(false);
    expect(isContextMessage({ type: "context", traceId: "trc_001", scenarioId: "sc" })).toBe(false);
  });

  it("null / primitive 는 false", () => {
    expect(isContextMessage(null)).toBe(false);
    expect(isContextMessage(undefined)).toBe(false);
    expect(isContextMessage("context")).toBe(false);
    expect(isContextMessage(42)).toBe(false);
  });

  it("필드 값이 string이 아니면 false", () => {
    expect(isContextMessage({ type: "context", traceId: 123, sessionId: "s", scenarioId: "sc" })).toBe(false);
  });
});

describe("isEventEmittedMessage", () => {
  it("유효한 event:emitted 메시지를 인식한다", () => {
    expect(isEventEmittedMessage({
      type: "event:emitted",
      eventKey: "click",
      timestamp: "2026-03-01T00:00:00Z",
    })).toBe(true);
  });

  it("type이 다르면 false", () => {
    expect(isEventEmittedMessage({
      type: "context",
      eventKey: "click",
      timestamp: "2026-03-01T00:00:00Z",
    })).toBe(false);
  });

  it("timestamp 누락 시 false", () => {
    expect(isEventEmittedMessage({ type: "event:emitted", eventKey: "click" })).toBe(false);
  });

  it("eventKey 누락 시 false", () => {
    expect(isEventEmittedMessage({ type: "event:emitted", timestamp: "2026-03-01T00:00:00Z" })).toBe(false);
  });

  it("null 은 false", () => {
    expect(isEventEmittedMessage(null)).toBe(false);
  });
});
