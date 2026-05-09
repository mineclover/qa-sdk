// @def.boundary rlsc
import {
  aggregateTextRegions,
  analyzeAreas,
  analyzeTextOccupancy,
  type AreaOverflowIssue,
  type AreaAnalysisNode,
  type LayoutMetrics,
  type LayoutPattern,
  type RLSCDocument,
  type TextOccupancy,
} from 'rlsc-analysis';
import {
  collectLayoutWithText,
  createLayoutMonitor,
  type LayoutMonitor,
} from 'rlsc-analysis/browser';
import type {
  PerspectiveCopyEvent,
  PerspectiveControlMode,
  PerspectiveGroupBy,
  PerspectiveNodeEvent,
  PerspectiveProjectionMode,
  PerspectiveRendererKind,
  PerspectiveSelectionDetail,
  PerspectiveViewer,
} from 'rlsc-perspective';
import { renderToSVG } from 'rlsc/rendering';
import './styles.css';

type StepId = 'collect' | 'text' | 'metrics' | 'pattern' | 'render';

interface PipelineState {
  doc: RLSCDocument | null;
  text: readonly TextOccupancy[];
  monitor: LayoutMonitor | null;
  layerScene: PerspectiveViewer | null;
  renderer: PerspectiveRendererKind;
  groupBy: PerspectiveGroupBy;
  controlMode: PerspectiveControlMode;
  projectionMode: PerspectiveProjectionMode;
  hoveredNodeId: string | null;
  hoveredDetail: PerspectiveSelectionDetail | null;
  selectedNodeId: string | null;
  selectedDetail: PerspectiveSelectionDetail | null;
  copiedText: string;
  runCount: number;
}

const steps: { id: StepId; label: string; detail: string }[] = [
  { id: 'collect', label: 'DOM collect', detail: 'live DOM에서 rect, role, relation 수집' },
  { id: 'text', label: 'Text occupancy', detail: 'pretext 기반 텍스트 점유율 분석' },
  { id: 'metrics', label: 'Metrics', detail: 'balance, flow, spacing, proximity 계산' },
  { id: 'pattern', label: 'Pattern', detail: 'layout pattern vocabulary로 변환' },
  { id: 'render', label: 'Render', detail: 'RLSC document를 SVG overlay로 렌더링' },
];

const state: PipelineState = {
  doc: null,
  text: [],
  monitor: null,
  layerScene: null,
  renderer: 'auto',
  groupBy: 'dom-node',
  controlMode: 'orbit',
  projectionMode: 'orthographic',
  hoveredNodeId: null,
  hoveredDetail: null,
  selectedNodeId: null,
  selectedDetail: null,
  copiedText: '',
  runCount: 0,
};

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('app mount failed');
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
              <option value="boundary">Boundary</option>
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

      <article id="sample-surface" class="sample-surface" data-qa-address="rlsc-demo:surface" data-component-id="DemoSurface" data-boundary="screen" role="main">
        <header class="sample-header" data-qa-address="rlsc-demo:header" data-component-id="DemoHeader" data-boundary="navigation" role="banner">
          <nav class="sample-nav" aria-label="demo navigation" data-component-id="DemoNav">
            <a href="#overview">Overview</a>
            <a href="#signals">Signals</a>
            <a href="#review">Review</a>
          </nav>
          <button class="sample-alert" type="button" data-qa-address="rlsc-demo:alert" data-component-id="ReviewAlert">검토 필요 3</button>
        </header>

        <section class="hero-block" data-qa-address="rlsc-demo:hero" data-component-id="HeroBlock" data-boundary="hero">
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

        <section class="metric-grid" data-qa-address="rlsc-demo:metrics" data-component-id="MetricGrid" data-boundary="metrics">
          <div class="metric-tile" data-component-id="MetricTile"><span>Nodes</span><strong>pending</strong></div>
          <div class="metric-tile" data-component-id="MetricTile"><span>Relations</span><strong>pending</strong></div>
          <div class="metric-tile" data-component-id="MetricTile"><span>Text fill</span><strong>pending</strong></div>
        </section>

        <section class="content-columns" data-qa-address="rlsc-demo:columns" data-component-id="ContentColumns" data-boundary="content">
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
      <div class="dom-highlight-overlay" data-view="domHighlight" aria-hidden="true"></div>
    </section>

    <aside class="inspect-pane" aria-label="rlsc execution output">
      <section class="step-panel">
        <h2>Pipeline</h2>
        <ol class="step-list" data-view="steps"></ol>
      </section>

      <section class="layer-panel">
        <h2>Perspective layers</h2>
        <div class="layer-view" data-view="layers3d"></div>
        <div class="layer-actions">
          <label class="renderer-control">
            Control
            <select data-action="controlMode">
              <option value="orbit">Orbit</option>
              <option value="x">X axis</option>
              <option value="y">Y axis</option>
              <option value="z">Z axis</option>
              <option value="pan">Pan</option>
            </select>
          </label>
          <label class="renderer-control">
            Projection
            <select data-action="projectionMode">
              <option value="orthographic">Orthographic</option>
              <option value="perspective">Perspective</option>
            </select>
          </label>
          <button type="button" data-action="clearSelection">Clear selection</button>
          <button type="button" data-action="viewTop">Top view</button>
          <button type="button" data-action="viewReset">Reset view</button>
          <button type="button" data-action="viewFit">Fit</button>
          <button type="button" data-action="copySelection">Copy identifier</button>
          <button type="button" data-action="copySelectionXPath">Copy XPath</button>
          <button type="button" data-action="copySelectionJson">Copy JSON</button>
        </div>
        <div class="interaction-view" data-view="interactions" aria-live="polite"></div>
      </section>

      <section class="summary-panel">
        <h2>Summary</h2>
        <div class="summary-grid" data-view="summary"></div>
      </section>

      <section class="svg-panel">
        <h2>SVG overlay</h2>
        <div class="svg-view" data-view="svg"></div>
      </section>

      <section class="json-panel">
        <h2>Document</h2>
        <pre data-view="json"></pre>
      </section>
    </aside>
  </main>
