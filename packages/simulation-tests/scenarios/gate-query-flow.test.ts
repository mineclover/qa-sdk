// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 시뮬레이션: gate-service + query-service 통합 흐름.
 *
 * 격리 환경에서 두 서비스의 순수 로직이 조합되어 동작하는지 검증.
 * 환경 의존(DB, HTTP)은 InMemory 어댑터로 대체.
 */

import { describe, it, expect } from "vitest";

// gate-service — synced에서 직접 import
import { MemoryEventBus } from "../synced/gate-service/src/adapters/memory-event-bus.js";
import type { FlagChangeEvent, GateEvent } from "../synced/gate-service/src/ports/event-bus.port.js";

// query-service — synced에서 직접 import
import { InMemoryPolicyRuleStore } from "../synced/query-service/src/stores/in-memory-policy-rule-store.js";
import type { StoredPolicyRule } from "../synced/query-service/src/stores/policy-rule-store.js";

const NOW = "2026-04-05T00:00:00Z";

describe("gate → query 통합 시뮬레이션", () => {
  it("gate flag 변경 이벤트 → policy rule 조회 흐름", async () => {
    // 1. gate-service: EventBus 설정
    const bus = new MemoryEventBus();
    const gateEvents: GateEvent[] = [];
    bus.subscribe("flag-change", (e) => gateEvents.push(e));

    // 2. query-service: policy rule store 설정
    const ruleStore = new InMemoryPolicyRuleStore<{ effect: string }>();
    await ruleStore.insert({
      id: "rule-1",
      pattern: [{ position: 0, value: 1 }],
      value: { effect: "allow" },
      indexId: "permission",
      versionId: "v1",
      createdAt: NOW,
      updatedAt: NOW,
    });

    // 3. 시뮬레이션: gate flag 변경 발생
    const flagEvent: FlagChangeEvent = {
      type: "flag-change",
      prefix: "permission",
      versionId: "v1",
      position: 0,
      status: "inactive",
      timestamp: NOW,
    };
    bus.publish(flagEvent);

    // 4. 검증: 이벤트 수신됨
    expect(gateEvents).toHaveLength(1);
    expect(gateEvents[0].type).toBe("flag-change");

    // 5. 검증: 해당 prefix의 policy rule 조회 가능
    const rules = await ruleStore.findByIndex("permission", "v1");
    expect(rules).toHaveLength(1);
    expect(rules[0].value.effect).toBe("allow");

    // 6. 시뮬레이션: gate inactive → policy rule 영향 분석
    // inactive된 position(0)과 rule의 position(0)이 겹침 → 영향 있음
    const affectedRules = rules.filter(r =>
      r.pattern.some(p => p.position === flagEvent.position),
    );
    expect(affectedRules).toHaveLength(1);
  });

  it("여러 서비스의 이벤트 버스가 독립적으로 동작", () => {
    const gateBus = new MemoryEventBus();
    const queryBus = new MemoryEventBus();

    const gateReceived: GateEvent[] = [];
    const queryReceived: GateEvent[] = [];

    gateBus.subscribe("flag-change", (e) => gateReceived.push(e));
    queryBus.subscribe("flag-change", (e) => queryReceived.push(e));

    gateBus.publish({
      type: "flag-change",
      prefix: "service",
      versionId: "v1",
      position: 0,
      status: "active",
      timestamp: NOW,
    });

    // gate bus에만 이벤트 발행 → query bus에는 전달 안 됨
    expect(gateReceived).toHaveLength(1);
    expect(queryReceived).toHaveLength(0);
  });
});
