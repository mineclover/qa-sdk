import { describe, expect, it } from "vitest";
import { TraceContext } from "@qa-sdk/logger";

describe("TraceContext", () => {
  it("auto-generates a trace id, preserves qa_session_id, and manages the span stack", () => {
    const context = new TraceContext({ qa_session_id: "qas_session_1" });

    expect(context.trace_id).toMatch(/^trc_/);
    expect(context.qa_session_id).toBe("qas_session_1");
    expect(context.depth).toBe(0);

    const rootSpanId = context.currentSpanId;
    expect(rootSpanId).toMatch(/^spn_/);
    expect(context.depth).toBe(1);

    const childSpanId = context.pushSpan();
    expect(context.currentSpanId).toBe(childSpanId);
    expect(context.parentSpanId).toBe(rootSpanId);
    expect(context.depth).toBe(2);

    expect(context.popSpan()).toBe(childSpanId);
    expect(context.currentSpanId).toBe(rootSpanId);
    expect(context.depth).toBe(1);

    expect(context.popSpan()).toBe(rootSpanId);
    expect(context.depth).toBe(0);
  });
});
