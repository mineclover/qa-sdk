// @def.boundary motion-content-editor-system
import {
  assembleComposition,
  createMotionCompositionDocument,
  createMotionStageNodeTarget,
  createMotionDomStageAdapter,
  createMotionPlayer,
  findCaptionById,
  findLayerById,
  findSequenceById,
  findTransitionById,
  resolveMotionComposition,
  serializeMotionComposition,
  serializeMotionCompositionV2,
  syncMotionEditorState,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionCompositionSchema,
  type MotionCompositionDocumentV1,
  type MotionEditorCommand,
  type MotionEditorSession,
  type MotionEditorSelectionV2,
  type MotionEditorState,
  type MotionCueKind,
  type MotionItemKind,
  type MotionLayerContentType,
  type MotionParameterValues,
  type MotionPlayer,
  type MotionRuntimeSnapshot,
  type MotionSceneDef,
  type MotionStageAdapter,
  type MotionTransitionStyle,
  type MotionEventLog,
  type ResolvedMotionComposition,
  type ResolvedMotionCompositionSchema,
  type ResolvedMotionCompositionV2,
  type SequenceLayerSlotRole,
  createMotionEventLog,
} from "motion-content";
import {
  renderCuePresetsPanel,
  renderDiagnosticsPanel,
  renderCaptionPanel,
  renderImportDiagnosticsPanel,
  renderLayerPanel,
  renderSceneCaptionPanel,
  renderScenePlacementPanel,
  renderSceneSequencePanel,
  renderScenesPanel,
  renderSelectionDetail,
  type MotionFrameDiagnosticsState,
  type MotionImportDiagnosticsState,
  renderParameterControls,
  renderSequencePanel,
  renderTransitionPanel,
} from "./panels.js";
import { ensureMotionEditorStyles, MOTION_EDITOR_CSS } from "./styles.js";
import {
  applyMotionEditorTheme,
  DEFAULT_MOTION_EDITOR_THEME,
  MOTION_EDITOR_THEMES,
  readStoredMotionEditorTheme,
  writeStoredMotionEditorTheme,
  type MotionEditorThemeName,
} from "./design-tokens.js";
import {
  beginMotionTimelineDrag,
  renderMotionTimeline,
  type MotionTimelineDragState,
  updateMotionTimelineDrag,
} from "./timeline.js";
import { PanelGroup, Splitter } from "./panel-layout.js";
import { bindScrubInputs, type ScrubInputConfig } from "./scrub-input.js";
import { composeMotionColorValue } from "./color-input.js";
import { bindInlineTextInputs } from "./inline-text-input.js";
import { type MotionEditorScenePresenceEntry } from "./scene-presence.js";
import {
  MOTION_EDITOR_LAYOUT_STORAGE_KEY,
  clearMotionEditorPref,
  readMotionEditorPref,
  writeMotionEditorPref,
} from "./prefs-store.js";
import {
  createMotionEditorShellWorkspace,
  type MotionEditorShellWorkspace,
} from "./workspace.js";

export { MOTION_EDITOR_CSS } from "./styles.js";

export interface MotionEditorShellStage {
  readonly adapter: MotionStageAdapter;
}

export interface MotionEditorShellOptions {
  readonly container: HTMLElement;
  readonly composition?: MotionCompositionSchema;
  readonly values?: Partial<MotionParameterValues>;
  readonly workspace?: MotionEditorShellWorkspace;
  readonly scenePresence?: readonly MotionEditorScenePresenceEntry[];
  readonly renderStage?: (host: HTMLElement, state: MotionEditorState<ResolvedMotionCompositionSchema>) => MotionEditorShellStage;
  readonly onStateChange?: (state: MotionEditorState<ResolvedMotionCompositionSchema>) => void;
  readonly onFocusedSceneChange?: (sceneId: string | null) => void;
  /** 로컬 이벤트 로그. 제공하면 사용, 미제공 시 내부 생성 */
  readonly eventLog?: MotionEventLog;
}

export interface MotionEditorShell {
  getState(): MotionEditorState<ResolvedMotionCompositionSchema>;
  getFocusedSceneId(): string | null;
  setScenePresence(presence: readonly MotionEditorScenePresenceEntry[]): void;
  dispatch(command: MotionEditorCommand): void;
  readonly eventLog: MotionEventLog;
  destroy(): void;
}

const DEFAULT_PLAYBACK_RATE = 1;
const IDEAL_FRAME_MS = 1000 / 60;
const SLOW_FRAME_MS = 1000 / 30;
const DEFAULT_LEFT_WIDTH = 320;
const DEFAULT_RIGHT_WIDTH = 320;
const DEFAULT_BOTTOM_HEIGHT = 220;
const DEFAULT_NEW_LAYER_DURATION_MS = 1200;
const DEFAULT_NEW_SEQUENCE_DURATION_MS = 1200;
const DEFAULT_NEW_CAPTION_DURATION_MS = 1200;
const DEFAULT_NEW_SCENE_DURATION_MS = 1200;
const DEFAULT_NEW_TRANSITION_DURATION_MS = 320;
const COLLAPSED_SIDE_SIZE = 72;
const COLLAPSED_BOTTOM_SIZE = 56;
const MIN_LEFT_WIDTH = 260;
const MIN_RIGHT_WIDTH = 260;
const MIN_CENTER_WIDTH = 520;
const MIN_BOTTOM_HEIGHT = 160;
const MIN_WORKSPACE_HEIGHT = 360;
const SPLITTER_SIZE = 10;
const FALLBACK_LAYOUT_WIDTH = 1440;
const FALLBACK_LAYOUT_HEIGHT = 860;
const STAGE_PREVIEW_THEME = MOTION_EDITOR_THEMES.dark;

type MotionEditorLayoutArea = "left" | "right" | "bottom";

interface MotionEditorDockLayoutState {
  readonly size: number;
  readonly activeTabId: string;
  readonly collapsed: boolean;
}

type ShellState = MotionEditorState<ResolvedMotionCompositionSchema>;
type LinearShellState = MotionEditorState<ResolvedMotionComposition>;
type SceneShellState = MotionEditorState<ResolvedMotionCompositionV2>;
type MotionEditorPreviewMode = "full" | "scene";
type MotionEditorPreviewTarget =
  | { readonly mode: "full" }
  | { readonly mode: "scene"; readonly sceneId: string };

const FULL_PREVIEW_TARGET: MotionEditorPreviewTarget = { mode: "full" };

/** innerHTML 직후 자식 요소를 안전하게 선택하는 헬퍼 */
function requireElement<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`필수 요소를 찾을 수 없습니다: ${selector}`);
  }
  return el;
}

function isSceneComposition(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): composition is MotionCompositionDefV2 | ResolvedMotionCompositionV2 {
  return "targets" in composition && "scenes" in composition;
}

function isLinearShellState(
  state: ShellState,
): state is LinearShellState {
  return !isSceneComposition(state.composition);
}

function serializeMotionCompositionSchema(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): string {
  return isSceneComposition(composition)
    ? serializeMotionCompositionV2(composition)
    : serializeMotionComposition(composition as MotionCompositionDef);
}

function createSetCompositionCommand(
  composition: MotionCompositionSchema,
  values: MotionParameterValues,
): MotionEditorCommand {
  return isSceneComposition(composition)
    ? { type: "set-composition", composition, values }
    : { type: "set-composition", composition, values };
}

function describeSelectionId(
  selection: MotionEditorSelectionV2,
): string {
  return "id" in selection ? selection.id : `${selection.sceneId}:${selection.targetId}`;
}

function deriveSceneIdFromSelection(
  selection: MotionEditorSelectionV2 | null,
): string | null {
  if (!selection) {
    return null;
  }
  if (selection.kind === "scene") {
    return selection.id;
  }
  if (selection.kind === "scene-layer") {
    return selection.sceneId;
  }
  return null;
}

function indexScenePresenceEntries(
  entries: readonly MotionEditorScenePresenceEntry[] | undefined,
): ReadonlyMap<string, MotionEditorScenePresenceEntry> {
  return new Map(
    (entries ?? []).map((entry) => [entry.sceneId, entry] as const),
  );
}

function clampTimeMs(
  timeMs: number,
  durationMs: number,
): number {
  return Math.max(0, Math.min(timeMs, durationMs));
}

function findSceneForPreview(
  composition: MotionCompositionDefV2 | ResolvedMotionCompositionV2,
  sceneId: string,
): MotionSceneDef | null {
  return composition.scenes.find((scene) => scene.id === sceneId) ?? null;
}

function createScenePreviewSourceComposition(
  composition: MotionCompositionDefV2 | ResolvedMotionCompositionV2,
  sceneId: string,
): MotionCompositionDefV2 | null {
  const scene = findSceneForPreview(composition, sceneId);
  if (!scene) {
    return null;
  }

  const targetIds = new Set(scene.layers.map((placement) => placement.targetId));

  return {
    ...composition,
    id: `${composition.id}-${scene.id}`,
    title: `${composition.title} · ${scene.title}`,
    description: composition.description.length > 0
      ? `${composition.description} · ${scene.title} 씬 미리보기`
      : `${scene.title} 씬 미리보기`,
    durationMs: scene.durationMs,
    targets: composition.targets.filter((target) => targetIds.has(target.id)),
    scenes: [
      {
        ...scene,
        startMs: 0,
      },
    ],
  };
}

function resolvePreviewTarget(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  previewMode: MotionEditorPreviewMode,
  focusedSceneId: string | null,
): MotionEditorPreviewTarget {
  if (!isSceneComposition(composition) || previewMode === "full" || !focusedSceneId) {
    return FULL_PREVIEW_TARGET;
  }

  return composition.scenes.some((scene) => scene.id === focusedSceneId)
    ? { mode: "scene", sceneId: focusedSceneId }
    : FULL_PREVIEW_TARGET;
}

function assemblePreviewComposition(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  previewTarget: MotionEditorPreviewTarget,
): MotionCompositionDef {
  if (!isSceneComposition(composition)) {
    return composition as MotionCompositionDef;
  }

  if (previewTarget.mode === "scene") {
    const scenePreview = createScenePreviewSourceComposition(composition, previewTarget.sceneId);
    if (scenePreview) {
      return assembleComposition(scenePreview);
    }
  }

  return assembleComposition(composition);
}

function createPreviewDocument(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  previewTarget: MotionEditorPreviewTarget,
): MotionCompositionDocumentV1 {
  return createMotionCompositionDocument(
    assemblePreviewComposition(composition, previewTarget),
  );
}

function mapPreviewTimeMs(
  composition: MotionCompositionDefV2 | ResolvedMotionCompositionV2,
  currentTarget: MotionEditorPreviewTarget,
  nextTarget: MotionEditorPreviewTarget,
  currentTimeMs: number,
): number {
  if (currentTarget.mode === nextTarget.mode) {
    if (currentTarget.mode === "full") {
      return clampTimeMs(currentTimeMs, composition.durationMs);
    }
    if (nextTarget.mode === "scene" && currentTarget.sceneId === nextTarget.sceneId) {
      const currentScene = findSceneForPreview(composition, currentTarget.sceneId);
      return currentScene
        ? clampTimeMs(currentTimeMs, currentScene.durationMs)
        : clampTimeMs(currentTimeMs, composition.durationMs);
    }
  }

  const currentScene = currentTarget.mode === "scene"
    ? findSceneForPreview(composition, currentTarget.sceneId)
    : null;
  const nextScene = nextTarget.mode === "scene"
    ? findSceneForPreview(composition, nextTarget.sceneId)
    : null;
  const globalTimeMs = currentScene
    ? clampTimeMs(currentScene.startMs + currentTimeMs, composition.durationMs)
    : clampTimeMs(currentTimeMs, composition.durationMs);

  if (!nextScene) {
    return globalTimeMs;
  }

  return clampTimeMs(globalTimeMs - nextScene.startMs, nextScene.durationMs);
}

