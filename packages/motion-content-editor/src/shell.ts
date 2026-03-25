import {
  applyMotionEditorSessionCommand,
  canRedoMotionEditorSession,
  canUndoMotionEditorSession,
  createMotionDomStageAdapter,
  createMotionEditorSession,
  createMotionPlayer,
  createPromoGridComposition,
  parseMotionComposition,
  previewMotionEditorSessionCommand,
  resolveMotionComposition,
  redoMotionEditorSession,
  serializeMotionComposition,
  syncMotionEditorState,
  undoMotionEditorSession,
  type MotionCompositionDef,
  type MotionEditorCommand,
  type MotionEditorSession,
  type MotionEditorState,
  type MotionParameterValues,
  type MotionPlayer,
  type MotionRuntimeSnapshot,
  type MotionStageAdapter,
  type MotionEventLog,
  createMotionEventLog,
} from "motion-content";
import {
  renderCuePresetsPanel,
  renderDiagnosticsPanel,
  renderCaptionPanel,
  renderImportDiagnosticsPanel,
  renderLayerPanel,
  renderSelectionDetail,
  type MotionFrameDiagnosticsState,
  type MotionImportDiagnosticsState,
  renderParameterControls,
  renderSequencePanel,
  renderTransitionPanel,
} from "./panels.js";
import { ensureMotionEditorStyles, MOTION_EDITOR_CSS } from "./styles.js";
import {
  beginMotionTimelineDrag,
  renderMotionTimeline,
  type MotionTimelineDragState,
  updateMotionTimelineDrag,
} from "./timeline.js";

export { MOTION_EDITOR_CSS } from "./styles.js";

export interface MotionEditorShellStage {
  readonly adapter: MotionStageAdapter;
}

export interface MotionEditorShellOptions {
  readonly container: HTMLElement;
  readonly composition?: MotionCompositionDef;
  readonly values?: Partial<MotionParameterValues>;
  readonly renderStage?: (host: HTMLElement, state: MotionEditorState) => MotionEditorShellStage;
  readonly onStateChange?: (state: MotionEditorState) => void;
  /** 로컬 이벤트 로그. 제공하면 사용, 미제공 시 내부 생성 */
  readonly eventLog?: MotionEventLog;
}

export interface MotionEditorShell {
  getState(): MotionEditorState;
  dispatch(command: MotionEditorCommand): void;
  readonly eventLog: MotionEventLog;
  destroy(): void;
}

