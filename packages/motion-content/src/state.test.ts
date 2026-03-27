import { describe, expect, it } from "vitest";
import { createMotionStageNodeTarget } from "./model.js";
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

  it("updates sequence stagger numeric fields", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "update-sequence-stagger",
      sequenceId: "cards",
      field: "startOffsetMs",
      value: 240,
    });

    expect(next.composition.sequences.find((sequence) => sequence.id === "cards")?.stagger).toMatchObject({
      startOffsetMs: 240,
      intervalMs: 270,
    });
    expect(next.composition.layers.find((layer) => layer.id === "card-a")?.startMs).toBe(1940);
  });

  it("updates sequence layer slot offset and zIndex", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const offsetEdited = applyMotionEditorCommand(state, {
      type: "update-sequence-layer-slot",
      sequenceId: "intro",
      layerId: "headline",
      field: "offsetMs",
      value: 240,
    });
    const zIndexEdited = applyMotionEditorCommand(offsetEdited, {
      type: "update-sequence-layer-slot",
      sequenceId: "intro",
      layerId: "headline",
      field: "zIndex",
      value: 7,
    });

    const intro = zIndexEdited.composition.sequences.find((sequence) => sequence.id === "intro");
    const headlineSlot = intro?.layers?.find((slot) => slot.layerId === "headline");
    const headline = zIndexEdited.composition.layers.find((layer) => layer.id === "headline");
    expect(intro?.layerIds).toContain("headline");
    expect(headlineSlot).toMatchObject({ offsetMs: 240, zIndex: 7 });
    expect(headline?.startMs).toBe(240);
  });

  it("updates layer label, sequence title, and caption text via inline string commands", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const layerEdited = applyMotionEditorCommand(state, {
      type: "update-item-string",
      itemKind: "layer",
      itemId: "headline",
      value: "  새 헤드라인 레이어  ",
    });
    const sequenceEdited = applyMotionEditorCommand(layerEdited, {
      type: "update-item-string",
      itemKind: "sequence",
      itemId: "cards",
      value: "카드 시퀀스",
    });
    const captionEdited = applyMotionEditorCommand(sequenceEdited, {
      type: "update-item-string",
      itemKind: "caption",
      itemId: "cap-2",
      value: "두 번째 캡션",
    });
    const emptyIgnored = applyMotionEditorCommand(captionEdited, {
      type: "update-item-string",
      itemKind: "caption",
      itemId: "cap-2",
      value: "   ",
    });

    expect(layerEdited.composition.layers.find((layer) => layer.id === "headline")?.label).toBe("새 헤드라인 레이어");
    expect(sequenceEdited.composition.sequences.find((sequence) => sequence.id === "cards")?.title).toBe("카드 시퀀스");
    expect(captionEdited.composition.captions.find((caption) => caption.id === "cap-2")?.text).toBe("두 번째 캡션");
    expect(emptyIgnored).toBe(captionEdited);
  });

  it("updates layer enum fields and cue preset refs", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const cueEdited = applyMotionEditorCommand(state, {
      type: "update-layer-cue-kind",
      layerId: "headline",
      cue: "enter",
      kind: "scale-pop",
    });
    const contentEdited = applyMotionEditorCommand(cueEdited, {
      type: "update-layer-content-type",
      layerId: "headline",
      contentType: "video",
    });
    const presetEdited = applyMotionEditorCommand(contentEdited, {
      type: "update-layer-cue-preset",
      layerId: "card-a",
      cue: "enter",
      presetId: "slide-up-default",
    });

    expect(presetEdited.composition.layers.find((layer) => layer.id === "headline")).toMatchObject({
      enter: { kind: "scale-pop" },
      content: { type: "video", src: "" },
    });
    expect(presetEdited.composition.layers.find((layer) => layer.id === "card-a")?.enter).toEqual({
      preset: "slide-up-default",
    });
  });

  it("updates slot role and transition style/color without keeping stale params", () => {
    const state = createMotionEditorState(createPromoGridComposition("crossfade"));

    const roleEdited = applyMotionEditorCommand(state, {
      type: "update-sequence-layer-role",
      sequenceId: "intro",
      layerId: "headline",
      role: "overlay",
    });
    const styleEdited = applyMotionEditorCommand(roleEdited, {
      type: "update-transition-style",
      transitionId: "intro-cards",
      style: "flash",
    });
    const colorEdited = applyMotionEditorCommand(styleEdited, {
      type: "update-transition-param",
      transitionId: "intro-cards",
      param: "glowColor",
      value: "rgba(17,34,51,0.24)",
    });

    expect(
      colorEdited.composition.sequences.find((sequence) => sequence.id === "intro")?.layers?.find((slot) => slot.layerId === "headline"),
    ).toMatchObject({ role: "overlay" });
    expect(colorEdited.composition.transitions.find((entry) => entry.id === "intro-cards")).toMatchObject({
      style: "flash",
      params: {
        glowColor: "rgba(17,34,51,0.24)",
        glowSize: 120,
      },
    });
    expect(
      (colorEdited.composition.transitions.find((entry) => entry.id === "intro-cards")?.params as { brightness?: number } | undefined)?.brightness,
    ).toBeUndefined();
  });

  it("appends a new layer with the default enter cue", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "add-layer",
      id: "layer-8",
      label: "Layer 8",
      target: createMotionStageNodeTarget("layer-8"),
      content: { type: "dom" },
      durationMs: 960,
    });

    const layer = next.composition.layers.find((entry) => entry.id === "layer-8");
    expect(layer).toMatchObject({
      id: "layer-8",
      label: "Layer 8",
      target: createMotionStageNodeTarget("layer-8"),
      content: { type: "dom" },
      startMs: 0,
      durationMs: 960,
      enter: { preset: "slide-up-default" },
    });
    expect(next.composition.layers.at(-1)?.id).toBe("layer-8");
  });

  it("appends a new sequence to the composition", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "add-sequence",
      id: "sequence-4",
      title: "Sequence 4",
      startMs: 5400,
      durationMs: 1200,
      layerIds: [],
      captionIds: [],
    });

    expect(next.composition.sequences.at(-1)).toMatchObject({
      id: "sequence-4",
      title: "Sequence 4",
      startMs: 5400,
      durationMs: 1200,
      layerIds: [],
      captionIds: [],
    });
  });

  it("removes a sequence and all related transitions", () => {
    let state = createMotionEditorState(createPromoGridComposition());
    state = applyMotionEditorCommand(state, {
      type: "select",
      selection: { kind: "transition", id: "cards-outro" },
    });

    const next = applyMotionEditorCommand(state, {
      type: "remove-sequence",
      sequenceId: "outro",
    });

    expect(next.composition.sequences.some((sequence) => sequence.id === "outro")).toBe(false);
    expect(next.composition.transitions.some((transition) => transition.id === "cards-outro")).toBe(false);
    expect(next.selection).toBeNull();
  });

  it("appends a new caption to the composition", () => {
    const state = createMotionEditorState(createPromoGridComposition());

    const next = applyMotionEditorCommand(state, {
      type: "add-caption",
      id: "cap-5",
      text: "새 캡션 5",
      startMs: 5200,
      durationMs: 900,
      tone: "accent",
    });

    expect(next.composition.captions.at(-1)).toMatchObject({
      id: "cap-5",
      text: "새 캡션 5",
      startMs: 5200,
      durationMs: 900,
      tone: "accent",
    });
  });

  it("removes a caption and prunes sequence caption references", () => {
    let state = createMotionEditorState(createPromoGridComposition());
    state = applyMotionEditorCommand(state, {
      type: "select",
      selection: { kind: "caption", id: "cap-2" },
    });

    const next = applyMotionEditorCommand(state, {
      type: "remove-caption",
      captionId: "cap-2",
    });

    expect(next.composition.captions.some((caption) => caption.id === "cap-2")).toBe(false);
    expect(next.composition.sequences.find((sequence) => sequence.id === "cards")?.captionIds).not.toContain("cap-2");
    expect(next.selection).toBeNull();
  });

  it("appends and removes transitions", () => {
    let state = createMotionEditorState(createPromoGridComposition());

    state = applyMotionEditorCommand(state, {
      type: "add-transition",
      id: "intro-cards-2",
      fromSequenceId: "intro",
      toSequenceId: "cards",
      style: "flash",
      durationMs: 280,
      params: { glowSize: 96 },
    });

    expect(state.composition.transitions.find((transition) => transition.id === "intro-cards-2")).toMatchObject({
      id: "intro-cards-2",
      fromSequenceId: "intro",
      toSequenceId: "cards",
      style: "flash",
      durationMs: 280,
      params: { glowSize: 96 },
    });

    state = applyMotionEditorCommand(state, {
      type: "select",
      selection: { kind: "transition", id: "intro-cards-2" },
    });
    const next = applyMotionEditorCommand(state, {
      type: "remove-transition",
      transitionId: "intro-cards-2",
    });

    expect(next.composition.transitions.some((transition) => transition.id === "intro-cards-2")).toBe(false);
    expect(next.selection).toBeNull();
  });

  it("removes a layer and all related sequence references", () => {
    let state = createMotionEditorState(createPromoGridComposition());
    state = applyMotionEditorCommand(state, {
      type: "select",
      selection: { kind: "layer", id: "headline" },
    });

    const next = applyMotionEditorCommand(state, {
      type: "remove-layer",
      layerId: "headline",
    });

    expect(next.composition.layers.some((layer) => layer.id === "headline")).toBe(false);
    expect(next.selection).toBeNull();
    const intro = next.composition.sequences.find((sequence) => sequence.id === "intro");
    expect(intro?.layerIds).not.toContain("headline");
    expect(intro?.layers?.some((slot) => slot.layerId === "headline")).toBe(false);
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

  it("updates transition numeric params without dropping other params", () => {
    const state = createMotionEditorState(createPromoGridComposition("flash"));

    const next = applyMotionEditorCommand(state, {
      type: "update-transition-param",
      transitionId: "intro-cards",
      param: "glowSize",
      value: 144,
    });

    expect(next.composition.transitions.find((entry) => entry.id === "intro-cards")?.params).toMatchObject({
      glowColor: "rgba(240,143,32,0.3)",
      glowSize: 144,
    });
  });
});