`;

const sampleSurface = queryRequired<HTMLElement>('#sample-surface');
const domHighlightView = queryRequired<HTMLElement>('[data-view="domHighlight"]');
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

mount.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset['action'];
  if (!action) return;

  if (action === 'run') {
    void runPipeline();
  } else if (action === 'mutate') {
    mutateSample();
  } else if (action === 'monitor') {
    toggleMonitor();
  } else if (action === 'clearSelection') {
    clearSelection();
  } else if (action === 'viewTop') {
    state.layerScene?.setView('top');
  } else if (action === 'viewReset') {
    state.layerScene?.resetView();
  } else if (action === 'viewFit') {
    state.layerScene?.fitView();
  } else if (action === 'copySelection') {
    void copySelection();
  } else if (action === 'copySelectionXPath') {
    void copySelectionXPath();
  } else if (action === 'copySelectionJson') {
    void copySelectionJson();
  }
});

mount.addEventListener('change', (event) => {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLSelectElement && target.dataset['action'] === 'renderer') {
    state.renderer = target.value as PerspectiveRendererKind;
    state.layerScene?.dispose();
    state.layerScene = null;
    if (state.doc) void runPipeline();
  } else if (target instanceof HTMLSelectElement && target.dataset['action'] === 'groupBy') {
    state.groupBy = target.value as PerspectiveGroupBy;
    state.hoveredNodeId = null;
    state.hoveredDetail = null;
    state.selectedNodeId = null;
    state.selectedDetail = null;
    state.copiedText = '';
    if (state.doc) {
      state.layerScene?.update(
        state.doc,
        viewerOptions(analyzeAreas(state.doc, { textOccupancies: state.text }).overflowIssues),
      );
    }
    renderInteractions();
    renderDomHighlights();
  } else if (target instanceof HTMLSelectElement && target.dataset['action'] === 'controlMode') {
    state.controlMode = target.value as PerspectiveControlMode;
    state.layerScene?.setControlMode(state.controlMode);
    renderInteractions();
  } else if (target instanceof HTMLSelectElement && target.dataset['action'] === 'projectionMode') {
    state.projectionMode = target.value as PerspectiveProjectionMode;
    state.layerScene?.setProjectionMode(state.projectionMode);
    renderInteractions();
  }
});

window.addEventListener('resize', renderDomHighlights);
window.addEventListener('scroll', renderDomHighlights, { passive: true });

function queryRequired<T extends HTMLElement>(selector: string): T {
  const element = mount.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}

function setStepStatus(active: StepId | null, done: readonly StepId[] = []): void {
  for (const item of stepsView.querySelectorAll<HTMLElement>('[data-step]')) {
    const id = item.dataset['step'] as StepId;
    item.dataset['state'] = id === active ? 'active' : done.includes(id) ? 'done' : 'idle';
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
        </li>`,
    )
    .join('');
}

