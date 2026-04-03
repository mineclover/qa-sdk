import { loadFileText, loadHostedReportText } from "./io.js";
import { renderFileMapLayout, renderTreeCanvas } from "./render.js";
import { SAMPLE_REPORT } from "./sample-report.js";
import { applyRawInputToState, createInitialState, resolveActiveTree } from "./state.js";
import type { RenderState } from "./types.js";

let container: HTMLElement;
let state: RenderState;
let autoRefreshTimerId: number | null = null;
const AUTO_REFRESH_MS = 5000;

export function renderFileMapPage(el: HTMLElement): void {
  container = el;
  if (!state) {
    state = createInitialState();
  }
  ensureAutoRefreshLoop();
  render();
  void maybeAutoLoadHostedReport();
}

function render(): void {
  const activeTree = resolveActiveTree(state);
  renderFileMapLayout(container, state, activeTree);
  bindPageActions();
  renderTreeCanvas(container, activeTree, state.selectedNodeId, (nodeId) => {
    state.selectedNodeId = nodeId;
    render();
  });
}

function bindPageActions(): void {
  container.querySelector<HTMLButtonElement>(".fmap-load-sample")?.addEventListener("click", () => {
    state.rawInput = JSON.stringify(SAMPLE_REPORT, null, 2);
    state.inputSource = "sample";
    state.autoRefreshEnabled = false;
    render();
  });

  container.querySelector<HTMLButtonElement>(".fmap-load-hosted")?.addEventListener("click", () => {
    void loadHostedReport(true);
  });

  const fileInput = container.querySelector<HTMLInputElement>("#fmap-file-input");
  container.querySelector<HTMLButtonElement>(".fmap-load-file")?.addEventListener("click", () => {
    fileInput?.click();
  });
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const rawText = await loadFileText(file);
    applyInput(rawText, "JSON을 적용했습니다.", {
      inputSource: "file",
      autoRefreshEnabled: false,
    });
    fileInput.value = "";
  });

  container.querySelector<HTMLButtonElement>(".fmap-render")?.addEventListener("click", () => {
    const input = container.querySelector<HTMLTextAreaElement>("#fmap-input");
    if (!input) return;
    applyInput(input.value, "JSON을 적용했습니다.", {
      inputSource: "manual",
      autoRefreshEnabled: false,
    });
  });

  container.querySelector<HTMLButtonElement>(".fmap-reset-view")?.addEventListener("click", () => {
    const activeTree = resolveActiveTree(state);
    renderTreeCanvas(container, activeTree, state.selectedNodeId, (nodeId) => {
      state.selectedNodeId = nodeId;
      render();
    });
  });

  container.querySelectorAll<HTMLButtonElement>(".fmap-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.viewMode;
      if (nextMode === "all" || nextMode === "current" || nextMode === "workspace" || nextMode === "overlap") {
        state.viewMode = nextMode;
        render();
      }
    });
  });

  container.querySelector<HTMLButtonElement>(".fmap-drawer-toggle")?.addEventListener("click", () => {
    state.drawerExpanded = !state.drawerExpanded;
    render();
  });

  container.querySelector<HTMLButtonElement>(".fmap-refresh-toggle")?.addEventListener("click", () => {
    state.autoRefreshEnabled = !state.autoRefreshEnabled;
    if (state.autoRefreshEnabled) {
      state.inputSource = "hosted";
      void loadHostedReport(false);
    }
    render();
  });
}

async function maybeAutoLoadHostedReport(): Promise<void> {
  if (state.autoLoadAttempted) return;
  state.autoLoadAttempted = true;
  await loadHostedReport(false);
}

async function loadHostedReport(showEmptyState: boolean): Promise<void> {
  const status = container.querySelector<HTMLElement>("#fmap-status");
  if (status) {
    status.textContent = "호스팅된 git-conflicts.json 확인 중...";
    status.className = "fmap-status";
  }

  const result = await loadHostedReportText();
  if (result.ok) {
    const rawText = result.rawText;
    applyInput(rawText, "호스팅된 git-conflicts.json을 불러왔습니다.", {
      inputSource: "hosted",
      autoRefreshEnabled: true,
      preserveSelection: true,
    });
    return;
  }

  if (!status) return;
  status.textContent = showEmptyState ? `에러: ${result.message}` : "호스팅된 데이터가 없어 샘플을 사용 중입니다.";
  status.className = showEmptyState ? "fmap-status fmap-status-error" : "fmap-status";
}

function applyInput(
  rawText: string,
  successMessage = "JSON을 적용했습니다.",
  options?: {
    inputSource?: RenderState["inputSource"];
    autoRefreshEnabled?: boolean;
    preserveSelection?: boolean;
  },
): void {
  const status = container.querySelector<HTMLElement>("#fmap-status");

  try {
    state = applyRawInputToState(state, rawText, options);
    render();
    const nextStatus = container.querySelector<HTMLElement>("#fmap-status");
    if (nextStatus) {
      nextStatus.textContent = successMessage;
      nextStatus.className = "fmap-status fmap-status-success";
    }
  } catch (error) {
    if (!status) return;
    const message = error instanceof Error ? error.message : "JSON 파싱 실패";
    status.textContent = `에러: ${message}`;
    status.className = "fmap-status fmap-status-error";
  }
}

function ensureAutoRefreshLoop(): void {
  if (autoRefreshTimerId !== null) return;

  autoRefreshTimerId = window.setInterval(() => {
    if (!state.autoRefreshEnabled) return;
    if (state.inputSource !== "hosted") return;
    void loadHostedReport(false);
  }, AUTO_REFRESH_MS);
}
