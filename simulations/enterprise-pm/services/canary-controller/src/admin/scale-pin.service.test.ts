// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 9~10 — ScalePinService.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.7
//
// 6 케이스:
//   (a) pin → getPin 일치
//   (b) unpin → getPin null
//   (c) 같은 service 재 pin → ConflictException 409
//   (d) replicas < 1 → throw (replicas must be >= 1)
//   (e) listPins() plain object
//   (f) unpin not-existing → no-op (idempotent)

import { describe, it, expect, beforeEach } from "vitest";
import { ConflictException } from "@nestjs/common";
import { ScaleStore } from "./scale-store.js";
import { ScalePinService } from "./scale-pin.service.js";

describe("ScalePinService (spec §6 endpoint 9~10)", () => {
  let svc: ScalePinService;
  beforeEach(() => {
    svc = new ScalePinService(new ScaleStore());
  });

  it("(a) pin → getPin 일치", () => {
    svc.pin("sim-approval-api-v2", 3);
    expect(svc.getPin("sim-approval-api-v2")).toBe(3);
  });

  it("(b) unpin → getPin null", () => {
    svc.pin("sim-approval-api-v2", 3);
    svc.unpin("sim-approval-api-v2");
    expect(svc.getPin("sim-approval-api-v2")).toBeNull();
  });

  it("(c) pin twice without unpin throws 409", () => {
    svc.pin("sim-approval-api-v2", 3);
    expect(() => svc.pin("sim-approval-api-v2", 5)).toThrow(ConflictException);
  });

  it("(d) rejects replicas < 1", () => {
    expect(() => svc.pin("sim-approval-api-v2", 0)).toThrow(
      /replicas must be >= 1/,
    );
    expect(() => svc.pin("sim-approval-api-v2", -1)).toThrow(
      /replicas must be >= 1/,
    );
    expect(() => svc.pin("sim-approval-api-v2", 1.5)).toThrow(
      /replicas must be >= 1/,
    );
  });

  it("(e) listPins returns plain object", () => {
    svc.pin("sim-approval-api-v1", 1);
    svc.pin("sim-approval-api-v2", 3);
    const pins = svc.listPins();
    expect(pins).toEqual({
      "sim-approval-api-v1": 1,
      "sim-approval-api-v2": 3,
    });
    // plain object — Map 또는 Record 가 아닌 일반 object 여야 JSON 직렬화 가능.
    expect(Object.getPrototypeOf(pins)).toBe(Object.prototype);
  });

  it("(f) unpin not-existing → no-op", () => {
    expect(() => svc.unpin("never-pinned")).not.toThrow();
    expect(svc.getPin("never-pinned")).toBeNull();
    expect(svc.listPins()).toEqual({});
  });
});
