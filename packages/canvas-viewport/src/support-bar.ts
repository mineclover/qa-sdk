// @def.boundary canvas-viewport-spec
// @def.doc canvas-viewport-spec

export interface CanvasSupportAction {
  id: string;
  label: string;
  title?: string;
  emphasis?: "default" | "primary";
}

export interface CanvasSupportChip {
  label: string;
  tone?: "default" | "info" | "success" | "warning";
}

export interface RenderCanvasSupportBarOptions {
  leading?: string;
  chips?: CanvasSupportChip[];
  actions?: CanvasSupportAction[];
  onAction?: (id: string) => void;
}

export function renderCanvasSupportBar(
  container: HTMLElement,
  options: RenderCanvasSupportBarOptions,
): void {
  container.innerHTML = "";

  const bar = document.createElement("div");
  bar.className = "cv-support";

  if (options.leading) {
    const leading = document.createElement("span");
    leading.className = "cv-support-leading";
    leading.textContent = options.leading;
    bar.appendChild(leading);
  }

  if (options.chips && options.chips.length > 0) {
    const chips = document.createElement("div");
    chips.className = "cv-support-chips";
    for (const chipSpec of options.chips) {
      const chip = document.createElement("span");
      chip.className = `cv-support-chip${chipSpec.tone ? ` is-${chipSpec.tone}` : ""}`;
      chip.textContent = chipSpec.label;
      chips.appendChild(chip);
    }
    bar.appendChild(chips);
  }

  if (options.actions && options.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = "cv-support-actions";
    for (const actionSpec of options.actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cv-support-btn${actionSpec.emphasis === "primary" ? " is-primary" : ""}`;
      button.textContent = actionSpec.label;
      if (actionSpec.title) {
        button.title = actionSpec.title;
      }
      button.addEventListener("click", () => options.onAction?.(actionSpec.id));
      actions.appendChild(button);
    }
    bar.appendChild(actions);
  }

  container.appendChild(bar);
}
