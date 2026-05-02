// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * gate-service MemoryEventBus — facet 격리 테스트.
 *
 * 원본: packages/gate-service/src/adapters/memory-event-bus.ts
 * 동기화: synced/gate-service/src/adapters/memory-event-bus.ts
 */

import { describe, it, expect, vi } from "vitest";
import { MemoryEventBus } from "../../synced/gate-service/src/adapters/memory-event-bus.js";
import type { FlagChangeEvent, ReleaseEvent, GateEvent } from "../../synced/gate-service/src/ports/event-bus.port.js";

const NOW = "2026-04-05T00:00:00Z";

function flagEvent(prefix = "test"): FlagChangeEvent {
  return { type: "flag-change", prefix, versionId: "v1", position: 0, status: "active", timestamp: NOW };
}

function releaseEvent(prefix = "test"): ReleaseEvent {
  return { type: "release", prefix, versionId: "v1", timestamp: NOW };
}

describe("MemoryEventBus (facet)", () => {
  it("구독자에게 이벤트를 전달한다", () => {
    const bus = new MemoryEventBus();
    const received: GateEvent[] = [];
    bus.subscribe("flag-change", (e) => received.push(e));

    bus.publish(flagEvent());
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("flag-change");
  });

  it("같은 타입에 여러 구독자가 동시에 수신한다 (fan-out)", () => {
    const bus = new MemoryEventBus();
    const a: GateEvent[] = [];
    const b: GateEvent[] = [];
    bus.subscribe("flag-change", (e) => a.push(e));
    bus.subscribe("flag-change", (e) => b.push(e));

    bus.publish(flagEvent());
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("다른 타입의 이벤트는 해당 구독자만 수신한다", () => {
    const bus = new MemoryEventBus();
    const flagEvents: GateEvent[] = [];
    const releaseEvents: GateEvent[] = [];
    bus.subscribe("flag-change", (e) => flagEvents.push(e));
    bus.subscribe("release", (e) => releaseEvents.push(e));

    bus.publish(flagEvent());
    bus.publish(releaseEvent());

    expect(flagEvents).toHaveLength(1);
    expect(releaseEvents).toHaveLength(1);
  });

  it("구독 해제 후에는 이벤트를 수신하지 않는다", () => {
    const bus = new MemoryEventBus();
    const received: GateEvent[] = [];
    const unsub = bus.subscribe("flag-change", (e) => received.push(e));

    bus.publish(flagEvent());
    expect(received).toHaveLength(1);

    unsub();
    bus.publish(flagEvent());
    expect(received).toHaveLength(1);
  });

  it("close() 후에는 publish가 무시된다", () => {
    const bus = new MemoryEventBus();
    const received: GateEvent[] = [];
    bus.subscribe("flag-change", (e) => received.push(e));

    bus.close();
    bus.publish(flagEvent());
    expect(received).toHaveLength(0);
  });

  it("핸들러 에러가 다른 핸들러에 전파되지 않는다", () => {
    const onError = vi.fn();
    const bus = new MemoryEventBus({ onError });
    const received: GateEvent[] = [];

    bus.subscribe("flag-change", () => { throw new Error("boom"); });
    bus.subscribe("flag-change", (e) => received.push(e));

    bus.publish(flagEvent());
    expect(received).toHaveLength(1);
    expect(onError).toHaveBeenCalledOnce();
  });
});
