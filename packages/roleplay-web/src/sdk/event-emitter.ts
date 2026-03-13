import type { QaBridge } from "./qa-bridge.js";
import type { ChildBridge } from "../iframe/child-bridge.js";

export interface EventEmitter {
  attach(container: HTMLElement): void;
  detach(): void;
}

export function createEventEmitter(
  bridge: QaBridge,
  childBridge: ChildBridge,
): EventEmitter {
  const controllers: AbortController[] = [];

  function emit(eventKey: string, payload?: Record<string, unknown>): void {
    bridge.emitEvent(eventKey, payload);
    childBridge.notifyEvent(eventKey);
    appendToEventLog(eventKey, payload);
  }

  function selectorOf(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className
      ? `.${String(el.className).trim().split(/\s+/).join(".")}`
      : "";
    return `${tag}${id}${cls}`;
  }

  function handleClick(e: Event): void {
    const target = e.target as Element;
    if (!target) return;
    emit("click", {
      target_selector: selectorOf(target),
      target_text: (target.textContent ?? "").slice(0, 100),
    });
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!target) return;
    emit("input_change", {
      field_name: target.name || target.id || selectorOf(target),
      field_value: target.value,
    });
  }

  function handleSubmit(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    emit("form_submit", {
      form_id: form.id || selectorOf(form),
    });
  }

  return {
    attach(container: HTMLElement): void {
      const controller = new AbortController();
      const signal = controller.signal;
      controllers.push(controller);

      container.addEventListener("click", handleClick, { signal });
      container.addEventListener("input", handleInput, { signal });
      container.addEventListener("change", handleInput, { signal });
      container.addEventListener("submit", handleSubmit, { signal });
    },

    detach(): void {
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.length = 0;
    },
  };
}

function appendToEventLog(
  eventKey: string,
  payload?: Record<string, unknown>,
): void {
  const logEl = document.getElementById("event-log");
  if (!logEl) return;

  const entry = document.createElement("div");
  entry.className = "event-log-entry";

  const time = document.createElement("span");
  time.className = "event-log-time";
  time.textContent = new Date().toISOString().slice(11, 23);

  const key = document.createElement("span");
  key.className = "event-log-key";
  key.textContent = eventKey;

  const detail = document.createElement("span");
  detail.className = "event-log-detail";
  detail.textContent = payload ? JSON.stringify(payload) : "";

  entry.appendChild(time);
  entry.appendChild(key);
  entry.appendChild(detail);

  logEl.prepend(entry);
}
