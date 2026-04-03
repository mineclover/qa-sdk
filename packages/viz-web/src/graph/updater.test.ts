import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUpdater } from "./updater.js";
import type { SpecGraph, StoredRecord } from "@qa-sdk/core";
import type { GraphRenderer } from "./renderer.js";

// ── Helpers ───────────────────────────────────────────────

function makeRenderer(): GraphRenderer {
  return {
    render: vi.fn(),
    resetState: vi.fn(),
    fitView: vi.fn(),
    resetView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    updateNodeState: vi.fn(),
    addEventToStack: vi.fn(),
    highlightEdge: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeRecord(eventKey: string): StoredRecord {
  return {
    logId: `log_${eventKey}`,
    traceId: "trc_001",
    spanId: "span_001",
    timestamp: new Date("2026-03-01T00:00:00Z"),
    recordKind: "log",
    eventKey,
    eventVersion: "001",
    payloadFormat: "json",
    payloadEncoding: "raw",
    payloadMaskingApplied: false,
    payloadMaskedFields: [],
    payload: {},
    createdAt: new Date(),
  };
}

/** 단순 선형 SpecGraph: A → B → C */
function makeLinearGraph(): SpecGraph {
  return {
    scenario_id: "sc_001",
    version: "1",
    nodes: [
      { step_id: "A", event_key: "session_start", required: true, kind: "sequence" },
      { step_id: "B", event_key: "click",         required: true, kind: "sequence" },
      { step_id: "C", event_key: "session_end",   required: true, kind: "sequence" },
    ],
    edges: [
      { source: "A", target: "B", type: "sequence" },
      { source: "B", target: "C", type: "sequence" },
    ],
  };
}

/** optional 노드 포함: A → B(optional) → C */
function makeGraphWithOptional(): SpecGraph {
  return {
    scenario_id: "sc_002",
    version: "1",
    nodes: [
      { step_id: "A", event_key: "session_start", required: true,  kind: "sequence" },
      { step_id: "B", event_key: "click",         required: false, kind: "optional" },
      { step_id: "C", event_key: "session_end",   required: true,  kind: "sequence" },
    ],
    edges: [
      { source: "A", target: "B", type: "optional" },
      { source: "B", target: "C", type: "sequence" },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────

describe("GraphUpdater — 정상 매칭", () => {
  it("매칭 이벤트 수신 시 해당 노드가 'matched'로 전환된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));

    expect(renderer.updateNodeState).toHaveBeenCalledWith("A", "matched");
  });

  it("매칭 후 다음 노드가 'active'로 전환된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));

    expect(renderer.updateNodeState).toHaveBeenCalledWith("B", "active");
  });

  it("순차 매칭 — A, B 매칭 후 C가 active", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));
    updater.processRecord(makeRecord("click"));

    expect(renderer.updateNodeState).toHaveBeenCalledWith("B", "matched");
    expect(renderer.updateNodeState).toHaveBeenCalledWith("C", "active");
  });

  it("마지막 노드 매칭 시 다음 노드 active 전환을 시도하지 않는다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));
    updater.processRecord(makeRecord("click"));
    (renderer.updateNodeState as ReturnType<typeof vi.fn>).mockClear();

    updater.processRecord(makeRecord("session_end"));

    // C matched 호출만 있어야 함 — active 전환 없음
    expect(renderer.updateNodeState).toHaveBeenCalledWith("C", "matched");
    const activeCalls = (renderer.updateNodeState as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, state]) => state === "active");
    expect(activeCalls).toHaveLength(0);
  });

  it("매칭 시 해당 노드로 들어오는 엣지가 하이라이트된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start")); // A 매칭
    updater.processRecord(makeRecord("click"));         // B 매칭 → A→B 엣지 하이라이트

    expect(renderer.highlightEdge).toHaveBeenCalledWith("A", "B");
  });
});

