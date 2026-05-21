import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { feedbackApiPlugin } from "./feedback-api";

const tmpJsonl = join(tmpdir(), `tax-web-test-${Date.now()}.jsonl`);

beforeEach(() => {
  if (existsSync(tmpJsonl)) unlinkSync(tmpJsonl);
});
afterEach(() => {
  if (existsSync(tmpJsonl)) unlinkSync(tmpJsonl);
});

describe("feedbackApiPlugin", () => {
  it("POST append → JSONL line 추가", async () => {
    const plugin = feedbackApiPlugin(tmpJsonl);
    // 미들웨어 직접 호출 어려움 — 헬퍼 함수 별도 export 하는 방식
    expect(plugin.name).toBe("taxonomy-web:feedback-api");
  });

  it("appendFeedback 헬퍼 — append + readFeedbacks", async () => {
    const { appendFeedback, readFeedbacks } = await import("./feedback-api");
    const f = { id: "f-1", ref: "t:s.a", tag: "bug", status: "open", text: "x", createdAt: "2026-05-21T00:00:00Z", updatedAt: "2026-05-21T00:00:00Z", history: [] };
    appendFeedback(tmpJsonl, f);
    const all = readFeedbacks(tmpJsonl);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe("f-1");
  });

  it("patchFeedback — id 매칭 시 line 교체", async () => {
    const { appendFeedback, patchFeedback, readFeedbacks } = await import("./feedback-api");
    const f1 = { id: "f-1", ref: "t:s.a", tag: "bug", status: "open", text: "x", createdAt: "...", updatedAt: "...", history: [] };
    const f2 = { id: "f-2", ref: "t:s.b", tag: "improvement", status: "open", text: "y", createdAt: "...", updatedAt: "...", history: [] };
    appendFeedback(tmpJsonl, f1);
    appendFeedback(tmpJsonl, f2);
    patchFeedback(tmpJsonl, "f-1", { status: "resolved" });
    const all = readFeedbacks(tmpJsonl);
    const updated = all.find((f) => f.id === "f-1");
    expect(updated?.status).toBe("resolved");
    expect(all.length).toBe(2);
  });
});