const DEFAULT_PLAYBACK_RATE = 1;
const IDEAL_FRAME_MS = 1000 / 60;
const SLOW_FRAME_MS = 1000 / 30;

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
  const stageRoot = host.querySelector<HTMLElement>(".mce-stage")!;
  const captionElement = host.querySelector<HTMLElement>(".mce-caption")!;
  return {
    adapter: createMotionDomStageAdapter({
      stageRoot,
      captionElement,
    }),
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

export function createMotionEditorShell(
  options: MotionEditorShellOptions,
): MotionEditorShell {
  ensureMotionEditorStyles();
  const eventLog = options.eventLog ?? createMotionEventLog();

  let session: MotionEditorSession = createMotionEditorSession(
    options.composition ?? createPromoGridComposition(),
    options.values,
  );
  let state = session.present;
  let player: MotionPlayer | null = null;
  let dragCommand: MotionEditorCommand | null = null;
  let dragState: MotionTimelineDragState | null = null;
  let lastSnapshot: MotionRuntimeSnapshot | null = null;
  let importDiagnostics: MotionImportDiagnosticsState = {
    status: "idle",
    source: null,
    message: "",
  };
  let frameDiagnostics = createFrameDiagnosticsState();
  let lastPlaybackFrameAt: number | null = null;

  const root = document.createElement("div");
  root.className = "mce-root";
  root.innerHTML = `
    <div class="mce-pane">
      <div class="mce-kicker">Editor</div>
      <h2 class="mce-title">Motion Content Editor</h2>
      <div class="mce-section"><h3>Parameters</h3><div class="mce-controls" data-panel="params"></div></div>
      <div class="mce-section"><h3>Sequences</h3><div class="mce-list" data-panel="sequences"></div></div>
      <div class="mce-section"><h3>Layers</h3><div class="mce-list" data-panel="layers"></div></div>
      <div class="mce-section"><h3>Transitions</h3><div class="mce-list" data-panel="transitions"></div></div>
      <div class="mce-section"><h3>Captions</h3><div class="mce-list" data-panel="captions"></div></div>
      <div class="mce-section"><h3>Cue Presets</h3><div class="mce-list" data-panel="cue-presets"></div></div>
      <div class="mce-section"><h3>Composition JSON</h3><textarea class="mce-json" data-panel="json"></textarea><div class="mce-error" data-panel="json-error"></div></div>
    </div>
    <div class="mce-stage-wrap">
      <div class="mce-toolbar">
        <button class="mce-secondary" data-action="undo">Undo</button>
        <button class="mce-secondary" data-action="redo">Redo</button>
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
        <button class="mce-secondary" data-action="download-json">Download</button>
        <button class="mce-secondary" data-action="open-file">Upload</button>
        <button class="mce-secondary" data-action="import-json">Apply</button>
        <input data-action="scrub" type="range" min="0" max="${state.transport.durationMs}" value="0" />
        <input data-action="file-input" type="file" accept="application/json,.json" style="display:none" />
      </div>
      <div class="mce-stage-host"></div>
      <div class="mce-timeline" data-panel="timeline"></div>
    </div>
    <div class="mce-pane">
      <div class="mce-section"><h3>Selection Detail</h3><div class="mce-diag" data-panel="selection-detail"></div></div>
      <div class="mce-section"><h3>Active State</h3><div class="mce-diag" data-panel="diagnostics"></div></div>
      <div class="mce-section"><h3>Import / Validation</h3><div class="mce-diag" data-panel="import-diagnostics"></div></div>
      <details class="mce-section"><summary><h3 style="display:inline">Event Log</h3></summary><div class="mce-diag" data-panel="event-log"></div></details>
    </div>
  `;

  options.container.innerHTML = "";
  options.container.appendChild(root);

  const stageHost = root.querySelector<HTMLElement>(".mce-stage-host")!;
  const stageMount = options.renderStage?.(stageHost, state) ?? renderDefaultStage(stageHost);
  const paramPanel = root.querySelector<HTMLElement>('[data-panel="params"]')!;
  const sequencePanel = root.querySelector<HTMLElement>('[data-panel="sequences"]')!;
  const layerPanel = root.querySelector<HTMLElement>('[data-panel="layers"]')!;
  const transitionPanel = root.querySelector<HTMLElement>('[data-panel="transitions"]')!;
  const captionPanel = root.querySelector<HTMLElement>('[data-panel="captions"]')!;
  const cuePresetsPanel = root.querySelector<HTMLElement>('[data-panel="cue-presets"]')!;
  const jsonPanel = root.querySelector<HTMLTextAreaElement>('[data-panel="json"]')!;
  const jsonErrorPanel = root.querySelector<HTMLElement>('[data-panel="json-error"]')!;
  const timelinePanel = root.querySelector<HTMLElement>('[data-panel="timeline"]')!;
  const selectionDetailPanel = root.querySelector<HTMLElement>('[data-panel="selection-detail"]')!;
  const diagnosticsPanel = root.querySelector<HTMLElement>('[data-panel="diagnostics"]')!;
  const importDiagnosticsPanel = root.querySelector<HTMLElement>('[data-panel="import-diagnostics"]')!;
  const eventLogPanel = root.querySelector<HTMLElement>('[data-panel="event-log"]')!;
  const scrub = root.querySelector<HTMLInputElement>('[data-action="scrub"]')!;
  const loopToggle = root.querySelector<HTMLInputElement>('[data-action="loop"]')!;
  const playbackRateInput = root.querySelector<HTMLInputElement>('[data-action="playback-rate"]')!;
  const fileInput = root.querySelector<HTMLInputElement>('[data-action="file-input"]')!;
  let dragPointerId: number | null = null;

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
    player = createMotionPlayer(
      stageMount.adapter,
      resolveMotionComposition(state.composition, state.values),
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
  };

  const renderEventLogPanel = () => {
    const entries = eventLog.entries().slice(0, 30);
    if (entries.length === 0) {
      eventLogPanel.innerHTML = `<div class="mce-diag-empty">이벤트 없음</div>`;
      return;
    }
    const categoryColor: Record<string, string> = {
      transport: "#4bb7ff", edit: "#f08f20", timeline: "#66cc66",
      composition: "#cc66cc", system: "#999",
    };
    eventLogPanel.innerHTML = entries
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString("ko-KR", { hour12: false });
        const color = categoryColor[entry.category] ?? "#999";
        const detail = entry.detail ? ` · ${Object.entries(entry.detail).map(([k, v]) => `${k}:${v}`).join(", ")}` : "";
        return `<div class="mce-diag-row"><strong style="color:${color}">${entry.category}</strong><span>${time} ${entry.action}${detail}</span></div>`;
      })
      .join("")
      + (eventLog.size() > 30 ? `<div class="mce-diag-row"><span>… ${eventLog.size() - 30}건 더</span></div>` : "");
  };

  const renderPanels = () => {
    paramPanel.innerHTML = renderParameterControls(state.composition.parameters, state.values);
    sequencePanel.innerHTML = renderSequencePanel(state.composition.sequences, state.selection);
    layerPanel.innerHTML = renderLayerPanel(state.composition.layers, state.selection);
    transitionPanel.innerHTML = renderTransitionPanel(state.composition.transitions, state.selection);
    captionPanel.innerHTML = renderCaptionPanel(state.composition.captions, state.selection);
    cuePresetsPanel.innerHTML = renderCuePresetsPanel(state.composition);
    jsonPanel.value = serializeMotionComposition(state.composition);
    selectionDetailPanel.innerHTML = renderSelectionDetail(state.composition, state.selection);
    diagnosticsPanel.innerHTML = renderDiagnosticsPanel(lastSnapshot, frameDiagnostics);
    importDiagnosticsPanel.innerHTML = renderImportDiagnosticsPanel(importDiagnostics);
    renderEventLogPanel();
    scrub.max = String(state.transport.durationMs);
    scrub.value = String(Math.round(state.transport.currentTimeMs));
    loopToggle.checked = state.transport.loop;
    playbackRateInput.value = String(state.transport.playbackRate);
    timelinePanel.innerHTML = renderMotionTimeline(state);

    const undoButton = root.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const redoButton = root.querySelector<HTMLButtonElement>('[data-action="redo"]');
    if (undoButton) undoButton.disabled = !canUndoMotionEditorSession(session);
    if (redoButton) redoButton.disabled = !canRedoMotionEditorSession(session);
  };

  const emitState = () => {
    options.onStateChange?.(state);
  };

  const sync = () => {
    mountPlayer();
    renderPanels();
    emitState();
  };

  const refreshFromPlayer = () => {
    if (player) {
      lastSnapshot = player.snapshot();
      state = syncMotionEditorState(state, lastSnapshot);
    }
    renderPanels();
    emitState();
  };

  const preview = (command: MotionEditorCommand) => {
    state = previewMotionEditorSessionCommand(session, command);
    mountPlayer();
    refreshFromPlayer();
  };

  const dispatch = (command: MotionEditorCommand) => {
    if (command.type === "play" || command.type === "restart" || command.type === "set-composition") {
      frameDiagnostics = createFrameDiagnosticsState();
      lastPlaybackFrameAt = null;
    }
    session = applyMotionEditorSessionCommand(session, command);
    state = session.present;

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
        if (command.selection) eventLog.push("edit", "select", { kind: command.selection.kind, id: command.selection.id });
        break;
      case "set-parameter":
        eventLog.push("edit", "edit_parameter", { parameterId: command.parameterId });
        sync();
        break;
      case "update-item-timing":
        eventLog.push("edit", "edit_timing", { kind: command.itemKind, id: command.itemId });
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
    origin: MotionImportDiagnosticsState["source"],
  ) => {
    try {
      const command: MotionEditorCommand = {
        type: "set-composition",
        composition: parseMotionComposition(source),
        values: state.values,
      };
      dispatch(command);
      eventLog.push("composition", "import", { source: origin });
      importDiagnostics = {
        status: "success",
        source: origin,
        message: `schemaVersion 검증 및 composition import가 완료되었습니다.`,
      };
      setJsonError(jsonErrorPanel, null);
      renderPanels();
      emitState();
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

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>("[data-action]");
    if (button?.dataset["action"] === "undo") {
      session = undoMotionEditorSession(session);
      state = session.present;
      eventLog.push("edit", "undo");
      sync();
      return;
    }
    if (button?.dataset["action"] === "redo") {
      session = redoMotionEditorSession(session);
      state = session.present;
      eventLog.push("edit", "redo");
      sync();
      return;
    }
    if (button?.dataset["action"] === "play") dispatch({ type: "play" });
    if (button?.dataset["action"] === "pause") dispatch({ type: "pause" });
    if (button?.dataset["action"] === "restart") dispatch({ type: "restart" });
    if (button?.dataset["action"] === "download-json") {
      const blob = new Blob([serializeMotionComposition(state.composition)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${state.composition.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      eventLog.push("composition", "export", { compositionId: state.composition.id });
    }
    if (button?.dataset["action"] === "open-file") fileInput.click();
    if (button?.dataset["action"] === "import-json") commitJson(jsonPanel.value, "textarea");

    const sequenceId = target.closest<HTMLElement>("[data-sequence]")?.dataset["sequence"];
    if (sequenceId) dispatch({ type: "select", selection: { kind: "sequence", id: sequenceId } });
    const layerId = target.closest<HTMLElement>("[data-layer]")?.dataset["layer"];
    if (layerId) dispatch({ type: "select", selection: { kind: "layer", id: layerId } });
    const transitionId = target.closest<HTMLElement>("[data-transition]")?.dataset["transition"];
    if (transitionId) dispatch({ type: "select", selection: { kind: "transition", id: transitionId } });
    const captionId = target.closest<HTMLElement>("[data-caption]")?.dataset["caption"];
    if (captionId) dispatch({ type: "select", selection: { kind: "caption", id: captionId } });
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
    const start = beginMotionTimelineDrag(state, target, event.clientX);
    if (!start) return;

    dispatch({ type: "select", selection: start.selection });
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
    dragCommand = updateMotionTimelineDrag(dragState, event.clientX);
    preview(dragCommand);
  });

  const endDrag = (event?: PointerEvent) => {
    if (event && dragPointerId !== null && event.pointerId !== dragPointerId) return;
    const pointerId = dragPointerId;
    const nextDragCommand = dragCommand;
    dragCommand = null;
    dragState = null;
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
    dispatch,
    eventLog,
    destroy() {
      player?.destroy();
      root.remove();
    },
  };
}