async function runPipeline(): Promise<void> {
  const done: StepId[] = [];
  state.runCount += 1;

  setStepStatus('collect', done);
  await settle();
  const { doc, textPrepared } = collectLayoutWithText(sampleSurface, {
    minSize: 8,
    maxDepth: 10,
    addressAttribute: 'data-qa-address',
  });
  state.doc = doc;
  done.push('collect');

  setStepStatus('text', done);
  await settle();
  const text = analyzeTextOccupancy(doc, textPrepared);
  const textRegions = aggregateTextRegions(doc, text);
  state.text = text;
  done.push('text');

  setStepStatus('metrics', done);
  await settle();
  const analysis = analyzeAreas(doc, { textOccupancies: text });
  const { metrics, overflowIssues } = analysis;
  done.push('metrics');

  setStepStatus('pattern', done);
  await settle();
  const { pattern } = analysis;
  done.push('pattern');

  setStepStatus('render', done);
  await settle();
  const svg = renderToSVG(doc, {
    colorBy: 'role',
    opacity: 0.62,
    showBalance: true,
    showFlow: true,
    showGrid: true,
    showGroups: true,
    metrics,
  });
  done.push('render');
  setStepStatus(null, done);

  renderSummary(doc, text, textRegions, metrics, pattern, overflowIssues);
  svgView.innerHTML = svg;
  stabilizeSvgPreview();
  if (state.layerScene) {
    state.layerScene.update(doc, viewerOptions(overflowIssues));
  } else {
    const { createPerspectiveViewer } = await import('rlsc-perspective');
    state.layerScene = createPerspectiveViewer(layerView, doc, viewerOptions(overflowIssues));
  }
  jsonView.textContent = JSON.stringify(
    {
      run: state.runCount,
      viewport: doc.viewport,
      root: doc.root.id,
      nodes: analysis.nodes.map((node: AreaAnalysisNode) => ({
        id: node.id,
        identifier: node.identifier,
        role: node.role,
        rect: node.rect,
        address: node.attributes['data-qa-address'],
      })),
      relations: doc.relations.slice(0, 12),
      overflowIssues,
      metrics,
      pattern,
    },
    null,
    2,
  );
  renderDomHighlights();
}

function stabilizeSvgPreview(): void {
  const svg = svgView.querySelector<SVGSVGElement>('svg');
  if (!svg) return;
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('focusable', 'false');
}

function viewerOptions(overflowIssues: readonly AreaOverflowIssue[]) {
  return {
    renderer: state.renderer,
    groupBy: state.groupBy,
    controlMode: state.controlMode,
    projectionMode: state.projectionMode,
    overflowIssues,
    textOccupancies: state.text,
    onHover(event: PerspectiveNodeEvent): void {
      state.hoveredNodeId = event.nodeId;
      state.hoveredDetail = event.selection ?? null;
      renderInteractions();
      renderDomHighlights();
    },
    onSelect(event: PerspectiveNodeEvent): void {
      state.selectedNodeId = event.nodeId;
      state.selectedDetail = event.selection ?? null;
      renderInteractions();
      renderDomHighlights();
    },
    onCopy(event: PerspectiveCopyEvent): void {
      state.copiedText = event.text;
      renderInteractions();
    },
  };
}

function renderInteractions(): void {
  const detail = state.selectedDetail;
  interactionsView.innerHTML = [
    metric('Renderer', state.renderer),
    metric('Group', state.groupBy),
    metric('Control', state.controlMode),
    metric('Projection', state.projectionMode),
    metric('Hover', state.hoveredNodeId ?? 'none'),
    metric('Selected', state.selectedNodeId ?? 'none'),
    metric(
      'Identifier',
      detail?.identifier ? `${detail.identifier.kind}:${detail.identifier.value}` : 'none',
    ),
    metric('Preferred', detail?.preferredIdentifier ?? 'none'),
    metric('XPath', detail?.xpath ?? 'none'),
    metric('CSS selector', detail?.cssSelector ?? 'none'),
    metric('Boundary', detail?.boundary ?? 'none'),
    metric('Debug label', detail?.debugLabel ?? 'none'),
    metric('Rect', detail ? formatRect(detail.rect) : 'none'),
    metric(
      'Size',
      detail ? `${detail.rect.width.toFixed(1)} x ${detail.rect.height.toFixed(1)}` : 'none',
    ),
    metric('Component', detail?.componentId ?? 'none'),
    metric('QA address', detail?.qaAddress ?? 'none'),
    metric('Role', detail?.role ?? 'none'),
    metric('Text', detail?.textHint ?? 'none'),
    metric(
      'Issues',
      detail?.issues.length
        ? detail.issues.map((issue) => issue.kind ?? issue.severity ?? 'issue').join(', ')
        : 'none',
    ),
    metric('Copied', state.copiedText ? 'ready' : 'none'),
  ].join('');
}

