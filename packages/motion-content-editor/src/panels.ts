import type {
  CrossfadeParams,
  FlashParams,
  LiftParams,
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCueRef,
  MotionCuePreset,
  MotionEditorSelection,
  MotionLayerDef,
  MotionParameterDef,
  MotionParameterValues,
  MotionRuntimeSnapshot,
  MotionSequenceDef,
  MotionTransitionDef,
} from "motion-content";
import {
  getSequenceLayerSlots,
  isCuePresetRef,
} from "motion-content";
import { parseMotionColorControlValue } from "./color-input.js";

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectRowOptions {
  readonly value: string;
  readonly control: string;
  readonly options: readonly SelectOption[];
  readonly metadata?: Record<string, string | number | undefined>;
  readonly emptyLabel?: string;
}

interface ColorRowOptions {
  readonly value: string;
  readonly control: string;
  readonly metadata?: Record<string, string | number | undefined>;
  readonly fallbackHex?: string;
}

const CUE_KIND_OPTIONS = [
  { value: "fade", label: "fade" },
  { value: "slide-up", label: "slide-up" },
  { value: "slide-left", label: "slide-left" },
  { value: "slide-right", label: "slide-right" },
  { value: "scale-pop", label: "scale-pop" },
] as const satisfies readonly SelectOption[];

const CONTENT_TYPE_OPTIONS = [
  { value: "dom", label: "dom" },
  { value: "image", label: "image" },
  { value: "video", label: "video" },
  { value: "svg", label: "svg" },
  { value: "canvas", label: "canvas" },
] as const satisfies readonly SelectOption[];

const TRANSITION_STYLE_OPTIONS = [
  { value: "crossfade", label: "crossfade" },
  { value: "flash", label: "flash" },
  { value: "lift", label: "lift" },
] as const satisfies readonly SelectOption[];

const SLOT_ROLE_OPTIONS = [
  { value: "background", label: "background" },
  { value: "content", label: "content" },
  { value: "overlay", label: "overlay" },
  { value: "accent", label: "accent" },
] as const satisfies readonly SelectOption[];

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

interface NumericRowOptions {
  readonly value: number;
  readonly command: string;
  readonly field: string;
  readonly unit?: string;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
  readonly metadata?: Record<string, string | number | undefined>;
}

interface InlineTextRowOptions {
  readonly value: string;
  readonly command: string;
  readonly field: string;
  readonly metadata?: Record<string, string | number | undefined>;
  readonly allowEmpty?: boolean;
  readonly emptyDisplay?: string;
  readonly emptyHint?: string;
  readonly placeholder?: string;
}

function valueRow(
  label: string,
  valueHtml: string,
): string {
  return `<div class="mce-diag-row"><strong>${escapeHtml(label)}</strong><div class="mce-diag-row__value">${valueHtml}</div></div>`;
}

function textRow(
  label: string,
  value: string,
): string {
  return valueRow(label, `<span>${escapeHtml(value)}</span>`);
}

function inlineTextRow(
  label: string,
  options: InlineTextRowOptions,
): string {
  const displayValue = options.value.length > 0
    ? options.value
    : (options.emptyDisplay ?? "");
  const hint = options.allowEmpty
    ? (options.emptyHint ?? "비우면 기본값")
    : "최소 1글자";
  const editor = `
    <div
      class="mce-inline-text-field"
      data-inline-text-field="${escapeHtml(options.field)}"
      data-inline-text-command="${escapeHtml(options.command)}"
      data-inline-text-value="${escapeHtml(options.value)}"
      data-inline-text-allow-empty="${options.allowEmpty ? "true" : "false"}"
      data-editing="false"
      data-invalid="false"
      ${Object.entries(options.metadata ?? {}).map(([name, value]) => renderAttr(name, value)).join("")}
    >
      <button
        type="button"
        class="mce-inline-text-field__display"
        data-inline-text-display="true"
        aria-label="${escapeHtml(label)} 편집"
      >
        <span class="mce-inline-text-field__value">${escapeHtml(displayValue)}</span>
      </button>
      <label class="mce-inline-text-field__editor">
        <input
          data-inline-text-editor="true"
          type="text"
          value="${escapeHtml(options.value)}"
          minlength="${options.allowEmpty ? "0" : "1"}"
          ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}
          aria-label="${escapeHtml(label)} 직접 입력"
        />
        <span class="mce-inline-text-field__hint">${escapeHtml(hint)}</span>
      </label>
    </div>
  `;
  return valueRow(label, editor);
}