interface MotionEditorLayoutState {
  readonly left: MotionEditorDockLayoutState;
  readonly right: MotionEditorDockLayoutState;
  readonly bottom: MotionEditorDockLayoutState;
}

const LAYOUT_TAB_IDS = {
  left: ["properties", "scenes", "layers", "sequences"],
  right: ["selection-detail", "active-state"],
  bottom: ["timeline"],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createDefaultLayoutState(): MotionEditorLayoutState {
  return {
    left: {
      size: DEFAULT_LEFT_WIDTH,
      activeTabId: "properties",
      collapsed: false,
    },
    right: {
      size: DEFAULT_RIGHT_WIDTH,
      activeTabId: "selection-detail",
      collapsed: false,
    },
    bottom: {
      size: DEFAULT_BOTTOM_HEIGHT,
      activeTabId: "timeline",
      collapsed: false,
    },
  };
}

function normalizeStoredDockLayout(
  value: unknown,
  fallback: MotionEditorDockLayoutState,
  allowedTabs: readonly string[],
): MotionEditorDockLayoutState {
  if (!isRecord(value)) {
    return fallback;
  }

  const size = typeof value["size"] === "number"
    && Number.isFinite(value["size"])
    && value["size"] > 0
    ? value["size"]
    : fallback.size;
  const activeTabId = typeof value["activeTabId"] === "string"
    && allowedTabs.includes(value["activeTabId"])
    ? value["activeTabId"]
    : fallback.activeTabId;
  const collapsed = typeof value["collapsed"] === "boolean"
    ? value["collapsed"]
    : fallback.collapsed;

  return {
    size,
    activeTabId,
    collapsed,
  };
}

function readStoredLayoutState(): MotionEditorLayoutState | null {
  try {
    const raw = readMotionEditorPref(MOTION_EDITOR_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const defaults = createDefaultLayoutState();
    return {
      left: normalizeStoredDockLayout(parsed["left"], defaults.left, LAYOUT_TAB_IDS.left),
      right: normalizeStoredDockLayout(parsed["right"], defaults.right, LAYOUT_TAB_IDS.right),
      bottom: normalizeStoredDockLayout(parsed["bottom"], defaults.bottom, LAYOUT_TAB_IDS.bottom),
    };
  } catch {
    return null;
  }
}

function writeStoredLayoutState(layout: MotionEditorLayoutState): void {
  writeMotionEditorPref(
    MOTION_EDITOR_LAYOUT_STORAGE_KEY,
    JSON.stringify(layout),
  );
}

function clearStoredLayoutState(): void {
  clearMotionEditorPref(MOTION_EDITOR_LAYOUT_STORAGE_KEY);
}

function createFrameDiagnosticsState(): MotionFrameDiagnosticsState {
  return {
    samples: 0,
    lastFrameMs: null,
    averageFrameMs: null,
    worstFrameMs: null,
    slowFrames: 0,
    droppedFrames: 0,
  };
}

function renderDefaultStage(host: HTMLElement): MotionEditorShellStage {
  host.innerHTML = `
    <div class="mce-stage">
      <div class="mce-hero" data-motion-id="hero">
        <div class="mce-chip" data-motion-id="chip">GSAP only</div>
        <h1 data-motion-id="headline"></h1>
        <p data-motion-id="subline"></p>
      </div>
      <div class="mce-card-grid">
        <article class="mce-card" data-motion-id="card-a"><span>Scene A</span><strong>composition</strong><p>장면과 레이어를 선언한다.</p></article>
        <article class="mce-card" data-motion-id="card-b"><span>Scene B</span><strong>sequence</strong><p>시작 시점과 지속 시간을 가진다.</p></article>
        <article class="mce-card" data-motion-id="card-c"><span>Scene C</span><strong>transition</strong><p>시퀀스 사이의 감정 곡선을 만든다.</p></article>
      </div>
      <div class="mce-outro" data-motion-id="outro">GSAP timeline drives every scene change.</div>
      <div class="mce-caption" data-tone="neutral"></div>
    </div>
  `;
  const stageRoot = requireElement<HTMLElement>(host, ".mce-stage");
  const captionElement = requireElement<HTMLElement>(host, ".mce-caption");
  return {
    adapter: createMotionDomStageAdapter({
      stageRoot,
      captionElement,
    }),
  };
}

function createNextIndexedId(
  prefix: string,
  existingIds: readonly string[],
): { readonly id: string; readonly index: number } {
  const existing = new Set(existingIds);
  let index = existingIds.length + 1;
  let id = `${prefix}-${index}`;
  while (existing.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return { id, index };
}

function createUniqueId(
  baseId: string,
  existingIds: readonly string[],
): string {
  const existing = new Set(existingIds);
  let nextId = baseId;
  let suffix = 2;
  while (existing.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

function createNextLayerDraft(
  state: LinearShellState,
): { readonly id: string; readonly label: string } {
  const { id, index } = createNextIndexedId(
    "layer",
    state.composition.layers.map((layer) => layer.id),
  );
  return {
    id,
    label: `Layer ${index}`,
  };
}

function createNextSequenceDraft(
  state: LinearShellState,
): { readonly id: string; readonly title: string; readonly startMs: number; readonly durationMs: number } {
  const { id, index } = createNextIndexedId(
    "sequence",
    state.composition.sequences.map((sequence) => sequence.id),
  );
  const durationMs = Math.min(DEFAULT_NEW_SEQUENCE_DURATION_MS, state.composition.durationMs);
  const maxStartMs = Math.max(0, state.composition.durationMs - durationMs);
  const lastSequenceEndMs = state.composition.sequences.reduce(
    (max, sequence) => Math.max(max, sequence.startMs + sequence.durationMs),
    0,
  );
  return {
    id,
    title: `Sequence ${index}`,
    startMs: Math.min(lastSequenceEndMs, maxStartMs),
    durationMs,
  };
}

function createNextCaptionDraft(
  state: LinearShellState,
): { readonly id: string; readonly text: string; readonly startMs: number; readonly durationMs: number; readonly tone: "neutral" } {
  const { id, index } = createNextIndexedId(
    "cap",
    state.composition.captions.map((caption) => caption.id),
  );
  const durationMs = Math.min(DEFAULT_NEW_CAPTION_DURATION_MS, state.composition.durationMs);
  const maxStartMs = Math.max(0, state.composition.durationMs - durationMs);
  const selectedSequenceId = state.selection?.kind === "sequence" ? state.selection.id : null;
  const selectedSequence = selectedSequenceId
    ? state.composition.sequences.find((sequence) => sequence.id === selectedSequenceId)
    : undefined;
  const rawStartMs = selectedSequence?.startMs ?? Math.round(state.transport.currentTimeMs);
  return {
    id,
    text: `새 캡션 ${index}`,
    startMs: Math.min(Math.max(rawStartMs, 0), maxStartMs),
    durationMs,
    tone: "neutral",
  };
}

function resolveDefaultTransitionStyle(
  state: LinearShellState,
): "crossfade" | "flash" | "lift" {
  const value = state.values["transitionStyle"];
  if (value === "crossfade" || value === "flash" || value === "lift") {
    return value;
  }
  return state.composition.transitions[0]?.style ?? "crossfade";
}

function createNextTransitionDraft(
  state: LinearShellState,
): {
  readonly id: string;
  readonly fromSequenceId: string;
  readonly toSequenceId: string;
  readonly style: "crossfade" | "flash" | "lift";
  readonly durationMs: number;
} | null {
  if (state.composition.sequences.length < 2) {
    return null;
  }
  const adjacentPairs = state.composition.sequences.slice(0, -1).map((sequence, index) => ({
    fromSequenceId: sequence.id,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- slice(0,-1) 순회이므로 index+1 항상 유효
    toSequenceId: state.composition.sequences[index + 1]!.id,
  }));
  const selectedSequenceId = state.selection?.kind === "sequence" ? state.selection.id : null;
  const prioritizedPairs = selectedSequenceId
    ? [
      ...adjacentPairs.filter((pair) => pair.fromSequenceId === selectedSequenceId),
      ...adjacentPairs.filter((pair) => pair.toSequenceId === selectedSequenceId && pair.fromSequenceId !== selectedSequenceId),
    ]
    : [];
  const orderedPairs = [
    ...prioritizedPairs,
    ...adjacentPairs.filter((pair) => !prioritizedPairs.includes(pair)),
  ];
  const existingPairs = new Set(
    state.composition.transitions.map((transition) => `${transition.fromSequenceId}::${transition.toSequenceId}`),
  );
  const pair = orderedPairs.find((entry) =>
    !existingPairs.has(`${entry.fromSequenceId}::${entry.toSequenceId}`)
  ) ?? orderedPairs[0];
  const baseId = `${pair.fromSequenceId}-${pair.toSequenceId}`;
  return {
    id: createUniqueId(
      baseId,
      state.composition.transitions.map((transition) => transition.id),
    ),
    fromSequenceId: pair.fromSequenceId,
    toSequenceId: pair.toSequenceId,
    style: resolveDefaultTransitionStyle(state),
    durationMs: DEFAULT_NEW_TRANSITION_DURATION_MS,
  };
}

function createNextSceneDraft(
  state: SceneShellState,
): { readonly id: string; readonly title: string; readonly startMs: number; readonly durationMs: number } {
  const { id, index } = createNextIndexedId(
    "scene",
    state.composition.scenes.map((scene) => scene.id),
  );
  const durationMs = Math.min(DEFAULT_NEW_SCENE_DURATION_MS, state.composition.durationMs);
  const maxStartMs = Math.max(0, state.composition.durationMs - durationMs);
  const lastSceneEndMs = state.composition.scenes.reduce(
    (max, scene) => Math.max(max, scene.startMs + scene.durationMs),
    0,
  );
  return {
    id,
    title: `Scene ${index}`,
    startMs: Math.min(lastSceneEndMs, maxStartMs),
    durationMs,
  };
}

function createSceneFocusTimelineState(
  state: SceneShellState,
  sceneId: string,
): LinearShellState | null {
  const scene = state.composition.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    return null;
  }

  const targetById = new Map(
    state.composition.targets.map((target) => [target.id, target]),
  );
  const layers = scene.layers.flatMap((placement) => {
    const target = targetById.get(placement.targetId);
    if (!target) {
      return [];
    }
    return [{
      id: placement.targetId,
      label: placement.targetId,
      target: target.target,
      content: target.content,
      startMs: placement.startMs,
      durationMs: placement.durationMs,
      enter: placement.enter,
      ...(placement.exit ? { exit: placement.exit } : {}),
    }];
  });

  return {
    composition: {
      id: `${state.composition.id}#scene:${scene.id}`,
      title: scene.title,
      description: `${state.composition.title} / ${scene.title}`,
      durationMs: scene.durationMs,
      parameters: state.composition.parameters,
      cuePresets: state.composition.cuePresets,
      assets: [],
      layers,
      sequences: [],
      captions: [],
      transitions: [],
      values: state.values,
    },
    values: state.values,
    selection: state.selection?.kind === "scene-layer" && state.selection.sceneId === scene.id
      ? { kind: "layer", id: state.selection.targetId }
      : null,
    transport: {
      ...state.transport,
      currentTimeMs: Math.max(0, Math.min(state.transport.currentTimeMs - scene.startMs, scene.durationMs)),
      durationMs: scene.durationMs,
    },
    viewport: state.viewport,
    activeSequenceIds: [],
    activeLayerIds: [],
    activeCaptionId: null,
  };
}

function mapSceneFocusTimelineSelection(
  sceneId: string,
  selection: MotionEditorSelectionV2,
): MotionEditorSelectionV2 | null {
  if (selection.kind === "layer") {
    return {
      kind: "scene-layer",
      sceneId,
      targetId: selection.id,
    };
  }
  return {
    kind: "scene",
    id: sceneId,
  };
}

function mapSceneFocusTimelineCommand(
  sceneId: string,
  command: MotionEditorCommand,
): MotionEditorCommand | null {
  if (command.type !== "update-item-timing" || command.itemKind !== "layer") {
    return null;
  }
  return {
    type: "update-scene-placement-timing",
    sceneId,
    targetId: command.itemId,
    startMs: command.startMs,
    durationMs: command.durationMs,
  };
}

function setJsonError(panel: HTMLElement, message: string | null): void {
  if (!message) {
    panel.textContent = "";
    panel.classList.remove("is-visible");
    return;
  }
  panel.textContent = message;
  panel.classList.add("is-visible");
}

function readNumericDataset(
  element: HTMLElement,
  key: string,
): number | undefined {
  const raw = element.dataset[key];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readScrubFieldConfig(
  field: HTMLElement,
): ScrubInputConfig | null {
  const value = readNumericDataset(field, "scrubValue");
  if (value === undefined) {
    return null;
  }
  return {
    value,
    step: readNumericDataset(field, "scrubStep"),
    min: readNumericDataset(field, "scrubMin"),
    max: readNumericDataset(field, "scrubMax"),
  };
}

function isMotionItemKind(value: string | undefined): value is MotionItemKind {
  return value === "layer" || value === "sequence" || value === "caption";
}

function isCueField(value: string | undefined): value is "enter" | "exit" {
  return value === "enter" || value === "exit";
}

function isMotionCueKind(value: string | undefined): value is MotionCueKind {
  return value === "fade"
    || value === "slide-up"
    || value === "slide-left"
    || value === "slide-right"
    || value === "scale-pop";
}

function isMotionLayerContentType(value: string | undefined): value is MotionLayerContentType {
  return value === "dom"
    || value === "image"
    || value === "video"
    || value === "svg"
    || value === "canvas";
}

function isMotionTransitionStyle(value: string | undefined): value is MotionTransitionStyle {
  return value === "crossfade" || value === "flash" || value === "lift";
}

function isSequenceLayerSlotRole(value: string | undefined): value is SequenceLayerSlotRole {
  return value === "background"
    || value === "content"
    || value === "overlay"
    || value === "accent";
}

function findCuePresetById(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  presetId: string,
) {
  return composition.cuePresets?.find((preset) => preset.id === presetId);
}

function createCuePresetSelection(
  presetId: string | undefined,
): MotionEditorSelectionV2 | null {
  return presetId
    ? { kind: "cue-preset", id: presetId }
    : null;
}

function buildCuePresetComposition(
  state: ShellState,
  presetId: string,
  updater: (preset: NonNullable<MotionCompositionDef["cuePresets"]>[number]) => NonNullable<MotionCompositionDef["cuePresets"]>[number],
): MotionCompositionSchema | null {
  const presets = state.composition.cuePresets;
  if (!presets) {
    return null;
  }

  let changed = false;
  const nextPresets = presets.map((preset) => {
    if (preset.id !== presetId) {
      return preset;
    }
    const nextPreset = updater(preset);
    changed = changed || nextPreset !== preset;
    return nextPreset;
  });

  if (!changed) {
    return null;
  }

  return {
    ...state.composition,
    cuePresets: nextPresets,
  };
}

function createSelectionDetailCommand(
  state: ShellState,
  field: HTMLElement,
  nextValue: number,
): MotionEditorCommand | null {
  const command = field.dataset["scrubCommand"];
  const scrubField = field.dataset["scrubField"];
  if (!command || !scrubField || !Number.isFinite(nextValue)) {
    return null;
  }

  if (command === "item-timing") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const itemKind = field.dataset["itemKind"];
    const itemId = field.dataset["itemId"];
    if (!isMotionItemKind(itemKind) || !itemId) {
      return null;
    }
    const item = itemKind === "layer"
      ? findLayerById(state.composition, itemId)
      : itemKind === "sequence"
        ? findSequenceById(state.composition, itemId)
        : findCaptionById(state.composition, itemId);
    if (!item) {
      return null;
    }
    return {
      type: "update-item-timing",
      itemKind,
      itemId,
      startMs: scrubField === "startMs" ? nextValue : item.startMs,
      durationMs: scrubField === "durationMs" ? nextValue : item.durationMs,
    };
  }

  if (command === "scene-timing") {
    if (!isSceneComposition(state.composition)) {
      return null;
    }
    const sceneId = field.dataset["sceneId"];
    if (!sceneId || (scrubField !== "startMs" && scrubField !== "durationMs")) {
      return null;
    }
    const scene = state.composition.scenes.find((entry) => entry.id === sceneId);
    if (!scene) {
      return null;
    }
    return {
      type: "update-scene-timing",
      sceneId,
      startMs: scrubField === "startMs" ? nextValue : scene.startMs,
      durationMs: scrubField === "durationMs" ? nextValue : scene.durationMs,
    };
  }

  if (command === "scene-placement-timing") {
    if (!isSceneComposition(state.composition)) {
      return null;
    }
    const sceneId = field.dataset["sceneId"];
    const targetId = field.dataset["targetId"];
    if (!sceneId || !targetId || (scrubField !== "startMs" && scrubField !== "durationMs")) {
      return null;
    }
    const scene = state.composition.scenes.find((entry) => entry.id === sceneId);
    const placement = scene?.layers.find((entry) => entry.targetId === targetId);
    if (!scene || !placement) {
      return null;
    }
    return {
      type: "update-scene-placement-timing",
      sceneId,
      targetId,
      startMs: scrubField === "startMs" ? nextValue : placement.startMs,
      durationMs: scrubField === "durationMs" ? nextValue : placement.durationMs,
    };
  }

  if (command === "layer-relative-start") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const sequenceId = field.dataset["sequenceId"];
    const layerId = field.dataset["layerId"];
    if (!sequenceId || !layerId) {
      return null;
    }
    const sequence = findSequenceById(state.composition, sequenceId);
    if (!sequence) {
      return null;
    }
    return {
      type: "update-sequence-layer-slot",
      sequenceId,
      layerId,
      field: "offsetMs",
      value: nextValue - sequence.startMs,
    };
  }

  if (command === "sequence-stagger") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const sequenceId = field.dataset["sequenceId"];
    if (!sequenceId || (scrubField !== "startOffsetMs" && scrubField !== "intervalMs")) {
      return null;
    }
    return {
      type: "update-sequence-stagger",
      sequenceId,
      field: scrubField,
      value: nextValue,
    };
  }

  if (command === "sequence-layer-slot") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const sequenceId = field.dataset["sequenceId"];
    const layerId = field.dataset["layerId"];
    if (!sequenceId || !layerId || (scrubField !== "offsetMs" && scrubField !== "zIndex")) {
      return null;
    }
    return {
      type: "update-sequence-layer-slot",
      sequenceId,
      layerId,
      field: scrubField,
      value: nextValue,
    };
  }

  if (command === "transition-duration") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const transitionId = field.dataset["transitionId"];
    if (!transitionId || !findTransitionById(state.composition, transitionId)) {
      return null;
    }
    return {
      type: "update-transition-duration",
      transitionId,
      durationMs: nextValue,
    };
  }

  if (command === "transition-param") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const transitionId = field.dataset["transitionId"];
    const param = field.dataset["transitionParam"];
    if (
      !transitionId
      || !findTransitionById(state.composition, transitionId)
      || (param !== "brightness" && param !== "glowSize" && param !== "liftY")
    ) {
      return null;
    }
    return {
      type: "update-transition-param",
      transitionId,
      param,
      value: nextValue,
    };
  }

  if (command === "cue-preset-number") {
    const presetId = field.dataset["presetId"];
    if (!presetId || (scrubField !== "durationMs" && scrubField !== "amount")) {
      return null;
    }
    const composition = buildCuePresetComposition(
      state,
      presetId,
      (preset) => {
        const normalizedValue = Math.max(0, Math.round(nextValue));
        if (scrubField === "durationMs") {
          return preset.durationMs === normalizedValue
            ? preset
            : { ...preset, durationMs: normalizedValue };
        }
        return preset.amount === normalizedValue
          ? preset
          : { ...preset, amount: normalizedValue };
      },
    );
    if (!composition) {
      return null;
    }
    return createSetCompositionCommand(composition, state.values);
  }

  return null;
}

