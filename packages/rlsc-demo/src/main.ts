import {
  aggregateTextRegions,
  analyzeAreas,
  analyzeTextOccupancy,
  type AreaOverflowIssue,
  type LayoutMetrics,
  type LayoutPattern,
  type RLSCDocument,
  type TextOccupancy
} from "@qa-sdk/rlsc-analysis";
import {
  collectLayoutWithText,
  createLayoutMonitor,
  type LayoutMonitor
} from "@qa-sdk/rlsc-analysis/browser";
import type {
  PerspectiveCopyEvent,
  PerspectiveGroupBy,
  PerspectiveNodeEvent,
  PerspectiveRendererKind,
  PerspectiveSelectionDetail,
  PerspectiveViewer
} from "@qa-sdk/rlsc-perspective";
import { renderToSVG } from "rlsc/rendering";
import "./styles.css";

type StepId = "collect" | "text" | "metrics" | "pattern" | "render";

interface PipelineState {
  doc: RLSCDocument | null;
  text: readonly TextOccupancy[];
  monitor: LayoutMonitor | null;
  layerScene: PerspectiveViewer | null;
  renderer: PerspectiveRendererKind;
  groupBy: PerspectiveGroupBy;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  selectedDetail: PerspectiveSelectionDetail | null;
  copiedText: string;
  runCount: number;
}

const steps: { id: StepId; label: string; detail: string }[] = [
  { id: "collect", label: "DOM collect", detail: "live DOM에서 rect, role, relation 수집" },
  { id: "text", label: "Text occupancy", detail: "pretext 기반 텍스트 점유율 분석" },
  { id: "metrics", label: "Metrics", detail: "balance, flow, spacing, proximity 계산" },
  { id: "pattern", label: "Pattern", detail: "layout pattern vocabulary로 변환" },
  { id: "render", label: "Render", detail: "RLSC document를 SVG overlay로 렌더링" }
];

const state: PipelineState = {
  doc: null,
  text: [],
  monitor: null,
  layerScene: null,
  renderer: "auto",
  groupBy: "dom-node",
  hoveredNodeId: null,
  selectedNodeId: null,
  selectedDetail: null,
  copiedText: "",
  runCount: 0
};

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("app mount failed");
const mount = app;

