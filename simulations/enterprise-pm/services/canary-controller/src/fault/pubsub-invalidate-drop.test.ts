// @def.boundary sim-canary-controller
// spec 2026-05-02 §8 — pubsub-invalidate-drop fault (시나리오 16).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.2
//
// 4 케이스:
//   (a) enable({dropRate:0.5}) → isEnabled, getParams 일치
//   (b) disable() → isEnabled false, getParams null
//   (c) enable({dropRate:1.5}) → throw (range 0~1)
//   (d) shouldDrop(rng) 결정적 — 1.0 항상 true, 0 항상 false

import { describe, it, expect, beforeEach } from "vitest";
import { PubsubInvalidateDropFault } from "./pubsub-invalidate-drop.js";

describe("PubsubInvalidateDropFault (spec §8)", () => {
  let fault: PubsubInvalidateDropFault;
  beforeEach(() => {
    fault = new PubsubInvalidateDropFault();
  });

  it("(a) enable + isEnabled + getParams roundtrip", async () => {
    await fault.enable({ dropRate: 0.5 });
    expect(fault.isEnabled()).toBe(true);
    expect(fault.getParams()).toEqual({ dropRate: 0.5 });
  });

  it("(b) disable resets state", async () => {
    await fault.enable({ dropRate: 0.5 });
    await fault.disable();
    expect(fault.isEnabled()).toBe(false);
    expect(fault.getParams()).toBeNull();
  });

  it("(c) rejects out-of-range dropRate", async () => {
    await expect(fault.enable({ dropRate: 1.5 })).rejects.toThrow(
      /dropRate must be in \[0, 1\]/,
    );
    await expect(fault.enable({ dropRate: -0.1 })).rejects.toThrow(
      /dropRate must be in \[0, 1\]/,
    );
  });

  it("(d) shouldDrop honors boundaries deterministically", async () => {
    // disabled → never drop
    expect(fault.shouldDrop(() => 0.5)).toBe(false);
    await fault.enable({ dropRate: 1.0 });
    // dropRate 1.0 → always drop (rng < 1.0 항상 true)
    expect(fault.shouldDrop(() => 0.7)).toBe(true);
    expect(fault.shouldDrop(() => 0.0)).toBe(true);
    await fault.enable({ dropRate: 0 });
    // dropRate 0 → never drop (rng < 0 절대 false)
    expect(fault.shouldDrop(() => 0.7)).toBe(false);
    expect(fault.shouldDrop(() => 0.0)).toBe(false);
  });
});
