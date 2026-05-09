import { describe, expect, it } from "vitest";
import { assembleComposition, migrateCompositionV1toV2 } from "./assemble.js";
import {
  createMotionStageNodeTarget,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
} from "./model.js";
import { createPromoGridComposition } from "./presets.js";
import { parseMotionCompositionV2, serializeMotionCompositionV2 } from "./io.js";

function createSimpleComposition(): MotionCompositionDef {
  return {
    id: "simple-v1",
    title: "Simple V1",
    description: "v1 -> v2 -> v1 라운드트립 fixture",
    durationMs: 2400,
    parameters: [],
    cuePresets: [
      { id: "fade-in", label: "Fade In", kind: "fade", durationMs: 240 },
    ],
    assets: [],
    layers: [
      {
        id: "hero",
        label: "Hero",
        target: createMotionStageNodeTarget("hero"),
        content: { type: "dom" },
        startMs: 120,
        durationMs: 1080,
        enter: { preset: "fade-in" },
      },
      {
        id: "badge",
        label: "Badge",
        target: createMotionStageNodeTarget("badge"),
        content: { type: "svg", viewBox: "0 0 24 24" },
        startMs: 820,
        durationMs: 900,
        enter: { kind: "scale-pop", durationMs: 320, amount: 0.9 },
      },
    ],
    sequences: [
      {
        id: "intro",
        title: "Intro",
        startMs: 0,
        durationMs: 1400,
        layerIds: ["hero", "badge"],
        layers: [
          { layerId: "hero", offsetMs: 120, zIndex: 0, role: "content" },
          { layerId: "badge", offsetMs: 820, zIndex: 1, role: "accent" },
        ],
        captionIds: ["cap-1"],
      },
    ],
    captions: [
      {
        id: "cap-1",
        text: "Simple roundtrip caption",
        startMs: 160,
        durationMs: 820,
        tone: "accent",
      },
    ],
    transitions: [],
  };
}

function createOverlappingCompositionV2(): MotionCompositionDefV2 {
  return {
    id: "overlap-v2",
    title: "Overlap V2",
    description: "겹치는 scene을 평탄화한다",
    durationMs: 3200,
    parameters: [],
    assets: [],
    targets: [
      {
        id: "hero",
        target: createMotionStageNodeTarget("hero"),
        content: { type: "dom" },
      },
      {
        id: "badge",
        target: createMotionStageNodeTarget("badge"),
        content: { type: "svg", viewBox: "0 0 24 24" },
      },
    ],
    scenes: [
      {
        id: "intro",
        title: "Intro",
        startMs: 0,
        durationMs: 1800,
        layers: [
          {
            targetId: "hero",
            startMs: 120,
            durationMs: 1200,
            enter: { kind: "fade", durationMs: 280 },
          },
        ],
        sequences: [
          {
            id: "intro-seq",
            title: "Intro sequence",
            startMs: 0,
            durationMs: 1200,
            targetIds: ["hero"],
            layers: [{ targetId: "hero", offsetMs: 120, role: "content", zIndex: 1 }],
            captionIds: ["cap-1"],
          },
        ],
        captions: [
          {
            id: "cap-1",
            text: "Hero scene",
            startMs: 160,
            durationMs: 720,
          },
        ],
      },
      {
        id: "overlap",
        title: "Overlap",
        startMs: 900,
        durationMs: 1400,
        layers: [
          {
            targetId: "badge",
            startMs: 120,
            durationMs: 700,
            enter: { kind: "scale-pop", durationMs: 240, amount: 0.92 },
          },
        ],
        sequences: [
          {
            id: "badge-seq",
            title: "Badge reveal",
            startMs: 40,
            durationMs: 800,
            targetIds: ["badge"],
            layers: [{ targetId: "badge", offsetMs: 80, role: "accent", zIndex: 3 }],
          },
        ],
        captions: [],
      },
    ],
  };
}

describe("motion composition v1/v2 conversion", () => {
  it("migrates v1 layers into targets under a single main scene", () => {
    const composition = createSimpleComposition();
    const migrated = migrateCompositionV1toV2(composition);

    expect(migrated.targets.map((target) => target.id)).toEqual(["hero", "badge"]);
    expect(migrated.scenes).toHaveLength(1);
    expect(migrated.scenes[0]).toMatchObject({
      id: "main",
      startMs: 0,
      durationMs: composition.durationMs,
    });
    expect(migrated.scenes[0]?.layers.map((layer) => layer.targetId)).toEqual(["hero", "badge"]);
    expect(migrated.scenes[0]?.sequences[0]?.targetIds).toEqual(["hero", "badge"]);
  });

  it("roundtrips v1 -> v2 -> serialize -> parse -> assemble -> v1", () => {
    const original = createSimpleComposition();
    const migrated = migrateCompositionV1toV2(original);
    const reparsed = parseMotionCompositionV2(serializeMotionCompositionV2(migrated));

    expect(assembleComposition(reparsed)).toEqual(original);
  });

  it("keeps the existing promo preset compatible with migrate/assemble", () => {
    const original = createPromoGridComposition("flash");
    const migrated = migrateCompositionV1toV2(original);
    const reparsed = parseMotionCompositionV2(serializeMotionCompositionV2(migrated));

    expect(assembleComposition(reparsed)).toEqual(original);
  });

  it("assembles overlapping scenes into global absolute layer coordinates", () => {
    const assembled = assembleComposition(createOverlappingCompositionV2());

    expect(assembled.layers).toEqual([
      expect.objectContaining({ id: "hero", startMs: 120, durationMs: 1200 }),
      expect.objectContaining({ id: "badge", startMs: 1020, durationMs: 700 }),
    ]);
    expect(assembled.sequences).toEqual([
      expect.objectContaining({ id: "intro-seq", startMs: 0 }),
      expect.objectContaining({ id: "badge-seq", startMs: 940 }),
    ]);
    expect(assembled.captions).toEqual([
      expect.objectContaining({ id: "cap-1", startMs: 160, durationMs: 720 }),
    ]);
  });
});
