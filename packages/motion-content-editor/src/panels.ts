import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCuePreset,
  MotionCueRef,
  MotionEditorSelection,
  MotionLayerDef,
  MotionParameterDef,
  MotionParameterValues,
  MotionRuntimeSnapshot,
  MotionSequenceDef,
  MotionTransitionDef,
  SequenceLayerSlot,
} from "motion-content";
import { isCuePresetRef, type MotionTransitionParams } from "motion-content";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeCueRef(ref: MotionCueRef): string {
  if (isCuePresetRef(ref)) return `preset:${ref.preset}`;
  return ref.kind;
}

function isSelected(
  selection: MotionEditorSelection | null,
  kind: MotionEditorSelection["kind"],
  id: string,
): boolean {
  return selection?.kind === kind && selection.id === id;
}

export interface MotionImportDiagnosticsState {
  readonly status: "idle" | "success" | "error";
  readonly source: "textarea" | "file" | null;
  readonly message: string;
}

export interface MotionFrameDiagnosticsState {
  readonly samples: number;
  readonly lastFrameMs: number | null;
  readonly averageFrameMs: number | null;
  readonly worstFrameMs: number | null;
  readonly slowFrames: number;
  readonly droppedFrames: number;
}

export function renderParameterControls(
  parameters: readonly MotionParameterDef[],
  values: MotionParameterValues,
): string {
  return parameters
    .map((parameter) => {
      const value = String(values[parameter.id] ?? parameter.defaultValue);
      const control = parameter.type === "select"
        ? `<select data-param="${escapeHtml(parameter.id)}">${(parameter.options ?? [])
            .map(
              (option) =>
                `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
            )
            .join("")}</select>`
        : `<input data-param="${escapeHtml(parameter.id)}" type="${parameter.type === "number" ? "number" : parameter.type}" value="${escapeHtml(value)}" min="${parameter.min ?? 0}" max="${parameter.max ?? 999}" step="${parameter.step ?? 1}" />`;
      return `<label class="mce-control"><span>${escapeHtml(parameter.label)}</span>${control}</label>`;
    })
    .join("");
}

export function renderLayerPanel(
  layers: readonly MotionLayerDef[],
  selection: MotionEditorSelection | null,
): string {
  return layers
    .map((layer) => {
      const ct = layer.content?.type ?? "dom";
      const enter = describeCueRef(layer.enter);
      const exit = layer.exit ? describeCueRef(layer.exit) : "—";
      return `<button class="mce-item ${isSelected(selection, "layer", layer.id) ? "is-active" : ""}" data-layer="${escapeHtml(layer.id)}"><strong>${escapeHtml(layer.label)}</strong><span>${ct} · ${enter} / ${exit}</span></button>`;
    })
    .join("");
}

export function renderCaptionPanel(
  captions: readonly MotionCaptionCue[],
  selection: MotionEditorSelection | null,
): string {
  return captions
    .map(
      (caption) =>
        `<button class="mce-item ${isSelected(selection, "caption", caption.id) ? "is-active" : ""}" data-caption="${escapeHtml(caption.id)}"><strong>${escapeHtml(caption.id)}</strong><span>${caption.tone ?? "neutral"} · ${caption.startMs}/${caption.durationMs}</span></button>`,
    )
    .join("");
}

export function renderCuePresetsPanel(
  composition: MotionCompositionDef,
): string {
  const presets = composition.cuePresets ?? [];
  if (presets.length === 0) return `<div class="mce-diag-empty">cue preset 없음</div>`;
  return presets
    .map((preset) => {
      const refCount = composition.layers.filter(
        (layer) =>
          (isCuePresetRef(layer.enter) && layer.enter.preset === preset.id) ||
          (layer.exit && isCuePresetRef(layer.exit) && layer.exit.preset === preset.id),
      ).length;
      return `<div class="mce-item"><strong>${escapeHtml(preset.label)}</strong><span>${escapeHtml(preset.kind)} · ${preset.durationMs}ms · ${refCount}곳 사용</span></div>`;
    })
    .join("");
}

export function renderSequencePanel(
  sequences: readonly MotionSequenceDef[],
  selection: MotionEditorSelection | null,
): string {
  return sequences
    .map((sequence) => {
      const layerCount = sequence.layerIds.length;
      const staggerInfo = sequence.stagger
        ? `stagger(${sequence.stagger.startOffsetMs}+${sequence.stagger.intervalMs}ms)`
        : `${layerCount} layers`;
      return `<button class="mce-item ${isSelected(selection, "sequence", sequence.id) ? "is-active" : ""}" data-sequence="${escapeHtml(sequence.id)}"><strong>${escapeHtml(sequence.title)}</strong><span>${sequence.startMs}/${sequence.durationMs} · ${staggerInfo}</span></button>`;
    })
    .join("");
}

export function renderTransitionPanel(
  transitions: readonly MotionTransitionDef[],
  selection: MotionEditorSelection | null,
): string {
  return transitions
    .map((transition) => {
      let paramsStr = "";
      if (transition.params) {
        const p = transition.params as Record<string, unknown>;
        paramsStr = " · " + Object.entries(p).map(([k, v]) => `${k}:${v}`).join(", ");
      }
      return `<button class="mce-item ${isSelected(selection, "transition", transition.id) ? "is-active" : ""}" data-transition="${escapeHtml(transition.id)}"><strong>${escapeHtml(transition.id)}</strong><span>${escapeHtml(transition.style)} ${transition.durationMs}ms${paramsStr}</span></button>`;
    })
    .join("");
}

export function renderSelectionDetail(
  composition: MotionCompositionDef,
  selection: MotionEditorSelection | null,
): string {
  if (!selection) return `<div class="mce-diag-empty">선택된 항목 없음</div>`;
  const presets = composition.cuePresets ?? [];
  const row = (label: string, value: string) =>
    `<div class="mce-diag-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;

  if (selection.kind === "layer") {
    const layer = composition.layers.find((l) => l.id === selection.id);
    if (!layer) return row("Layer", `${selection.id} (없음)`);
    const ct = layer.content?.type ?? "dom";
    const contentDetail = layer.content && "src" in layer.content ? ` (${(layer.content as { src: string }).src})` : "";
    const enter = describeCueRef(layer.enter);
    const exit = layer.exit ? describeCueRef(layer.exit) : "없음";
    // slot 정보 찾기
    let slotInfo = "절대 좌표";
    for (const seq of composition.sequences) {
      const slot = seq.layers?.find((s) => s.layerId === layer.id);
      if (slot) {
        const coordMode = slot.offsetMs !== undefined ? "상대" : "절대";
        const staggerNote = seq.stagger && slot.offsetMs === undefined ? " (stagger 파생)" : "";
        slotInfo = `${seq.title} · ${slot.role ?? "-"} · z:${slot.zIndex ?? "-"} · ${coordMode}${staggerNote}`;
        break;
      }
    }
    return [
      row("id", layer.id),
      row("label", layer.label),
      row("contentType", `${ct}${contentDetail}`),
      row("enter", enter),
      row("exit", exit),
      row("timing", `${layer.startMs}~${layer.startMs + layer.durationMs}ms (${layer.durationMs}ms)`),
      row("slot", slotInfo),
    ].join("");
  }

  if (selection.kind === "sequence") {
    const seq = composition.sequences.find((s) => s.id === selection.id);
    if (!seq) return row("Sequence", `${selection.id} (없음)`);
    const stagger = seq.stagger
      ? `startOffset:${seq.stagger.startOffsetMs}, interval:${seq.stagger.intervalMs}`
      : "없음";
    const layers = seq.layerIds.join(", ");
    const captions = seq.captionIds?.join(", ") ?? "없음";
    return [
      row("id", seq.id),
      row("title", seq.title),
      row("timing", `${seq.startMs}~${seq.startMs + seq.durationMs}ms (${seq.durationMs}ms)`),
      row("stagger", stagger),
      row("layers", layers),
      row("captions", captions),
    ].join("");
  }

  if (selection.kind === "transition") {
    const tr = composition.transitions.find((t) => t.id === selection.id);
    if (!tr) return row("Transition", `${selection.id} (없음)`);
    let paramsStr = "기본값";
    if (tr.params) {
      paramsStr = Object.entries(tr.params).map(([k, v]) => `${k}:${v}`).join(", ");
    }
    return [
      row("id", tr.id),
      row("from → to", `${tr.fromSequenceId} → ${tr.toSequenceId}`),
      row("style", `${tr.style} (${paramsStr})`),
      row("duration", `${tr.durationMs}ms`),
    ].join("");
  }

  if (selection.kind === "caption") {
    const cap = composition.captions.find((c) => c.id === selection.id);
    if (!cap) return row("Caption", `${selection.id} (없음)`);
    return [
      row("id", cap.id),
      row("text", cap.text),
      row("tone", cap.tone ?? "neutral"),
      row("timing", `${cap.startMs}~${cap.startMs + cap.durationMs}ms (${cap.durationMs}ms)`),
    ].join("");
  }

  return row("Composition", composition.title);
}