mount.innerHTML = `
  <main class="workspace">
    <section class="sample-pane" aria-label="sample web page">
      <header class="toolbar">
        <div>
          <h1>RLSC browser execution</h1>
          <p>실제 DOM을 수집하고 분석 단계별 산출물을 확인합니다.</p>
        </div>
        <div class="actions">
          <label class="renderer-control">
            Renderer
            <select data-action="renderer">
              <option value="auto">Auto</option>
              <option value="webgl">WebGL</option>
              <option value="canvas">Canvas</option>
            </select>
          </label>
          <label class="renderer-control">
            Group
            <select data-action="groupBy">
              <option value="dom-node">DOM node</option>
              <option value="componentId">Component</option>
              <option value="qaAddress">QA address</option>
              <option value="role">Role</option>
            </select>
          </label>
          <button type="button" data-action="run">Run</button>
          <button type="button" data-action="mutate">Mutate DOM</button>
          <button type="button" data-action="monitor">Start monitor</button>
        </div>
      </header>

      <article id="sample-surface" class="sample-surface" data-qa-address="rlsc-demo:surface" data-component-id="DemoSurface" role="main">
        <header class="sample-header" data-qa-address="rlsc-demo:header" data-component-id="DemoHeader" role="banner">
          <nav class="sample-nav" aria-label="demo navigation" data-component-id="DemoNav">
            <a href="#overview">Overview</a>
            <a href="#signals">Signals</a>
            <a href="#review">Review</a>
          </nav>
          <button class="sample-alert" type="button" data-qa-address="rlsc-demo:alert" data-component-id="ReviewAlert">검토 필요 3</button>
        </header>

        <section class="hero-block" data-qa-address="rlsc-demo:hero" data-component-id="HeroBlock">
          <div class="hero-copy">
            <h2>Layout signal capture</h2>
            <p>RLSC는 화면의 시각 구조를 노드, 격자, 관계, 텍스트 점유율로 변환합니다.</p>
          </div>
          <form class="hero-form" data-qa-address="rlsc-demo:form" data-component-id="ScenarioForm">
            <label>
              Scenario
              <select>
                <option>Checkout review</option>
                <option>Content audit</option>
              </select>
            </label>
            <button type="button">분석 요청</button>
          </form>
        </section>

        <section class="metric-grid" data-qa-address="rlsc-demo:metrics" data-component-id="MetricGrid">
          <div class="metric-tile" data-component-id="MetricTile"><span>Nodes</span><strong>pending</strong></div>
          <div class="metric-tile" data-component-id="MetricTile"><span>Relations</span><strong>pending</strong></div>
          <div class="metric-tile" data-component-id="MetricTile"><span>Text fill</span><strong>pending</strong></div>
        </section>

        <section class="content-columns" data-qa-address="rlsc-demo:columns" data-component-id="ContentColumns">
          <article>
            <h3>Primary flow</h3>
            <p>카드 간 간격과 행 방향 흐름이 relation graph로 변환됩니다.</p>
          </article>
          <article>
            <h3>Boundary pressure</h3>
            <p class="text-stress" data-component-id="TextStress">텍스트가 컨테이너 경계에 얼마나 붙는지 occupancy 단계에서 계산되며 긴 디버그 문장은 제한된 높이에서 overflow issue로 표시됩니다.</p>
          </article>
          <article>
            <h3>Mutation watch</h3>
            <p>DOM 변경은 monitor가 debounce 후 다시 수집합니다.</p>
          </article>
        </section>
      </article>
    </section>

    <aside class="inspect-pane" aria-label="rlsc execution output">
      <section class="step-panel">
        <h2>Pipeline</h2>
        <ol class="step-list" data-view="steps"></ol>
      </section>

      <section class="summary-panel">
        <h2>Summary</h2>
        <div class="summary-grid" data-view="summary"></div>
      </section>

      <section class="svg-panel">
        <h2>SVG overlay</h2>
        <div class="svg-view" data-view="svg"></div>
      </section>

      <section class="layer-panel">
        <h2>Perspective layers</h2>
        <div class="layer-view" data-view="layers3d"></div>
        <div class="layer-actions">
          <button type="button" data-action="clearSelection">Clear selection</button>
          <button type="button" data-action="copySelection">Copy identifier</button>
          <button type="button" data-action="copySelectionJson">Copy JSON</button>
        </div>
        <div class="interaction-view" data-view="interactions" aria-live="polite"></div>
      </section>

      <section class="json-panel">
        <h2>Document</h2>
        <pre data-view="json"></pre>
      </section>
    </aside>
  </main>
`;

const sampleSurface = queryRequired<HTMLElement>("#sample-surface");
const stepsView = queryRequired<HTMLElement>('[data-view="steps"]');
const summaryView = queryRequired<HTMLElement>('[data-view="summary"]');
const svgView = queryRequired<HTMLElement>('[data-view="svg"]');
const layerView = queryRequired<HTMLElement>('[data-view="layers3d"]');
const interactionsView = queryRequired<HTMLElement>('[data-view="interactions"]');
const jsonView = queryRequired<HTMLElement>('[data-view="json"]');
const monitorButton = queryRequired<HTMLButtonElement>('[data-action="monitor"]');

renderSteps();
renderInteractions();
void runPipeline();

mount.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLButtonElement>("[data-action]")?.dataset["action"];
  if (!action) return;

  if (action === "run") {
    void runPipeline();
  } else if (action === "mutate") {
    mutateSample();
  } else if (action === "monitor") {
    toggleMonitor();
  } else if (action === "clearSelection") {
    clearSelection();
  } else if (action === "copySelection") {
    void copySelection();
  } else if (action === "copySelectionJson") {
    void copySelectionJson();
  }
});

mount.addEventListener("change", (event) => {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLSelectElement && target.dataset["action"] === "renderer") {
    state.renderer = target.value as PerspectiveRendererKind;
    state.layerScene?.dispose();
    state.layerScene = null;
    if (state.doc) void runPipeline();
  } else if (target instanceof HTMLSelectElement && target.dataset["action"] === "groupBy") {
    state.groupBy = target.value as PerspectiveGroupBy;
    state.hoveredNodeId = null;
    state.selectedNodeId = null;
    state.selectedDetail = null;
    state.copiedText = "";
    if (state.doc) state.layerScene?.update(state.doc, viewerOptions(analyzeAreas(state.doc, { textOccupancies: state.text }).overflowIssues));
    renderInteractions();
  }
});

