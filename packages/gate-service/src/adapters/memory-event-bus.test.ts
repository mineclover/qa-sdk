import { describe, it, expect, vi } from "vitest";
import { MemoryEventBus } from "./memory-event-bus.js";
import type { FlagChangeEvent, GateEvent, ReleaseEvent, RecomputeCompleteEvent } from "../ports/event-bus.port.js";

const NOW = "2026-04-05T00:00:00Z";

function makeFlagChange(overrides?: Partial<FlagChangeEvent>): FlagChangeEvent {
  return {
    type: "flag-change",
    prefix: "role",
    versionId: "v1",
    position: 1,
    status: "inactive",
    timestamp: NOW,
    ...overrides,
  };
}

function makeRelease(overrides?: Partial<ReleaseEvent>): ReleaseEvent {
  return {
    type: "release",
    prefix: "role",
    versionId: "v1",
    timestamp: NOW,
    ...overrides,
  };
}

function makeRecomputeComplete(overrides?: Partial<RecomputeCompleteEvent>): RecomputeCompleteEvent {
  return {
    type: "recompute-complete",
    prefix: "role",
    versionId: "v1",
    timestamp: NOW,
    ...overrides,
  };
}

describe("MemoryEventBus", () => {
  it("구독자에게 이벤트를 전달한다", () => {
    const bus = new MemoryEventBus();
    const received: FlagChangeEvent[] = [];

    bus.subscribe("flag-change", (event) => {
      received.push(event);
    });

    const event = makeFlagChange();
    bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  it("같은 타입에 여러 구독자가 동시에 수신한다 (fan-out)", () => {
    const bus = new MemoryEventBus();
    const received1: GateEvent[] = [];
    const received2: GateEvent[] = [];

    bus.subscribe("flag-change", (e) => { received1.push(e); });
    bus.subscribe("flag-change", (e) => { received2.push(e); });

    bus.publish(makeFlagChange());

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });

  it("다른 타입의 이벤트는 해당 구독자만 수신한다", () => {
    const bus = new MemoryEventBus();
    const flagEvents: GateEvent[] = [];
    const releaseEvents: GateEvent[] = [];

    bus.subscribe("flag-change", (e) => { flagEvents.push(e); });
    bus.subscribe("release", (e) => { releaseEvents.push(e); });

    bus.publish(makeFlagChange());
    bus.publish(makeRelease());

    expect(flagEvents).toHaveLength(1);
    expect(flagEvents[0]!.type).toBe("flag-change");
    expect(releaseEvents).toHaveLength(1);
    expect(releaseEvents[0]!.type).toBe("release");
  });

  it("구독 해제 후에는 이벤트를 수신하지 않는다", () => {
    const bus = new MemoryEventBus();
    const received: GateEvent[] = [];

    const unsubscribe = bus.subscribe("flag-change", (e) => { received.push(e); });
    bus.publish(makeFlagChange());
    expect(received).toHaveLength(1);

    unsubscribe();
    bus.publish(makeFlagChange());
    expect(received).toHaveLength(1);
  });

  it("close() 후에는 publish가 무시된다", () => {
    const bus = new MemoryEventBus();
    const received: GateEvent[] = [];

    bus.subscribe("flag-change", (e) => { received.push(e); });
    bus.close();
    bus.publish(makeFlagChange());

    expect(received).toHaveLength(0);
  });

  it("close() 후에는 subscribe가 no-op unsubscribe를 반환한다", () => {
    const bus = new MemoryEventBus();
    bus.close();

    const unsub = bus.subscribe("flag-change", () => {});
    // no-op — 에러 없이 호출 가능
    unsub();
  });

  it("sync 핸들러 에러가 다른 핸들러에 전파되지 않는다 (격리)", () => {
    const errors: unknown[] = [];
    const bus = new MemoryEventBus({
      onError: (err) => errors.push(err),
    });
    const received: GateEvent[] = [];

    bus.subscribe("flag-change", () => {
      throw new Error("handler error");
    });
    bus.subscribe("flag-change", (e) => { received.push(e); });

    bus.publish(makeFlagChange());

    // 첫 번째 핸들러 에러에도 불구하고 두 번째 핸들러가 실행됨
    expect(received).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it("async 핸들러 에러가 다른 핸들러에 전파되지 않는다", async () => {
    const errors: unknown[] = [];
    const bus = new MemoryEventBus({
      onError: (err) => errors.push(err),
    });

    bus.subscribe("flag-change", async () => {
      throw new Error("async handler error");
    });

    bus.publish(makeFlagChange());

    // async 에러가 catch되도록 마이크로태스크 대기
    await new Promise((r) => setTimeout(r, 10));
    expect(errors).toHaveLength(1);
  });

  it("구독자가 없는 이벤트 타입은 조용히 무시된다", () => {
    const bus = new MemoryEventBus();
    // 에러 없이 실행
    bus.publish(makeRecomputeComplete());
  });

  it("recompute-complete 이벤트 전달", () => {
    const bus = new MemoryEventBus();
    const received: RecomputeCompleteEvent[] = [];

    bus.subscribe("recompute-complete", (e) => { received.push(e); });

    const event = makeRecomputeComplete({ triggeredBy: "flag-change:2" });
    bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0]!.triggeredBy).toBe("flag-change:2");
  });
});