function createSelectionDetailTextCommand(
  state: ShellState,
  field: HTMLElement,
  nextValue: string,
): MotionEditorCommand | null {
  const command = field.dataset["inlineTextCommand"];
  if (command === "scene-title") {
    if (!isSceneComposition(state.composition)) {
      return null;
    }
    const sceneId = field.dataset["sceneId"];
    if (!sceneId || nextValue.trim().length === 0 || !state.composition.scenes.some((scene) => scene.id === sceneId)) {
      return null;
    }
    return {
      type: "rename-scene",
      sceneId,
      title: nextValue,
    };
  }

  if (command === "item-string") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const itemKind = field.dataset["itemKind"];
    const itemId = field.dataset["itemId"];
    if (!isMotionItemKind(itemKind) || !itemId || nextValue.trim().length === 0) {
      return null;
    }

    if (itemKind === "layer" && !findLayerById(state.composition, itemId)) {
      return null;
    }
    if (itemKind === "sequence" && !findSequenceById(state.composition, itemId)) {
      return null;
    }
    if (itemKind === "caption" && !findCaptionById(state.composition, itemId)) {
      return null;
    }

    return {
      type: "update-item-string",
      itemKind,
      itemId,
      value: nextValue,
    };
  }

  if (command === "cue-preset-text") {
    const presetId = field.dataset["presetId"];
    if (!presetId) {
      return null;
    }
    const composition = buildCuePresetComposition(
      state,
      presetId,
      (preset) => {
        const trimmed = nextValue.trim();
        const nextEase = trimmed.length > 0 ? trimmed : undefined;
        return preset.ease === nextEase
          ? preset
          : {
            ...preset,
            ease: nextEase,
          };
      },
    );
    if (!composition) {
      return null;
    }
    return createSetCompositionCommand(composition, state.values);
  }

  return null;
}