function renderDomHighlights(): void {
  const boxes = [
    ...highlightBoxesForSelection('selected', state.selectedDetail),
    ...highlightBoxesForSelection('hover', state.hoveredDetail),
  ];
  domHighlightView.innerHTML = boxes
    .map(
      (box) => `
        <span
          class="dom-highlight-box ${box.kind === 'selected' ? 'is-selected' : 'is-hovered'}"
          style="left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px"
        ></span>
      `,
    )
    .join('');
}

function highlightBoxesForSelection(
  kind: 'hover' | 'selected',
  detail: PerspectiveSelectionDetail | null,
): HighlightBox[] {
  if (!detail || !state.doc) return [];
  const paneRect = domHighlightView.getBoundingClientRect();
  const elements = detail.nodeIds
    .map((nodeId) => findDocNode(state.doc?.root ?? null, nodeId))
    .filter((node): node is RLSCDocument['root'] => node !== null)
    .map((node) => resolveSourceElement(node))
    .filter((element): element is HTMLElement => element !== null);
  return [...new Set(elements)].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      kind,
      left: Math.round(rect.left - paneRect.left),
      top: Math.round(rect.top - paneRect.top),
      width: Math.max(2, Math.round(rect.width)),
      height: Math.max(2, Math.round(rect.height)),
    };
  });
}

