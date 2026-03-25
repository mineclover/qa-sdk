import { describe, expect, it } from "vitest";
import { resolveMotionComposition } from "./model.js";
import { endMs } from "./utils.js";
import { createPromoGridComposition } from "./presets.js";
import { parseMotionComposition, serializeMotionComposition } from "./io.js";
import { resolveMotionAssetSnapshots } from "./snapshot.js";
import { createMotionDebugSnapshot } from "./snapshot.js";

describe("composition roundtrip", () => {
  const original = createPromoGridComposition();

  it("serialize → parse preserves composition identity", () => {
    const json = serializeMotionComposition(original);
    const parsed = parseMotionComposition(json);

    expect(parsed.id).toBe(original.id);
    expect(parsed.title).toBe(original.title);
    expect(parsed.durationMs).toBe(original.durationMs);
  });

  it("serialize → parse preserves all layers", () => {
    const parsed = parseMotionComposition(serializeMotionComposition(original));

    expect(parsed.layers).toHaveLength(original.layers.length);
    for (const layer of original.layers) {
      const found = parsed.layers.find((l) => l.id === layer.id);
      expect(found).toBeDefined();
      expect(found!.startMs).toBe(layer.startMs);
      expect(found!.durationMs).toBe(layer.durationMs);
      expect(found!.enter.kind).toBe(layer.enter.kind);
    }
  });

  it("serialize → parse preserves all sequences", () => {
    const parsed = parseMotionComposition(serializeMotionComposition(original));

    expect(parsed.sequences).toHaveLength(original.sequences.length);
    for (const seq of original.sequences) {
      const found = parsed.sequences.find((s) => s.id === seq.id);
      expect(found).toBeDefined();
      expect(found!.layerIds).toEqual(seq.layerIds);
    }
  });

  it("serialize → parse preserves all captions with durationMs", () => {
    const parsed = parseMotionComposition(serializeMotionComposition(original));

    expect(parsed.captions).toHaveLength(original.captions.length);
    for (const cap of original.captions) {
      const found = parsed.captions.find((c) => c.id === cap.id);
      expect(found).toBeDefined();
      expect(found!.startMs).toBe(cap.startMs);
      expect(found!.durationMs).toBe(cap.durationMs);
    }
  });

  it("serialize → parse preserves transitions", () => {
    const parsed = parseMotionComposition(serializeMotionComposition(original));

    expect(parsed.transitions).toHaveLength(original.transitions.length);
    for (const tr of original.transitions) {
      const found = parsed.transitions.find((t) => t.id === tr.id);
      expect(found).toBeDefined();
      expect(found!.style).toBe(tr.style);
      expect(found!.durationMs).toBe(tr.durationMs);
    }
  });

  it("resolved composition snapshot covers full timeline", () => {
    const resolved = resolveMotionComposition(original);
    const assets = resolveMotionAssetSnapshots(resolved);

    // 시작, 중간, 끝 시점에서 snapshot을 생성 — 에러 없이 완료되어야 함
    const timePoints = [0, 1000, 3000, 5000, original.durationMs];
    for (const t of timePoints) {
      const snapshot = createMotionDebugSnapshot(resolved, t, assets);
      expect(snapshot.timeMs).toBe(t);
      expect(snapshot.resolvedAssets).toHaveLength(assets.length);
    }
  });

  it("all layers/sequences/captions end within composition duration", () => {
    for (const layer of original.layers) {
      expect(endMs(layer)).toBeLessThanOrEqual(original.durationMs);
    }
    for (const seq of original.sequences) {
      expect(endMs(seq)).toBeLessThanOrEqual(original.durationMs);
    }
    for (const cap of original.captions) {
      expect(endMs(cap)).toBeLessThanOrEqual(original.durationMs);
    }
  });

  it("double roundtrip produces identical JSON", () => {
    const json1 = serializeMotionComposition(original);
    const parsed1 = parseMotionComposition(json1);
    const json2 = serializeMotionComposition(parsed1);

    expect(json1).toBe(json2);
  });
});