function createSelectionDetailControlCommand(
  state: ShellState,
  control: HTMLInputElement | HTMLSelectElement,
): MotionEditorCommand | null {
  const kind = control.dataset["selectionControl"];
  if (!kind) {
    return null;
  }

  if (kind === "layer-cue-kind") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const layerId = control.dataset["layerId"];
    const cue = control.dataset["cueField"];
    if (!layerId || !isCueField(cue) || !isMotionCueKind(control.value) || !findLayerById(state.composition, layerId)) {
      return null;
    }
    return {
      type: "update-layer-cue-kind",
      layerId,
      cue,
      kind: control.value,
    };
  }

  if (kind === "layer-cue-preset") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const layerId = control.dataset["layerId"];
    const cue = control.dataset["cueField"];
    const presetId = control.value;
    if (
      !layerId
      || !isCueField(cue)
      || !findLayerById(state.composition, layerId)
      || !state.composition.cuePresets?.some((preset) => preset.id === presetId)
    ) {
      return null;
    }
    return {
      type: "update-layer-cue-preset",
      layerId,
      cue,
      presetId,
    };
  }

  if (kind === "layer-content-type") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const layerId = control.dataset["layerId"];
    if (!layerId || !isMotionLayerContentType(control.value) || !findLayerById(state.composition, layerId)) {
      return null;
    }
    return {
      type: "update-layer-content-type",
      layerId,
      contentType: control.value,
    };
  }

  if (kind === "sequence-layer-role") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const sequenceId = control.dataset["sequenceId"];
    const layerId = control.dataset["layerId"];
    if (!sequenceId || !layerId || !findSequenceById(state.composition, sequenceId)) {
      return null;
    }
    if (control.value !== "" && !isSequenceLayerSlotRole(control.value)) {
      return null;
    }
    return {
      type: "update-sequence-layer-role",
      sequenceId,
      layerId,
      role: control.value === "" ? null : control.value,
    };
  }

  if (kind === "transition-style") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const transitionId = control.dataset["transitionId"];
    if (!transitionId || !isMotionTransitionStyle(control.value) || !findTransitionById(state.composition, transitionId)) {
      return null;
    }
    return {
      type: "update-transition-style",
      transitionId,
      style: control.value,
    };
  }

  if (kind === "cue-preset-kind") {
    const presetId = control.dataset["presetId"];
    if (!presetId || !isMotionCueKind(control.value) || !findCuePresetById(state.composition, presetId)) {
      return null;
    }
    const nextKind: MotionCueKind = control.value;
    const composition = buildCuePresetComposition(
      state,
      presetId,
      (preset) => (
        preset.kind === nextKind
          ? preset
          : { ...preset, kind: nextKind }
      ),
    );
    if (!composition) {
      return null;
    }
    return createSetCompositionCommand(composition, state.values);
  }

  if (kind === "transition-param-color") {
    if (!isLinearShellState(state)) {
      return null;
    }
    const transitionId = control.dataset["transitionId"];
    const param = control.dataset["transitionParam"];
    if (
      !transitionId
      || !findTransitionById(state.composition, transitionId)
      || param !== "glowColor"
      || !(control instanceof HTMLInputElement)
    ) {
      return null;
    }
    const alphaRaw = Number(control.dataset["colorAlpha"] ?? "1");
    const alpha = Number.isFinite(alphaRaw) ? Math.max(0, Math.min(1, alphaRaw)) : 1;
    return {
      type: "update-transition-param",
      transitionId,
      param: "glowColor",
      value: composeMotionColorValue(control.value, alpha),
    };
  }

  return null;
}

function createPanelStack(markup: string): HTMLDivElement {
  const content = document.createElement("div");
  content.className = "mce-panel-stack";
  content.innerHTML = markup;
  return content;
}

function applyStagePreviewTheme(host: HTMLElement): void {
  host.style.isolation = "isolate";
  host.style.setProperty("--mce-preview-surface-canvas", STAGE_PREVIEW_THEME.color.surface.canvas);
  host.style.setProperty("--mce-preview-surface-stage", STAGE_PREVIEW_THEME.color.surface.stage);
  host.style.setProperty("--mce-preview-surface-stage-glow", STAGE_PREVIEW_THEME.color.surface.stageGlow);
  host.style.setProperty("--mce-preview-surface-card", STAGE_PREVIEW_THEME.color.surface.card);
  host.style.setProperty("--mce-preview-surface-overlay", STAGE_PREVIEW_THEME.color.surface.overlay);
  host.style.setProperty("--mce-preview-text-primary", STAGE_PREVIEW_THEME.color.text.primary);
  host.style.setProperty("--mce-preview-text-inverse", STAGE_PREVIEW_THEME.color.text.inverse);
  host.style.setProperty("--mce-preview-text-muted", STAGE_PREVIEW_THEME.color.text.muted);
  host.style.setProperty("--mce-preview-accent-primary", STAGE_PREVIEW_THEME.color.accent.primary);
  host.style.setProperty("--mce-preview-accent-contrast", STAGE_PREVIEW_THEME.color.accent.contrast);
  host.style.setProperty("--mce-preview-border-default", STAGE_PREVIEW_THEME.color.border.default);
  host.style.setProperty("--mce-preview-border-warning", STAGE_PREVIEW_THEME.color.border.warning);
  host.style.setProperty("--mce-preview-border-danger", STAGE_PREVIEW_THEME.color.border.danger);
  host.style.setProperty("--mce-preview-shadow-elevation-3", STAGE_PREVIEW_THEME.shadow.elevation3);
}

