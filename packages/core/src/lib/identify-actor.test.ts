// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { identifyActorMode } from "./identify-actor.js";

describe("identifyActorMode", () => {
  it("명시된 mode는 그대로 반환", () => {
    expect(identifyActorMode({ actor_id: "x", identification_mode: "service" })).toBe("service");
  });

  it("user_id 있으면 identified", () => {
    expect(identifyActorMode({ actor_id: "a1", user_id: "u1" })).toBe("identified");
  });

  it("actor_id만 있으면 pseudonymized", () => {
    expect(identifyActorMode({ actor_id: "token-abc" })).toBe("pseudonymized");
  });

  it("actor_id 없으면 anonymous", () => {
    expect(identifyActorMode({})).toBe("anonymous");
  });

  it("actor_id='anonymous' → anonymous", () => {
    expect(identifyActorMode({ actor_id: "anonymous" })).toBe("anonymous");
  });

  it("actor_id='' → anonymous", () => {
    expect(identifyActorMode({ actor_id: "" })).toBe("anonymous");
  });

  it("platform=node + owner_type=workspace → service", () => {
    expect(
      identifyActorMode({ actor_id: "svc-1", platform: "node", owner_type: "workspace" }),
    ).toBe("service");
  });

  it("platform=node + owner_type=tenant → service", () => {
    expect(
      identifyActorMode({ actor_id: "svc-1", platform: "node", owner_type: "tenant" }),
    ).toBe("service");
  });

  it("platform=browser → not service (pseudonymized)", () => {
    expect(
      identifyActorMode({ actor_id: "svc-1", platform: "browser", owner_type: "workspace" }),
    ).toBe("pseudonymized");
  });
});