interface HighlightBox {
  readonly kind: 'hover' | 'selected';
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function renderSummary(
  doc: RLSCDocument,
  text: readonly TextOccupancy[],
  textRegions: ReturnType<typeof aggregateTextRegions>,
  metrics: LayoutMetrics,
  pattern: LayoutPattern,
  overflowIssues: readonly AreaOverflowIssue[],
): void {
  const { nodes } = analyzeAreas(doc);
  summaryView.innerHTML = [
    metric('Run', String(state.runCount)),
    metric('Nodes', String(nodes.length)),
    metric('Relations', String(doc.relations.length)),
    metric('Layers', String(doc.layers.length)),
    metric('Text regions', String(text.length)),
    metric('Dominant flow', metrics.dominantFlow),
    metric('Balance X', metrics.balance.x.toFixed(2)),
    metric('Spacing base', String(metrics.spacingBase)),
    metric('Text density', metrics.textDensity?.toFixed(3) ?? 'n/a'),
    metric('Text groups', String(textRegions.length)),
    metric('Context boundaries', String(countBoundaries(doc))),
    metric('Containment leaks', String(overflowIssues.length)),
    metric('Pattern', JSON.stringify(pattern)),
  ].join('');

  const tiles = sampleSurface.querySelectorAll<HTMLElement>('.metric-tile strong');
  if (!state.monitor) {
    if (tiles[0]) tiles[0].textContent = String(nodes.length);
    if (tiles[1]) tiles[1].textContent = String(doc.relations.length);
    if (tiles[2]) tiles[2].textContent = metrics.textDensity?.toFixed(3) ?? 'n/a';
  }
}

function metric(label: string, value: string): string {
  return `<div class="summary-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function formatRect(rect: PerspectiveSelectionDetail['rect']): string {
  return `${rect.x.toFixed(1)}, ${rect.y.toFixed(1)}, ${rect.width.toFixed(1)}, ${rect.height.toFixed(1)}`;
}

function countBoundaries(doc: RLSCDocument): number {
  return flattenDocNodes(doc.root).filter(
    (node) => node.boundary ?? node.attributes['data-boundary'],
  ).length;
}

function flattenDocNodes(node: RLSCDocument['root']): RLSCDocument['root'][] {
  return [node, ...node.children.flatMap((child) => flattenDocNodes(child))];
}

function findDocNode(node: RLSCDocument['root'] | null, nodeId: string): RLSCDocument['root'] | null {
  if (!node) return null;
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findDocNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function resolveSourceElement(node: RLSCDocument['root']): HTMLElement | null {
  const selector = node.identifier?.cssSelector;
  const selectorMatch = selector ? document.querySelector<HTMLElement>(selector) : null;
  if (selectorMatch && sampleSurface.contains(selectorMatch)) return selectorMatch;

  const xpathMatch = node.identifier?.xpath
    ? resolveSampleXPath(sampleSurface, node.identifier.xpath)
    : null;
  if (xpathMatch) return xpathMatch;

  if (node.id.startsWith('html#')) return null;
  if (node.id.includes('#')) {
    const id = node.id.slice(node.id.indexOf('#') + 1);
    const idMatch = document.getElementById(id);
    if (idMatch instanceof HTMLElement && sampleSurface.contains(idMatch)) return idMatch;
  }
  return null;
}

function resolveSampleXPath(root: HTMLElement, xpath: string): HTMLElement | null {
  const documentMatch = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
  ).singleNodeValue;
  if (documentMatch instanceof HTMLElement && root.contains(documentMatch)) return documentMatch;

  const segments = xpath.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  let current: Element = root;
  const first = parseXPathSegment(segments[0]);
  let index = first && first.tag === root.tagName.toLowerCase() ? 1 : 0;
  for (; index < segments.length; index += 1) {
    const segment = parseXPathSegment(segments[index]);
    if (!segment) return null;
    const candidates = [...current.children].filter(
      (child) => child.tagName.toLowerCase() === segment.tag,
    );
    const next = candidates[segment.index - 1];
    if (!next) return null;
    current = next;
  }
  return current instanceof HTMLElement ? current : null;
}

function parseXPathSegment(segment: string): { readonly tag: string; readonly index: number } | null {
  const match = /^([a-z0-9-]+)\[(\d+)\]$/i.exec(segment);
  if (!match) return null;
  return { tag: match[1].toLowerCase(), index: Number(match[2]) };
}

function mutateSample(): void {
  const columns = sampleSurface.querySelector('.content-columns');
  if (!columns) return;

  const article = document.createElement('article');
  article.className = 'mutated';
  article.setAttribute('data-component-id', 'MutationCard');
  article.setAttribute('data-qa-address', 'rlsc-demo:mutation-card');
  article.setAttribute('data-boundary', 'mutation');
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
  state.copiedText = '';
  renderInteractions();
  renderDomHighlights();
}

async function copySelection(): Promise<void> {
  if (!state.selectedDetail) return;
  const text = state.selectedDetail.identifier.value;
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  state.copiedText = text;
  renderInteractions();
}

async function copySelectionXPath(): Promise<void> {
  if (!state.selectedDetail) return;
  const text =
    state.selectedDetail.xpath ??
    state.selectedDetail.cssSelector ??
    state.selectedDetail.identifier.value;
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  state.copiedText = text;
  renderInteractions();
}

async function copySelectionJson(): Promise<void> {
  if (!state.selectedDetail) return;
  const text = JSON.stringify(
    {
      identifier: state.selectedDetail.identifier,
      xpath: state.selectedDetail.xpath,
      cssSelector: state.selectedDetail.cssSelector,
      boundary: state.selectedDetail.boundary,
      debugLabel: state.selectedDetail.debugLabel,
      rect: state.selectedDetail.rect,
      nodeId: state.selectedDetail.nodeId,
      nodeIds: state.selectedDetail.nodeIds,
      issues: state.selectedDetail.issues,
    },
    null,
    2,
  );
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  state.copiedText = text;
  renderInteractions();
}

function toggleMonitor(): void {
  if (state.monitor) {
    state.monitor.stop();
    state.monitor = null;
    monitorButton.textContent = 'Start monitor';
    monitorButton.dataset['active'] = 'false';
    return;
  }

  state.monitor = createLayoutMonitor(sampleSurface, {
    debounceMs: 220,
    trackText: true,
    onTextOccupancyChange: () => {
      void runPipeline();
    },
  });
  state.monitor.start();
  monitorButton.textContent = 'Stop monitor';
  monitorButton.dataset['active'] = 'true';
}

function settle(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 140));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