function selectRow(
  label: string,
  options: SelectRowOptions,
): string {
  const optionMarkup = [
    options.emptyLabel !== undefined
      ? `<option value="">${escapeHtml(options.emptyLabel)}</option>`
      : "",
    ...options.options.map((option) =>
      `<option value="${escapeHtml(option.value)}" ${option.value === options.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
    ),
  ].join("");
  return valueRow(
    label,
    `<select
      data-selection-control="${escapeHtml(options.control)}"
      aria-label="${escapeHtml(label)} 변경"
      ${Object.entries(options.metadata ?? {}).map(([name, value]) => renderAttr(name, value)).join("")}
    >${optionMarkup}</select>`,
  );
}

function colorRow(
  label: string,
  options: ColorRowOptions,
): string {
  const color = parseMotionColorControlValue(options.value, options.fallbackHex ?? "#000000");
  return valueRow(
    label,
    `<div class="mce-color-field">
      <input
        data-selection-control="${escapeHtml(options.control)}"
        type="color"
        value="${escapeHtml(color.hex)}"
        data-color-alpha="${escapeHtml(String(color.alpha))}"
        aria-label="${escapeHtml(label)} 변경"
        ${Object.entries(options.metadata ?? {}).map(([name, value]) => renderAttr(name, value)).join("")}
      />
      <span>${escapeHtml(color.hex)}${color.alpha < 0.999 ? ` · alpha ${escapeHtml(formatNumericValue(color.alpha))}` : ""}</span>
    </div>`,
  );
}

function formatNumericValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function renderAttr(
  name: string,
  value: string | number | undefined,
): string {
  if (value === undefined) {
    return "";
  }
  return ` ${name}="${escapeHtml(String(value))}"`;
}

function numericRow(
  label: string,
  options: NumericRowOptions,
): string {
  const step = options.step ?? 1;
  const displayValue = formatNumericValue(options.value);
  const editor = `
    <div
      class="mce-scrub-field"
      data-scrub-field="${escapeHtml(options.field)}"
      data-scrub-command="${escapeHtml(options.command)}"
      data-scrub-value="${escapeHtml(String(options.value))}"
      data-scrub-step="${escapeHtml(String(step))}"
      data-editing="false"
      data-scrubbing="false"
      ${renderAttr("data-scrub-min", options.min)}
      ${renderAttr("data-scrub-max", options.max)}
      ${Object.entries(options.metadata ?? {}).map(([name, value]) => renderAttr(name, value)).join("")}
    >
      <button
        type="button"
        class="mce-scrub-field__display"
        data-scrub-display="true"
        aria-label="${escapeHtml(label)} 조절"
      >
        <span class="mce-scrub-field__number">${escapeHtml(displayValue)}</span>
        ${options.unit ? `<span class="mce-scrub-field__unit">${escapeHtml(options.unit)}</span>` : ""}
      </button>
      <label class="mce-scrub-field__editor">
        <input
          data-scrub-editor="true"
          type="number"
          value="${escapeHtml(String(options.value))}"
          step="${escapeHtml(String(step))}"
          ${options.min !== undefined ? `min="${escapeHtml(String(options.min))}"` : ""}
          ${options.max !== undefined ? `max="${escapeHtml(String(options.max))}"` : ""}
          aria-label="${escapeHtml(label)} 직접 입력"
        />
        ${options.unit ? `<span class="mce-scrub-field__unit">${escapeHtml(options.unit)}</span>` : ""}
      </label>
    </div>
  `;
  return valueRow(label, editor);
}

function renderTransitionDetailFields(
  transition: MotionTransitionDef,
): readonly string[] {
  if (transition.style === "crossfade") {
    const brightness = (transition.params as CrossfadeParams | undefined)?.brightness ?? 0.86;
    return [
      numericRow("brightness", {
        value: brightness,
        step: 0.01,
        min: 0,
        command: "transition-param",
        field: "brightness",
        metadata: {
          "data-transition-id": transition.id,
          "data-transition-param": "brightness",
        },
      }),
    ];
  }
  if (transition.style === "flash") {
    const glowColor = (transition.params as FlashParams | undefined)?.glowColor ?? "rgba(240,143,32,0.24)";
    const glowSize = (transition.params as FlashParams | undefined)?.glowSize ?? 120;
    return [
      colorRow("glowColor", {
        value: glowColor,
        control: "transition-param-color",
        fallbackHex: "#f08f20",
        metadata: {
          "data-transition-id": transition.id,
          "data-transition-param": "glowColor",
        },
      }),
      numericRow("glowSize", {
        value: glowSize,
        unit: "px",
        min: 0,
        command: "transition-param",
        field: "glowSize",
        metadata: {
          "data-transition-id": transition.id,
          "data-transition-param": "glowSize",
        },
      }),
    ];
  }
  const liftY = (transition.params as LiftParams | undefined)?.liftY ?? 18;
  return [
    numericRow("liftY", {
      value: liftY,
      unit: "px",
      command: "transition-param",
      field: "liftY",
      metadata: {
        "data-transition-id": transition.id,
        "data-transition-param": "liftY",
      },
    }),
  ];
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
        : parameter.type === "number"
          ? `<input data-param="${escapeHtml(parameter.id)}" type="number" value="${escapeHtml(value)}" min="${parameter.min ?? 0}" max="${parameter.max ?? 999}" step="${parameter.step ?? 1}" />`
          : `<input data-param="${escapeHtml(parameter.id)}" type="${parameter.type}" value="${escapeHtml(value)}" />`;
      return `<label class="mce-control"><span>${escapeHtml(parameter.label)}</span>${control}</label>`;
    })
    .join("");
}

export function renderLayerPanel(
  layers: readonly MotionLayerDef[],
  selection: MotionEditorSelection | null,
): string {
  if (layers.length === 0) {
    return `<div class="mce-diag-empty">layer 없음</div>`;
  }
  return layers
    .map((layer) => {
      const ct = layer.content?.type ?? "dom";
      const enter = describeCueRef(layer.enter);
      const exit = layer.exit ? describeCueRef(layer.exit) : "—";
      return `
        <div class="mce-item-row">
          <button type="button" class="mce-item ${isSelected(selection, "layer", layer.id) ? "is-active" : ""}" data-layer="${escapeHtml(layer.id)}">
            <strong>${escapeHtml(layer.label)}</strong>
            <span>${ct} · ${enter} / ${exit}</span>
          </button>
          <button
            type="button"
            class="mce-item-action"
            data-remove-layer="${escapeHtml(layer.id)}"
            aria-label="${escapeHtml(layer.label)} 삭제"
            title="${escapeHtml(layer.label)} 삭제"
          >✕</button>
        </div>
      `;
    })
    .join("");
}

export function renderCaptionPanel(
  captions: readonly MotionCaptionCue[],
  selection: MotionEditorSelection | null,
): string {
  if (captions.length === 0) {
    return `<div class="mce-diag-empty">caption 없음</div>`;
  }
  return captions
    .map((caption) => `
      <div class="mce-item-row">
        <button type="button" class="mce-item ${isSelected(selection, "caption", caption.id) ? "is-active" : ""}" data-caption="${escapeHtml(caption.id)}">
          <strong>${escapeHtml(caption.id)}</strong>
          <span>${caption.tone ?? "neutral"} · ${caption.startMs}/${caption.durationMs}</span>
        </button>
        <button
          type="button"
          class="mce-item-action"
          data-remove-caption="${escapeHtml(caption.id)}"
          aria-label="${escapeHtml(caption.id)} 삭제"
          title="${escapeHtml(caption.id)} 삭제"
        >✕</button>
      </div>
    `)
    .join("");
}

export function renderCuePresetsPanel(
  composition: MotionCompositionDef,
  selection: MotionEditorSelection | null,
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
      return `
        <button
          type="button"
          class="mce-item ${isSelected(selection, "cue-preset", preset.id) ? "is-active" : ""}"
          data-cue-preset="${escapeHtml(preset.id)}"
        >
          <strong>${escapeHtml(preset.label)}</strong>
          <span>${escapeHtml(preset.kind)} · ${preset.durationMs}ms · ${refCount}곳 사용</span>
        </button>
      `;
    })
    .join("");
}

function findPresetReferences(
  composition: MotionCompositionDef,
  presetId: string,
): readonly MotionLayerDef[] {
  return composition.layers.filter(
    (layer) =>
      (isCuePresetRef(layer.enter) && layer.enter.preset === presetId)
      || (layer.exit && isCuePresetRef(layer.exit) && layer.exit.preset === presetId),
  );
}

function renderCuePresetSelectionDetail(
  composition: MotionCompositionDef,
  preset: MotionCuePreset,
): string {
  const references = findPresetReferences(composition, preset.id);
  const amount = preset.amount ?? 48;
  return [
    textRow("id", preset.id),
    textRow("label", preset.label),
    selectRow("kind", {
      value: preset.kind,
      control: "cue-preset-kind",
      options: CUE_KIND_OPTIONS,
      metadata: {
        "data-preset-id": preset.id,
      },
    }),
    numericRow("durationMs", {
      value: preset.durationMs,
      unit: "ms",
      min: 0,
      command: "cue-preset-number",
      field: "durationMs",
      metadata: {
        "data-preset-id": preset.id,
      },
    }),
    inlineTextRow("ease", {
      value: preset.ease ?? "",
      command: "cue-preset-text",
      field: "ease",
      allowEmpty: true,
      emptyDisplay: "기본값 (power2.out / power2.in)",
      emptyHint: "비우면 기본 ease 사용",
      placeholder: "예: expo.out",
      metadata: {
        "data-preset-id": preset.id,
      },
    }),
    numericRow("amount", {
      value: amount,
      min: 0,
      command: "cue-preset-number",
      field: "amount",
      metadata: {
        "data-preset-id": preset.id,
      },
    }),
    textRow(
      "references",
      references.length > 0
        ? references.map((layer) => layer.label).join(", ")
        : "없음",
    ),
  ].join("");
}

export function renderSequencePanel(
  sequences: readonly MotionSequenceDef[],
  selection: MotionEditorSelection | null,
): string {
  if (sequences.length === 0) {
    return `<div class="mce-diag-empty">sequence 없음</div>`;
  }
  return sequences
    .map((sequence) => {
      const layerCount = sequence.layerIds.length;
      const staggerInfo = sequence.stagger
        ? `stagger(${sequence.stagger.startOffsetMs}+${sequence.stagger.intervalMs}ms)`
        : `${layerCount} layers`;
      return `
        <div class="mce-item-row">
          <button type="button" class="mce-item ${isSelected(selection, "sequence", sequence.id) ? "is-active" : ""}" data-sequence="${escapeHtml(sequence.id)}">
            <strong>${escapeHtml(sequence.title)}</strong>
            <span>${sequence.startMs}/${sequence.durationMs} · ${staggerInfo}</span>
          </button>
          <button
            type="button"
            class="mce-item-action"
            data-remove-sequence="${escapeHtml(sequence.id)}"
            aria-label="${escapeHtml(sequence.title)} 삭제"
            title="${escapeHtml(sequence.title)} 삭제"
          >✕</button>
        </div>
      `;
    })
    .join("");
}

export function renderTransitionPanel(
  transitions: readonly MotionTransitionDef[],
  selection: MotionEditorSelection | null,
): string {
  if (transitions.length === 0) {
    return `<div class="mce-diag-empty">transition 없음</div>`;
  }
  return transitions
    .map((transition) => {
      let paramsStr = "";
      if (transition.params) {
        const p = transition.params as Record<string, unknown>;
        paramsStr = " · " + Object.entries(p).map(([k, v]) => `${k}:${v}`).join(", ");
      }
      return `
        <div class="mce-item-row">
          <button type="button" class="mce-item ${isSelected(selection, "transition", transition.id) ? "is-active" : ""}" data-transition="${escapeHtml(transition.id)}">
            <strong>${escapeHtml(transition.id)}</strong>
            <span>${escapeHtml(transition.style)} ${transition.durationMs}ms${paramsStr}</span>
          </button>
          <button
            type="button"
            class="mce-item-action"
            data-remove-transition="${escapeHtml(transition.id)}"
            aria-label="${escapeHtml(transition.id)} 삭제"
            title="${escapeHtml(transition.id)} 삭제"
          >✕</button>
        </div>
      `;
    })
    .join("");
}

export function renderSelectionDetail(
  composition: MotionCompositionDef,
  selection: MotionEditorSelection | null,
): string {
  if (!selection) return `<div class="mce-diag-empty">선택된 항목 없음</div>`;
  const presets = composition.cuePresets ?? [];

  if (selection.kind === "cue-preset") {
    const preset = presets.find((entry) => entry.id === selection.id);
    if (!preset) return textRow("CuePreset", `${selection.id} (없음)`);
    return renderCuePresetSelectionDetail(composition, preset);
  }

  if (selection.kind === "layer") {
    const layer = composition.layers.find((l) => l.id === selection.id);
    if (!layer) return textRow("Layer", `${selection.id} (없음)`);
    const ct = layer.content?.type ?? "dom";
    const contentDetail = layer.content && "src" in layer.content ? (layer.content as { src: string }).src : "";
    const presetOptions = presets.map((preset) => ({
      value: preset.id,
      label: `${preset.label} (${preset.id})`,
    }));
    const slotEntry = composition.sequences
      .map((sequence) => {
        const slots = getSequenceLayerSlots(sequence);
        const index = slots.findIndex((slot) => slot.layerId === layer.id);
        if (index === -1) {
          return null;
        }
        return {
          sequence,
          slot: slots[index]!,
          storedSlot: sequence.layers?.find((entry) => entry.layerId === layer.id),
          index,
        };
      })
      .find((entry) => entry !== null);
    const rows = [
      textRow("id", layer.id),
      inlineTextRow("label", {
        value: layer.label,
        command: "item-string",
        field: "label",
        metadata: {
          "data-item-kind": "layer",
          "data-item-id": layer.id,
        },
      }),
      selectRow("contentType", {
        value: ct,
        control: "layer-content-type",
        options: CONTENT_TYPE_OPTIONS,
        metadata: {
          "data-layer-id": layer.id,
        },
      }),
      ...(contentDetail ? [textRow("contentSource", contentDetail)] : []),
      isCuePresetRef(layer.enter)
        ? (presetOptions.length > 0
          ? selectRow("enter", {
            value: layer.enter.preset,
            control: "layer-cue-preset",
            options: presetOptions,
            metadata: {
              "data-layer-id": layer.id,
              "data-cue-field": "enter",
            },
          })
          : textRow("enter", describeCueRef(layer.enter)))
        : selectRow("enter", {
          value: layer.enter.kind,
          control: "layer-cue-kind",
          options: CUE_KIND_OPTIONS,
          metadata: {
            "data-layer-id": layer.id,
            "data-cue-field": "enter",
          },
        }),
      !layer.exit
        ? textRow("exit", "없음")
        : isCuePresetRef(layer.exit)
          ? (presetOptions.length > 0
            ? selectRow("exit", {
              value: layer.exit.preset,
              control: "layer-cue-preset",
              options: presetOptions,
              metadata: {
                "data-layer-id": layer.id,
                "data-cue-field": "exit",
              },
            })
            : textRow("exit", describeCueRef(layer.exit)))
          : selectRow("exit", {
            value: layer.exit.kind,
            control: "layer-cue-kind",
            options: CUE_KIND_OPTIONS,
            metadata: {
              "data-layer-id": layer.id,
              "data-cue-field": "exit",
            },
          }),
      slotEntry && slotEntry.slot.offsetMs !== undefined
        ? numericRow("startMs", {
          value: layer.startMs,
          unit: "ms",
          min: 0,
          command: "layer-relative-start",
          field: "startMs",
          metadata: {
            "data-sequence-id": slotEntry.sequence.id,
            "data-layer-id": layer.id,
          },
        })
        : numericRow("startMs", {
          value: layer.startMs,
          unit: "ms",
          min: 0,
          command: "item-timing",
          field: "startMs",
          metadata: {
            "data-item-kind": "layer",
            "data-item-id": layer.id,
          },
        }),
      numericRow("durationMs", {
        value: layer.durationMs,
        unit: "ms",
        min: 0,
        command: "item-timing",
        field: "durationMs",
        metadata: {
          "data-item-kind": "layer",
          "data-item-id": layer.id,
        },
      }),
    ];
    if (slotEntry && slotEntry.slot.offsetMs !== undefined) {
      rows.push(
        numericRow("offsetMs", {
          value: slotEntry.slot.offsetMs,
          unit: "ms",
          min: 0,
          command: "sequence-layer-slot",
          field: "offsetMs",
          metadata: {
            "data-sequence-id": slotEntry.sequence.id,
            "data-layer-id": layer.id,
          },
        }),
      );
    }
    if (slotEntry) {
      const zIndex = slotEntry.slot.zIndex ?? slotEntry.index;
      const coordMode = slotEntry.slot.offsetMs !== undefined ? "상대" : "절대";
      const staggerNote = slotEntry.sequence.stagger
        && slotEntry.storedSlot?.offsetMs === undefined
        && slotEntry.slot.offsetMs !== undefined
        ? " (stagger 파생)"
        : "";
      rows.push(
        selectRow("slotRole", {
          value: slotEntry.slot.role ?? "",
          control: "sequence-layer-role",
          options: SLOT_ROLE_OPTIONS,
          emptyLabel: "미지정",
          metadata: {
            "data-sequence-id": slotEntry.sequence.id,
            "data-layer-id": layer.id,
          },
        }),
      );
      rows.push(
        numericRow("zIndex", {
          value: zIndex,
          command: "sequence-layer-slot",
          field: "zIndex",
          metadata: {
            "data-sequence-id": slotEntry.sequence.id,
            "data-layer-id": layer.id,
          },
        }),
      );
      rows.push(
        textRow("slot", `${slotEntry.sequence.title} · ${coordMode}${staggerNote}`),
      );
    } else {
      rows.push(textRow("slot", "절대 좌표"));
    }
    return rows.join("");
  }

  if (selection.kind === "sequence") {
    const seq = composition.sequences.find((s) => s.id === selection.id);
    if (!seq) return textRow("Sequence", `${selection.id} (없음)`);
    const layers = seq.layerIds.length > 0 ? seq.layerIds.join(", ") : "없음";
    const captions = seq.captionIds && seq.captionIds.length > 0 ? seq.captionIds.join(", ") : "없음";
    const rows = [
      textRow("id", seq.id),
      inlineTextRow("title", {
        value: seq.title,
        command: "item-string",
        field: "title",
        metadata: {
          "data-item-kind": "sequence",
          "data-item-id": seq.id,
        },
      }),
      numericRow("startMs", {
        value: seq.startMs,
        unit: "ms",
        min: 0,
        command: "item-timing",
        field: "startMs",
        metadata: {
          "data-item-kind": "sequence",
          "data-item-id": seq.id,
        },
      }),
      numericRow("durationMs", {
        value: seq.durationMs,
        unit: "ms",
        min: 0,
        command: "item-timing",
        field: "durationMs",
        metadata: {
          "data-item-kind": "sequence",
          "data-item-id": seq.id,
        },
      }),
    ];
    if (seq.stagger) {
      rows.push(
        numericRow("startOffsetMs", {
          value: seq.stagger.startOffsetMs,
          unit: "ms",
          min: 0,
          command: "sequence-stagger",
          field: "startOffsetMs",
          metadata: {
            "data-sequence-id": seq.id,
          },
        }),
      );
      rows.push(
        numericRow("intervalMs", {
          value: seq.stagger.intervalMs,
          unit: "ms",
          min: 0,
          command: "sequence-stagger",
          field: "intervalMs",
          metadata: {
            "data-sequence-id": seq.id,
          },
        }),
      );
    } else {
      rows.push(textRow("stagger", "없음"));
    }
    rows.push(textRow("layers", layers));
    rows.push(textRow("captions", captions));
    return rows.join("");
  }

  if (selection.kind === "transition") {
    const tr = composition.transitions.find((t) => t.id === selection.id);
    if (!tr) return textRow("Transition", `${selection.id} (없음)`);
    return [
      textRow("id", tr.id),
      textRow("from → to", `${tr.fromSequenceId} → ${tr.toSequenceId}`),
      selectRow("style", {
        value: tr.style,
        control: "transition-style",
        options: TRANSITION_STYLE_OPTIONS,
        metadata: {
          "data-transition-id": tr.id,
        },
      }),
      numericRow("durationMs", {
        value: tr.durationMs,
        unit: "ms",
        min: 0,
        command: "transition-duration",
        field: "durationMs",
        metadata: {
          "data-transition-id": tr.id,
        },
      }),
      ...renderTransitionDetailFields(tr),
    ].join("");
  }

  if (selection.kind === "caption") {
    const cap = composition.captions.find((c) => c.id === selection.id);
    if (!cap) return textRow("Caption", `${selection.id} (없음)`);
    return [
      textRow("id", cap.id),
      inlineTextRow("text", {
        value: cap.text,
        command: "item-string",
        field: "text",
        metadata: {
          "data-item-kind": "caption",
          "data-item-id": cap.id,
        },
      }),
      textRow("tone", cap.tone ?? "neutral"),
      numericRow("startMs", {
        value: cap.startMs,
        unit: "ms",
        min: 0,
        command: "item-timing",
        field: "startMs",
        metadata: {
          "data-item-kind": "caption",
          "data-item-id": cap.id,
        },
      }),
      numericRow("durationMs", {
        value: cap.durationMs,
        unit: "ms",
        min: 0,
        command: "item-timing",
        field: "durationMs",
        metadata: {
          "data-item-kind": "caption",
          "data-item-id": cap.id,
        },
      }),
    ].join("");
  }

  return textRow("Composition", composition.title);
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