function renderAssetValue(
  value: string,
): string {
  return `<code>${escapeHtml(value)}</code>`;
}

export function renderImportDiagnosticsPanel(
  state: MotionImportDiagnosticsState,
): string {
  if (state.status === "idle") {
    return `<div class="mce-diag-empty">아직 import/validation 이벤트가 없습니다.</div>`;
  }
  const tone = state.status === "error" ? "error" : "ok";
  const source = state.source === "file" ? "파일 업로드" : "JSON Apply";
  return `
    <div class="mce-diag-card" data-tone="${tone}">
      <strong>${state.status === "error" ? "실패" : "성공"} · ${source}</strong>
      <p>${escapeHtml(state.message)}</p>
    </div>
  `;
}

export function renderDiagnosticsPanel(
  snapshot: MotionRuntimeSnapshot | null,
  frame: MotionFrameDiagnosticsState,
): string {
  if (!snapshot) {
    return `<div class="mce-diag-empty">runtime snapshot이 아직 준비되지 않았습니다.</div>`;
  }

  const activeSections = [
    snapshot.active.sequences.length > 0
      ? snapshot.active.sequences
          .map(
            (sequence) =>
              `<div class="mce-diag-row"><strong>Sequence</strong><span>${escapeHtml(sequence.title)} · ${sequence.startMs}-${sequence.endMs}ms · remain ${sequence.remainingMs}ms</span></div>`,
          )
          .join("")
      : `<div class="mce-diag-row"><strong>Sequence</strong><span>active 없음</span></div>`,
    snapshot.active.layers.length > 0
      ? snapshot.active.layers
          .map(
            (layer) =>
              `<div class="mce-diag-row"><strong>Layer</strong><span>${escapeHtml(layer.label)} · ${escapeHtml(layer.contentType)} · ${escapeHtml(layer.phase)} · ${layer.startMs}-${layer.endMs}ms</span></div>`,
          )
          .join("")
      : `<div class="mce-diag-row"><strong>Layer</strong><span>active 없음</span></div>`,
    snapshot.active.caption
      ? `<div class="mce-diag-row"><strong>Caption</strong><span>${escapeHtml(snapshot.active.caption.id)} · ${snapshot.active.caption.startMs}-${snapshot.active.caption.endMs}ms · ${escapeHtml(snapshot.active.caption.text)}</span></div>`
      : `<div class="mce-diag-row"><strong>Caption</strong><span>active 없음</span></div>`,
  ].join("");

  const assetSections = snapshot.resolvedAssets.length > 0
    ? snapshot.resolvedAssets
        .map((asset) => {
          const status = asset.targetFound ? "resolved" : "missing";
          const diff = asset.changed
            ? `${renderAssetValue(asset.defaultValue)} → ${renderAssetValue(asset.value)}`
            : renderAssetValue(asset.value);
          const property = asset.property ? `.${asset.property}` : "";
          return `
            <div class="mce-diag-card" data-tone="${asset.targetFound ? (asset.changed ? "accent" : "neutral") : "error"}">
              <strong>${escapeHtml(asset.id)} · ${escapeHtml(asset.target.nodeId + property)} · ${status}</strong>
              <p>${diff}</p>
            </div>
          `;
        })
        .join("")
    : `<div class="mce-diag-empty">resolved asset가 없습니다.</div>`;

  return `
    <div class="mce-diag-group">
      <div class="mce-diag-group-title">Active Cue</div>
      ${activeSections}
    </div>
    <div class="mce-diag-group">
      <div class="mce-diag-group-title">Resolved Assets / Property Diff</div>
      ${assetSections}
    </div>
    <div class="mce-diag-group">
      <div class="mce-diag-group-title">Timing</div>
      <div class="mce-diag-row"><strong>Time</strong><span>${snapshot.timeMs} / ${snapshot.transport.durationMs}ms</span></div>
      <div class="mce-diag-row"><strong>Transition</strong><span>${snapshot.timing.activeTransitionIds.length > 0 ? escapeHtml(snapshot.timing.activeTransitionIds.join(", ")) : "active 없음"}</span></div>
      <div class="mce-diag-row"><strong>Next Cue</strong><span>${snapshot.timing.nextCueLabel ? `${escapeHtml(snapshot.timing.nextCueLabel)} · ${snapshot.timing.timeToNextCueMs}ms 후` : "없음"}</span></div>
      <div class="mce-diag-row"><strong>Frame</strong><span>last ${frame.lastFrameMs?.toFixed(1) ?? "-"}ms · avg ${frame.averageFrameMs?.toFixed(1) ?? "-"}ms · worst ${frame.worstFrameMs?.toFixed(1) ?? "-"}ms</span></div>
      <div class="mce-diag-row"><strong>Drop</strong><span>slow ${frame.slowFrames} · estimated dropped ${frame.droppedFrames} · samples ${frame.samples}</span></div>
    </div>
  `;
}
