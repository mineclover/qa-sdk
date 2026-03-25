import { describe, expect, it } from "vitest";
import {
  MOTION_COMPOSITION_SCHEMA_V1,
  MotionCompositionParseError,
  parseMotionComposition,
  serializeMotionComposition,
} from "./io.js";
import { createPromoGridComposition } from "./presets.js";

describe("motion composition io", () => {
  it("serializes into the fixed V1 document envelope", () => {
    const composition = createPromoGridComposition("crossfade");

    const serialized = serializeMotionComposition(composition);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed["schemaVersion"]).toBe(MOTION_COMPOSITION_SCHEMA_V1);
    expect(parsed["composition"]).toMatchObject({
      id: composition.id,
      title: composition.title,
    });
  });

  it("parses the serialized V1 document back into a composition", () => {
    const composition = createPromoGridComposition("lift");

    expect(parseMotionComposition(serializeMotionComposition(composition))).toEqual(composition);
  });

  it("surfaces malformed JSON before document validation", () => {
    expect(() => parseMotionComposition("{not valid json")).toThrowError(
      /^\$: JSON 파싱에 실패했습니다\./,
    );
  });

  it("returns concrete validation messages for required fields and shape errors", () => {
    const invalidJson = JSON.stringify({
      schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      composition: {
        title: "Broken",
        description: "missing id and wrong arrays",
        durationMs: "fast",
        parameters: [{ id: "headline", label: "Headline", type: "select", defaultValue: 12 }],
        assets: "wrong",
        layers: [],
        sequences: [],
        captions: [],
        transitions: [],
      },
    });

    expect(() => parseMotionComposition(invalidJson)).toThrowError(MotionCompositionParseError);
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /MotionComposition JSON 검증 실패/,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.id: 필수 string 필드가 없습니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.durationMs: number여야 하지만 string입니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.parameters\[0\]\.options: 필수 array 필드가 없습니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.assets: array여야 하지만 string입니다\./,
    );
  });

  it("rejects schema mismatch and enum boundary violations in V1 documents", () => {
    const invalidJson = JSON.stringify({
      schemaVersion: "qa-sdk.motion-composition/v0",
      composition: {
        ...createPromoGridComposition("crossfade"),
        assets: [
          {
            id: "headline",
            type: "text",
            target: { kind: "selector", nodeId: "headline" },
            template: "{{headline}}",
          },
        ],
        captions: [
          {
            id: "cap-1",
            text: "invalid tone",
            startMs: 0,
            durationMs: 300,
            tone: "loud",
          },
        ],
        transitions: [
          {
            id: "intro-cards",
            fromSequenceId: "intro",
            toSequenceId: "cards",
            style: "spin",
            durationMs: 200,
          },
        ],
      },
    });

    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.schemaVersion: qa-sdk\.motion-composition\/v1여야 하지만 "qa-sdk\.motion-composition\/v0"입니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.assets\[0\]\.target\.kind: stage-node 중 하나여야 하지만 "selector"입니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.captions\[0\]\.tone: neutral \| accent \| warning 중 하나여야 하지만 "loud"입니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.transitions\[0\]\.style: crossfade \| flash \| lift 중 하나여야 하지만 "spin"입니다\./,
    );
  });

  it("detects dangling layer reference in sequence.layerIds", () => {
    const base = createPromoGridComposition();
    const broken = {
      ...base,
      sequences: [
        { ...base.sequences[0], layerIds: ["chip", "nonexistent-layer"] },
        ...base.sequences.slice(1),
      ],
    };
    const json = JSON.stringify({
      schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      composition: broken,
    });

    expect(() => parseMotionComposition(json)).toThrowError(
      /존재하지 않는 layer "nonexistent-layer"/,
    );
  });

  it("detects dangling caption reference in sequence.captionIds", () => {
    const base = createPromoGridComposition();
    const broken = {
      ...base,
      sequences: [
        { ...base.sequences[0], captionIds: ["nonexistent-cap"] },
        ...base.sequences.slice(1),
      ],
    };
    const json = JSON.stringify({
      schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      composition: broken,
    });

    expect(() => parseMotionComposition(json)).toThrowError(
      /존재하지 않는 caption "nonexistent-cap"/,
    );
  });

  it("detects dangling sequence reference in transition", () => {
    const base = createPromoGridComposition();
    const broken = {
      ...base,
      transitions: [
        { id: "bad-tr", fromSequenceId: "nonexistent", toSequenceId: "cards", style: "crossfade", durationMs: 200 },
      ],
    };
    const json = JSON.stringify({
      schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      composition: broken,
    });

    expect(() => parseMotionComposition(json)).toThrowError(
      /존재하지 않는 sequence "nonexistent"/,
    );
  });

  it("rejects legacy selector or raw string targets in V1 documents", () => {
    const invalidJson = JSON.stringify({
      schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      composition: {
        ...createPromoGridComposition("crossfade"),
        assets: [
          {
            id: "headline",
            type: "text",
            target: "[data-motion-id='headline']",
            template: "{{headline}}",
          },
        ],
        layers: [
          {
            id: "headline",
            label: "Headline",
            selector: "[data-motion-id='headline']",
            startMs: 0,
            durationMs: 1000,
            enter: { kind: "fade", durationMs: 300 },
          },
        ],
      },
    });

    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.assets\[0\]\.target: object여야 하지만 string입니다\./,
    );
    expect(() => parseMotionComposition(invalidJson)).toThrowError(
      /\$\.composition\.layers\[0\]\.target: 필수 object 필드가 없습니다\./,
    );
  });
});
