export interface ScrubInputConfig {
  readonly value: number;
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface ScrubInputBindingOptions {
  readonly root: HTMLElement;
  readonly readConfig: (field: HTMLElement) => ScrubInputConfig | null;
  readonly preview: (field: HTMLElement, value: number) => void;
  readonly commit: (field: HTMLElement, value: number) => void;
}

export interface ScrubInputBinding {
  destroy(): void;
}

interface ScrubDragState {
  readonly field: HTMLElement;
  readonly pointerId: number;
  readonly originClientX: number;
  readonly originValue: number;
  readonly baseStep: number;
  readonly min: number | null;
  readonly max: number | null;
  previewValue: number;
}

function clampValue(
  value: number,
  min: number | null,
  max: number | null,
): number {
  let next = value;
  if (min !== null) {
    next = Math.max(next, min);
  }
  if (max !== null) {
    next = Math.min(next, max);
  }
  return next;
}

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = value.toString().toLowerCase();
  if (normalized.includes("e-")) {
    const [, exponent = "0"] = normalized.split("e-");
    return Number(exponent);
  }
  const [, fraction = ""] = normalized.split(".");
  return fraction.length;
}

function quantizeValue(
  value: number,
  quantum: number,
): number {
  if (!Number.isFinite(quantum) || quantum <= 0) {
    return value;
  }
  const decimals = decimalPlaces(quantum);
  return Number((Math.round(value / quantum) * quantum).toFixed(decimals));
}

function modifierScale(event: PointerEvent): number {
  return (event.shiftKey ? 10 : 1) * (event.altKey ? 0.1 : 1);
}

function isFiniteNumber(value: string): value is `${number}` {
  return value.trim().length > 0 && Number.isFinite(Number(value));
}

export function bindScrubInputs(
  options: ScrubInputBindingOptions,
): ScrubInputBinding {
  const { root } = options;
  const ownerWindow = root.ownerDocument.defaultView ?? window;
  let dragState: ScrubDragState | null = null;
  let previousUserSelect = "";
  let previousCursor = "";

  const clearDragState = () => {
    if (!dragState) {
      return;
    }
    dragState.field.dataset["scrubbing"] = "false";
    dragState = null;
    ownerWindow.document.body.style.userSelect = previousUserSelect;
    ownerWindow.document.body.style.cursor = previousCursor;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const scale = modifierScale(event);
    const quantum = dragState.baseStep * scale;
    const precisionQuantum = Math.min(dragState.baseStep, quantum);
    const deltaValue = (event.clientX - dragState.originClientX) * quantum;
    const nextValue = clampValue(
      quantizeValue(dragState.originValue + deltaValue, precisionQuantum),
      dragState.min,
      dragState.max,
    );
    if (nextValue === dragState.previewValue) {
      return;
    }
    dragState.previewValue = nextValue;
    options.preview(dragState.field, nextValue);
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const activeDrag = dragState;
    clearDragState();
    if (activeDrag.previewValue !== activeDrag.originValue) {
      options.commit(activeDrag.field, activeDrag.previewValue);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const display = target.closest<HTMLElement>('[data-scrub-display="true"]');
    if (!display) {
      return;
    }
    const field = display.closest<HTMLElement>("[data-scrub-field]");
    if (!field || field.dataset["editing"] === "true") {
      return;
    }
    const config = options.readConfig(field);
    if (!config) {
      return;
    }
    previousUserSelect = ownerWindow.document.body.style.userSelect;
    previousCursor = ownerWindow.document.body.style.cursor;
    ownerWindow.document.body.style.userSelect = "none";
    ownerWindow.document.body.style.cursor = "ew-resize";
    field.dataset["scrubbing"] = "true";
    const min = typeof config.min === "number" && Number.isFinite(config.min) ? config.min : null;
    const max = typeof config.max === "number" && Number.isFinite(config.max) ? config.max : null;
    dragState = {
      field,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originValue: config.value,
      baseStep: config.step ?? 1,
      min,
      max,
      previewValue: config.value,
    };
    event.preventDefault();
  };

  const handleDoubleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const display = target.closest<HTMLElement>('[data-scrub-display="true"]');
    if (!display) {
      return;
    }
    const field = display.closest<HTMLElement>("[data-scrub-field]");
    const input = field?.querySelector<HTMLInputElement>('[data-scrub-editor="true"]');
    const config = field ? options.readConfig(field) : null;
    if (!field || !input || !config) {
      return;
    }
    field.dataset["editing"] = "true";
    input.value = String(config.value);
    input.focus();
    input.select();
    event.preventDefault();
  };

  const closeEditor = (
    field: HTMLElement,
    input: HTMLInputElement,
    shouldCommit: boolean,
  ) => {
    field.dataset["editing"] = "false";
    if (!shouldCommit || !isFiniteNumber(input.value)) {
      const config = options.readConfig(field);
      if (config) {
        input.value = String(config.value);
      }
      return;
    }
    options.commit(field, Number(input.value));
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset["scrubEditor"] !== "true") {
      return;
    }
    const field = target.closest<HTMLElement>("[data-scrub-field]");
    if (!field) {
      return;
    }
    if (event.key === "Enter") {
      closeEditor(field, target, true);
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      closeEditor(field, target, false);
      event.preventDefault();
    }
  };

  const handleFocusOut = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset["scrubEditor"] !== "true") {
      return;
    }
    const field = target.closest<HTMLElement>("[data-scrub-field]");
    if (!field) {
      return;
    }
    closeEditor(field, target, true);
  };

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("dblclick", handleDoubleClick);
  root.addEventListener("keydown", handleKeyDown);
  root.addEventListener("focusout", handleFocusOut);
  ownerWindow.addEventListener("pointermove", handlePointerMove);
  ownerWindow.addEventListener("pointerup", handlePointerEnd);
  ownerWindow.addEventListener("pointercancel", handlePointerEnd);

  return {
    destroy() {
      clearDragState();
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("dblclick", handleDoubleClick);
      root.removeEventListener("keydown", handleKeyDown);
      root.removeEventListener("focusout", handleFocusOut);
      ownerWindow.removeEventListener("pointermove", handlePointerMove);
      ownerWindow.removeEventListener("pointerup", handlePointerEnd);
      ownerWindow.removeEventListener("pointercancel", handlePointerEnd);
    },
  };
}
