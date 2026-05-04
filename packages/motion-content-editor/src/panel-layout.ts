// @def.boundary motion-content-editor-system
export interface PanelGroupTab {
  readonly id: string;
  readonly label: string;
  readonly content: HTMLElement;
}

export interface PanelGroupOptions {
  readonly id: string;
  readonly container: HTMLElement;
  readonly title: string;
  readonly tabs: readonly PanelGroupTab[];
  readonly defaultTabId?: string;
  readonly collapseDirection?: "left" | "right" | "down";
  readonly onTabChange?: (tabId: string) => void;
  readonly onCollapseChange?: (collapsed: boolean) => void;
}

export interface SplitterOptions {
  readonly element: HTMLElement;
  readonly axis: "x" | "y";
  readonly direction?: 1 | -1;
  readonly getValue: () => number;
  readonly setValue: (value: number) => void;
  readonly getRange: () => { min: number; max: number };
  readonly onDragStart?: () => void;
  readonly onDragEnd?: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolvePointerId(event: MouseEvent | PointerEvent): number {
  return typeof (event as PointerEvent).pointerId === "number"
    ? (event as PointerEvent).pointerId
    : 1;
}

function resolveCollapseLabels(
  direction: "left" | "right" | "down",
  collapsed: boolean,
): { label: string; ariaLabel: string } {
  switch (direction) {
    case "left":
      return collapsed
        ? { label: ">>", ariaLabel: "좌측 패널 펼치기" }
        : { label: "<<", ariaLabel: "좌측 패널 접기" };
    case "right":
      return collapsed
        ? { label: "<<", ariaLabel: "우측 패널 펼치기" }
        : { label: ">>", ariaLabel: "우측 패널 접기" };
    case "down":
    default:
      return collapsed
        ? { label: "^^", ariaLabel: "하단 패널 펼치기" }
        : { label: "vv", ariaLabel: "하단 패널 접기" };
  }
}

export class PanelGroup {
  readonly element: HTMLElement;

  private readonly options: PanelGroupOptions;
  private readonly tabListElement: HTMLElement;
  private readonly bodyElement: HTMLElement;
  private readonly titleElement: HTMLElement;
  private readonly collapseButton: HTMLButtonElement;
  private readonly tabButtons = new Map<string, HTMLButtonElement>();
  private readonly tabViews = new Map<string, HTMLElement>();
  private activeTabId: string;
  private collapsed = false;

  constructor(options: PanelGroupOptions) {
    if (options.tabs.length === 0) {
      throw new Error(`PanelGroup(${options.id}) requires at least one tab.`);
    }

    this.options = options;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- constructor에서 tabs.length === 0 검사 직후
    this.activeTabId = options.defaultTabId ?? options.tabs[0]!.id;

    const direction = options.collapseDirection ?? "left";
    const element = document.createElement("section");
    element.className = "mce-panel-group";
    element.dataset["panelGroup"] = options.id;
    element.dataset["collapseDirection"] = direction;

    const header = document.createElement("header");
    header.className = "mce-panel-group__header";

    const title = document.createElement("div");
    title.className = "mce-panel-group__title";
    title.textContent = options.title;

    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "mce-panel-group__collapse";
    collapseButton.addEventListener("click", () => this.toggleCollapsed());

    header.append(title, collapseButton);

    const tabList = document.createElement("div");
    tabList.className = "mce-panel-group__tabs";
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", `${options.title} tabs`);

    const body = document.createElement("div");
    body.className = "mce-panel-group__body";

    for (const tab of options.tabs) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mce-panel-group__tab";
      button.dataset["panelTab"] = tab.id;
      button.setAttribute("role", "tab");
      button.textContent = tab.label;
      button.addEventListener("click", () => this.selectTab(tab.id));
      this.tabButtons.set(tab.id, button);
      tabList.appendChild(button);

      const view = document.createElement("div");
      view.className = "mce-panel-view";
      view.dataset["panelView"] = tab.id;
      view.setAttribute("role", "tabpanel");
      view.appendChild(tab.content);
      this.tabViews.set(tab.id, view);
      body.appendChild(view);
    }

    element.append(header, tabList, body);
    options.container.innerHTML = "";
    options.container.appendChild(element);

