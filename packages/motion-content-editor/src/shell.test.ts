import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMotionPlayerSpy } = vi.hoisted(() => ({
  createMotionPlayerSpy: vi.fn(),
}));

vi.mock("motion-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion-content")>();

  createMotionPlayerSpy.mockImplementation((
    _adapter: import("motion-content").MotionStageAdapter,
    composition: import("motion-content").ResolvedMotionComposition,
  ): import("motion-content").MotionPlayer => {
    const transport: import("motion-content").MotionTransportState = {
      playing: false,
      currentTimeMs: 0,
      durationMs: composition.durationMs,
      loop: false,
      playbackRate: 1,
    };

    const snapshot = () => ({
      ...actual.createMotionDebugSnapshot(
        composition,
        transport.currentTimeMs,
        actual.resolveMotionAssetSnapshots(composition),
      ),
      transport: { ...transport },
    });

    return {
      play() {
        transport.playing = true;
      },
      pause() {
        transport.playing = false;
      },
      restart() {
        transport.playing = true;
        transport.currentTimeMs = 0;
      },
      seek(ms) {
        transport.currentTimeMs = Math.max(0, Math.min(ms, composition.durationMs));
      },
      setPlaybackRate(playbackRate) {
        transport.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
      },
      setLoop(loop) {
        transport.loop = loop;
      },
      getTransportState() {
        return { ...transport };
      },
      progress() {
        return composition.durationMs === 0 ? 0 : transport.currentTimeMs / composition.durationMs;
      },
      currentTimeMs() {
        return transport.currentTimeMs;
      },
      durationMs() {
        return composition.durationMs;
      },
      snapshot,
      destroy() {
        return;
      },
    };
  });

  return {
    ...actual,
    createMotionPlayer: createMotionPlayerSpy,
  };
});

import {
  createMotionStageNodeTarget,
  createPromoGridComposition,
  migrateCompositionV1toV2,
  resolveCue,
  serializeMotionComposition,
  type MotionCompositionDefV2,
} from "motion-content";
import {
  MOTION_EDITOR_THEMES,
} from "./design-tokens.js";
import {
  MOTION_EDITOR_LAYOUT_STORAGE_KEY,
  MOTION_EDITOR_THEME_STORAGE_KEY,
  readMotionEditorPref,
} from "./prefs-store.js";
import {
  createMotionEditorShell as createMotionEditorShellImpl,
  type MotionEditorShellOptions,
} from "./shell.js";
import { createMotionEditorShellWorkspace } from "./workspace.js";

function createMotionEditorShell(options: MotionEditorShellOptions) {
  return createMotionEditorShellImpl({
    ...options,
    workspace: options.workspace ?? createMotionEditorShellWorkspace({
      composition: options.composition,
      values: options.values,
    }),
  });
}

function createOverlappingSceneComposition(): MotionCompositionDefV2 {
  return {
    id: "overlap-v2",
    title: "Overlap V2",
    description: "겹치는 scene 전체 재생 fixture",
    durationMs: 3200,
    parameters: [],
    cuePresets: [
      { id: "fade-in", label: "Fade In", kind: "fade", durationMs: 240 },
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
            startMs: 120,
            durationMs: 1200,
            enter: { preset: "fade-in" },
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

function installPointerCapturePolyfill(): void {
  const captures = new WeakMap<HTMLElement, Set<number>>();

  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        const current = captures.get(this) ?? new Set<number>();
        current.add(pointerId);
        captures.set(this, current);
      },
    },
    releasePointerCapture: {
      configurable: true,
      value(pointerId: number) {
        captures.get(this)?.delete(pointerId);
      },
    },
    hasPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        return captures.get(this)?.has(pointerId) ?? false;
      },
    },
  });
}

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  pointerId: number,
  clientX: number,
  clientY = 0,
  init: {
    readonly shiftKey?: boolean;
    readonly altKey?: boolean;
  } = {},
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    shiftKey: init.shiftKey,
    altKey: init.altKey,
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: pointerId,
  });
  target.dispatchEvent(event);
}

function dispatchMouseEvent(
  target: EventTarget,
  type: string,
): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

function stubTimelineGeometry(container: HTMLElement): void {
  for (const track of container.querySelectorAll<HTMLElement>(".mce-track")) {
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 660,
        bottom: 24,
        width: 660,
        height: 24,
        toJSON: () => null,
      }),
    });
  }
}

function readStoredLayout(): Record<string, unknown> | null {
  const raw = readMotionEditorPref(MOTION_EDITOR_LAYOUT_STORAGE_KEY);
  return raw ? JSON.parse(raw) as Record<string, unknown> : null;
}

function readStoredTheme(): string | null {
  return readMotionEditorPref(MOTION_EDITOR_THEME_STORAGE_KEY);
}

