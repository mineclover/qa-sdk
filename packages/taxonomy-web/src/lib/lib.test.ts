import { describe, it, expect, beforeEach } from "vitest";
import { newFeedbackId, _resetCounter } from "./newFeedbackId";
import { isValidRef, displayRef } from "./refFormat";
import { filterFeedback } from "./filterFeedback";
import type { Feedback } from "../types/feedback";

describe("newFeedbackId", () => {
  beforeEach(_resetCounter);

  it("date + counter 형식", () => {
    const id = newFeedbackId(new Date("2026-05-21T00:00:00Z"));
    expect(id).toBe("f-20260521-001");
  });

  it("같은 날 호출 시 counter 증가", () => {
    const date = new Date("2026-05-21T00:00:00Z");
    expect(newFeedbackId(date)).toBe("f-20260521-001");
    expect(newFeedbackId(date)).toBe("f-20260521-002");
    expect(newFeedbackId(date)).toBe("f-20260521-003");
  });

  it("날짜 바뀌면 counter reset", () => {
    expect(newFeedbackId(new Date("2026-05-21T00:00:00Z"))).toBe("f-20260521-001");
    expect(newFeedbackId(new Date("2026-05-22T00:00:00Z"))).toBe("f-20260522-001");
  });
});

describe("refFormat", () => {
  it("isValidRef — 유효 ref true", () => {
    expect(isValidRef("t:s.a")).toBe(true);
    expect(isValidRef("t#/axes/s/entries/a")).toBe(true);
  });

  it("isValidRef — 잘못된 ref false", () => {
    expect(isValidRef("not a ref")).toBe(false);
    expect(isValidRef("")).toBe(false);
  });

  it("displayRef — entry는 dotted 형식", () => {
    expect(displayRef("t#/axes/s/entries/a")).toBe("t:s.a");
  });
});

describe("filterFeedback", () => {
  const items: Feedback[] = [
    { id: "f1", ref: "t1:s.a", tag: "bug", status: "open", text: "", createdAt: "", updatedAt: "", history: [] },
    { id: "f2", ref: "t1:s.b", tag: "improvement", status: "resolved", text: "", createdAt: "", updatedAt: "", history: [] },
    { id: "f3", ref: "t2:s.a", tag: "bug", status: "open", text: "", createdAt: "", updatedAt: "", history: [] },
  ];

  it("ref 필터", () => {
    expect(filterFeedback(items, { ref: "t1:s.a" }).length).toBe(1);
  });

  it("tag 필터", () => {
    expect(filterFeedback(items, { tags: ["bug"] }).length).toBe(2);
  });

  it("status 필터", () => {
    expect(filterFeedback(items, { statuses: ["open"] }).length).toBe(2);
  });

  it("taxonomy prefix 필터", () => {
    expect(filterFeedback(items, { taxonomy: "t1" }).length).toBe(2);
  });

  it("multi 필터 — AND", () => {
    expect(filterFeedback(items, { tags: ["bug"], statuses: ["open"], taxonomy: "t1" }).length).toBe(1);
  });
});
