import { ROLEPLAY_WEB_URL } from "../config";
import type { ParentMessage, ChildMessage } from "./message-protocol";
import { isChildMessage } from "./message-protocol";

export interface RoleplayHost {
  sendContext(ctx: { traceId: string; sessionId: string; scenarioId: string }): void;
  onEvent(handler: (msg: ChildMessage) => void): void;
  destroy(): void;
}

export function createRoleplayHost(container: HTMLElement): RoleplayHost {
  const wrapper = document.createElement("div");
  wrapper.className = "roleplay-host";

  const header = document.createElement("div");
  header.className = "roleplay-header";

  const title = document.createElement("span");
  title.className = "panel-label";
  title.textContent = "Roleplay";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "btn-toggle";
  toggleBtn.textContent = "Collapse";

  header.appendChild(title);
  header.appendChild(toggleBtn);

  const iframeContainer = document.createElement("div");
  iframeContainer.className = "roleplay-iframe-container";

  const iframe = document.createElement("iframe");
  iframe.src = ROLEPLAY_WEB_URL;
  iframe.className = "roleplay-iframe";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  iframeContainer.appendChild(iframe);

  wrapper.appendChild(header);
  wrapper.appendChild(iframeContainer);
  container.appendChild(wrapper);

  let collapsed = false;
  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    iframeContainer.classList.toggle("collapsed", collapsed);
    toggleBtn.textContent = collapsed ? "Expand" : "Collapse";
  });

  const eventHandlers: Array<(msg: ChildMessage) => void> = [];

  function handleMessage(event: MessageEvent): void {
    if (event.origin !== new URL(ROLEPLAY_WEB_URL).origin) return;
    if (!isChildMessage(event.data)) return;
    for (const handler of eventHandlers) {
      handler(event.data);
    }
  }

  window.addEventListener("message", handleMessage);

  return {
    sendContext(ctx) {
      if (!iframe.contentWindow) return;
      const msg: ParentMessage = {
        type: "context",
        traceId: ctx.traceId,
        sessionId: ctx.sessionId,
        scenarioId: ctx.scenarioId,
      };
      iframe.contentWindow.postMessage(msg, ROLEPLAY_WEB_URL);
    },

    onEvent(handler) {
      eventHandlers.push(handler);
    },

    destroy() {
      window.removeEventListener("message", handleMessage);
      if (wrapper.parentElement) {
        wrapper.parentElement.removeChild(wrapper);
      }
    },
  };
}