function queryRequired<T extends HTMLElement>(selector: string): T {
  const element = mount.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}

function setStepStatus(active: StepId | null, done: readonly StepId[] = []): void {
  for (const item of stepsView.querySelectorAll<HTMLElement>("[data-step]")) {
    const id = item.dataset["step"] as StepId;
    item.dataset["state"] = id === active ? "active" : done.includes(id) ? "done" : "idle";
  }
}

function renderSteps(): void {
  stepsView.innerHTML = steps
    .map(
      (step) => `
        <li data-step="${step.id}" data-state="idle">
          <span class="step-dot"></span>
          <div>
            <strong>${step.label}</strong>
            <small>${step.detail}</small>
          </div>
        </li>`
    )
    .join("");
}

async function runPipeline(): Promise<void> {
  const done: StepId[] = [];
  state.runCount += 1;

  setStepStatus("collect", done);
  await settle();
  const { doc, textPrepared } = collectLayoutWithText(sampleSurface, {
    minSize: 8,
    maxDepth: 10,
    addressAttribute: "data-qa-address"
  });
  state.doc = doc;
  done.push("collect");

  setStepStatus("text", done);
  await settle();
  const text = analyzeTextOccupancy(doc, textPrepared);
  const textRegions = aggregateTextRegions(doc, text);
  state.text = text;
  done.push("text");

  setStepStatus("metrics", done);
  await settle();
  const analysis = analyzeAreas(doc, { textOccupancies: text });
  const { metrics, overflowIssues } = analysis;
  done.push("metrics");

  setStepStatus("pattern", done);
  await settle();
  const { pattern } = analysis;
  done.push("pattern");

  setStepStatus("render", done);
  await settle();
  const svg = renderToSVG(doc, {
    colorBy: "role",
    opacity: 0.62,
    showBalance: true,
    showFlow: true,
    showGrid: true,
    showGroups: true,
    metrics
  });
  done.push("render");
  setStepStatus(null, done);

  renderSummary(doc, text, textRegions, metrics, pattern, overflowIssues);
  svgView.innerHTML = svg;
  if (state.layerScene) {
    state.layerScene.update(doc, viewerOptions(overflowIssues));
  } else {
    const { createPerspectiveViewer } = await import("@qa-sdk/rlsc-perspective");
    state.layerScene = createPerspectiveViewer(layerView, doc, viewerOptions(overflowIssues));
  }
  jsonView.textContent = JSON.stringify(
    {
      run: state.runCount,
      viewport: doc.viewport,
      root: doc.root.id,
      nodes: analysis.nodes.map((node) => ({
        id: node.id,
        identifier: node.identifier,
        role: node.role,
        rect: node.rect,
        address: node.attributes["data-qa-address"]
      })),
      relations: doc.relations.slice(0, 12),
      overflowIssues,
      metrics,
      pattern
    },
    null,
    2
  );
}

function viewerOptions(overflowIssues: readonly AreaOverflowIssue[]) {
  return {
    renderer: state.renderer,
    groupBy: state.groupBy,
    overflowIssues,
    textOccupancies: state.text,
    onHover(event: PerspectiveNodeEvent): void {
      state.hoveredNodeId = event.nodeId;
      renderInteractions();
    },
    onSelect(event: PerspectiveNodeEvent): void {
      state.selectedNodeId = event.nodeId;
      state.selectedDetail = event.selection ?? null;
      renderInteractions();
    },
    onCopy(event: PerspectiveCopyEvent): void {
      state.copiedText = event.text;
      renderInteractions();
    }
  };
}

