import { describe, expect, it } from "vitest";
import {
  MOTION_COMPOSITION_SCHEMA_V2,
  MotionCompositionParseError,
  parseMotionCompositionV2,
  serializeMotionCompositionV2,
  validateMotionCompositionV2,
} from "./io.js";
import { createMotionStageNodeTarget } from "./model.js";
import type { MotionCompositionDefV2 } from "./model.js";

function createPromoSceneCompositionV2(): MotionCompositionDefV2 {
  return {
    id: "promo-v2",
    title: "Promo V2",
    description: "scene 기반 composition",
    durationMs: 3200,
    parameters: [],
    cuePresets: [
      { id: "fade-in", label: "Fade In", kind: "fade", durationMs: 280 },
    ],
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
            startMs: 0,
            durationMs: 1200,
            enter: { preset: "fade-in" },
          },
        ],
        sequences: [
          {
            id: "intro-seq",
            title: "Hero hold",
            startMs: 0,
            durationMs: 1200,
            targetIds: ["hero"],
            layers: [{ targetId: "hero", role: "content", zIndex: 1 }],
            captionIds: ["cap-1"],
          },
        ],
        captions: [
          {
            id: "cap-1",
            text: "Scene relative caption",
            startMs: 160,
            durationMs: 720,
            tone: "accent",
          },
        ],
      },
      {
        id: "overlap",
        title: "Overlap",
        startMs: 900,
        durationMs: 1200,
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
            startMs: 0,
            durationMs: 800,
            targetIds: ["badge"],
            layers: [{ targetId: "badge", role: "accent", zIndex: 3 }],
          },
        ],
        captions: [],
      },
    ],
  };
}

describe("motion composition io v2", () => {
  it("serializes into the fixed V2 document envelope", () => {
    const composition = createPromoSceneCompositionV2();

    const serialized = serializeMotionCompositionV2(composition);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed["schemaVersion"]).toBe(MOTION_COMPOSITION_SCHEMA_V2);
    expect(parsed["composition"]).toMatchObject({
      id: composition.id,
      title: composition.title,
    });
  });

  it("parses the serialized V2 document back into a composition", () => {
    const composition = createPromoSceneCompositionV2();

    expect(parseMotionCompositionV2(serializeMotionCompositionV2(composition))).toEqual(composition);
    expect(validateMotionCompositionV2(composition)).toEqual([]);
  });

  it("returns concrete validation messages for V2 schema mismatches", () => {
    const invalidJson = JSON.stringify({
      schemaVersion: "qa-sdk.motion-composition/v0",
      composition: {
        title: "Broken V2",
        description: "missing id and wrong arrays",
        durationMs: "fast",
        parameters: [],
        assets: [],
        targets: "wrong",
        scenes: [],
      },
    });

    expect(() => parseMotionCompositionV2(invalidJson)).toThrowError(MotionCompositionParseError);
    expect(() => parseMotionCompositionV2(invalidJson)).toThrowError(
      /\$\.schemaVersion: qa-sdk\.motion-composition\/v2여야 하지만 "qa-sdk\.motion-composition\/v0"입니다\./,
    );
    expect(() => parseMotionCompositionV2(invalidJson)).toThrowError(
      /\$\.composition\.id: 필수 string 필드가 없습니다\./,
    );
    expect(() => parseMotionCompositionV2(invalidJson)).toThrowError(
      /\$\.composition\.durationMs: number여야 하지만 string입니다\./,
    );
    expect(() => parseMotionCompositionV2(invalidJson)).toThrowError(
      /\$\.composition\.targets: array여야 하지만 string입니다\./,
    );
  });

  it("detects dangling target reference in scene layer placements", () => {
    const base = createPromoSceneCompositionV2();
    const broken = {
      ...base,
      scenes: [
        {
          ...base.scenes[0],
          layers: [
            { ...base.scenes[0]!.layers[0], targetId: "ghost" },
          ],
        },
        ...base.scenes.slice(1),
      ],
    };

    expect(() => parseMotionCompositionV2(serializeMotionCompositionV2(broken))).toThrowError(
      /존재하지 않는 target "ghost"/,
    );
  });

  it("detects scene-local sequence target/caption references that do not exist", () => {
    const base = createPromoSceneCompositionV2();
    const broken = {
      ...base,
      scenes: [
        {
          ...base.scenes[0],
          sequences: [
            {
              ...base.scenes[0]!.sequences[0],
              targetIds: ["badge"],
              captionIds: ["missing-cap"],
            },
          ],
        },
        ...base.scenes.slice(1),
      ],
    };

    expect(() => parseMotionCompositionV2(serializeMotionCompositionV2(broken))).toThrowError(
      /scene\.layers에 배치되지 않은 target "badge"/,
    );
    expect(() => parseMotionCompositionV2(serializeMotionCompositionV2(broken))).toThrowError(
      /scene\.captions에 없는 caption "missing-cap"/,
    );
  });
});