describe("motion editor shell", () => {
  let container: HTMLDivElement;
  let urlCreateObjectUrl: ReturnType<typeof vi.fn>;
  let urlRevokeObjectUrl: ReturnType<typeof vi.fn>;
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installPointerCapturePolyfill();
    createMotionPlayerSpy.mockClear();

    container = document.createElement("div");
    document.body.appendChild(container);

    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    urlCreateObjectUrl = vi.fn(() => "blob:motion-content");
    urlRevokeObjectUrl = vi.fn();
    anchorClick = vi.fn();

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: urlCreateObjectUrl,
      revokeObjectURL: urlRevokeObjectUrl,
    });

    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: anchorClick,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.classList.remove("mce-dark", "mce-light");
    document.documentElement.removeAttribute("data-motion-editor-theme");
    document.documentElement.style.colorScheme = "";
    container.remove();
    document.body.innerHTML = "";
  });

  it("runs the shell command flow for undo redo download and composition apply", () => {
    const onStateChange = vi.fn();
    const shell = createMotionEditorShell({ container, onStateChange });

    const undoButton = container.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const redoButton = container.querySelector<HTMLButtonElement>('[data-action="redo"]');
    const downloadButton = container.querySelector<HTMLButtonElement>('[data-action="download-json"]');
    const jsonPanel = container.querySelector<HTMLTextAreaElement>('[data-panel="json"]');
    const importButton = container.querySelector<HTMLButtonElement>('[data-action="import-json"]');
    const importDiagnosticsPanel = container.querySelector<HTMLElement>('[data-panel="import-diagnostics"]');

    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);

    shell.dispatch({
      type: "set-parameter",
      parameterId: "headline",
      value: "편집된 헤드라인",
    });

    expect(shell.getState().values["headline"]).toBe("편집된 헤드라인");
    expect(undoButton?.disabled).toBe(false);
    expect(redoButton?.disabled).toBe(true);

    undoButton!.click();
    expect(shell.getState().values["headline"]).toBe("GSAP Motion Canvas");
    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(false);

    redoButton!.click();
    expect(shell.getState().values["headline"]).toBe("편집된 헤드라인");

    downloadButton!.click();
    expect(urlCreateObjectUrl).toHaveBeenCalledTimes(1);
    expect(urlCreateObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(urlRevokeObjectUrl).toHaveBeenCalledWith("blob:motion-content");

    const importedComposition = {
      ...createPromoGridComposition("lift"),
      id: "imported-shell",
      title: "Imported Shell",
    };
    jsonPanel!.value = serializeMotionComposition(importedComposition);

    importButton!.click();

    expect(shell.getState().composition.id).toBe("imported-shell");
    expect(shell.getState().composition.title).toBe("Imported Shell");
    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);
    expect(importDiagnosticsPanel?.textContent).toContain("성공");
    expect(importDiagnosticsPanel?.textContent).toContain("schemaVersion 검증 및 composition import가 완료되었습니다.");
    expect(onStateChange).toHaveBeenCalled();

    shell.destroy();
  });

  it("assembles full playback and scene playback separately, then exports the assembled v1 json", async () => {
    const shell = createMotionEditorShell({
      container,
      composition: createOverlappingSceneComposition(),
    });

    const previewLabel = container.querySelector<HTMLElement>("[data-preview-label]");
    const previewFullButton = container.querySelector<HTMLButtonElement>('[data-action="preview-full"]');
    const previewSceneButton = container.querySelector<HTMLButtonElement>('[data-action="preview-scene"]');
    const exportV1Button = container.querySelector<HTMLButtonElement>('[data-action="export-v1"]');
    const overlapSceneButton = container.querySelector<HTMLElement>('[data-scene="overlap"]');

    const initialComposition = createMotionPlayerSpy.mock.calls.at(-1)?.[1];
    expect(initialComposition?.durationMs).toBe(3200);
    expect(initialComposition?.layers.map((layer) => ({ id: layer.id, startMs: layer.startMs }))).toEqual([
      { id: "hero", startMs: 120 },
      { id: "badge", startMs: 1020 },
    ]);
    expect(initialComposition?.sequences.map((sequence) => sequence.id)).toEqual(["intro-seq", "badge-seq"]);
    expect(previewSceneButton?.disabled).toBe(true);
    expect(previewLabel?.textContent).toContain("전체 어셈블리");

    overlapSceneButton?.click();
    expect(previewSceneButton?.disabled).toBe(false);

    previewSceneButton?.click();

    const scenePreviewComposition = createMotionPlayerSpy.mock.calls.at(-1)?.[1];
    expect(scenePreviewComposition?.durationMs).toBe(1400);
    expect(scenePreviewComposition?.layers.map((layer) => ({ id: layer.id, startMs: layer.startMs }))).toEqual([
      { id: "badge", startMs: 120 },
    ]);
    expect(scenePreviewComposition?.sequences.map((sequence) => sequence.id)).toEqual(["badge-seq"]);
    expect(shell.getState().transport.durationMs).toBe(1400);
    expect(previewLabel?.textContent).toContain("Overlap 씬");

    exportV1Button?.click();

    const sceneExportBlob = urlCreateObjectUrl.mock.calls[0]?.[0] as Blob;
    const sceneExportDocument = JSON.parse(await sceneExportBlob.text()) as {
      readonly schemaVersion: string;
      readonly composition: {
        readonly id: string;
        readonly durationMs: number;
        readonly layers: readonly { readonly id: string; readonly startMs: number }[];
        readonly sequences: readonly { readonly id: string }[];
      };
    };
    expect(sceneExportDocument.schemaVersion).toBe("qa-sdk.motion-composition/v1");
    expect(sceneExportDocument.composition.id).toBe("overlap-v2-overlap");
    expect(sceneExportDocument.composition.durationMs).toBe(1400);
    expect(sceneExportDocument.composition.layers.map((layer) => ({ id: layer.id, startMs: layer.startMs }))).toEqual([
      { id: "badge", startMs: 120 },
    ]);
    expect(sceneExportDocument.composition.sequences.map((sequence) => ({ id: sequence.id }))).toEqual([
      { id: "badge-seq" },
    ]);

    previewFullButton?.click();

    const fullPreviewComposition = createMotionPlayerSpy.mock.calls.at(-1)?.[1];
    expect(fullPreviewComposition?.durationMs).toBe(3200);
    expect(fullPreviewComposition?.layers.map((layer) => ({ id: layer.id, startMs: layer.startMs }))).toEqual([
      { id: "hero", startMs: 120 },
      { id: "badge", startMs: 1020 },
    ]);
    expect(previewLabel?.textContent).toContain("전체 어셈블리");

    exportV1Button?.click();

    const fullExportBlob = urlCreateObjectUrl.mock.calls[1]?.[0] as Blob;
    const fullExportDocument = JSON.parse(await fullExportBlob.text()) as {
      readonly schemaVersion: string;
      readonly composition: {
        readonly id: string;
        readonly durationMs: number;
        readonly layers: readonly { readonly id: string; readonly startMs: number }[];
        readonly sequences: readonly { readonly id: string }[];
      };
    };
    expect(fullExportDocument.schemaVersion).toBe("qa-sdk.motion-composition/v1");
    expect(fullExportDocument.composition.id).toBe("overlap-v2");
    expect(fullExportDocument.composition.durationMs).toBe(3200);
    expect(fullExportDocument.composition.layers.map((layer) => ({ id: layer.id, startMs: layer.startMs }))).toEqual([
      { id: "hero", startMs: 120 },
      { id: "badge", startMs: 1020 },
    ]);
    expect(fullExportDocument.composition.sequences.map((sequence) => ({ id: sequence.id }))).toEqual([
      { id: "intro-seq" },
      { id: "badge-seq" },
    ]);

    expect(anchorClick).toHaveBeenCalledTimes(2);

    shell.destroy();
  });

  it("adds and removes layers from the Layers panel", () => {
    const shell = createMotionEditorShell({ container });

    const addLayerButton = container.querySelector<HTMLButtonElement>('[data-action="add-layer"]');
    const initialDeleteButton = container.querySelector<HTMLButtonElement>('[data-remove-layer="headline"]');

    expect(addLayerButton).toBeTruthy();
    expect(initialDeleteButton).toBeTruthy();

    const initialLayerCount = shell.getState().composition.layers.length;
    addLayerButton!.click();

    const expectedLayerId = `layer-${initialLayerCount + 1}`;
    const addedLayer = shell.getState().composition.layers.find((layer) => layer.id === expectedLayerId);
    expect(addedLayer).toMatchObject({
      id: expectedLayerId,
      label: `Layer ${initialLayerCount + 1}`,
      target: { kind: "stage-node", nodeId: expectedLayerId },
      content: { type: "dom" },
      enter: { preset: "slide-up-default" },
      durationMs: 1200,
    });
    expect(shell.getState().selection).toEqual({ kind: "layer", id: expectedLayerId });

    const removeLayerButton = container.querySelector<HTMLButtonElement>(`[data-remove-layer="${expectedLayerId}"]`);
    expect(removeLayerButton).toBeTruthy();

    removeLayerButton!.click();

    expect(shell.getState().composition.layers.some((layer) => layer.id === expectedLayerId)).toBe(false);
    expect(shell.getState().selection).toBeNull();

    shell.destroy();
  });

  it("adds and removes sequences, captions, and transitions from their panels", () => {
    const shell = createMotionEditorShell({ container });

    container.querySelector<HTMLButtonElement>('[data-panel-tab="sequences"]')?.click();

    const addSequenceButton = container.querySelector<HTMLButtonElement>('[data-action="add-sequence"]');
    expect(addSequenceButton).toBeTruthy();

    const initialSequenceCount = shell.getState().composition.sequences.length;
    addSequenceButton!.click();

    const expectedSequenceId = `sequence-${initialSequenceCount + 1}`;
    expect(shell.getState().composition.sequences.find((sequence) => sequence.id === expectedSequenceId)).toMatchObject({
      id: expectedSequenceId,
      title: `Sequence ${initialSequenceCount + 1}`,
      layerIds: [],
      captionIds: [],
    });
    expect(shell.getState().selection).toEqual({ kind: "sequence", id: expectedSequenceId });

    const removeSequenceButton = container.querySelector<HTMLButtonElement>(`[data-remove-sequence="${expectedSequenceId}"]`);
    expect(removeSequenceButton).toBeTruthy();
    removeSequenceButton!.click();

    expect(shell.getState().composition.sequences.some((sequence) => sequence.id === expectedSequenceId)).toBe(false);
    expect(shell.getState().selection).toBeNull();

    container.querySelector<HTMLButtonElement>('[data-panel-tab="properties"]')?.click();

    const addCaptionButton = container.querySelector<HTMLButtonElement>('[data-action="add-caption"]');
    const addTransitionButton = container.querySelector<HTMLButtonElement>('[data-action="add-transition"]');

    expect(addCaptionButton).toBeTruthy();
    expect(addTransitionButton).toBeTruthy();

    const initialCaptionCount = shell.getState().composition.captions.length;
    addCaptionButton!.click();

    const expectedCaptionId = `cap-${initialCaptionCount + 1}`;
    expect(shell.getState().composition.captions.find((caption) => caption.id === expectedCaptionId)).toMatchObject({
      id: expectedCaptionId,
      text: `새 캡션 ${initialCaptionCount + 1}`,
      tone: "neutral",
      durationMs: 1200,
    });
    expect(shell.getState().selection).toEqual({ kind: "caption", id: expectedCaptionId });

    const removeCaptionButton = container.querySelector<HTMLButtonElement>(`[data-remove-caption="${expectedCaptionId}"]`);
    expect(removeCaptionButton).toBeTruthy();
    removeCaptionButton!.click();

    expect(shell.getState().composition.captions.some((caption) => caption.id === expectedCaptionId)).toBe(false);
    expect(shell.getState().selection).toBeNull();

    addTransitionButton!.click();

    expect(shell.getState().composition.transitions.find((transition) => transition.id === "intro-cards-2")).toMatchObject({
      id: "intro-cards-2",
      fromSequenceId: "intro",
      toSequenceId: "cards",
      style: "crossfade",
      durationMs: 320,
    });
    expect(shell.getState().selection).toEqual({ kind: "transition", id: "intro-cards-2" });

    const removeTransitionButton = container.querySelector<HTMLButtonElement>('[data-remove-transition="intro-cards-2"]');
    expect(removeTransitionButton).toBeTruthy();
    removeTransitionButton!.click();

    expect(shell.getState().composition.transitions.some((transition) => transition.id === "intro-cards-2")).toBe(false);
    expect(shell.getState().selection).toBeNull();

    shell.destroy();
  });

  it("keeps timeline drag preview separate from commit and undo history", () => {
    const shell = createMotionEditorShell({ container });
    stubTimelineGeometry(container);

    const timelinePanel = container.querySelector<HTMLElement>('[data-panel="timeline"]');
    const introBar = container.querySelector<HTMLElement>('[data-bar-kind="sequence"][data-bar-id="intro"]');
    const undoButton = container.querySelector<HTMLButtonElement>('[data-action="undo"]');

    expect(timelinePanel).toBeTruthy();
    expect(introBar).toBeTruthy();

    const initialSeq = shell.getState().composition.sequences.find((s) => s.id === "intro");
    expect(initialSeq?.startMs).toBe(0);
    expect(undoButton?.disabled).toBe(true);

    dispatchPointerEvent(introBar!, "pointerdown", 7, 12);
    dispatchPointerEvent(timelinePanel!, "pointermove", 7, 100);

    expect(shell.getState().selection).toEqual({ kind: "sequence", id: "intro" });
    // preview 상태: sequence가 이동됨
    const previewSeq = shell.getState().composition.sequences.find((s) => s.id === "intro");
    expect(previewSeq?.startMs).not.toBe(0);
    expect(undoButton?.disabled).toBe(true);

    dispatchPointerEvent(timelinePanel!, "pointerup", 7, 100);

    // commit 후 undo 가능
    expect(undoButton?.disabled).toBe(false);

    undoButton!.click();
    // undo 후 원래 위치로 복귀
    expect(shell.getState().composition.sequences.find((s) => s.id === "intro")?.startMs).toBe(0);

    shell.destroy();
  });

  it("renders the bottom timeline ruler and keeps the playhead synced to transport", () => {
    const shell = createMotionEditorShell({ container });

    const timelinePanel = container.querySelector<HTMLElement>('[data-panel="timeline"]');
    const initialSurface = timelinePanel?.querySelector<HTMLElement>('[data-timeline-surface="true"]');
    const initialRuler = timelinePanel?.querySelector<HTMLElement>('[data-timeline-ruler="true"]');
    const initialPlayhead = timelinePanel?.querySelector<HTMLElement>('[data-timeline-playhead="true"]');
    const initialRatio = initialSurface?.style.getPropertyValue("--mce-timeline-playhead-ratio");

    expect(initialRuler).toBeTruthy();
    expect(initialPlayhead).toBeTruthy();
    expect(timelinePanel?.querySelectorAll("[data-ruler-tick]").length).toBeGreaterThan(2);
    expect(initialRatio).toBe("0");

    shell.dispatch({ type: "set-current-time", timeMs: 1800 });

    const updatedSurface = timelinePanel?.querySelector<HTMLElement>('[data-timeline-surface="true"]');
    expect(updatedSurface?.style.getPropertyValue("--mce-timeline-playhead-ratio")).not.toBe(initialRatio);

    shell.destroy();
  });

  it("supports dock tabs, splitter resize, and collapse controls", () => {
    const shell = createMotionEditorShell({ container });
    const root = container.querySelector<HTMLElement>(".mce-root");
    const leftGroup = container.querySelector<HTMLElement>('[data-panel-group="left"]');
    const rightGroup = container.querySelector<HTMLElement>('[data-panel-group="right"]');
    const bottomGroup = container.querySelector<HTMLElement>('[data-panel-group="bottom"]');
    const leftSplitter = container.querySelector<HTMLElement>('[data-splitter="left"]');
    const bottomSplitter = container.querySelector<HTMLElement>('[data-splitter="bottom"]');

    expect(root).toBeTruthy();
    expect(leftGroup?.dataset["activeTab"]).toBe("properties");
    expect(rightGroup?.dataset["activeTab"]).toBe("selection-detail");
    expect(bottomGroup?.dataset["activeTab"]).toBe("timeline");

    leftGroup?.querySelector<HTMLButtonElement>('[data-panel-tab="layers"]')?.click();
    rightGroup?.querySelector<HTMLButtonElement>('[data-panel-tab="active-state"]')?.click();

    expect(leftGroup?.dataset["activeTab"]).toBe("layers");
    expect(rightGroup?.dataset["activeTab"]).toBe("active-state");

    leftGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();
    expect(leftGroup?.dataset["collapsed"]).toBe("true");
    expect(root?.style.getPropertyValue("--mce-left-size")).toBe("72px");

    leftGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();
    expect(leftGroup?.dataset["collapsed"]).toBe("false");
    expect(root?.style.getPropertyValue("--mce-left-size")).toBe("320px");

    dispatchPointerEvent(leftSplitter!, "pointerdown", 11, 100);
    dispatchPointerEvent(document, "pointermove", 11, 180);
    dispatchPointerEvent(document, "pointerup", 11, 180);
    expect(root?.style.getPropertyValue("--mce-left-size")).toBe("400px");

    dispatchPointerEvent(bottomSplitter!, "pointerdown", 12, 0, 200);
    dispatchPointerEvent(document, "pointermove", 12, 0, 120);
    dispatchPointerEvent(document, "pointerup", 12, 0, 120);
    expect(root?.style.getPropertyValue("--mce-bottom-size")).toBe("300px");

    bottomGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();
    expect(bottomGroup?.dataset["collapsed"]).toBe("true");
    expect(root?.style.getPropertyValue("--mce-bottom-size")).toBe("56px");

    shell.destroy();
  });

  it("renders scrub fields for every numeric value in selection detail", () => {
    const shell = createMotionEditorShell({
      container,
      composition: createPromoGridComposition("crossfade"),
    });
    const selectionDetail = container.querySelector<HTMLElement>('[data-panel="selection-detail"]');

    shell.dispatch({ type: "select", selection: { kind: "layer", id: "headline" } });
    expect(selectionDetail?.querySelector('[data-scrub-field="startMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="durationMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="offsetMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="zIndex"]')).toBeTruthy();

    shell.dispatch({ type: "select", selection: { kind: "sequence", id: "cards" } });
    expect(selectionDetail?.querySelector('[data-scrub-field="startMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="durationMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="startOffsetMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="intervalMs"]')).toBeTruthy();

    shell.dispatch({ type: "select", selection: { kind: "transition", id: "intro-cards" } });
    expect(selectionDetail?.querySelector('[data-scrub-field="durationMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="brightness"]')).toBeTruthy();

    shell.dispatch({ type: "select", selection: { kind: "caption", id: "cap-2" } });
    expect(selectionDetail?.querySelector('[data-scrub-field="startMs"]')).toBeTruthy();
    expect(selectionDetail?.querySelector('[data-scrub-field="durationMs"]')).toBeTruthy();

    shell.destroy();
  });

  it("supports inline string editing in selection detail", () => {
    const shell = createMotionEditorShell({
      container,
      composition: createPromoGridComposition("crossfade"),
    });
    const selectionDetail = container.querySelector<HTMLElement>('[data-panel="selection-detail"]');

    shell.dispatch({ type: "select", selection: { kind: "layer", id: "headline" } });
    const layerField = selectionDetail?.querySelector<HTMLElement>(
      '[data-inline-text-field="label"][data-item-kind="layer"][data-item-id="headline"]',
    );
    const layerDisplay = layerField?.querySelector<HTMLElement>('[data-inline-text-display="true"]');
    const layerEditor = layerField?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    expect(layerField).toBeTruthy();
    dispatchMouseEvent(layerDisplay!, "click");
    expect(layerField?.dataset["editing"]).toBe("true");
    layerEditor!.value = "새 레이어 라벨";
    layerEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(shell.getState().composition.layers.find((layer) => layer.id === "headline")?.label).toBe("새 레이어 라벨");

    shell.dispatch({ type: "select", selection: { kind: "sequence", id: "cards" } });
    const originalTitle = shell.getState().composition.sequences.find((sequence) => sequence.id === "cards")?.title;
    const titleField = selectionDetail?.querySelector<HTMLElement>(
      '[data-inline-text-field="title"][data-item-kind="sequence"][data-item-id="cards"]',
    );
    const titleDisplay = titleField?.querySelector<HTMLElement>('[data-inline-text-display="true"]');
    const titleEditor = titleField?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    expect(titleField).toBeTruthy();
    dispatchMouseEvent(titleDisplay!, "click");
    titleEditor!.value = "변경되면 안 됨";
    titleEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(shell.getState().composition.sequences.find((sequence) => sequence.id === "cards")?.title).toBe(originalTitle);

    shell.dispatch({ type: "select", selection: { kind: "caption", id: "cap-2" } });
    const originalText = shell.getState().composition.captions.find((caption) => caption.id === "cap-2")?.text;
    const textField = selectionDetail?.querySelector<HTMLElement>(
      '[data-inline-text-field="text"][data-item-kind="caption"][data-item-id="cap-2"]',
    );
    const textDisplay = textField?.querySelector<HTMLElement>('[data-inline-text-display="true"]');
    const textEditor = textField?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    expect(textField).toBeTruthy();
    dispatchMouseEvent(textDisplay!, "click");
    textEditor!.value = "   ";
    textEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(shell.getState().composition.captions.find((caption) => caption.id === "cap-2")?.text).toBe(originalText);
    expect(textField?.dataset["editing"]).toBe("true");
    expect(textField?.dataset["invalid"]).toBe("true");
    textEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(textField?.dataset["editing"]).toBe("false");

    shell.destroy();
  });

  it("supports scrub dragging with modifiers and direct input in selection detail", () => {
    const shell = createMotionEditorShell({
      container,
      composition: createPromoGridComposition("crossfade"),
    });
    const selectionDetail = container.querySelector<HTMLElement>('[data-panel="selection-detail"]');

    shell.dispatch({ type: "select", selection: { kind: "layer", id: "headline" } });
    const layerStartField = selectionDetail?.querySelector<HTMLElement>(
      '[data-scrub-field="startMs"][data-scrub-command="layer-relative-start"]',
    );
    const layerStartDisplay = layerStartField?.querySelector<HTMLElement>('[data-scrub-display="true"]');
    expect(layerStartDisplay).toBeTruthy();

    dispatchPointerEvent(layerStartDisplay!, "pointerdown", 31, 100);
    dispatchPointerEvent(window, "pointermove", 31, 130);
    dispatchPointerEvent(window, "pointerup", 31, 130);

    expect(shell.getState().composition.layers.find((layer) => layer.id === "headline")?.startMs).toBe(150);
    expect(
      shell.getState().composition.sequences.find((sequence) => sequence.id === "intro")?.layers?.find((slot) => slot.layerId === "headline")?.offsetMs,
    ).toBe(150);

    shell.dispatch({ type: "select", selection: { kind: "transition", id: "intro-cards" } });
    const brightnessField = selectionDetail?.querySelector<HTMLElement>('[data-scrub-field="brightness"]');
    const brightnessDisplay = brightnessField?.querySelector<HTMLElement>('[data-scrub-display="true"]');
    expect(brightnessDisplay).toBeTruthy();

    dispatchPointerEvent(brightnessDisplay!, "pointerdown", 32, 50);
    dispatchPointerEvent(window, "pointermove", 32, 52, 0, { shiftKey: true });
    dispatchPointerEvent(window, "pointerup", 32, 52, 0, { shiftKey: true });

    expect(
      (shell.getState().composition.transitions.find((transition) => transition.id === "intro-cards")?.params as { brightness?: number } | undefined)?.brightness,
    ).toBeCloseTo(1.02, 5);

    shell.dispatch({ type: "select", selection: { kind: "sequence", id: "cards" } });
    const durationField = selectionDetail?.querySelector<HTMLElement>('[data-scrub-field="durationMs"]');
    const durationDisplay = durationField?.querySelector<HTMLElement>('[data-scrub-display="true"]');
    expect(durationDisplay).toBeTruthy();

    dispatchPointerEvent(durationDisplay!, "pointerdown", 33, 10);
    dispatchPointerEvent(window, "pointermove", 33, 20, 0, { altKey: true });
    dispatchPointerEvent(window, "pointerup", 33, 20, 0, { altKey: true });

    expect(shell.getState().composition.sequences.find((sequence) => sequence.id === "cards")?.durationMs).toBe(2801);

    const refreshedDurationField = selectionDetail?.querySelector<HTMLElement>('[data-scrub-field="durationMs"]');
    const durationEditor = refreshedDurationField?.querySelector<HTMLInputElement>('[data-scrub-editor="true"]');
    expect(durationEditor).toBeTruthy();

    dispatchMouseEvent(refreshedDurationField!.querySelector<HTMLElement>('[data-scrub-display="true"]')!, "dblclick");
    expect(refreshedDurationField?.dataset["editing"]).toBe("true");

    durationEditor!.value = "2400";
    durationEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(shell.getState().composition.sequences.find((sequence) => sequence.id === "cards")?.durationMs).toBe(2400);

    shell.destroy();
  });

  it("renders selection detail dropdowns and color pickers for enum/color edits", () => {
    const shell = createMotionEditorShell({
      container,
      composition: createPromoGridComposition("crossfade"),
    });
    const selectionDetail = container.querySelector<HTMLElement>('[data-panel="selection-detail"]');
    const accentInput = container.querySelector<HTMLInputElement>('[data-param="accent"]');

    expect(accentInput?.type).toBe("color");

    shell.dispatch({ type: "select", selection: { kind: "layer", id: "headline" } });

    const cueKindSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="layer-cue-kind"][data-layer-id="headline"][data-cue-field="enter"]',
    );
    expect(cueKindSelect).toBeTruthy();
    cueKindSelect!.value = "scale-pop";
    cueKindSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shell.getState().composition.layers.find((layer) => layer.id === "headline")?.enter).toMatchObject({
      kind: "scale-pop",
    });

    const contentTypeSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="layer-content-type"][data-layer-id="headline"]',
    );
    expect(contentTypeSelect).toBeTruthy();
    contentTypeSelect!.value = "video";
    contentTypeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shell.getState().composition.layers.find((layer) => layer.id === "headline")?.content).toMatchObject({
      type: "video",
    });

    const slotRoleSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="sequence-layer-role"][data-sequence-id="intro"][data-layer-id="headline"]',
    );
    expect(slotRoleSelect).toBeTruthy();
    slotRoleSelect!.value = "overlay";
    slotRoleSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      shell.getState().composition.sequences.find((sequence) => sequence.id === "intro")?.layers?.find((slot) => slot.layerId === "headline")?.role,
    ).toBe("overlay");

    shell.dispatch({ type: "select", selection: { kind: "layer", id: "card-a" } });
    const presetSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="layer-cue-preset"][data-layer-id="card-a"][data-cue-field="enter"]',
    );
    expect(presetSelect).toBeTruthy();
    presetSelect!.value = "slide-up-default";
    presetSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shell.getState().composition.layers.find((layer) => layer.id === "card-a")?.enter).toEqual({
      preset: "slide-up-default",
    });

    shell.dispatch({ type: "select", selection: { kind: "transition", id: "intro-cards" } });
    const styleSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="transition-style"][data-transition-id="intro-cards"]',
    );
    expect(styleSelect).toBeTruthy();
    styleSelect!.value = "flash";
    styleSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shell.getState().composition.transitions.find((transition) => transition.id === "intro-cards")?.style).toBe("flash");

    const glowColorInput = selectionDetail?.querySelector<HTMLInputElement>(
      '[data-selection-control="transition-param-color"][data-transition-id="intro-cards"]',
    );
    expect(glowColorInput?.type).toBe("color");
    glowColorInput!.value = "#112233";
    glowColorInput!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shell.getState().composition.transitions.find((transition) => transition.id === "intro-cards")?.params).toMatchObject({
      glowColor: "rgba(17,34,51,0.24)",
      glowSize: 120,
    });

    shell.destroy();
  });

  it("selects and edits cue presets from the inspector", () => {
    const base = createPromoGridComposition("crossfade");
    const composition = {
      ...base,
      layers: base.layers.map((layer) =>
        layer.id === "card-a"
          ? Object.assign({}, layer, { enter: { preset: "slide-up-default" } })
          : layer
      ),
    };
    const shell = createMotionEditorShell({ container, composition });
    const cuePresetButton = container.querySelector<HTMLButtonElement>('[data-cue-preset="slide-up-default"]');
    const selectionDetail = container.querySelector<HTMLElement>('[data-panel="selection-detail"]');

    expect(cuePresetButton).toBeTruthy();

    cuePresetButton!.click();

    expect(shell.getState().selection).toEqual({ kind: "cue-preset", id: "slide-up-default" });
    expect(selectionDetail?.textContent).toContain("kind");
    expect(selectionDetail?.textContent).toContain("durationMs");
    expect(selectionDetail?.textContent).toContain("references");
    expect(selectionDetail?.textContent).toContain("Card A");
    expect(selectionDetail?.textContent).toContain("Outro");

    const kindSelect = selectionDetail?.querySelector<HTMLSelectElement>(
      '[data-selection-control="cue-preset-kind"][data-preset-id="slide-up-default"]',
    );
    expect(kindSelect).toBeTruthy();
    kindSelect!.value = "slide-right";
    kindSelect!.dispatchEvent(new Event("change", { bubbles: true }));

    const amountField = selectionDetail?.querySelector<HTMLElement>(
      '[data-scrub-field="amount"][data-preset-id="slide-up-default"]',
    );
    const amountDisplay = amountField?.querySelector<HTMLElement>('[data-scrub-display="true"]');
    expect(amountDisplay).toBeTruthy();

    dispatchPointerEvent(amountDisplay!, "pointerdown", 41, 100);
    dispatchPointerEvent(window, "pointermove", 41, 112);
    expect(shell.getState().selection).toEqual({ kind: "cue-preset", id: "slide-up-default" });
    dispatchPointerEvent(window, "pointerup", 41, 112);

    const easeField = selectionDetail?.querySelector<HTMLElement>(
      '[data-inline-text-field="ease"][data-preset-id="slide-up-default"]',
    );
    const easeDisplay = easeField?.querySelector<HTMLElement>('[data-inline-text-display="true"]');
    const easeEditor = easeField?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    expect(easeField).toBeTruthy();
    dispatchMouseEvent(easeDisplay!, "click");
    easeEditor!.value = "expo.out";
    easeEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    const durationField = selectionDetail?.querySelector<HTMLElement>(
      '[data-scrub-field="durationMs"][data-preset-id="slide-up-default"]',
    );
    const durationDisplay = durationField?.querySelector<HTMLElement>('[data-scrub-display="true"]');
    expect(durationDisplay).toBeTruthy();

    dispatchPointerEvent(durationDisplay!, "pointerdown", 42, 20);
    dispatchPointerEvent(window, "pointermove", 42, 50);
    dispatchPointerEvent(window, "pointerup", 42, 50);

    const updatedPreset = shell.getState().composition.cuePresets?.find((preset) => preset.id === "slide-up-default");
    expect(updatedPreset).toMatchObject({
      kind: "slide-right",
      durationMs: 450,
      ease: "expo.out",
      amount: 60,
    });
    expect(shell.getState().selection).toEqual({ kind: "cue-preset", id: "slide-up-default" });

    const cardAEnter = shell.getState().composition.layers.find((layer) => layer.id === "card-a")?.enter;
    const outroEnter = shell.getState().composition.layers.find((layer) => layer.id === "outro")?.enter;
    expect(resolveCue(cardAEnter!, shell.getState().composition.cuePresets)).toMatchObject({
      kind: "slide-right",
      durationMs: 450,
      ease: "expo.out",
      amount: 60,
    });
    expect(resolveCue(outroEnter!, shell.getState().composition.cuePresets)).toMatchObject({
      kind: "slide-right",
      durationMs: 450,
      ease: "expo.out",
      amount: 60,
    });

    const refreshedEaseField = selectionDetail?.querySelector<HTMLElement>(
      '[data-inline-text-field="ease"][data-preset-id="slide-up-default"]',
    );
    const refreshedEaseDisplay = refreshedEaseField?.querySelector<HTMLElement>('[data-inline-text-display="true"]');
    const refreshedEaseEditor = refreshedEaseField?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    dispatchMouseEvent(refreshedEaseDisplay!, "click");
    refreshedEaseEditor!.value = "   ";
    refreshedEaseEditor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(shell.getState().composition.cuePresets?.find((preset) => preset.id === "slide-up-default")?.ease).toBeUndefined();
    expect(refreshedEaseField?.dataset["editing"]).toBe("false");

    shell.destroy();
  });

  it("persists dock layout changes and restores them on the next shell", () => {
    const shell = createMotionEditorShell({ container });
    const root = container.querySelector<HTMLElement>(".mce-root");
    const leftGroup = container.querySelector<HTMLElement>('[data-panel-group="left"]');
    const rightGroup = container.querySelector<HTMLElement>('[data-panel-group="right"]');
    const leftSplitter = container.querySelector<HTMLElement>('[data-splitter="left"]');
    const bottomSplitter = container.querySelector<HTMLElement>('[data-splitter="bottom"]');

    leftGroup?.querySelector<HTMLButtonElement>('[data-panel-tab="layers"]')?.click();
    rightGroup?.querySelector<HTMLButtonElement>('[data-panel-tab="active-state"]')?.click();

    dispatchPointerEvent(leftSplitter!, "pointerdown", 21, 100);
    dispatchPointerEvent(document, "pointermove", 21, 180);
    dispatchPointerEvent(document, "pointerup", 21, 180);

    dispatchPointerEvent(bottomSplitter!, "pointerdown", 22, 0, 200);
    dispatchPointerEvent(document, "pointermove", 22, 0, 120);
    dispatchPointerEvent(document, "pointerup", 22, 0, 120);

    leftGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();

    expect(root?.style.getPropertyValue("--mce-left-size")).toBe("72px");
    expect(root?.style.getPropertyValue("--mce-bottom-size")).toBe("300px");

    expect(readStoredLayout()).toEqual({
      left: {
        size: 400,
        activeTabId: "layers",
        collapsed: true,
      },
      right: {
        size: 320,
        activeTabId: "active-state",
        collapsed: false,
      },
      bottom: {
        size: 300,
        activeTabId: "timeline",
        collapsed: false,
      },
    });

    shell.destroy();

    const restoredShell = createMotionEditorShell({ container });
    const restoredRoot = container.querySelector<HTMLElement>(".mce-root");
    const restoredLeftGroup = container.querySelector<HTMLElement>('[data-panel-group="left"]');
    const restoredRightGroup = container.querySelector<HTMLElement>('[data-panel-group="right"]');

    expect(restoredLeftGroup?.dataset["activeTab"]).toBe("layers");
    expect(restoredLeftGroup?.dataset["collapsed"]).toBe("true");
    expect(restoredRightGroup?.dataset["activeTab"]).toBe("active-state");
    expect(restoredRoot?.style.getPropertyValue("--mce-left-size")).toBe("72px");
    expect(restoredRoot?.style.getPropertyValue("--mce-bottom-size")).toBe("300px");

    restoredLeftGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();
    expect(restoredRoot?.style.getPropertyValue("--mce-left-size")).toBe("400px");

    restoredShell.destroy();
  });

  it("adds scenes, renames them, and places shared targets from the scenes panel", () => {
    vi.stubGlobal("prompt", vi.fn(() => "Stinger Focus"));

    const shell = createMotionEditorShell({
      container,
      composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
    });

    container.querySelector<HTMLButtonElement>('[data-panel-tab="scenes"]')?.click();

    const addSceneButton = container.querySelector<HTMLButtonElement>('[data-action="add-scene"]');
    expect(addSceneButton).toBeTruthy();

    addSceneButton!.click();

    expect(shell.getState().selection).toEqual({ kind: "scene", id: "scene-2" });
    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    expect(shell.getState().composition.scenes.find((scene) => scene.id === "scene-2")).toMatchObject({
      id: "scene-2",
      title: "Scene 2",
      layers: [],
    });

    const addPlacementButton = container.querySelector<HTMLButtonElement>(
      '[data-add-scene-placement="headline"][data-scene-id="scene-2"]',
    );
    expect(addPlacementButton?.disabled).toBe(false);
    addPlacementButton!.click();

    expect(shell.getState().selection).toEqual({
      kind: "scene-layer",
      sceneId: "scene-2",
      targetId: "headline",
    });
    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    expect(
      shell.getState().composition.scenes.find((scene) => scene.id === "scene-2")?.layers.some((placement) => placement.targetId === "headline"),
    ).toBe(true);

    const renameSceneButton = container.querySelector<HTMLButtonElement>('[data-rename-scene="scene-2"]');
    expect(renameSceneButton).toBeTruthy();
    renameSceneButton!.click();

    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    expect(shell.getState().composition.scenes.find((scene) => scene.id === "scene-2")?.title).toBe("Stinger Focus");

    const removeSceneButton = container.querySelector<HTMLButtonElement>('[data-remove-scene="scene-2"]');
    expect(removeSceneButton).toBeTruthy();
    removeSceneButton!.click();

    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    expect(shell.getState().composition.scenes.some((scene) => scene.id === "scene-2")).toBe(false);

    shell.destroy();
  });

  it("switches the timeline into focused scene placement view and edits placements in isolation", () => {
    const shell = createMotionEditorShell({
      container,
      composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
    });
    const timelinePanel = container.querySelector<HTMLElement>('[data-panel="timeline"]');

    expect(timelinePanel).toBeTruthy();

    stubTimelineGeometry(container);

    const sceneBar = container.querySelector<HTMLElement>('[data-bar-kind="scene"][data-bar-id="main"]');
    expect(sceneBar).toBeTruthy();

    dispatchPointerEvent(sceneBar!, "pointerdown", 61, 12);
    dispatchPointerEvent(timelinePanel!, "pointerup", 61, 12);

    expect(shell.getState().selection).toEqual({ kind: "scene", id: "main" });
    expect(timelinePanel?.textContent).toContain("Scene Focus");
    expect(timelinePanel?.querySelector('[data-bar-kind="scene"]')).toBeNull();
    expect(timelinePanel?.querySelectorAll('[data-bar-kind="layer"]').length).toBeGreaterThan(0);

    stubTimelineGeometry(container);

    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    const beforeStartMs = shell.getState().composition.scenes
      .find((scene) => scene.id === "main")
      ?.layers.find((placement) => placement.targetId === "headline")
      ?.startMs;

    const headlineBar = timelinePanel?.querySelector<HTMLElement>('[data-bar-kind="layer"][data-bar-id="headline"]');
    expect(headlineBar).toBeTruthy();

    dispatchPointerEvent(headlineBar!, "pointerdown", 62, 20);
    dispatchPointerEvent(timelinePanel!, "pointermove", 62, 120);

    expect(shell.getState().selection).toEqual({
      kind: "scene-layer",
      sceneId: "main",
      targetId: "headline",
    });
    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    const previewStartMs = shell.getState().composition.scenes
      .find((scene) => scene.id === "main")
      ?.layers.find((placement) => placement.targetId === "headline")
      ?.startMs;
    expect(previewStartMs).not.toBe(beforeStartMs);

    dispatchPointerEvent(timelinePanel!, "pointerup", 62, 120);

    if (!("scenes" in shell.getState().composition)) {
      throw new Error("expected scene composition");
    }
    const committedStartMs = shell.getState().composition.scenes
      .find((scene) => scene.id === "main")
      ?.layers.find((placement) => placement.targetId === "headline")
      ?.startMs;
    expect(committedStartMs).not.toBe(beforeStartMs);

    shell.destroy();
  });

  it("renders scene presence badges and emits focused scene changes", () => {
    const onFocusedSceneChange = vi.fn();
    const shell = createMotionEditorShell({
      container,
      composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
      scenePresence: [
        {
          sceneId: "main",
          users: [
            { userId: "alpha", name: "alpha", color: "#ff8a5b" },
            { userId: "beta", name: "beta", color: "#4db6ac" },
          ],
          locked: true,
        },
      ],
      onFocusedSceneChange,
    });

    const scenesPanel = container.querySelector<HTMLElement>('[data-panel="scenes"]');
    const sceneButton = container.querySelector<HTMLElement>('[data-scene="main"]');
    const sceneBar = container.querySelector<HTMLElement>('[data-bar-kind="scene"][data-bar-id="main"]');

    expect(scenesPanel?.textContent).toContain("alpha");
    expect(scenesPanel?.textContent).toContain("beta");
    expect(sceneButton?.dataset["sceneLocked"]).toBe("true");
    expect(sceneBar?.querySelector(".mce-user-badge")?.textContent).toBeTruthy();
    expect(sceneBar?.querySelector(".mce-lock-pill")?.textContent).toContain("LOCK");

    shell.setScenePresence([
      {
        sceneId: "main",
        users: [{ userId: "charlie", name: "charlie", color: "#7c9cff" }],
        locked: false,
      },
    ]);

    const refreshedSceneButton = container.querySelector<HTMLElement>('[data-scene="main"]');
    const refreshedSceneBar = container.querySelector<HTMLElement>('[data-bar-kind="scene"][data-bar-id="main"]');
    expect(scenesPanel?.textContent).toContain("charlie");
    expect(refreshedSceneButton?.dataset["sceneLocked"]).toBe("false");
    expect(refreshedSceneBar?.querySelector(".mce-lock-pill")).toBeNull();

    refreshedSceneButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onFocusedSceneChange).toHaveBeenLastCalledWith("main");

    const clearFocusButton = container.querySelector<HTMLButtonElement>('[data-action="clear-scene-focus"]');
    expect(clearFocusButton).toBeTruthy();
    clearFocusButton?.click();
    expect(onFocusedSceneChange).toHaveBeenLastCalledWith(null);

    shell.destroy();
  });

  it("resets the layout to defaults and clears stored layout state", () => {
    const shell = createMotionEditorShell({ container });
    const root = container.querySelector<HTMLElement>(".mce-root");
    const leftGroup = container.querySelector<HTMLElement>('[data-panel-group="left"]');
    const bottomGroup = container.querySelector<HTMLElement>('[data-panel-group="bottom"]');
    const leftSplitter = container.querySelector<HTMLElement>('[data-splitter="left"]');
    const resetLayoutButton = container.querySelector<HTMLButtonElement>('[data-action="reset-layout"]');

    leftGroup?.querySelector<HTMLButtonElement>('[data-panel-tab="layers"]')?.click();

    dispatchPointerEvent(leftSplitter!, "pointerdown", 31, 100);
    dispatchPointerEvent(document, "pointermove", 31, 180);
    dispatchPointerEvent(document, "pointerup", 31, 180);

    bottomGroup?.querySelector<HTMLButtonElement>(".mce-panel-group__collapse")?.click();

    expect(readStoredLayout()).not.toBeNull();

    resetLayoutButton?.click();

    expect(readMotionEditorPref(MOTION_EDITOR_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(leftGroup?.dataset["activeTab"]).toBe("properties");
    expect(leftGroup?.dataset["collapsed"]).toBe("false");
    expect(bottomGroup?.dataset["collapsed"]).toBe("false");
    expect(root?.style.getPropertyValue("--mce-left-size")).toBe("320px");
    expect(root?.style.getPropertyValue("--mce-right-size")).toBe("320px");
    expect(root?.style.getPropertyValue("--mce-bottom-size")).toBe("220px");

    shell.destroy();

    const restoredShell = createMotionEditorShell({ container });
    const restoredRoot = container.querySelector<HTMLElement>(".mce-root");
    const restoredLeftGroup = container.querySelector<HTMLElement>('[data-panel-group="left"]');
    const restoredBottomGroup = container.querySelector<HTMLElement>('[data-panel-group="bottom"]');

    expect(restoredLeftGroup?.dataset["activeTab"]).toBe("properties");
    expect(restoredLeftGroup?.dataset["collapsed"]).toBe("false");
    expect(restoredBottomGroup?.dataset["collapsed"]).toBe("false");
    expect(restoredRoot?.style.getPropertyValue("--mce-left-size")).toBe("320px");
    expect(restoredRoot?.style.getPropertyValue("--mce-bottom-size")).toBe("220px");

    restoredShell.destroy();
  });

  it("toggles the theme, persists it, and keeps the stage preview isolated", () => {
    const shell = createMotionEditorShell({ container });
    const themeToggleButton = container.querySelector<HTMLButtonElement>('[data-action="toggle-theme"]');
    const stageHost = container.querySelector<HTMLElement>(".mce-stage-host");

    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("dark");
    expect(document.documentElement.classList.contains("mce-dark")).toBe(true);
    expect(themeToggleButton?.textContent).toContain("다크");
    expect(stageHost?.style.isolation).toBe("isolate");
    expect(stageHost?.style.getPropertyValue("--mce-preview-surface-stage")).toBe(
      MOTION_EDITOR_THEMES.dark.color.surface.stage,
    );

    themeToggleButton?.click();

    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("light");
    expect(document.documentElement.classList.contains("mce-light")).toBe(true);
    expect(document.documentElement.classList.contains("mce-dark")).toBe(false);
    expect(themeToggleButton?.textContent).toContain("라이트");
    expect(readStoredTheme()).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--mce-color-surface-canvas")).toBe(
      MOTION_EDITOR_THEMES.light.color.surface.canvas,
    );
    expect(stageHost?.style.getPropertyValue("--mce-preview-surface-stage")).toBe(
      MOTION_EDITOR_THEMES.dark.color.surface.stage,
    );
    expect(stageHost?.style.getPropertyValue("--mce-preview-surface-canvas")).toBe(
      MOTION_EDITOR_THEMES.dark.color.surface.canvas,
    );

    shell.destroy();

    const restoredShell = createMotionEditorShell({ container });
    const restoredThemeToggleButton = container.querySelector<HTMLButtonElement>('[data-action="toggle-theme"]');
    const restoredStageHost = container.querySelector<HTMLElement>(".mce-stage-host");

    expect(document.documentElement.dataset["motionEditorTheme"]).toBe("light");
    expect(restoredThemeToggleButton?.textContent).toContain("라이트");
    expect(restoredStageHost?.style.getPropertyValue("--mce-preview-surface-stage")).toBe(
      MOTION_EDITOR_THEMES.dark.color.surface.stage,
    );

    restoredShell.destroy();
  });

  it("surfaces file import parse errors in both diagnostics and inline error panels", async () => {
    const shell = createMotionEditorShell({ container });
    const fileInput = container.querySelector<HTMLInputElement>('[data-action="file-input"]');
    const jsonErrorPanel = container.querySelector<HTMLElement>('[data-panel="json-error"]');
    const importDiagnosticsPanel = container.querySelector<HTMLElement>('[data-panel="import-diagnostics"]');

    expect(fileInput).toBeTruthy();

    Object.defineProperty(fileInput!, "files", {
      configurable: true,
      value: [
        {
          text: vi.fn().mockResolvedValue("{ invalid json"),
        },
      ],
    });

    fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(importDiagnosticsPanel?.textContent).toContain("실패");
    });

    expect(importDiagnosticsPanel?.textContent).toContain("실패");
    expect(importDiagnosticsPanel?.textContent).toContain("파일 업로드");
    expect(importDiagnosticsPanel?.textContent).toContain("JSON 파싱에 실패했습니다.");
    expect(jsonErrorPanel?.textContent).toContain("JSON 파싱에 실패했습니다.");
    expect(jsonErrorPanel?.classList.contains("is-visible")).toBe(true);

    shell.destroy();
  });
});