function renderInteractions(): void {
  const detail = state.selectedDetail;
  interactionsView.innerHTML = [
    metric("Renderer", state.renderer),
    metric("Group", state.groupBy),
    metric("Hover", state.hoveredNodeId ?? "none"),
    metric("Selected", state.selectedNodeId ?? "none"),
    metric("Identifier", detail?.identifier ? `${detail.identifier.kind}:${detail.identifier.value}` : "none"),
    metric("Preferred", detail?.preferredIdentifier ?? "none"),
    metric("Component", detail?.componentId ?? "none"),
    metric("QA address", detail?.qaAddress ?? "none"),
    metric("Role", detail?.role ?? "none"),
    metric("Text", detail?.textHint ?? "none"),
    metric("Issues", detail?.issues.length ? detail.issues.map((issue) => issue.kind ?? issue.severity ?? "issue").join(", ") : "none"),
    metric("Copied", state.copiedText ? "ready" : "none")
  ].join("");
}

function renderSummary(
  doc: RLSCDocument,
  text: readonly TextOccupancy[],
  textRegions: ReturnType<typeof aggregateTextRegions>,
  metrics: LayoutMetrics,
  pattern: LayoutPattern,
  overflowIssues: readonly AreaOverflowIssue[]
): void {
  const { nodes } = analyzeAreas(doc);
  summaryView.innerHTML = [
    metric("Run", String(state.runCount)),
    metric("Nodes", String(nodes.length)),
    metric("Relations", String(doc.relations.length)),
    metric("Layers", String(doc.layers.length)),
    metric("Text regions", String(text.length)),
    metric("Dominant flow", metrics.dominantFlow),
    metric("Balance X", metrics.balance.x.toFixed(2)),
    metric("Spacing base", String(metrics.spacingBase)),
    metric("Text density", metrics.textDensity?.toFixed(3) ?? "n/a"),
    metric("Text groups", String(textRegions.length)),
    metric("Containment leaks", String(overflowIssues.length)),
    metric("Pattern", JSON.stringify(pattern))
  ].join("");

  const tiles = sampleSurface.querySelectorAll<HTMLElement>(".metric-tile strong");
  if (!state.monitor) {
    if (tiles[0]) tiles[0].textContent = String(nodes.length);
    if (tiles[1]) tiles[1].textContent = String(doc.relations.length);
    if (tiles[2]) tiles[2].textContent = metrics.textDensity?.toFixed(3) ?? "n/a";
  }
}

function metric(label: string, value: string): string {
  return `<div class="summary-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function mutateSample(): void {
  const columns = sampleSurface.querySelector(".content-columns");
  if (!columns) return;

  const article = document.createElement("article");
  article.className = "mutated";
  article.setAttribute("data-component-id", "MutationCard");
  article.setAttribute("data-qa-address", "rlsc-demo:mutation-card");
  article.innerHTML = `
    <span class="spill-chip">spill</span>
    <h3>New branch</h3>
    <p>오른쪽 badge는 parent article 경계를 넘도록 배치되어 containment leak 감지에 잡힙니다.</p>
  `;
  columns.appendChild(article);
}

function clearSelection(): void {
  state.layerScene?.clearSelection();
  state.selectedNodeId = null;
  state.selectedDetail = null;
  state.copiedText = "";
  renderInteractions();
}

async function copySelection(): Promise<void> {
  if (!state.selectedDetail) return;
  const text = state.selectedDetail.identifier.value;
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  state.copiedText = text;
  renderInteractions();
}

async function copySelectionJson(): Promise<void> {
  if (!state.selectedDetail) return;
  const text = JSON.stringify(
    {
      identifier: state.selectedDetail.identifier,
      nodeId: state.selectedDetail.nodeId,
      nodeIds: state.selectedDetail.nodeIds,
      issues: state.selectedDetail.issues,
    },
    null,
    2
  );
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  state.copiedText = text;
  renderInteractions();
}

function toggleMonitor(): void {
  if (state.monitor) {
    state.monitor.stop();
    state.monitor = null;
    monitorButton.textContent = "Start monitor";
    monitorButton.dataset["active"] = "false";
    return;
  }

  state.monitor = createLayoutMonitor(sampleSurface, {
    debounceMs: 220,
    trackText: true,
    onTextOccupancyChange: () => {
      void runPipeline();
    }
  });
  state.monitor.start();
  monitorButton.textContent = "Stop monitor";
  monitorButton.dataset["active"] = "true";
}

function settle(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 140));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}