export function createMotionEditorShell(
  options: MotionEditorShellOptions,
): MotionEditorShell {
  ensureMotionEditorStyles();
  let activeTheme: MotionEditorThemeName = readStoredMotionEditorTheme(DEFAULT_MOTION_EDITOR_THEME);
  applyMotionEditorTheme(activeTheme);
  const eventLog = options.eventLog ?? createMotionEventLog();
  const workspace = options.workspace ?? createMotionEditorShellWorkspace({
    composition: options.composition,
    values: options.values,
  });
  let session: MotionEditorSession<ResolvedMotionCompositionSchema> = workspace.controller.getSession();
  let state: ShellState = session.present;
  let player: MotionPlayer | null = null;
  let dragCommand: MotionEditorCommand | null = null;
  let dragState: MotionTimelineDragState | null = null;
  let dragSceneId: string | null = null;
  let lastSnapshot: MotionRuntimeSnapshot | null = null;
  let importDiagnostics: MotionImportDiagnosticsState = {
    status: "idle",
    source: null,
    message: "",
  };
  let frameDiagnostics = createFrameDiagnosticsState();
  let lastPlaybackFrameAt: number | null = null;
  let focusedSceneId: string | null = isSceneComposition(state.composition)
    ? deriveSceneIdFromSelection(state.selection)
    : null;
  let previewMode: MotionEditorPreviewMode = "full";
  let lastEmittedFocusedSceneId: string | null | undefined = undefined;
  let scenePresence = indexScenePresenceEntries(options.scenePresence);
  const initialLayoutState = readStoredLayoutState() ?? createDefaultLayoutState();

  const root = document.createElement("div");
  root.className = "mce-root";
  root.style.setProperty(
    "--mce-left-size",
    `${initialLayoutState.left.collapsed ? COLLAPSED_SIDE_SIZE : initialLayoutState.left.size}px`,
  );
  root.style.setProperty(
    "--mce-right-size",
    `${initialLayoutState.right.collapsed ? COLLAPSED_SIDE_SIZE : initialLayoutState.right.size}px`,
  );
  root.style.setProperty(
    "--mce-bottom-size",
    `${initialLayoutState.bottom.collapsed ? COLLAPSED_BOTTOM_SIZE : initialLayoutState.bottom.size}px`,
  );
  root.innerHTML = `
    <div class="mce-dock-slot" data-layout-slot="left"></div>
    <div class="mce-splitter" data-splitter="left" role="separator" aria-orientation="vertical" aria-label="좌측 패널 너비 조절"></div>
    <div class="mce-stage-wrap">
      <div class="mce-toolbar">
        <button class="mce-secondary" data-action="undo">Undo</button>
        <button class="mce-secondary" data-action="redo">Redo</button>
        <button class="mce-secondary" data-action="toggle-theme" aria-pressed="false">테마: 다크</button>
        <button data-action="play">Play</button>
        <button data-action="pause">Pause</button>
        <button data-action="restart">Restart</button>
        <label class="mce-toolbar-toggle">
          <input data-action="loop" type="checkbox" />
          <span>Loop</span>
        </label>
        <label class="mce-toolbar-field">
          <span>Speed</span>
          <input data-action="playback-rate" type="number" min="0.25" max="4" step="0.25" value="${DEFAULT_PLAYBACK_RATE}" />
        </label>
        <div class="mce-toolbar-field" data-preview-controls hidden>
          <span>Preview</span>
          <button type="button" class="mce-secondary" data-action="preview-full">전체</button>
          <button type="button" class="mce-secondary" data-action="preview-scene">씬</button>
          <span data-preview-label>전체 어셈블리</span>
        </div>
        <button class="mce-secondary" data-action="download-json">Download</button>
        <button class="mce-secondary" data-action="export-v1">Export v1</button>
        <button class="mce-secondary" data-action="open-file">Upload</button>
        <button class="mce-secondary" data-action="import-json">Apply</button>
        <button class="mce-secondary" data-action="reset-layout">레이아웃 초기화</button>
        <input data-action="scrub" type="range" min="0" max="${state.transport.durationMs}" value="0" />
        <input class="mce-file-input" data-action="file-input" type="file" accept="application/json,.json" />
      </div>
      <div class="mce-stage-host"></div>
    </div>
    <div class="mce-splitter" data-splitter="right" role="separator" aria-orientation="vertical" aria-label="우측 패널 너비 조절"></div>
    <div class="mce-dock-slot" data-layout-slot="right"></div>
    <div class="mce-splitter mce-splitter--horizontal" data-splitter="bottom" role="separator" aria-orientation="horizontal" aria-label="하단 타임라인 높이 조절"></div>
    <div class="mce-dock-slot mce-dock-slot--bottom" data-layout-slot="bottom"></div>
  `;

  options.container.innerHTML = "";
  options.container.appendChild(root);

  const leftDockSlot = requireElement<HTMLElement>(root, '[data-layout-slot="left"]');
  const rightDockSlot = requireElement<HTMLElement>(root, '[data-layout-slot="right"]');
  const bottomDockSlot = requireElement<HTMLElement>(root, '[data-layout-slot="bottom"]');

  const leftDock = new PanelGroup({
    id: "left",
    container: leftDockSlot,
    title: "Workspace",
    defaultTabId: initialLayoutState.left.activeTabId,
    collapseDirection: "left",
    onTabChange: () => persistLayoutState(),
    onCollapseChange: () => {
      syncDockCollapse("left");
      persistLayoutState();
    },
    tabs: [
      {
        id: "properties",
        label: "Properties",
        content: createPanelStack(`
          <div class="mce-panel-intro">
            <div class="mce-kicker">Editor</div>
            <h2 class="mce-title">Motion Content Editor</h2>
            <p class="mce-panel-copy">탭과 splitter로 stage, inspector, timeline을 동시에 조절한다.</p>
          </div>
          <div class="mce-section"><h3>Parameters</h3><div class="mce-controls" data-panel="params"></div></div>
          <div class="mce-section">
            <div class="mce-section-head">
              <h3>Transitions</h3>
              <button type="button" class="mce-inline-action" data-action="add-transition">+ 추가</button>
            </div>
            <div class="mce-list" data-panel="transitions"></div>
          </div>
          <div class="mce-section">
            <div class="mce-section-head">
              <h3>Captions</h3>
              <button type="button" class="mce-inline-action" data-action="add-caption">+ 추가</button>
            </div>
            <div class="mce-list" data-panel="captions"></div>
          </div>
          <div class="mce-section"><h3>Cue Presets</h3><div class="mce-list" data-panel="cue-presets"></div></div>
          <div class="mce-section"><h3>Composition JSON</h3><textarea class="mce-json" data-panel="json"></textarea><div class="mce-error" data-panel="json-error"></div></div>
        `),
      },
      {
        id: "scenes",
        label: "Scenes",
        content: createPanelStack(`
          <div class="mce-list" data-panel="scenes"></div>
        `),
      },
      {
        id: "layers",
        label: "Layers",
        content: createPanelStack(`
          <div class="mce-section">
            <div class="mce-section-head">
              <h3>Layers</h3>
              <button type="button" class="mce-inline-action" data-action="add-layer">+ 추가</button>
            </div>
            <div class="mce-list" data-panel="layers"></div>
          </div>
        `),
      },
      {
        id: "sequences",
        label: "Sequences",
        content: createPanelStack(`
          <div class="mce-section">
            <div class="mce-section-head">
              <h3>Sequences</h3>
              <button type="button" class="mce-inline-action" data-action="add-sequence">+ 추가</button>
            </div>
            <div class="mce-list" data-panel="sequences"></div>
          </div>
        `),
      },
    ],
  });

  const rightDock = new PanelGroup({
    id: "right",
    container: rightDockSlot,
    title: "Inspector",
    defaultTabId: initialLayoutState.right.activeTabId,
    collapseDirection: "right",
    onTabChange: () => persistLayoutState(),
    onCollapseChange: () => {
      syncDockCollapse("right");
      persistLayoutState();
    },
    tabs: [
      {
        id: "selection-detail",
        label: "Selection Detail",
        content: createPanelStack(`
          <div class="mce-section"><h3>Selection Detail</h3><div class="mce-diag" data-panel="selection-detail"></div></div>
        `),
      },
      {
        id: "active-state",
        label: "Active State",
        content: createPanelStack(`
          <div class="mce-section"><h3>Active State</h3><div class="mce-diag" data-panel="diagnostics"></div></div>
          <div class="mce-section"><h3>Import / Validation</h3><div class="mce-diag" data-panel="import-diagnostics"></div></div>
          <details class="mce-section mce-section--details"><summary><h3 class="mce-summary-title">Event Log</h3></summary><div class="mce-diag" data-panel="event-log"></div></details>
        `),
      },
    ],
  });

  const bottomDock = new PanelGroup({
    id: "bottom",
    container: bottomDockSlot,
    title: "Timeline",
    defaultTabId: initialLayoutState.bottom.activeTabId,
    collapseDirection: "down",
    onTabChange: () => persistLayoutState(),
    onCollapseChange: () => {
      syncDockCollapse("bottom");
      persistLayoutState();
    },
    tabs: [
      {
        id: "timeline",
        label: "Timeline",
        content: createPanelStack(`
          <div class="mce-timeline" data-panel="timeline"></div>
        `),
      },
    ],
  });
  bottomDock.element.classList.add("mce-panel-group--timeline");

  const leftSplitterElement = requireElement<HTMLElement>(root, '[data-splitter="left"]');
  const rightSplitterElement = requireElement<HTMLElement>(root, '[data-splitter="right"]');
  const bottomSplitterElement = requireElement<HTMLElement>(root, '[data-splitter="bottom"]');
  const layoutSizes = {
    left: initialLayoutState.left.collapsed ? COLLAPSED_SIDE_SIZE : initialLayoutState.left.size,
    right: initialLayoutState.right.collapsed ? COLLAPSED_SIDE_SIZE : initialLayoutState.right.size,
    bottom: initialLayoutState.bottom.collapsed ? COLLAPSED_BOTTOM_SIZE : initialLayoutState.bottom.size,
  };
  const expandedSizes = {
    left: initialLayoutState.left.size,
    right: initialLayoutState.right.size,
    bottom: initialLayoutState.bottom.size,
  };

  leftDock.setCollapsed(initialLayoutState.left.collapsed, false);
  rightDock.setCollapsed(initialLayoutState.right.collapsed, false);
  bottomDock.setCollapsed(initialLayoutState.bottom.collapsed, false);

  const getDockGroup = (area: MotionEditorLayoutArea) => {
    if (area === "left") return leftDock;
    if (area === "right") return rightDock;
    return bottomDock;
  };

  const getLayoutVarName = (area: MotionEditorLayoutArea) => {
    if (area === "left") return "--mce-left-size";
    if (area === "right") return "--mce-right-size";
    return "--mce-bottom-size";
  };

  const getCollapsedSize = (area: MotionEditorLayoutArea) =>
    area === "bottom" ? COLLAPSED_BOTTOM_SIZE : COLLAPSED_SIDE_SIZE;

  const getRootBounds = () => {
    const rect = root.getBoundingClientRect();
    return {
      width: rect.width || FALLBACK_LAYOUT_WIDTH,
      height: rect.height || FALLBACK_LAYOUT_HEIGHT,
    };
  };

  const getLayoutRange = (area: MotionEditorLayoutArea) => {
    const { width, height } = getRootBounds();

    if (area === "left") {
      return {
        min: MIN_LEFT_WIDTH,
        max: Math.max(
          MIN_LEFT_WIDTH,
          width - layoutSizes.right - MIN_CENTER_WIDTH - (SPLITTER_SIZE * 2),
        ),
      };
    }

    if (area === "right") {
      return {
        min: MIN_RIGHT_WIDTH,
        max: Math.max(
          MIN_RIGHT_WIDTH,
          width - layoutSizes.left - MIN_CENTER_WIDTH - (SPLITTER_SIZE * 2),
        ),
      };
    }

    return {
      min: MIN_BOTTOM_HEIGHT,
      max: Math.max(
        MIN_BOTTOM_HEIGHT,
        height - MIN_WORKSPACE_HEIGHT - SPLITTER_SIZE,
      ),
    };
  };

  const applyLayoutSize = (area: MotionEditorLayoutArea) => {
    root.style.setProperty(getLayoutVarName(area), `${layoutSizes[area]}px`);
  };

  const persistLayoutState = () => {
    writeStoredLayoutState({
      left: {
        size: expandedSizes.left,
        activeTabId: leftDock.getActiveTabId(),
        collapsed: leftDock.isCollapsed(),
      },
      right: {
        size: expandedSizes.right,
        activeTabId: rightDock.getActiveTabId(),
        collapsed: rightDock.isCollapsed(),
      },
      bottom: {
        size: expandedSizes.bottom,
        activeTabId: bottomDock.getActiveTabId(),
        collapsed: bottomDock.isCollapsed(),
      },
    });
  };

  const syncSplitterState = () => {
    leftSplitter.setDisabled(leftDock.isCollapsed());
    rightSplitter.setDisabled(rightDock.isCollapsed());
    bottomSplitter.setDisabled(bottomDock.isCollapsed());
  };

  const setDockSize = (
    area: MotionEditorLayoutArea,
    nextSize: number,
  ) => {
    const group = getDockGroup(area);
    const size = group.isCollapsed()
      ? getCollapsedSize(area)
      : Math.min(
        Math.max(nextSize, getLayoutRange(area).min),
        getLayoutRange(area).max,
      );
    layoutSizes[area] = size;
    if (!group.isCollapsed()) {
      expandedSizes[area] = size;
    }
    applyLayoutSize(area);
  };

  const syncDockCollapse = (area: MotionEditorLayoutArea) => {
    const group = getDockGroup(area);
    if (group.isCollapsed()) {
      expandedSizes[area] = Math.max(expandedSizes[area], layoutSizes[area]);
      layoutSizes[area] = getCollapsedSize(area);
    } else {
      const range = getLayoutRange(area);
      layoutSizes[area] = Math.min(
        Math.max(expandedSizes[area], range.min),
        range.max,
      );
      expandedSizes[area] = layoutSizes[area];
    }
    applyLayoutSize(area);
    syncSplitterState();
  };

  const clampLayoutToBounds = () => {
    for (const area of ["left", "right", "bottom"] as const) {
      if (getDockGroup(area).isCollapsed()) {
        layoutSizes[area] = getCollapsedSize(area);
      } else {
        const range = getLayoutRange(area);
        layoutSizes[area] = Math.min(
          Math.max(layoutSizes[area], range.min),
          range.max,
        );
        expandedSizes[area] = layoutSizes[area];
      }
      applyLayoutSize(area);
    }
    syncSplitterState();
  };

  const applyLayoutState = (nextLayoutState: MotionEditorLayoutState) => {
    leftDock.selectTab(nextLayoutState.left.activeTabId, false);
    rightDock.selectTab(nextLayoutState.right.activeTabId, false);
    bottomDock.selectTab(nextLayoutState.bottom.activeTabId, false);
    leftDock.setCollapsed(nextLayoutState.left.collapsed, false);
    rightDock.setCollapsed(nextLayoutState.right.collapsed, false);
    bottomDock.setCollapsed(nextLayoutState.bottom.collapsed, false);

    expandedSizes.left = nextLayoutState.left.size;
    expandedSizes.right = nextLayoutState.right.size;
    expandedSizes.bottom = nextLayoutState.bottom.size;
    layoutSizes.left = nextLayoutState.left.collapsed
      ? COLLAPSED_SIDE_SIZE
      : nextLayoutState.left.size;
    layoutSizes.right = nextLayoutState.right.collapsed
      ? COLLAPSED_SIDE_SIZE
      : nextLayoutState.right.size;
    layoutSizes.bottom = nextLayoutState.bottom.collapsed
      ? COLLAPSED_BOTTOM_SIZE
      : nextLayoutState.bottom.size;

    clampLayoutToBounds();
  };

  const resetLayout = () => {
    clearStoredLayoutState();
    applyLayoutState(createDefaultLayoutState());
  };

  const leftSplitter = new Splitter({
    element: leftSplitterElement,
    axis: "x",
    getValue: () => layoutSizes.left,
    setValue: (value) => setDockSize("left", value),
    getRange: () => getLayoutRange("left"),
    onDragEnd: persistLayoutState,
  });

  const rightSplitter = new Splitter({
    element: rightSplitterElement,
    axis: "x",
    direction: -1,
    getValue: () => layoutSizes.right,
    setValue: (value) => setDockSize("right", value),
    getRange: () => getLayoutRange("right"),
    onDragEnd: persistLayoutState,
  });

  const bottomSplitter = new Splitter({
    element: bottomSplitterElement,
    axis: "y",
    direction: -1,
    getValue: () => layoutSizes.bottom,
    setValue: (value) => setDockSize("bottom", value),
    getRange: () => getLayoutRange("bottom"),
    onDragEnd: persistLayoutState,
  });

  const handleWindowResize = () => {
    clampLayoutToBounds();
    persistLayoutState();
  };
  window.addEventListener("resize", handleWindowResize);
  clampLayoutToBounds();

  const stageHost = requireElement<HTMLElement>(root, ".mce-stage-host");
  applyStagePreviewTheme(stageHost);
  const stageMount = options.renderStage?.(stageHost, state) ?? renderDefaultStage(stageHost);
  const paramPanel = requireElement<HTMLElement>(root, '[data-panel="params"]');
  const scenesPanel = requireElement<HTMLElement>(root, '[data-panel="scenes"]');
  const sequencePanel = requireElement<HTMLElement>(root, '[data-panel="sequences"]');
  const layerPanel = requireElement<HTMLElement>(root, '[data-panel="layers"]');
  const transitionPanel = requireElement<HTMLElement>(root, '[data-panel="transitions"]');
  const captionPanel = requireElement<HTMLElement>(root, '[data-panel="captions"]');
  const cuePresetsPanel = requireElement<HTMLElement>(root, '[data-panel="cue-presets"]');
  const jsonPanel = requireElement<HTMLTextAreaElement>(root, '[data-panel="json"]');
  const jsonErrorPanel = requireElement<HTMLElement>(root, '[data-panel="json-error"]');
  const timelinePanel = requireElement<HTMLElement>(root, '[data-panel="timeline"]');
  const selectionDetailPanel = requireElement<HTMLElement>(root, '[data-panel="selection-detail"]');
  const diagnosticsPanel = requireElement<HTMLElement>(root, '[data-panel="diagnostics"]');
  const importDiagnosticsPanel = requireElement<HTMLElement>(root, '[data-panel="import-diagnostics"]');
  const eventLogPanel = requireElement<HTMLElement>(root, '[data-panel="event-log"]');
  const scrub = requireElement<HTMLInputElement>(root, '[data-action="scrub"]');
  const loopToggle = requireElement<HTMLInputElement>(root, '[data-action="loop"]');
  const playbackRateInput = requireElement<HTMLInputElement>(root, '[data-action="playback-rate"]');
  const themeToggleButton = requireElement<HTMLButtonElement>(root, '[data-action="toggle-theme"]');
  const fileInput = requireElement<HTMLInputElement>(root, '[data-action="file-input"]');
  const previewControls = requireElement<HTMLElement>(root, "[data-preview-controls]");
  const previewFullButton = requireElement<HTMLButtonElement>(root, '[data-action="preview-full"]');
  const previewSceneButton = requireElement<HTMLButtonElement>(root, '[data-action="preview-scene"]');
  const previewLabel = requireElement<HTMLElement>(root, "[data-preview-label]");
  const syncFocusedScene = () => {
    if (!isSceneComposition(state.composition)) {
      focusedSceneId = null;
      previewMode = "full";
      return;
    }
    const selectedSceneId = deriveSceneIdFromSelection(state.selection);
    if (selectedSceneId) {
      focusedSceneId = selectedSceneId;
    }
    focusedSceneId = focusedSceneId && state.composition.scenes.some((scene) => scene.id === focusedSceneId)
      ? focusedSceneId
      : null;
    if (!focusedSceneId && previewMode === "scene") {
      previewMode = "full";
    }
  };
  const getFocusedScene = () => (
    isSceneComposition(state.composition) && focusedSceneId
      ? state.composition.scenes.find((scene) => scene.id === focusedSceneId) ?? null
      : null
  );
  const getPreviewTarget = () =>
    resolvePreviewTarget(state.composition, previewMode, focusedSceneId);
  const getTimelineRenderState = () => {
    if (!isSceneComposition(state.composition) || !focusedSceneId) {
      return {
        sceneId: null,
        state,
      };
    }
    const focusedTimelineState = createSceneFocusTimelineState(
      state as SceneShellState,
      focusedSceneId,
    );
    return focusedTimelineState
      ? {
          sceneId: focusedSceneId,
          state: focusedTimelineState,
        }
      : {
          sceneId: null,
          state,
        };
  };
  const renderTimelinePanel = () => {
    const focusedScene = getFocusedScene();
    const timelineState = getTimelineRenderState().state;
    if (!focusedScene) {
      return renderMotionTimeline(timelineState, { scenePresence });
    }
    return `
      <div class="mce-section">
        <div class="mce-section-head">
          <h3>Scene Focus</h3>
          <button type="button" class="mce-inline-action" data-action="clear-scene-focus">전체 보기</button>
        </div>
        <div class="mce-diag-card" data-tone="accent">
          <strong>${focusedScene.title}</strong>
          <p>global ${focusedScene.startMs}-${focusedScene.startMs + focusedScene.durationMs}ms · local 0-${focusedScene.durationMs}ms</p>
        </div>
      </div>
      ${renderMotionTimeline(timelineState, { scenePresence })}
    `;
  };
  let dragPointerId: number | null = null;
  const syncControllerSession = () => {
    session = workspace.controller.getSession();
    state = session.present;
    syncFocusedScene();
  };
  const preservePreviewSelection = (
    command: MotionEditorCommand,
    selection: MotionEditorSelectionV2 | null,
  ) => {
    state = workspace.controller.preview(command);
    if (
      selection?.kind === "cue-preset"
      && command.type === "set-composition"
      && findCuePresetById(command.composition, selection.id)
    ) {
      state = { ...state, selection };
    }
    mountPlayer();
    refreshFromPlayer();
  };
  const dispatchSelectionDetailCommand = (
    command: MotionEditorCommand | null,
    selection: MotionEditorSelectionV2 | null = null,
  ) => {
    if (!command) {
      return;
    }
    dispatch(command);
    if (
      selection?.kind === "cue-preset"
      && command.type === "set-composition"
      && findCuePresetById(command.composition, selection.id)
    ) {
      dispatch({ type: "select", selection });
    }
  };
  const selectionDetailScrub = bindScrubInputs({
    root: selectionDetailPanel,
    readConfig: readScrubFieldConfig,
    preview(field, value) {
      const command = createSelectionDetailCommand(session.present, field, value);
      if (command) {
        preservePreviewSelection(command, createCuePresetSelection(field.dataset["presetId"]));
      }
    },
    commit(field, value) {
      dispatchSelectionDetailCommand(
        createSelectionDetailCommand(session.present, field, value),
        createCuePresetSelection(field.dataset["presetId"]),
      );
    },
  });
  const selectionDetailText = bindInlineTextInputs({
    root: selectionDetailPanel,
    commit(field, value) {
      dispatchSelectionDetailCommand(
        createSelectionDetailTextCommand(session.present, field, value),
        createCuePresetSelection(field.dataset["presetId"]),
      );
    },
  });

  const syncThemeToggleButton = () => {
    themeToggleButton.textContent = `테마: ${activeTheme === "dark" ? "다크" : "라이트"}`;
    themeToggleButton.setAttribute("aria-pressed", activeTheme === "light" ? "true" : "false");
    themeToggleButton.dataset["theme"] = activeTheme;
  };

  const setActiveTheme = (
    theme: MotionEditorThemeName,
    config: {
      readonly persist?: boolean;
    } = {},
  ) => {
    activeTheme = theme;
    applyMotionEditorTheme(theme);
    if (config.persist !== false) {
      writeStoredMotionEditorTheme(theme);
    }
    syncThemeToggleButton();
  };

  syncThemeToggleButton();

  const recordPlaybackFrame = () => {
    const now = performance.now();
    if (lastPlaybackFrameAt === null) {
      lastPlaybackFrameAt = now;
      return;
    }
    const deltaMs = now - lastPlaybackFrameAt;
    lastPlaybackFrameAt = now;
    const nextSamples = frameDiagnostics.samples + 1;
    const nextAverage = frameDiagnostics.averageFrameMs === null
      ? deltaMs
      : ((frameDiagnostics.averageFrameMs * frameDiagnostics.samples) + deltaMs) / nextSamples;
    frameDiagnostics = {
      samples: nextSamples,
      lastFrameMs: deltaMs,
      averageFrameMs: nextAverage,
      worstFrameMs: Math.max(frameDiagnostics.worstFrameMs ?? deltaMs, deltaMs),
      slowFrames: frameDiagnostics.slowFrames + (deltaMs > SLOW_FRAME_MS ? 1 : 0),
      droppedFrames: frameDiagnostics.droppedFrames + Math.max(0, Math.round(deltaMs / IDEAL_FRAME_MS) - 1),
    };
  };

  const mountPlayer = () => {
    lastPlaybackFrameAt = null;
    player?.destroy();
    const playbackComposition = resolveMotionComposition(
      assemblePreviewComposition(state.composition, getPreviewTarget()),
      state.values,
    );
    player = createMotionPlayer(
      stageMount.adapter,
      playbackComposition,
      {
        onTimeUpdate() {
          recordPlaybackFrame();
          refreshFromPlayer();
        },
        onComplete() {
          lastPlaybackFrameAt = null;
          eventLog.push("transport", "complete");
          refreshFromPlayer();
        },
      },
    );
    player.setLoop(state.transport.loop);
    player.setPlaybackRate(state.transport.playbackRate);
    player.seek(state.transport.currentTimeMs);
    if (state.transport.playing) {
      player.play();
    }
    lastSnapshot = player.snapshot();
    state = syncMotionEditorState(state, lastSnapshot);
  };

  const renderEventLogPanel = () => {
    const entries = eventLog.entries().slice(0, 30);
    if (entries.length === 0) {
      eventLogPanel.innerHTML = `<div class="mce-diag-empty">이벤트 없음</div>`;
      return;
    }
    eventLogPanel.innerHTML = entries
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString("ko-KR", { hour12: false });
        const detail = entry.detail ? ` · ${Object.entries(entry.detail).map(([k, v]) => `${k}:${v}`).join(", ")}` : "";
        return `<div class="mce-diag-row"><strong class="mce-log-category" data-category="${entry.category}">${entry.category}</strong><span>${time} ${entry.action}${detail}</span></div>`;
      })
      .join("")
      + (eventLog.size() > 30 ? `<div class="mce-diag-row"><span>… ${eventLog.size() - 30}건 더</span></div>` : "");
  };

  const setPreviewMode = (
    mode: MotionEditorPreviewMode,
    currentTargetOverride?: MotionEditorPreviewTarget,
  ) => {
    if (!isSceneComposition(state.composition)) {
      return;
    }

    if (mode === "scene" && !focusedSceneId) {
      return;
    }

    const currentTarget = currentTargetOverride ?? getPreviewTarget();
    previewMode = mode;
    const nextTarget = getPreviewTarget();

    if (
      currentTarget.mode !== nextTarget.mode
      || (currentTarget.mode === "scene"
        && nextTarget.mode === "scene"
        && currentTarget.sceneId !== nextTarget.sceneId)
    ) {
      workspace.controller.apply({
        type: "set-current-time",
        timeMs: mapPreviewTimeMs(
          state.composition,
          currentTarget,
          nextTarget,
          state.transport.currentTimeMs,
        ),
      });
      syncControllerSession();
    }

    eventLog.push("system", "set_preview_mode", {
      mode: nextTarget.mode,
      ...(nextTarget.mode === "scene" ? { sceneId: nextTarget.sceneId } : {}),
    });
    frameDiagnostics = createFrameDiagnosticsState();
    lastPlaybackFrameAt = null;
    mountPlayer();
    renderPanels();
    emitState();
  };

  const renderPanels = () => {
    paramPanel.innerHTML = renderParameterControls(state.composition.parameters, state.values);
    const previewTarget = getPreviewTarget();
    if (isSceneComposition(state.composition)) {
      const focusedScene = getFocusedScene();
      scenesPanel.innerHTML = renderScenesPanel(state.composition, state.selection, focusedSceneId, scenePresence);
      sequencePanel.innerHTML = focusedScene
        ? renderSceneSequencePanel(state.composition, focusedScene.id)
        : `<div class="mce-diag-empty">scene을 선택하면 scene-local sequence를 보여줍니다.</div>`;
      layerPanel.innerHTML = focusedScene
        ? renderScenePlacementPanel(state.composition, focusedScene.id, state.selection)
        : `<div class="mce-diag-empty">scene을 선택하면 해당 scene의 placement만 편집합니다.</div>`;
      transitionPanel.innerHTML = `<div class="mce-diag-empty">scene composition에는 전역 transition panel이 없습니다.</div>`;
      captionPanel.innerHTML = focusedScene
        ? renderSceneCaptionPanel(state.composition, focusedScene.id)
        : `<div class="mce-diag-empty">scene을 선택하면 scene-local caption을 보여줍니다.</div>`;
    } else {
      scenesPanel.innerHTML = `<div class="mce-diag-empty">scene composition에서만 사용합니다.</div>`;
      sequencePanel.innerHTML = renderSequencePanel(state.composition.sequences, state.selection);
      layerPanel.innerHTML = renderLayerPanel(state.composition.layers, state.selection);
      transitionPanel.innerHTML = renderTransitionPanel(state.composition.transitions, state.selection);
      captionPanel.innerHTML = renderCaptionPanel(state.composition.captions, state.selection);
    }
    previewControls.hidden = !isSceneComposition(state.composition);
    previewFullButton.disabled = !isSceneComposition(state.composition);
    previewSceneButton.disabled = !isSceneComposition(state.composition) || !focusedSceneId;
    previewFullButton.classList.toggle("mce-secondary", previewTarget.mode !== "full");
    previewSceneButton.classList.toggle("mce-secondary", previewTarget.mode !== "scene");
    previewLabel.textContent = previewTarget.mode === "scene"
      ? `${getFocusedScene()?.title ?? previewTarget.sceneId} 씬`
      : "전체 어셈블리";
    cuePresetsPanel.innerHTML = renderCuePresetsPanel(state.composition, state.selection);
    jsonPanel.value = serializeMotionCompositionSchema(state.composition);
    selectionDetailPanel.innerHTML = renderSelectionDetail(state.composition, state.selection);
    diagnosticsPanel.innerHTML = renderDiagnosticsPanel(lastSnapshot, frameDiagnostics);
    importDiagnosticsPanel.innerHTML = renderImportDiagnosticsPanel(importDiagnostics);
    renderEventLogPanel();
    scrub.max = String(state.transport.durationMs);
    scrub.value = String(Math.round(state.transport.currentTimeMs));
    loopToggle.checked = state.transport.loop;
    playbackRateInput.value = String(state.transport.playbackRate);
    timelinePanel.innerHTML = renderTimelinePanel();

    const undoButton = root.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const redoButton = root.querySelector<HTMLButtonElement>('[data-action="redo"]');
    if (undoButton) undoButton.disabled = !workspace.controller.canUndo();
    if (redoButton) redoButton.disabled = !workspace.controller.canRedo();

    const linearOnlyActions = ["add-layer", "add-sequence", "add-caption", "add-transition"] as const;
    for (const action of linearOnlyActions) {
      const button = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button) {
        button.disabled = isSceneComposition(state.composition);
      }
    }
  };

  const emitState = () => {
    if (lastEmittedFocusedSceneId !== focusedSceneId) {
      lastEmittedFocusedSceneId = focusedSceneId;
      options.onFocusedSceneChange?.(focusedSceneId);
    }
    options.onStateChange?.(state);
  };

  const sync = () => {
    syncControllerSession();
    mountPlayer();
    renderPanels();
    emitState();
  };

  const refreshFromPlayer = () => {
    if (player) {
      lastSnapshot = player.snapshot();
      state = syncMotionEditorState(state, lastSnapshot);
      syncFocusedScene();
    }
    renderPanels();
    emitState();
  };

  const preview = (command: MotionEditorCommand) => {
    state = workspace.controller.preview(command);
    syncFocusedScene();
    mountPlayer();
    refreshFromPlayer();
  };

  const dispatch = (command: MotionEditorCommand) => {
    if (command.type === "play" || command.type === "restart" || command.type === "set-composition") {
      frameDiagnostics = createFrameDiagnosticsState();
      lastPlaybackFrameAt = null;
    }
    workspace.controller.apply(command);
    syncControllerSession();

    // transport 커맨드 → player 직접 제어
    switch (command.type) {
      case "play": player?.play(); eventLog.push("transport", "play"); break;
      case "pause": player?.pause(); eventLog.push("transport", "pause"); break;
      case "restart": player?.restart(); eventLog.push("transport", "restart"); break;
      case "set-current-time": player?.seek(command.timeMs); eventLog.push("transport", "seek", { timeMs: command.timeMs }); break;
      case "set-playback-rate": player?.setPlaybackRate(command.playbackRate); eventLog.push("transport", "set_rate", { rate: command.playbackRate }); break;
      case "set-loop": player?.setLoop(command.loop); eventLog.push("transport", "set_loop", { loop: command.loop }); break;
      // 편집 커맨드 → 트래킹 + full sync
      case "select":
        if (command.selection) eventLog.push("edit", "select", { kind: command.selection.kind, id: describeSelectionId(command.selection) });
        break;
      case "add-scene":
        eventLog.push("edit", "add_scene", { sceneId: command.id });
        sync();
        break;
      case "remove-scene":
        eventLog.push("edit", "remove_scene", { sceneId: command.sceneId });
        sync();
        break;
      case "rename-scene":
        eventLog.push("edit", "rename_scene", { sceneId: command.sceneId });
        sync();
        break;
      case "update-scene-timing":
        eventLog.push("edit", "edit_scene", { sceneId: command.sceneId, field: "timing" });
        sync();
        break;
      case "add-scene-placement":
        eventLog.push("edit", "add_scene_placement", { sceneId: command.sceneId, targetId: command.targetId });
        sync();
        break;
      case "remove-scene-placement":
        eventLog.push("edit", "remove_scene_placement", { sceneId: command.sceneId, targetId: command.targetId });
        sync();
        break;
      case "update-scene-placement-timing":
        eventLog.push("edit", "edit_scene_placement", { sceneId: command.sceneId, targetId: command.targetId, field: "timing" });
        sync();
        break;
      case "update-scene-placement-cue":
        eventLog.push("edit", "edit_scene_placement", { sceneId: command.sceneId, targetId: command.targetId, field: command.cue });
        sync();
        break;
      case "set-parameter":
        eventLog.push("edit", "edit_parameter", { parameterId: command.parameterId });
        sync();
        break;
      case "update-item-string":
        eventLog.push("edit", `edit_${command.itemKind}`, { id: command.itemId, field: command.itemKind === "layer" ? "label" : command.itemKind === "sequence" ? "title" : "text" });
        sync();
        break;
      case "update-item-timing":
        eventLog.push("edit", "edit_timing", { kind: command.itemKind, id: command.itemId });
        sync();
        break;
      case "update-sequence-stagger":
        eventLog.push("edit", "edit_stagger", { sequenceId: command.sequenceId, field: command.field });
        sync();
        break;
      case "update-sequence-layer-slot":
        eventLog.push("edit", "edit_slot", {
          sequenceId: command.sequenceId,
          layerId: command.layerId,
          field: command.field,
        });
        sync();
        break;
      case "update-sequence-layer-role":
        eventLog.push("edit", "edit_slot", {
          sequenceId: command.sequenceId,
          layerId: command.layerId,
          field: "role",
        });
        sync();
        break;
      case "update-layer-cue-kind":
        eventLog.push("edit", "edit_layer", { layerId: command.layerId, field: `${command.cue}.kind` });
        sync();
        break;
      case "update-layer-cue-preset":
        eventLog.push("edit", "edit_layer", { layerId: command.layerId, field: `${command.cue}.preset` });
        sync();
        break;
      case "update-layer-content-type":
        eventLog.push("edit", "edit_layer", { layerId: command.layerId, field: "content.type" });
        sync();
        break;
      case "add-layer":
        eventLog.push("edit", "add_layer", { layerId: command.id });
        sync();
        break;
      case "remove-layer":
        eventLog.push("edit", "remove_layer", { layerId: command.layerId });
        sync();
        break;
      case "add-sequence":
        eventLog.push("edit", "add_sequence", { sequenceId: command.id });
        sync();
        break;
      case "remove-sequence":
        eventLog.push("edit", "remove_sequence", { sequenceId: command.sequenceId });
        sync();
        break;
      case "add-caption":
        eventLog.push("edit", "add_caption", { captionId: command.id });
        sync();
        break;
      case "remove-caption":
        eventLog.push("edit", "remove_caption", { captionId: command.captionId });
        sync();
        break;
      case "add-transition":
        eventLog.push("edit", "add_transition", { transitionId: command.id });
        sync();
        break;
      case "remove-transition":
        eventLog.push("edit", "remove_transition", { transitionId: command.transitionId });
        sync();
        break;
      case "update-transition-duration":
        eventLog.push("edit", "edit_transition", { transitionId: command.transitionId, field: "durationMs" });
        sync();
        break;
      case "update-transition-style":
        eventLog.push("edit", "edit_transition", { transitionId: command.transitionId, field: "style" });
        sync();
        break;
      case "update-transition-param":
        eventLog.push("edit", "edit_transition", { transitionId: command.transitionId, field: command.param });
        sync();
        break;
      default:
        sync();
        break;
    }

    refreshFromPlayer();
  };

  const commitJson = (
    source: string,
    origin: Exclude<MotionImportDiagnosticsState["source"], null>,
  ) => {
    try {
      workspace.importDocument(source, { source: origin });
      frameDiagnostics = createFrameDiagnosticsState();
      lastPlaybackFrameAt = null;
      eventLog.push("composition", "import", { source: origin });
      importDiagnostics = {
        status: "success",
        source: origin,
        message: `schemaVersion 검증 및 composition import가 완료되었습니다.`,
      };
      setJsonError(jsonErrorPanel, null);
      sync();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      importDiagnostics = {
        status: "error",
        source: origin,
        message,
      };
      setJsonError(
        jsonErrorPanel,
        message,
      );
      renderPanels();
      emitState();
    }
  };

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const action = target.dataset["action"];
    if (action === "loop" && target instanceof HTMLInputElement) {
      dispatch({ type: "set-loop", loop: target.checked });
      return;
    }
    if (action === "playback-rate" && target instanceof HTMLInputElement) {
      dispatch({
        type: "set-playback-rate",
        playbackRate: Number(target.value),
      });
      return;
    }
    const parameterId = target.dataset["param"];
    if (!parameterId) return;
    dispatch({
      type: "set-parameter",
      parameterId,
      value:
        target instanceof HTMLInputElement && target.type === "number"
          ? Number(target.value)
          : target.value,
    });
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    const command = createSelectionDetailControlCommand(state, target);
    if (command) {
      dispatchSelectionDetailCommand(command, createCuePresetSelection(target.dataset["presetId"]));
    }
  });

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-action]");
    if (button?.dataset["action"] === "toggle-theme") {
      const nextTheme = activeTheme === "dark" ? "light" : "dark";
      setActiveTheme(nextTheme);
      eventLog.push("system", "set_theme", { theme: nextTheme });
      return;
    }
    if (button?.dataset["action"] === "undo") {
      workspace.controller.undo();
      eventLog.push("edit", "undo");
      sync();
      return;
    }
    if (button?.dataset["action"] === "redo") {
      workspace.controller.redo();
      eventLog.push("edit", "redo");
      sync();
      return;
    }
    if (button?.dataset["action"] === "clear-scene-focus") {
      const previousTarget = getPreviewTarget();
      focusedSceneId = null;
      if (previousTarget.mode === "scene") {
        setPreviewMode("full", previousTarget);
        return;
      }
      if (state.selection?.kind === "scene" || state.selection?.kind === "scene-layer") {
        dispatch({ type: "select", selection: null });
      } else {
        renderPanels();
        emitState();
      }
      return;
    }
    if (button?.dataset["action"] === "add-layer") {
      if (!isLinearShellState(state)) return;
      const draft = createNextLayerDraft(state);
      dispatch({
        type: "add-layer",
        id: draft.id,
        label: draft.label,
        target: createMotionStageNodeTarget(draft.id),
        content: { type: "dom" },
        durationMs: DEFAULT_NEW_LAYER_DURATION_MS,
      });
      dispatch({ type: "select", selection: { kind: "layer", id: draft.id } });
      return;
    }
    if (button?.dataset["action"] === "add-sequence") {
      if (!isLinearShellState(state)) return;
      const draft = createNextSequenceDraft(state);
      dispatch({
        type: "add-sequence",
        id: draft.id,
        title: draft.title,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        layerIds: [],
        captionIds: [],
      });
      dispatch({ type: "select", selection: { kind: "sequence", id: draft.id } });
      return;
    }
    if (button?.dataset["action"] === "add-caption") {
      if (!isLinearShellState(state)) return;
      const draft = createNextCaptionDraft(state);
      dispatch({
        type: "add-caption",
        id: draft.id,
        text: draft.text,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        tone: draft.tone,
      });
      dispatch({ type: "select", selection: { kind: "caption", id: draft.id } });
      return;
    }
    if (button?.dataset["action"] === "add-transition") {
      if (!isLinearShellState(state)) return;
      const draft = createNextTransitionDraft(state);
      if (!draft) {
        return;
      }
      dispatch({
        type: "add-transition",
        id: draft.id,
        fromSequenceId: draft.fromSequenceId,
        toSequenceId: draft.toSequenceId,
        style: draft.style,
        durationMs: draft.durationMs,
      });
      dispatch({ type: "select", selection: { kind: "transition", id: draft.id } });
      return;
    }
    if (button?.dataset["action"] === "add-scene") {
      if (!isSceneComposition(state.composition)) return;
      const draft = createNextSceneDraft(state as SceneShellState);
      focusedSceneId = draft.id;
      dispatch({
        type: "add-scene",
        id: draft.id,
        title: draft.title,
        startMs: draft.startMs,
        durationMs: draft.durationMs,
        layers: [],
        sequences: [],
        captions: [],
      });
      dispatch({ type: "select", selection: { kind: "scene", id: draft.id } });
      return;
    }
    if (button?.dataset["action"] === "play") dispatch({ type: "play" });
    if (button?.dataset["action"] === "pause") dispatch({ type: "pause" });
    if (button?.dataset["action"] === "restart") dispatch({ type: "restart" });
    if (button?.dataset["action"] === "preview-full") {
      setPreviewMode("full");
      return;
    }
    if (button?.dataset["action"] === "preview-scene") {
      setPreviewMode("scene");
      return;
    }
    if (button?.dataset["action"] === "download-json") {
      workspace.exportDocument({
        document: workspace.controller.exportDocument(),
        fileName: `${state.composition.id}.json`,
        state,
      });
      eventLog.push("composition", "export", { compositionId: state.composition.id });
    }
    if (button?.dataset["action"] === "export-v1") {
      const previewTarget = getPreviewTarget();
      const fileName = previewTarget.mode === "scene"
        ? `${state.composition.id}.${previewTarget.sceneId}.assembled.v1.json`
        : `${state.composition.id}.assembled.v1.json`;
      workspace.exportDocument({
        document: createPreviewDocument(state.composition, previewTarget),
        fileName,
        state,
      });
      eventLog.push("composition", "export_v1", {
        compositionId: state.composition.id,
        mode: previewTarget.mode,
        ...(previewTarget.mode === "scene" ? { sceneId: previewTarget.sceneId } : {}),
      });
      return;
    }
    if (button?.dataset["action"] === "open-file") fileInput.click();
    if (button?.dataset["action"] === "import-json") commitJson(jsonPanel.value, "textarea");
    if (button?.dataset["action"] === "reset-layout") {
      resetLayout();
      eventLog.push("system", "reset_layout");
      return;
    }

    const addScenePlacementTargetId = target.closest<HTMLElement>("[data-add-scene-placement]")?.dataset["addScenePlacement"];
    if (addScenePlacementTargetId) {
      const sceneId = target.closest<HTMLElement>("[data-add-scene-placement]")?.dataset["sceneId"];
      if (!sceneId || !isSceneComposition(state.composition)) {
        return;
      }
      focusedSceneId = sceneId;
      dispatch({
        type: "add-scene-placement",
        sceneId,
        targetId: addScenePlacementTargetId,
      });
      dispatch({
        type: "select",
        selection: {
          kind: "scene-layer",
          sceneId,
          targetId: addScenePlacementTargetId,
        },
      });
      return;
    }
    const removeSceneId = target.closest<HTMLElement>("[data-remove-scene]")?.dataset["removeScene"];
    if (removeSceneId) {
      dispatch({ type: "remove-scene", sceneId: removeSceneId });
      return;
    }
    const renameSceneId = target.closest<HTMLElement>("[data-rename-scene]")?.dataset["renameScene"];
    if (renameSceneId && isSceneComposition(state.composition)) {
      const scene = state.composition.scenes.find((entry) => entry.id === renameSceneId);
      if (!scene) {
        return;
      }
      const nextTitle = typeof window.prompt === "function"
        ? window.prompt("씬 이름", scene.title)
        : scene.title;
      if (nextTitle !== null) {
        focusedSceneId = renameSceneId;
        dispatch({ type: "rename-scene", sceneId: renameSceneId, title: nextTitle });
      }
      return;
    }
    const removeScenePlacementTargetId = target.closest<HTMLElement>("[data-remove-scene-placement]")?.dataset["removeScenePlacement"];
    if (removeScenePlacementTargetId) {
      const sceneId = target.closest<HTMLElement>("[data-remove-scene-placement]")?.dataset["sceneId"];
      if (!sceneId) {
        return;
      }
      focusedSceneId = sceneId;
      dispatch({
        type: "remove-scene-placement",
        sceneId,
        targetId: removeScenePlacementTargetId,
      });
      return;
    }
    const removeLayerId = target.closest<HTMLElement>("[data-remove-layer]")?.dataset["removeLayer"];
    if (removeLayerId) {
      dispatch({ type: "remove-layer", layerId: removeLayerId });
      return;
    }
    const removeSequenceId = target.closest<HTMLElement>("[data-remove-sequence]")?.dataset["removeSequence"];
    if (removeSequenceId) {
      dispatch({ type: "remove-sequence", sequenceId: removeSequenceId });
      return;
    }
    const removeCaptionId = target.closest<HTMLElement>("[data-remove-caption]")?.dataset["removeCaption"];
    if (removeCaptionId) {
      dispatch({ type: "remove-caption", captionId: removeCaptionId });
      return;
    }
    const removeTransitionId = target.closest<HTMLElement>("[data-remove-transition]")?.dataset["removeTransition"];
    if (removeTransitionId) {
      dispatch({ type: "remove-transition", transitionId: removeTransitionId });
      return;
    }

    const sceneId = target.closest<HTMLElement>("[data-scene]")?.dataset["scene"];
    if (sceneId) {
      focusedSceneId = sceneId;
      dispatch({ type: "select", selection: { kind: "scene", id: sceneId } });
      return;
    }
    const sceneLayerButton = target.closest<HTMLElement>("[data-scene-layer]");
    if (sceneLayerButton) {
      const sceneLayerSceneId = sceneLayerButton.dataset["sceneId"];
      const sceneLayerTargetId = sceneLayerButton.dataset["targetId"];
      if (sceneLayerSceneId && sceneLayerTargetId) {
        focusedSceneId = sceneLayerSceneId;
        dispatch({
          type: "select",
          selection: {
            kind: "scene-layer",
            sceneId: sceneLayerSceneId,
            targetId: sceneLayerTargetId,
          },
        });
      }
      return;
    }
    const sequenceId = target.closest<HTMLElement>("[data-sequence]")?.dataset["sequence"];
    if (sequenceId) dispatch({ type: "select", selection: { kind: "sequence", id: sequenceId } });
    const layerId = target.closest<HTMLElement>("[data-layer]")?.dataset["layer"];
    if (layerId) dispatch({ type: "select", selection: { kind: "layer", id: layerId } });
    const transitionId = target.closest<HTMLElement>("[data-transition]")?.dataset["transition"];
    if (transitionId) dispatch({ type: "select", selection: { kind: "transition", id: transitionId } });
    const captionId = target.closest<HTMLElement>("[data-caption]")?.dataset["caption"];
    if (captionId) dispatch({ type: "select", selection: { kind: "caption", id: captionId } });
    const cuePresetId = target.closest<HTMLElement>("[data-cue-preset]")?.dataset["cuePreset"];
    if (cuePresetId) dispatch({ type: "select", selection: { kind: "cue-preset", id: cuePresetId } });
    const targetId = target.closest<HTMLElement>("[data-target]")?.dataset["target"];
    if (targetId) dispatch({ type: "select", selection: { kind: "target", id: targetId } });
  });

  scrub.addEventListener("input", () => {
    dispatch({ type: "set-current-time", timeMs: Number(scrub.value) });
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const source = await file.text();
      jsonPanel.value = source;
      commitJson(source, "file");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      importDiagnostics = {
        status: "error",
        source: "file",
        message,
      };
      setJsonError(jsonErrorPanel, message);
      renderPanels();
      emitState();
    } finally {
      fileInput.value = "";
    }
  });

  timelinePanel.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    const timelineState = getTimelineRenderState();
    const start = beginMotionTimelineDrag(timelineState.state, target, event.clientX);
    if (!start) return;

    dragSceneId = timelineState.sceneId;
    const nextSelection = timelineState.sceneId
      ? mapSceneFocusTimelineSelection(timelineState.sceneId, start.selection)
      : start.selection;
    if (nextSelection) {
      dispatch({ type: "select", selection: nextSelection });
    }
    dragState = start.dragState;
    dragCommand = null;

    if (dragState) {
      const op = dragState.operation;
      const kind = "target" in dragState ? dragState.target.kind : "transition";
      eventLog.push("timeline", "drag_start", { operation: op, itemKind: kind });
      dragPointerId = event.pointerId;
      timelinePanel.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });

  timelinePanel.addEventListener("pointermove", (event) => {
    if (!dragState || dragPointerId !== event.pointerId) return;
    const nextDragCommand = updateMotionTimelineDrag(dragState, event.clientX);
    dragCommand = dragSceneId
      ? mapSceneFocusTimelineCommand(dragSceneId, nextDragCommand)
      : nextDragCommand;
    if (dragCommand) {
      preview(dragCommand);
    }
  });

  const endDrag = (event?: PointerEvent) => {
    if (event && dragPointerId !== null && event.pointerId !== dragPointerId) return;
    const pointerId = dragPointerId;
    const nextDragCommand = dragCommand;
    dragCommand = null;
    dragState = null;
    dragSceneId = null;
    dragPointerId = null;

    if (nextDragCommand) {
      eventLog.push("timeline", "drag_commit");
      dispatch(nextDragCommand);
    } else {
      renderPanels();
      emitState();
    }
    if (pointerId !== null && timelinePanel.hasPointerCapture(pointerId)) {
      timelinePanel.releasePointerCapture(pointerId);
    }
  };

  timelinePanel.addEventListener("pointerup", (event) => endDrag(event));
  timelinePanel.addEventListener("pointercancel", (event) => endDrag(event));
  timelinePanel.addEventListener("lostpointercapture", () => endDrag());

  sync();

  return {
    getState() {
      return state;
    },
    getFocusedSceneId() {
      return focusedSceneId;
    },
    setScenePresence(presence) {
      scenePresence = indexScenePresenceEntries(presence);
      renderPanels();
    },
    dispatch,
    eventLog,
    destroy() {
      selectionDetailScrub.destroy();
      selectionDetailText.destroy();
      window.removeEventListener("resize", handleWindowResize);
      leftSplitter.destroy();
      rightSplitter.destroy();
      bottomSplitter.destroy();
      player?.destroy();
      root.remove();
    },
  };
}
