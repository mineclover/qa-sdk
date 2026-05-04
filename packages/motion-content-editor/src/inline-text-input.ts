// @def.boundary motion-content-editor-system
export interface InlineTextInputBindingOptions {
  readonly root: HTMLElement;
  readonly commit: (field: HTMLElement, value: string) => void;
}

export interface InlineTextInputBinding {
  destroy(): void;
}

function readCommittedValue(
  field: HTMLElement,
  input: HTMLInputElement,
): string {
  return field.dataset["inlineTextValue"] ?? input.defaultValue;
}

function allowsEmptyValue(
  field: HTMLElement,
): boolean {
  return field.dataset["inlineTextAllowEmpty"] === "true";
}

function resetEditorState(
  field: HTMLElement,
  input: HTMLInputElement,
): void {
  field.dataset["invalid"] = "false";
  input.removeAttribute("aria-invalid");
}

export function bindInlineTextInputs(
  options: InlineTextInputBindingOptions,
): InlineTextInputBinding {
  const { root } = options;

  const openEditor = (
    field: HTMLElement,
    input: HTMLInputElement,
  ) => {
    input.value = readCommittedValue(field, input);
    field.dataset["editing"] = "true";
    resetEditorState(field, input);
    input.focus();
    input.select();
  };

  const cancelEditor = (
    field: HTMLElement,
    input: HTMLInputElement,
  ) => {
    input.value = readCommittedValue(field, input);
    field.dataset["editing"] = "false";
    resetEditorState(field, input);
  };

  const commitEditor = (
    field: HTMLElement,
    input: HTMLInputElement,
    config: {
      readonly allowCancelOnInvalid?: boolean;
    } = {},
  ): boolean => {
    const nextValue = input.value.trim();
    if (nextValue.length === 0 && !allowsEmptyValue(field)) {
      if (config.allowCancelOnInvalid) {
        cancelEditor(field, input);
        return false;
      }
      field.dataset["invalid"] = "true";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      input.select();
      return false;
    }

    field.dataset["editing"] = "false";
    resetEditorState(field, input);
    if (nextValue === readCommittedValue(field, input)) {
      input.value = nextValue;
      return true;
    }
    options.commit(field, nextValue);
    return true;
  };

  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const display = target.closest<HTMLElement>('[data-inline-text-display="true"]');
    if (!display) {
      return;
    }
    const field = display.closest<HTMLElement>("[data-inline-text-field]");
    const input = field?.querySelector<HTMLInputElement>('[data-inline-text-editor="true"]');
    if (!field || !input) {
      return;
    }
    openEditor(field, input);
    event.preventDefault();
  };

  const handleInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset["inlineTextEditor"] !== "true") {
      return;
    }
    const field = target.closest<HTMLElement>("[data-inline-text-field]");
    if (!field) {
      return;
    }
    resetEditorState(field, target);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset["inlineTextEditor"] !== "true") {
      return;
    }
    const field = target.closest<HTMLElement>("[data-inline-text-field]");
    if (!field) {
      return;
    }
    if (event.key === "Enter") {
      commitEditor(field, target);
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      cancelEditor(field, target);
      event.preventDefault();
    }
  };

  const handleFocusOut = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset["inlineTextEditor"] !== "true") {
      return;
    }
    const field = target.closest<HTMLElement>("[data-inline-text-field]");
    if (!field || field.dataset["editing"] !== "true") {
      return;
    }
    commitEditor(field, target, { allowCancelOnInvalid: true });
  };

  root.addEventListener("click", handleClick);
  root.addEventListener("input", handleInput);
  root.addEventListener("keydown", handleKeyDown);
  root.addEventListener("focusout", handleFocusOut);

  return {
    destroy() {
      root.removeEventListener("click", handleClick);
      root.removeEventListener("input", handleInput);
      root.removeEventListener("keydown", handleKeyDown);
      root.removeEventListener("focusout", handleFocusOut);
    },
  };
}
