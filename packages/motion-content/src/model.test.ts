import { describe, expect, it } from "vitest";
import {
  applyMotionTemplate,
  createMotionStageNodeTarget,
  resolveMotionComposition,
} from "./model.js";
import { createPromoGridComposition } from "./presets.js";

describe("motion composition model", () => {
  it("resolves overrides while keeping parameter defaults as the SSOT", () => {
    const composition = resolveMotionComposition(createPromoGridComposition("lift"), {
      headline: "Override headline",
      accent: "#00ffaa",
      unknown: "ignored",
    });

    expect(composition.values).toMatchObject({
      headline: "Override headline",
      subline: "Scene · Sequence · Caption · Transition",
      accent: "#00ffaa",
      transitionStyle: "crossfade",
    });
    expect(composition.values["unknown"]).toBeUndefined();
  });

  it("renders templates with empty fallback and standardizes stage-node targets", () => {
    expect(createMotionStageNodeTarget("hero")).toEqual({
      kind: "stage-node",
      nodeId: "hero",
    });
    expect(
      applyMotionTemplate("{{headline}} / {{missing}}", {
        headline: "Motion Canvas",
      }),
    ).toBe("Motion Canvas / ");
  });
});
