import { describe, it, expect } from "vitest";
import {
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2,
} from "./demo-snapshot.js";

describe("SSOT 위치 안정성 (position stability)", () => {
  it("v2 역할 — v1 역할의 position이 동일해야 한다", () => {
    for (let i = 0; i < DEMO_ROLES_V1.length; i++) {
      const roleId = DEMO_ROLES_V1[i];
      const v2Idx = DEMO_ROLES_V2.indexOf(roleId);
      expect(v2Idx, `role "${roleId}": v1 pos=${i}, v2 pos=${v2Idx}`).toBe(i);
    }
  });

  it("v2 역할 — 신규 항목은 v1 항목 뒤에만 추가", () => {
    const v1Set = new Set<string>(DEMO_ROLES_V1);
    for (let i = 0; i < DEMO_ROLES_V2.length; i++) {
      if (!v1Set.has(DEMO_ROLES_V2[i])) {
        expect(i, `new role "${DEMO_ROLES_V2[i]}" at index ${i} should be >= ${DEMO_ROLES_V1.length}`)
          .toBeGreaterThanOrEqual(DEMO_ROLES_V1.length);
      }
    }
  });

  it("v2 이벤트 — v1 이벤트의 position이 동일해야 한다", () => {
    for (let i = 0; i < DEMO_EVENTS_V1.length; i++) {
      const evtId = DEMO_EVENTS_V1[i];
      const v2Idx = DEMO_EVENTS_V2.indexOf(evtId);
      expect(v2Idx, `event "${evtId}": v1 pos=${i}, v2 pos=${v2Idx}`).toBe(i);
    }
  });

  it("v2 이벤트 — 신규 항목은 v1 항목 뒤에만 추가", () => {
    const v1Set = new Set<string>(DEMO_EVENTS_V1);
    for (let i = 0; i < DEMO_EVENTS_V2.length; i++) {
      if (!v1Set.has(DEMO_EVENTS_V2[i])) {
        expect(i, `new event "${DEMO_EVENTS_V2[i]}" at index ${i} should be >= ${DEMO_EVENTS_V1.length}`)
          .toBeGreaterThanOrEqual(DEMO_EVENTS_V1.length);
      }
    }
  });

  it("v1 역할이 모두 v2에 존재해야 한다 (삭제 없음)", () => {
    const v2Set = new Set<string>(DEMO_ROLES_V2);
    for (const role of DEMO_ROLES_V1) {
      expect(v2Set.has(role), `role "${role}" missing in v2`).toBe(true);
    }
  });

  it("v1 이벤트가 모두 v2에 존재해야 한다 (삭제 없음)", () => {
    const v2Set = new Set<string>(DEMO_EVENTS_V2);
    for (const evt of DEMO_EVENTS_V1) {
      expect(v2Set.has(evt), `event "${evt}" missing in v2`).toBe(true);
    }
  });
});