describe("GraphUpdater — optional 노드 skip", () => {
  it("optional 노드를 건너뛰면 해당 노드가 'skipped'로 전환된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeGraphWithOptional(), renderer);

    updater.processRecord(makeRecord("session_start")); // A 매칭
    updater.processRecord(makeRecord("session_end"));   // C 매칭 — B 건너뜀

    expect(renderer.updateNodeState).toHaveBeenCalledWith("B", "skipped");
    expect(renderer.updateNodeState).toHaveBeenCalledWith("C", "matched");
  });

  it("required 노드는 건너뛰어도 skipped로 전환되지 않는다", () => {
    const renderer = makeRenderer();
    // A(required) → B(required) → C(required) 에서 B를 건너뛰는 상황
    const graph: SpecGraph = {
      scenario_id: "sc_003",
      version: "1",
      nodes: [
        { step_id: "A", event_key: "session_start", required: true, kind: "sequence" },
        { step_id: "B", event_key: "click",         required: true, kind: "sequence" },
        { step_id: "C", event_key: "session_end",   required: true, kind: "sequence" },
      ],
      edges: [
        { source: "A", target: "B", type: "sequence" },
        { source: "B", target: "C", type: "sequence" },
      ],
    };
    const updater = createUpdater(graph, renderer);

    updater.processRecord(makeRecord("session_start")); // A 매칭
    // B(click)를 건너뛰고 C(session_end)로 — matchIndex가 C에 도달하지 못함
    // session_end를 보내도 matchIndex=1 이후에 session_end 없으므로 스택에 쌓임
    updater.processRecord(makeRecord("session_end"));

    // B는 required이므로 skipped로 전환되지 않아야 함
    const skippedCalls = (renderer.updateNodeState as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, state]) => state === "skipped");
    expect(skippedCalls).toHaveLength(0);
  });
});

describe("GraphUpdater — 미매칭 이벤트", () => {
  it("현재 위치 이후에 없는 이벤트는 addEventToStack으로 처리된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    // session_start 매칭(A), 이후 unknown_event가 들어옴
    updater.processRecord(makeRecord("session_start"));
    updater.processRecord(makeRecord("unknown_event"));

    expect(renderer.addEventToStack).not.toHaveBeenCalled();
    // unknown_event는 어느 노드에도 없으므로 addEventToStack 미호출
  });

  it("그래프 어딘가에 있는 이벤트지만 순서가 맞지 않으면 스택에 쌓인다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    // A도 매칭 전에 B의 이벤트(click)가 먼저 오면 matchIndex=0에서 찾음 → 실제로 매칭됨
    // A를 먼저 매칭하고, A를 한번 더 보내면 matchIndex=1 이후에 A(session_start)가 없으므로 스택
    updater.processRecord(makeRecord("session_start")); // A 매칭, matchIndex=1
    updater.processRecord(makeRecord("session_start")); // matchIndex=1부터 탐색, A 없음 → addEventToStack

    expect(renderer.addEventToStack).toHaveBeenCalledWith("A", expect.objectContaining({
      event_key: "session_start",
    }));
  });
});

describe("GraphUpdater — getProgress()", () => {
  it("초기 상태에서 모든 노드가 'pending'", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    const progress = updater.getProgress();
    for (const [, state] of progress) {
      expect(state).toBe("pending");
    }
    expect(progress.size).toBe(3);
  });

  it("매칭 후 해당 노드의 progress가 'matched'로 반영된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));

    expect(updater.getProgress().get("A")).toBe("matched");
    expect(updater.getProgress().get("B")).toBe("pending");
  });

  it("getProgress()는 스냅샷 복사본을 반환한다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    const snap1 = updater.getProgress();
    updater.processRecord(makeRecord("session_start"));
    const snap2 = updater.getProgress();

    expect(snap1.get("A")).toBe("pending");
    expect(snap2.get("A")).toBe("matched");
  });
});

describe("GraphUpdater — reset()", () => {
  it("reset() 후 모든 노드가 'pending'으로 복원된다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start"));
    updater.processRecord(makeRecord("click"));
    updater.reset();

    for (const [, state] of updater.getProgress()) {
      expect(state).toBe("pending");
    }
  });

  it("reset() 후 첫 번째 이벤트를 다시 매칭할 수 있다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);

    updater.processRecord(makeRecord("session_start")); // A 매칭
    updater.reset();
    (renderer.updateNodeState as ReturnType<typeof vi.fn>).mockClear();

    updater.processRecord(makeRecord("session_start")); // 다시 A 매칭

    expect(renderer.updateNodeState).toHaveBeenCalledWith("A", "matched");
  });

  it("reset() 은 renderer.updateNodeState를 모든 노드에 대해 호출한다", () => {
    const renderer = makeRenderer();
    const updater = createUpdater(makeLinearGraph(), renderer);
    (renderer.updateNodeState as ReturnType<typeof vi.fn>).mockClear();

    updater.reset();

    const pendingCalls = (renderer.updateNodeState as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, state]) => state === "pending");
    expect(pendingCalls).toHaveLength(3);
  });
});
