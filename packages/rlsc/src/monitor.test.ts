import { describe, it, expect, vi, afterEach } from "vitest";
import { createLayoutMonitor } from "./monitor.js";
import { collectLayout, collectLayoutWithText } from "./collector.js";
import type { RLSCDocument } from "./types.js";

// collector를 mock하여 DOM 없이 실행
vi.mock("./collector.js", () => ({
  collectLayout: vi.fn(),
  collectLayoutWithText: vi.fn(() => ({
    doc: {
      version: "1.0",
      viewport: { width: 1024, height: 768 },
      url: "http://localhost",
      timestamp: "2024-01-01T00:00:00.000Z",
      root: {
        id: "root", tag: "body", classes: [],
        rect: { x: 0, y: 0, width: 1024, height: 768 },
        zIndex: 0, depth: 0, display: "block",
        position: "static", overflow: "visible",
        visible: true, attributes: {}, children: [],
      },
      grid: { cellSize: 16, cols: 64, rows: 48, cells: [] },
      layers: [],
      relations: [],
    },
    textPrepared: new Map(),
  })),
}));

vi.mock("./text-occupancy.js", () => ({
  analyzeTextOccupancy: vi.fn(() => []),
}));

function makeDoc(): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 1024, height: 768 },
    url: "http://localhost",
    timestamp: "2024-01-01T00:00:00.000Z",
    root: {
      id: "root", tag: "body", classes: [],
      rect: { x: 0, y: 0, width: 1024, height: 768 },
      zIndex: 0, depth: 0, display: "block",
      position: "static", overflow: "visible",
      visible: true, attributes: {}, children: [],
    },
    grid: { cellSize: 16, cols: 64, rows: 48, cells: [] },
    layers: [],
    relations: [],
  };
}

// ── 브라우저 가드 ─────────────────────────────────────────────────────

describe("createLayoutMonitor — 브라우저 가드", () => {
  it("window 미존재 환경(Node.js)에서 throw한다", () => {
    expect(() => createLayoutMonitor()).toThrow("브라우저 환경에서만");
  });
});

// ── debounce ──────────────────────────────────────────────────────────

describe("createLayoutMonitor — debounce", () => {
  let mutationCb: ((records: MutationRecord[], observer: MutationObserver) => void) | undefined;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.mocked(collectLayout).mockReset();
  });

  function stubBrowserEnv() {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    vi.stubGlobal("MutationObserver", class {
      constructor(cb: (records: MutationRecord[], obs: MutationObserver) => void) {
        mutationCb = cb;
      }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  }

  it("연속 DOM 변경이 단일 처리로 합쳐진다", () => {
    vi.useFakeTimers();
    vi.mocked(collectLayout).mockReturnValue(makeDoc());
    stubBrowserEnv();

    const collectSpy = vi.mocked(collectLayout);
    const monitor = createLayoutMonitor(undefined, { debounceMs: 50 });
    monitor.start();

    const callsAfterConstruct = collectSpy.mock.calls.length; // 생성 시 1회

    // 3번 빠른 연속 변경
    mutationCb!([], {} as MutationObserver);
    mutationCb!([], {} as MutationObserver);
    mutationCb!([], {} as MutationObserver);

    // debounce 전: 추가 호출 없음
    expect(collectSpy.mock.calls.length).toBe(callsAfterConstruct);

    // 50ms 후: 단 1회만 추가 호출
    vi.advanceTimersByTime(50);
    expect(collectSpy.mock.calls.length).toBe(callsAfterConstruct + 1);

    monitor.stop();
  });

  it("stop() 호출 시 대기 중인 debounce가 취소된다", () => {
    vi.useFakeTimers();
    vi.mocked(collectLayout).mockReturnValue(makeDoc());
    stubBrowserEnv();

    const collectSpy = vi.mocked(collectLayout);
    const monitor = createLayoutMonitor(undefined, { debounceMs: 100 });
    monitor.start();

    const callsAfterConstruct = collectSpy.mock.calls.length;

    mutationCb!([], {} as MutationObserver);
    monitor.stop(); // 대기 타이머 취소

    vi.advanceTimersByTime(200);
    // stop() 후 타이머가 취소됐으므로 추가 호출 없음
    expect(collectSpy.mock.calls.length).toBe(callsAfterConstruct);
  });
});

// ── trackText ────────────────────────────────────────────────────────

describe("createLayoutMonitor — trackText", () => {
  let mutationCb3: ((records: MutationRecord[], observer: MutationObserver) => void) | undefined;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.mocked(collectLayout).mockReset();
    vi.mocked(collectLayoutWithText).mockReset();
  });

  function stubBrowserEnv3() {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { body: {}, documentElement: {} });
    vi.stubGlobal("MutationObserver", class {
      constructor(cb: (records: MutationRecord[], obs: MutationObserver) => void) {
        mutationCb3 = cb;
      }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  }

  it("trackText: true일 때 onTextOccupancyChange 콜백 호출", () => {
    vi.useFakeTimers();
    vi.mocked(collectLayout).mockReturnValue(makeDoc());
    // collectLayoutWithText mock is already set up at module level
    stubBrowserEnv3();

    const textCb = vi.fn();
    const monitor = createLayoutMonitor(undefined, {
      debounceMs: 50,
      trackText: true,
      onTextOccupancyChange: textCb,
    });
    monitor.start();

    mutationCb3!([], {} as MutationObserver);
    vi.advanceTimersByTime(50);

    expect(textCb).toHaveBeenCalledWith([]);

    monitor.stop();
  });
});
