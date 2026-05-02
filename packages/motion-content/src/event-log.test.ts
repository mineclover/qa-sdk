import { describe, expect, it, vi } from "vitest";
import { createMotionEventLog, type McLogEntry } from "./event-log.js";
import { MC_ALL_ACTIONS } from "./events.js";

describe("로컬 이벤트 로그", () => {
  it("push한 엔트리를 최신순으로 반환한다", () => {
    const log = createMotionEventLog();
    log.push("transport", "play");
    log.push("transport", "pause");

    const entries = log.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("pause"); // 최신
    expect(entries[1].action).toBe("play");
  });

  it("ring buffer가 maxEntries를 초과하면 오래된 것부터 제거한다", () => {
    const log = createMotionEventLog(3);
    log.push("transport", "play");
    log.push("transport", "pause");
    log.push("edit", "select");
    log.push("transport", "seek");

    expect(log.size()).toBe(3);
    const entries = log.entries();
    expect(entries[0].action).toBe("seek");
    expect(entries[2].action).toBe("pause"); // play는 밀려남
  });

  it("카테고리로 필터링한다", () => {
    const log = createMotionEventLog();
    log.push("transport", "play");
    log.push("edit", "select");
    log.push("transport", "pause");
    log.push("timeline", "drag_start");

    expect(log.entriesByCategory("transport")).toHaveLength(2);
    expect(log.entriesByCategory("edit")).toHaveLength(1);
    expect(log.entriesByCategory("composition")).toHaveLength(0);
  });

  it("onEntry 콜백이 push마다 호출된다", () => {
    const log = createMotionEventLog();
    const received: McLogEntry[] = [];
    log.onEntry = (entry) => received.push(entry);

    log.push("transport", "play");
    log.push("edit", "select", { kind: "layer", id: "chip" });

    expect(received).toHaveLength(2);
    expect(received[0].action).toBe("play");
    expect(received[1].detail).toMatchObject({ kind: "layer" });
  });

  it("clear로 로그를 초기화한다", () => {
    const log = createMotionEventLog();
    log.push("transport", "play");
    log.push("transport", "pause");
    log.clear();

    expect(log.size()).toBe(0);
    expect(log.entries()).toHaveLength(0);
  });

  it("id가 자동 증가한다", () => {
    const log = createMotionEventLog();
    log.push("transport", "play");
    log.push("transport", "pause");

    const entries = log.entries();
    expect(entries[0].id).toBe(2);
    expect(entries[1].id).toBe(1);
  });

  it("detail에 임의 데이터를 포함할 수 있다", () => {
    const log = createMotionEventLog();
    log.push("timeline", "drag_start", { operation: "move", itemKind: "layer" });

    const entry = log.entries()[0];
    expect(entry.detail).toMatchObject({ operation: "move", itemKind: "layer" });
  });
});

describe("액션 목록", () => {
  it("전체 액션이 정의되어 있다", () => {
    expect(MC_ALL_ACTIONS.length).toBeGreaterThanOrEqual(15);
    expect(MC_ALL_ACTIONS).toContain("play");
    expect(MC_ALL_ACTIONS).toContain("select");
    expect(MC_ALL_ACTIONS).toContain("drag_start");
    expect(MC_ALL_ACTIONS).toContain("import");
  });
});