    this.element = element;
    this.tabListElement = tabList;
    this.bodyElement = body;
    this.titleElement = title;
    this.collapseButton = collapseButton;

    this.selectTab(this.activeTabId, false);
    this.setCollapsed(false, false);
  }

  getActiveTabId(): string {
    return this.activeTabId;
  }

  isCollapsed(): boolean {
    return this.collapsed;
  }

  selectTab(tabId: string, emit = true): void {
    const nextButton = this.tabButtons.get(tabId);
    const nextView = this.tabViews.get(tabId);
    if (!nextButton || !nextView) {
      throw new Error(`Unknown tab "${tabId}" in PanelGroup(${this.options.id}).`);
    }

    this.activeTabId = tabId;
    this.element.dataset["activeTab"] = tabId;

    for (const [id, button] of this.tabButtons) {
      const active = id === tabId;
      button.dataset["state"] = active ? "active" : "inactive";
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    }

    for (const [id, view] of this.tabViews) {
      const active = id === tabId;
      view.dataset["state"] = active ? "active" : "inactive";
      view.hidden = !active;
    }

    if (emit) {
      this.options.onTabChange?.(tabId);
    }
  }

  setCollapsed(collapsed: boolean, emit = true): void {
    if (this.collapsed === collapsed && emit) {
      return;
    }
    this.collapsed = collapsed;
    this.element.dataset["collapsed"] = collapsed ? "true" : "false";
    this.tabListElement.hidden = collapsed;
    this.bodyElement.hidden = collapsed;

    const labels = resolveCollapseLabels(
      this.options.collapseDirection ?? "left",
      collapsed,
    );
    this.collapseButton.textContent = labels.label;
    this.collapseButton.setAttribute("aria-label", labels.ariaLabel);
    this.collapseButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
    this.titleElement.dataset["collapsed"] = collapsed ? "true" : "false";

    if (emit) {
      this.options.onCollapseChange?.(collapsed);
    }
  }

  toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed);
  }
}

export class Splitter {
  readonly element: HTMLElement;

  private readonly options: SplitterOptions;
  private pointerId: number | null = null;
  private startPosition = 0;
  private startValue = 0;
  private disabled = false;

  constructor(options: SplitterOptions) {
    this.options = options;
    this.element = options.element;
    this.element.addEventListener("pointerdown", this.handlePointerDown);
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    this.element.dataset["disabled"] = disabled ? "true" : "false";
    this.element.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  destroy(): void {
    this.element.removeEventListener("pointerdown", this.handlePointerDown);
    this.removeDocumentListeners();
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (this.disabled) return;

    this.pointerId = resolvePointerId(event);
    this.startPosition = this.options.axis === "x" ? event.clientX : event.clientY;
    this.startValue = this.options.getValue();
    this.element.dataset["dragging"] = "true";

    if (typeof this.element.setPointerCapture === "function") {
      this.element.setPointerCapture(this.pointerId);
    }

    this.addDocumentListeners();
    this.options.onDragStart?.();
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.pointerId === null || resolvePointerId(event) !== this.pointerId) {
      return;
    }

    const currentPosition = this.options.axis === "x" ? event.clientX : event.clientY;
    const delta = (currentPosition - this.startPosition) * (this.options.direction ?? 1);
    const range = this.options.getRange();
    this.options.setValue(clamp(this.startValue + delta, range.min, range.max));
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (this.pointerId === null || resolvePointerId(event) !== this.pointerId) {
      return;
    }
    this.finishDrag();
  };

  private readonly handlePointerCancel = (event: PointerEvent) => {
    if (this.pointerId === null || resolvePointerId(event) !== this.pointerId) {
      return;
    }
    this.finishDrag();
  };

  private addDocumentListeners(): void {
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
    document.addEventListener("pointercancel", this.handlePointerCancel);
  }

  private removeDocumentListeners(): void {
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
    document.removeEventListener("pointercancel", this.handlePointerCancel);
  }

  private finishDrag(): void {
    if (this.pointerId !== null && typeof this.element.releasePointerCapture === "function") {
      this.element.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.element.dataset["dragging"] = "false";
    this.removeDocumentListeners();
    this.options.onDragEnd?.();
  }
}
