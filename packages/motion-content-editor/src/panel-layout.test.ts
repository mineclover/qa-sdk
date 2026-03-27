import { describe, expect, it } from "vitest";

import { PanelGroup, Splitter } from "./panel-layout.js";

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
  clientY: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: pointerId,
  });
  target.dispatchEvent(event);
}

describe("panel layout", () => {
  it("switches tabs and toggles collapsed state", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const group = new PanelGroup({
      id: "left",
      container,
      title: "Workspace",
      collapseDirection: "left",
      tabs: [
        {
          id: "properties",
          label: "Properties",
          content: Object.assign(document.createElement("div"), {
            textContent: "properties",
          }),
        },
        {
          id: "layers",
          label: "Layers",
          content: Object.assign(document.createElement("div"), {
            textContent: "layers",
          }),
        },
      ],
    });

    const propertiesView = container.querySelector<HTMLElement>('[data-panel-view="properties"]');
    const layersView = container.querySelector<HTMLElement>('[data-panel-view="layers"]');
    const layersTab = container.querySelector<HTMLButtonElement>('[data-panel-tab="layers"]');
    const collapseButton = container.querySelector<HTMLButtonElement>(".mce-panel-group__collapse");

    expect(group.getActiveTabId()).toBe("properties");
    expect(propertiesView?.hidden).toBe(false);
    expect(layersView?.hidden).toBe(true);

    layersTab?.click();

    expect(group.getActiveTabId()).toBe("layers");
    expect(propertiesView?.hidden).toBe(true);
    expect(layersView?.hidden).toBe(false);

    collapseButton?.click();
    expect(group.isCollapsed()).toBe(true);
    expect(group.element.dataset["collapsed"]).toBe("true");

    collapseButton?.click();
    expect(group.isCollapsed()).toBe(false);

    container.remove();
  });

  it("clamps splitter drag and supports reverse direction", () => {
    installPointerCapturePolyfill();

    const splitterElement = document.createElement("div");
    document.body.appendChild(splitterElement);

    let size = 320;
    const splitter = new Splitter({
      element: splitterElement,
      axis: "x",
      direction: -1,
      getValue: () => size,
      setValue: (value) => {
        size = value;
      },
      getRange: () => ({ min: 240, max: 400 }),
    });

    dispatchPointerEvent(splitterElement, "pointerdown", 7, 200, 0);
    dispatchPointerEvent(document, "pointermove", 7, 120, 0);
    expect(size).toBe(400);

    dispatchPointerEvent(document, "pointermove", 7, 420, 0);
    expect(size).toBe(240);

    dispatchPointerEvent(document, "pointerup", 7, 420, 0);
    expect(splitterElement.dataset["dragging"]).toBe("false");

    splitter.destroy();
    splitterElement.remove();
  });
});
