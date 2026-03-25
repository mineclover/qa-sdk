import { describe, expect, it } from "vitest";
import { createPromoGridComposition } from "./presets.js";
import { applyMotionEditorCommand, createMotionEditorState } from "./state.js";

describe("motion editor timeline normalization", () => {
  it("preserves parameter overrides when the shell dispatches a set-parameter command", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "set-parameter",
      parameterId: "headline",
      value: "편집된 헤드라인",
    });

    expect(next.values["headline"]).toBe("편집된 헤드라인");
    expect(next.composition.values["headline"]).toBe("편집된 헤드라인");
  });

  it("keeps selection and transport while timeline commands mutate composition", () => {
    let state = createMotionEditorState(createPromoGridComposition());
    state = applyMotionEditorCommand(state, {
      type: "select",
      selection: { kind: "sequence", id: "intro" },
    });
    state = applyMotionEditorCommand(state, {
      type: "set-current-time",
      timeMs: 2500,
    });

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "sequence",
      itemId: "intro",
      startMs: 300,
      durationMs: 900,
    });

    expect(next.selection).toEqual({ kind: "sequence", id: "intro" });
    expect(next.transport.currentTimeMs).toBe(2500);
  });

  it("clamps caption edits to the composition duration", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "caption",
      itemId: "cap-4",
      startMs: 6520,
      durationMs: 480,
    });

    const caption = next.composition.captions.find((entry) => entry.id === "cap-4");
    expect(caption).toMatchObject({
      startMs: 6480,
      durationMs: 120,
    });
  });

  it("updates absolute-coordinate layer timing via update-item-timing", () => {
    // 절대좌표 layer로 테스트: layers 슬롯 없는 composition
    const base = createPromoGridComposition();
    const absoluteComp = { ...base, sequences: base.sequences.map((s) => ({ ...s, layers: undefined })) };
    const state = createMotionEditorState(absoluteComp);

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "layer",
      itemId: "headline",
      startMs: 200,
      durationMs: 1000,
    });

    const layer = next.composition.layers.find((l) => l.id === "headline");
    expect(layer).toMatchObject({ startMs: 200, durationMs: 1000 });
  });

  it("relative-coordinate layer.startMs is overwritten by slot offsetMs during normalization", () => {
    // 상대좌표 layer의 startMs를 직접 변경해도 정규화가 offsetMs 기준으로 복원
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "layer",
      itemId: "headline",
      startMs: 999,
      durationMs: 1000,
    });

    const layer = next.composition.layers.find((l) => l.id === "headline");
    // intro sequence startMs=0, headline slot offsetMs=120 → 정규화 후 startMs=120
    expect(layer!.startMs).toBe(120);
    // durationMs는 직접 변경이 유효
    expect(layer!.durationMs).toBe(1000);
  });

  it("updates sequence timing via update-item-timing", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "sequence",
      itemId: "cards",
      startMs: 2000,
      durationMs: 2000,
    });

    const sequence = next.composition.sequences.find((s) => s.id === "cards");
    expect(sequence).toMatchObject({ startMs: 2000, durationMs: 2000 });
  });

  it("updates caption timing via update-item-timing", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "caption",
      itemId: "cap-2",
      startMs: 2000,
      durationMs: 800,
    });

    const caption = next.composition.captions.find((c) => c.id === "cap-2");
    expect(caption).toMatchObject({ startMs: 2000, durationMs: 800 });
  });

  it("clamps absolute-coordinate layer timing to composition duration", () => {
    // 절대좌표 layer로 테스트하기 위해 layers 슬롯 없는 composition 사용
    const base = createPromoGridComposition();
    const absoluteComposition = {
      ...base,
      sequences: base.sequences.map((seq) => ({ ...seq, layers: undefined })),
    };
    const state = createMotionEditorState(absoluteComposition);

    const next = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "layer",
      itemId: "outro",
      startMs: 6550,
      durationMs: 500,
    });

    const layer = next.composition.layers.find((l) => l.id === "outro");
    // 절대좌표: startMs는 최대 6600-120=6480, durationMs는 최소 120
    expect(layer!.startMs).toBeLessThanOrEqual(6480);
    expect(layer!.durationMs).toBeGreaterThanOrEqual(120);
    expect(layer!.startMs + layer!.durationMs).toBeLessThanOrEqual(6600);
  });

  it("reconciles transition duration with the source and target sequence boundary", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const expanded = applyMotionEditorCommand(state, {
      type: "update-transition-duration",
      transitionId: "intro-cards",
      durationMs: 4000,
    });
    expect(
      expanded.composition.transitions.find((entry) => entry.id === "intro-cards")?.durationMs,
    ).toBe(1700);

    const collapsed = applyMotionEditorCommand(state, {
      type: "update-item-timing",
      itemKind: "sequence",
      itemId: "intro",
      startMs: 0,
      durationMs: 1000,
    });
    expect(
      collapsed.composition.transitions.find((entry) => entry.id === "intro-cards")?.durationMs,
    ).toBe(0);
  });
});
