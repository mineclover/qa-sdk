// @def.boundary rlsc
import type {
  AreaOverflowIssue,
  LayoutRect,
  RLSCDocument,
  RLSCNode,
  ScreenIdentifier,
  TextOccupancy,
} from '@qa-sdk/rlsc-analysis';

export type PerspectiveRendererKind = 'auto' | 'webgl' | 'canvas';
export type PerspectiveGroupBy = 'dom-node' | 'componentId' | 'qaAddress' | 'role';
export type PerspectiveCopyFormat = 'identifier' | 'json' | 'xpath';
export type PerspectiveViewPreset = 'default' | 'top' | 'front' | 'side';
export type PerspectiveControlMode = 'orbit' | 'x' | 'y' | 'z' | 'pan';
export type PerspectiveProjectionMode = 'orthographic' | 'perspective';

export interface PerspectiveIssue {
  readonly nodeId?: string;
  readonly parentId?: string;
  readonly childId?: string;
  readonly kind?: 'containment-leak' | 'text-overflow' | 'custom';
  readonly message?: string;
  readonly severity?: 'info' | 'warning' | 'error';
  readonly color?: number;
}

export interface PerspectiveNodeEvent {
  readonly nodeId: string | null;
  readonly node?: RLSCNode;
  readonly layerId: string | null;
  readonly layer?: PerspectiveLayer;
  readonly selection?: PerspectiveSelectionDetail;
}

export interface PerspectiveCopyEvent extends PerspectiveNodeEvent {
  readonly text: string;
}

export interface PerspectiveLayer {
  readonly id: string;
  readonly groupBy: PerspectiveGroupBy;
  readonly value: string;
  readonly nodeIds: readonly string[];
  readonly preferredNodeId: string;
}

export interface PerspectiveSelectionDetail {
  readonly nodeId: string;
  readonly nodeIds: readonly string[];
  readonly identifier: ScreenIdentifier;
  readonly rect: LayoutRect;
  readonly componentId?: string;
  readonly qaAddress?: string;
  readonly role?: string;
  readonly textHint?: string;
  readonly cssSelector?: string;
  readonly xpath?: string;
  readonly preferredIdentifier?: string;
  readonly identifierKind?: string;
  readonly issues: readonly PerspectiveIssue[];
}

export interface PerspectiveViewerOptions {
  readonly renderer?: PerspectiveRendererKind;
  readonly groupBy?: PerspectiveGroupBy;
  readonly copyFormat?: PerspectiveCopyFormat;
  readonly issues?: readonly PerspectiveIssue[];
  readonly overflowIssues?: readonly AreaOverflowIssue[];
  readonly textOccupancies?: readonly TextOccupancy[];
  readonly controlMode?: PerspectiveControlMode;
  readonly projectionMode?: PerspectiveProjectionMode;
  readonly onHover?: (event: PerspectiveNodeEvent) => void;
  readonly onSelect?: (event: PerspectiveNodeEvent) => void;
  readonly onCopy?: (event: PerspectiveCopyEvent) => void;
}

export interface PerspectiveViewer {
  update(doc: RLSCDocument, options?: PerspectiveViewerOptions): void;
  clearSelection(): void;
  fitView(): void;
  resetView(): void;
  setView(preset: PerspectiveViewPreset): void;
  setControlMode(mode: PerspectiveControlMode): void;
  setProjectionMode(mode: PerspectiveProjectionMode): void;
  dispose(): void;
}

const ROLE_COLORS: Record<string, number> = {
  article: 0x3867d6,
  banner: 0x167c63,
  form: 0xd59a32,
  list: 0x7c5cff,
  main: 0x1b8f75,
  navigation: 0x4c78a8,
};

const ISSUE_COLORS = {
  info: 0x3867d6,
  warning: 0xffd43b,
  error: 0xf03e3e,
} as const;

export function createPerspectiveViewer(
  container: HTMLElement,
  doc: RLSCDocument,
  options: PerspectiveViewerOptions = {},
): PerspectiveViewer {
  return createCss3DViewer(container, doc, options);
}

function createCss3DViewer(
  container: HTMLElement,
  doc: RLSCDocument,
  options: PerspectiveViewerOptions,
): PerspectiveViewer {
  container.innerHTML = '';

  const viewport = document.createElement('div');
  viewport.tabIndex = 0;
  viewport.className = 'rlsc-css3d-viewport';
  style(viewport, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'grab',
    outline: 'none',
    touchAction: 'none',
    userSelect: 'none',
  });

  const scene = document.createElement('div');
  scene.className = 'rlsc-css3d-scene';
  style(scene, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transformOrigin: '50% 50%',
    transformStyle: 'preserve-3d',
    pointerEvents: 'none',
  });

  viewport.appendChild(scene);
  container.appendChild(viewport);

  let currentDoc = doc;
  let currentOptions = options;
  let currentIssueMap = createIssueMap(currentOptions);
  let currentLayers = createLayerModel(
    doc,
    currentOptions.groupBy,
    currentIssueMap,
    currentOptions.copyFormat,
  );
  let elements = new Map<string, HTMLElement>();
  let hoveredNodeId: string | null = null;
  let hoveredLayerId: string | null = null;
  let selectedLayerId: string | null = null;
  let dragState: Css3DDragState | null = null;
  let suppressClick = false;
  let controlMode: PerspectiveControlMode = options.controlMode ?? 'orbit';
  let projectionMode: PerspectiveProjectionMode = options.projectionMode ?? 'orthographic';
  let viewState: Css3DViewState = createViewState('default');

  const resizeObserver = new ResizeObserver(() => render());
  resizeObserver.observe(container);

  function fitScale(): number {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const viewportWidth = Math.max(1, currentDoc.viewport.width);
    const viewportHeight = Math.max(1, currentDoc.viewport.height);
    return Math.min(width / viewportWidth, height / viewportHeight) * 0.78;
  }

  function applyTransform(): void {
    scene.style.width = `${currentDoc.viewport.width}px`;
    scene.style.height = `${currentDoc.viewport.height}px`;
    scene.style.transform = [
      'translate3d(-50%, -50%, 0)',
      `translate3d(${viewState.panX}px, ${viewState.panY}px, 0)`,
      `scale(${fitScale() * viewState.zoom})`,
      matrixToCss(viewState.rotation),
    ].join(' ');
  }

  function applyProjection(): void {
    viewport.style.perspective = projectionMode === 'perspective' ? '980px' : 'none';
    viewport.style.perspectiveOrigin = '50% 48%';
  }

  function render(): void {
    elements = new Map();
    scene.replaceChildren(createGrid(currentDoc));
    applyProjection();
    applyTransform();
    const flat = flattenVisibleNodes(currentDoc.root, 0, null).toSorted(
      (a, b) => a.depth - b.depth || a.node.rect.y - b.node.rect.y || a.node.rect.x - b.node.rect.x,
    );
    for (const item of flat) {
      const element = createNodeElement(item);
      elements.set(item.node.id, element);
      scene.appendChild(element);
    }
    if (hoveredNodeId && !elements.has(hoveredNodeId)) {
      hoveredNodeId = null;
      hoveredLayerId = null;
    }
    if (selectedLayerId && !currentLayers.layers.has(selectedLayerId)) selectedLayerId = null;
    applyInteractionState();
  }

  function createGrid(nextDoc: RLSCDocument): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'rlsc-css3d-grid';
    style(grid, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${nextDoc.viewport.width}px`,
      height: `${nextDoc.viewport.height}px`,
      transform: 'translateZ(-8px)',
      transformStyle: 'preserve-3d',
      backgroundImage:
        'linear-gradient(rgba(148,163,184,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.22) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
      border: '1px solid rgba(71,85,105,.28)',
      boxSizing: 'border-box',
      pointerEvents: 'none',
    });
    return grid;
  }

  function createNodeElement(item: FlatNode): HTMLElement {
    const node = item.node;
    const issue = primaryIssue(currentIssueMap.get(node.id) ?? []);
    const layerId = currentLayers.nodeToLayer.get(node.id) ?? node.id;
    const color = issueColor(issue) ?? colorForNode(node, item.depth);
    const background = cssColor(color, issue ? 0.82 : node.children.length > 0 ? 0.32 : 0.68);
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'rlsc-css3d-node';
    element.dataset['nodeId'] = node.id;
    element.dataset['layerId'] = layerId;
    element.dataset['baseBackground'] = background;
    element.title = nodeLabel(node, currentLayers.layers.get(layerId));
    element.setAttribute('aria-label', element.title);
    style(element, {
      position: 'absolute',
      left: `${node.rect.x}px`,
      top: `${node.rect.y}px`,
      width: `${Math.max(2, node.rect.width)}px`,
      height: `${Math.max(2, node.rect.height)}px`,
      margin: '0',
      padding: '0',
      border: `2px solid ${issue ? 'rgba(185,28,28,.92)' : 'rgba(30,41,59,.52)'}`,
      borderRadius: '3px',
      background,
      boxSizing: 'border-box',
      transform: `translateZ(${nodeDepth(item)}px)`,
      transformStyle: 'preserve-3d',
      backfaceVisibility: 'visible',
      pointerEvents: 'auto',
      cursor: 'pointer',
      outline: 'none',
    });
    element.addEventListener('pointerover', (event) => {
      event.stopPropagation();
      if (!dragState) setHover(node.id);
    });
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (suppressClick) return;
      setHover(node.id);
      selectHovered();
    });
    return element;
  }

  function applyInteractionState(): void {
    for (const [nodeId, element] of elements) {
      const layerId = element.dataset['layerId'] ?? nodeId;
      const isHovered = hoveredLayerId === layerId;
      const isSelected = selectedLayerId === layerId;
      const issue = primaryIssue(currentIssueMap.get(nodeId) ?? []);
      const baseBackground = element.dataset['baseBackground'] ?? element.style.background;
      element.style.opacity = '1';
      element.dataset['interactionState'] =
        isSelected && isHovered
          ? 'selected-hover'
          : isSelected
            ? 'selected'
            : isHovered
              ? 'hover'
              : 'idle';
      element.style.boxShadow =
        isSelected && isHovered
          ? '0 0 0 3px rgba(255,255,255,.98), 0 0 0 9px rgba(14,165,233,.76), 0 18px 44px rgba(8,47,73,.38)'
          : isSelected
            ? '0 0 0 3px rgba(255,255,255,.92), 0 0 0 8px rgba(14,165,233,.66), 0 14px 36px rgba(8,47,73,.3)'
            : isHovered
              ? '0 0 0 5px rgba(245,158,11,.5), 0 14px 34px rgba(15,23,42,.24)'
              : 'none';
      element.style.borderColor = isSelected
        ? 'rgba(2,132,199,.98)'
        : isHovered
          ? 'rgba(146,64,14,.98)'
          : issue
            ? 'rgba(185,28,28,.92)'
            : 'rgba(30,41,59,.52)';
      element.style.background = isSelected
        ? 'rgba(14,165,233,.74)'
        : isHovered
          ? 'rgba(245,158,11,.7)'
          : baseBackground;
      element.style.filter = isSelected || isHovered ? 'saturate(1.22) contrast(1.08)' : 'none';
    }
  }

  function setHover(nodeId: string | null): void {
    const layerId = nodeId ? (currentLayers.nodeToLayer.get(nodeId) ?? null) : null;
    if (nodeId === hoveredNodeId && layerId === hoveredLayerId) return;
    hoveredNodeId = nodeId;
    hoveredLayerId = layerId;
    viewport.style.cursor = hoveredLayerId ? 'pointer' : 'grab';
    applyInteractionState();
    emitNodeEvent(
      container,
      'rlsc-perspective-hover',
      currentDoc,
      currentLayers,
      hoveredNodeId,
      hoveredLayerId,
    );
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
  }

  function selectHovered(): void {
    selectedLayerId = hoveredLayerId;
    applyInteractionState();
    emitNodeEvent(
      container,
      'rlsc-perspective-select',
      currentDoc,
      currentLayers,
      hoveredNodeId,
      selectedLayerId,
    );
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, selectedLayerId));
    viewport.focus();
  }

  function update(nextDoc: RLSCDocument, nextOptions: PerspectiveViewerOptions = {}): void {
    currentDoc = nextDoc;
    currentOptions = { ...currentOptions, ...nextOptions };
    currentIssueMap = createIssueMap(currentOptions);
    currentLayers = createLayerModel(
      nextDoc,
      currentOptions.groupBy,
      currentIssueMap,
      currentOptions.copyFormat,
    );
    controlMode = currentOptions.controlMode ?? controlMode;
    projectionMode = currentOptions.projectionMode ?? projectionMode;
    render();
  }

  function clearSelection(): void {
    selectedLayerId = null;
    applyInteractionState();
    emitNodeEvent(container, 'rlsc-perspective-select', currentDoc, currentLayers, null, null);
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, null, null));
  }

  function fitView(): void {
    viewState = { ...viewState, zoom: 1, panX: 0, panY: 0 };
    applyTransform();
  }

  function resetView(): void {
    viewState = createViewState('default');
    applyTransform();
  }

  function setView(preset: PerspectiveViewPreset): void {
    viewState = createViewState(preset);
    applyTransform();
  }

  function setControlMode(mode: PerspectiveControlMode): void {
    controlMode = mode;
    viewport.style.cursor = 'grab';
  }

  function setProjectionMode(mode: PerspectiveProjectionMode): void {
    projectionMode = mode;
    applyProjection();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (![0, 1, 2].includes(event.button)) return;
    const mode = dragMode(event, controlMode);
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      startRotation: viewState.rotation,
      startPanX: viewState.panX,
      startPanY: viewState.panY,
      mode,
      moved: false,
    };
    suppressClick = false;
    viewport.setPointerCapture(event.pointerId);
    viewport.style.cursor = 'grabbing';
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    dragState.moved ||= Math.hypot(dx, dy) > 4;
    suppressClick = dragState.moved;
    const mode = dragMode(event, dragState.mode);
    viewState =
      mode === 'pan'
        ? { ...viewState, panX: dragState.startPanX + dx, panY: dragState.startPanY + dy }
        : {
            ...viewState,
            rotation: dragRotationMatrix(mode, dx, dy).multiply(dragState.startRotation),
          };
    applyTransform();
  }

  function handlePointerUp(event: PointerEvent): void {
    const shouldSelect = dragState !== null && !dragState.moved;
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    viewport.style.cursor = hoveredLayerId ? 'pointer' : 'grab';
    dragState = null;
    if (shouldSelect) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('.rlsc-css3d-node');
      const nodeId = target?.dataset['nodeId'] ?? null;
      if (nodeId) {
        setHover(nodeId);
        selectHovered();
      }
    }
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
  }

  function handlePointerLeave(): void {
    if (!dragState) setHover(null);
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    viewState = {
      ...viewState,
      zoom: clamp(viewState.zoom * Math.exp(-event.deltaY * 0.0011), 0.32, 3.2),
    };
    applyTransform();
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  function handleCopy(event: ClipboardEvent): void {
    if (!selectedLayerId) return;
    const detail = copyEvent(currentDoc, currentLayers, selectedLayerId);
    event.clipboardData?.setData('text/plain', detail.text);
    event.preventDefault();
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!selectedLayerId || event.key.toLowerCase() !== 'c' || (!event.metaKey && !event.ctrlKey))
      return;
    const detail = copyEvent(currentDoc, currentLayers, selectedLayerId);
    void navigator.clipboard?.writeText(detail.text).catch(() => undefined);
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function dispose(): void {
    resizeObserver.disconnect();
    viewport.removeEventListener('pointerdown', handlePointerDown);
    viewport.removeEventListener('pointermove', handlePointerMove);
    viewport.removeEventListener('pointerup', handlePointerUp);
    viewport.removeEventListener('pointerleave', handlePointerLeave);
    viewport.removeEventListener('wheel', handleWheel);
    viewport.removeEventListener('contextmenu', handleContextMenu);
    viewport.removeEventListener('copy', handleCopy);
    viewport.removeEventListener('keydown', handleKeyDown);
    viewport.remove();
  }

  viewport.addEventListener('pointerdown', handlePointerDown);
  viewport.addEventListener('pointermove', handlePointerMove);
  viewport.addEventListener('pointerup', handlePointerUp);
  viewport.addEventListener('pointerleave', handlePointerLeave);
  viewport.addEventListener('wheel', handleWheel, { passive: false });
  viewport.addEventListener('contextmenu', handleContextMenu);
  viewport.addEventListener('copy', handleCopy);
  viewport.addEventListener('keydown', handleKeyDown);
  render();

  return {
    update,
    clearSelection,
    fitView,
    resetView,
    setView,
    setControlMode,
    setProjectionMode,
    dispose,
  };
}

interface FlatNode {
  readonly node: RLSCNode;
  readonly depth: number;
  readonly parent?: RLSCNode;
}

interface Css3DViewState {
  readonly rotation: DOMMatrix;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

interface Css3DDragState {
  readonly startX: number;
  readonly startY: number;
  readonly startRotation: DOMMatrix;
  readonly startPanX: number;
  readonly startPanY: number;
  readonly mode: DragMode;
  moved: boolean;
}

type DragMode = PerspectiveControlMode | 'auto-axis';

function nodeDepth(item: FlatNode): number {
  return item.depth * 38 + Math.max(0, item.node.zIndex) / 80;
}

function nodeLabel(node: RLSCNode, layer: PerspectiveLayer | undefined): string {
  const identifier =
    node.identifier?.value ??
    node.identifier?.componentId ??
    node.identifier?.qaAddress ??
    node.address;
  return identifier ?? layer?.value ?? node.id;
}

function style(element: HTMLElement, next: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, next);
}

function createViewState(preset: PerspectiveViewPreset): Css3DViewState {
  return { rotation: presetRotationMatrix(preset), zoom: 1, panX: 0, panY: 0 };
}

function presetRotationMatrix(preset: PerspectiveViewPreset): DOMMatrix {
  if (preset === 'top') return new DOMMatrix();
  if (preset === 'front') return new DOMMatrix().rotateSelf(72, 0, 0);
  if (preset === 'side') return new DOMMatrix().rotateSelf(70, 0, 90);
  return new DOMMatrix().rotateSelf(62, 0, -18);
}

function dragRotationMatrix(mode: DragMode, dx: number, dy: number): DOMMatrix {
  if (mode === 'auto-axis') return dragRotationMatrix(resolveAutoAxis(dx, dy), dx, dy);
  if (mode === 'x') return new DOMMatrix().rotateAxisAngleSelf(1, 0, 0, -dy * 0.28);
  if (mode === 'y') return new DOMMatrix().rotateAxisAngleSelf(0, 1, 0, dx * 0.34);
  if (mode === 'z') return new DOMMatrix().rotateAxisAngleSelf(0, 0, 1, dx * 0.34);
  return new DOMMatrix()
    .rotateAxisAngleSelf(0, 1, 0, dx * 0.34)
    .rotateAxisAngleSelf(1, 0, 0, -dy * 0.28);
}

function dragMode(event: PointerEvent, configuredMode: DragMode): DragMode {
  if (event.altKey)
    return configuredMode === 'orbit' || configuredMode === 'pan' ? 'auto-axis' : configuredMode;
  if (event.button === 1 || event.button === 2 || event.buttons === 4 || event.buttons === 2)
    return 'pan';
  return 'pan';
}

function resolveAutoAxis(dx: number, dy: number): 'x' | 'y' {
  return Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x';
}

function matrixToCss(matrix: DOMMatrix): string {
  const values = [
    matrix.m11,
    matrix.m12,
    matrix.m13,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    matrix.m23,
    matrix.m24,
    matrix.m31,
    matrix.m32,
    matrix.m33,
    matrix.m34,
    matrix.m41,
    matrix.m42,
    matrix.m43,
    matrix.m44,
  ];
  return `matrix3d(${values.map((value) => cleanMatrixValue(value)).join(',')})`;
}

function cleanMatrixValue(value: number): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return Number(normalized.toFixed(10)).toString();
}

function createIssueMap(
  options: PerspectiveViewerOptions,
): Map<string, readonly PerspectiveIssue[]> {
  const result = new Map<string, PerspectiveIssue[]>();
  const addIssue = (nodeId: string | undefined, issue: PerspectiveIssue): void => {
    if (!nodeId) return;
    const issues = result.get(nodeId) ?? [];
    issues.push(issue);
    result.set(nodeId, issues);
  };
  for (const issue of options.issues ?? []) {
    for (const id of [issue.nodeId, issue.childId, issue.parentId]) addIssue(id, issue);
  }
  for (const issue of options.overflowIssues ?? []) {
    addIssue(issue.childId, {
      childId: issue.childId,
      parentId: issue.parentId,
      kind: 'containment-leak',
      message: `Child exceeds parent by ${issue.exceededPx.toFixed(1)}px`,
      severity: 'error',
    });
  }
  for (const occupancy of options.textOccupancies ?? []) {
    if (!occupancy.overflows) continue;
    addIssue(occupancy.nodeId, {
      nodeId: occupancy.nodeId,
      kind: 'text-overflow',
      message: 'Text overflows its visual content area',
      severity: 'warning',
    });
  }
  return result;
}

function primaryIssue(issues: readonly PerspectiveIssue[]): PerspectiveIssue | undefined {
  const rank = { error: 3, warning: 2, info: 1 } as const;
  return [...issues].toSorted(
    (a, b) => rank[b.severity ?? 'warning'] - rank[a.severity ?? 'warning'],
  )[0];
}

function issueColor(issue: PerspectiveIssue | undefined): number | undefined {
  if (!issue) return undefined;
  return issue.color ?? ISSUE_COLORS[issue.severity ?? 'warning'];
}

function colorForNode(node: RLSCNode, depth: number): number {
  if (node.role && ROLE_COLORS[node.role]) return ROLE_COLORS[node.role];
  if (node.tag === 'button' || node.tag === 'select') return 0xd59a32;
  if (node.tag === 'form') return 0x1b8f75;
  if (node.textContent) return 0x3867d6;
  return [0x91a7ff, 0x63c7b2, 0xf6bd60, 0x7c5cff, 0x6ca6c1][depth % 5] ?? 0x91a7ff;
}

interface LayerModel {
  readonly groupBy: PerspectiveGroupBy;
  readonly copyFormat: PerspectiveCopyFormat;
  readonly layers: ReadonlyMap<string, PerspectiveLayer>;
  readonly nodeToLayer: ReadonlyMap<string, string>;
  readonly issueMap: ReadonlyMap<string, readonly PerspectiveIssue[]>;
}

function createLayerModel(
  doc: RLSCDocument,
  groupBy: PerspectiveGroupBy = 'dom-node',
  issueMap: ReadonlyMap<string, readonly PerspectiveIssue[]> = new Map(),
  copyFormat: PerspectiveCopyFormat = 'identifier',
): LayerModel {
  const layerEntries = new Map<string, { value: string; nodes: RLSCNode[] }>();
  for (const node of flattenNodes(doc.root).filter((item) => item.visible)) {
    const value = layerValue(node, groupBy);
    const id = `${groupBy}:${value}`;
    const entry = layerEntries.get(id) ?? { value, nodes: [] };
    entry.nodes.push(node);
    layerEntries.set(id, entry);
  }

  const layers = new Map<string, PerspectiveLayer>();
  const nodeToLayer = new Map<string, string>();
  for (const [id, entry] of layerEntries) {
    const preferred = [...entry.nodes].toSorted(
      (a, b) =>
        identifierRank(a) - identifierRank(b) ||
        b.rect.width * b.rect.height - a.rect.width * a.rect.height,
    )[0];
    if (!preferred) continue;
    const layer = {
      id,
      groupBy,
      value: entry.value,
      nodeIds: entry.nodes.map((node) => node.id),
      preferredNodeId: preferred.id,
    } satisfies PerspectiveLayer;
    layers.set(id, layer);
    for (const node of entry.nodes) nodeToLayer.set(node.id, id);
  }
  return { groupBy, copyFormat, layers, nodeToLayer, issueMap };
}

function layerValue(node: RLSCNode, groupBy: PerspectiveGroupBy): string {
  if (groupBy === 'componentId')
    return node.identifier?.componentId ?? node.attributes['data-component-id'] ?? node.id;
  if (groupBy === 'qaAddress')
    return (
      node.identifier?.qaAddress ?? node.address ?? node.attributes['data-qa-address'] ?? node.id
    );
  if (groupBy === 'role') return node.role ?? node.tag;
  return node.id;
}

function identifierRank(node: RLSCNode): number {
  if (node.identifier?.componentId || node.attributes['data-component-id']) return 0;
  if (node.identifier?.qaAddress || node.address || node.attributes['data-qa-address']) return 1;
  if (node.textContent) return 2;
  return 3;
}

function nodeEvent(
  doc: RLSCDocument,
  model: LayerModel,
  nodeId: string | null,
  layerId: string | null,
): PerspectiveNodeEvent {
  const layer = layerId ? model.layers.get(layerId) : undefined;
  const preferredNodeId = layer?.preferredNodeId ?? nodeId;
  const node = preferredNodeId ? findNodeById(doc.root, preferredNodeId) : undefined;
  return {
    nodeId: preferredNodeId ?? null,
    node,
    layerId,
    layer,
    selection: layer && node ? selectionDetail(doc.root, layer, node, model) : undefined,
  };
}

function copyEvent(doc: RLSCDocument, model: LayerModel, layerId: string): PerspectiveCopyEvent {
  const detail = nodeEvent(doc, model, null, layerId);
  const selection = detail.selection;
  return {
    ...detail,
    text: copyText(model.copyFormat, selection, detail.nodeId),
  };
}

function copyText(
  format: PerspectiveCopyFormat,
  selection: PerspectiveSelectionDetail | undefined,
  nodeId: string | null,
): string {
  if (format === 'json') return JSON.stringify(selection ?? {}, null, 2);
  if (format === 'xpath') {
    return (
      selection?.xpath ?? selection?.cssSelector ?? selection?.preferredIdentifier ?? nodeId ?? ''
    );
  }
  return selection?.preferredIdentifier ?? nodeId ?? '';
}

function selectionDetail(
  root: RLSCNode,
  layer: PerspectiveLayer,
  node: RLSCNode,
  model: LayerModel,
): PerspectiveSelectionDetail {
  const componentId = node.identifier?.componentId ?? node.attributes['data-component-id'];
  const qaAddress =
    node.identifier?.qaAddress ?? node.address ?? node.attributes['data-qa-address'];
  const cssSelector = node.identifier?.cssSelector;
  const identifier = node.identifier ?? {
    kind: componentId ? 'componentId' : qaAddress ? 'qaAddress' : 'nodeId',
    value: componentId ?? qaAddress ?? node.id,
    componentId,
    qaAddress,
    cssSelector,
    nodeId: node.id,
  };
  return {
    nodeId: node.id,
    nodeIds: layer.nodeIds,
    identifier,
    rect: node.rect,
    componentId,
    qaAddress,
    role: node.role,
    textHint: node.textContent,
    cssSelector,
    xpath: node.identifier?.xpath ?? createNodeXPath(root, node.id),
    preferredIdentifier: identifier.value,
    identifierKind: identifier.kind,
    issues: layer.nodeIds.flatMap((nodeId) => model.issueMap.get(nodeId) ?? []),
  };
}

function emitNodeEvent(
  container: HTMLElement,
  name: string,
  doc: RLSCDocument,
  model: LayerModel,
  nodeId: string | null,
  layerId: string | null,
): void {
  container.dispatchEvent(
    new CustomEvent(name, { detail: nodeEvent(doc, model, nodeId, layerId), bubbles: true }),
  );
}

function emitCopyEvent(container: HTMLElement, detail: PerspectiveCopyEvent): void {
  container.dispatchEvent(new CustomEvent('rlsc-perspective-copy', { detail, bubbles: true }));
}

function findNodeById(node: RLSCNode, nodeId: string): RLSCNode | undefined {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

function createNodeXPath(root: RLSCNode, nodeId: string): string | undefined {
  const path = findNodePath(root, nodeId);
  if (!path) return undefined;
  return `/${path.map((node, index) => xpathSegment(node, path[index - 1])).join('/')}`;
}

function findNodePath(node: RLSCNode, nodeId: string): RLSCNode[] | undefined {
  if (node.id === nodeId) return [node];
  for (const child of node.children) {
    const childPath = findNodePath(child, nodeId);
    if (childPath) return [node, ...childPath];
  }
  return undefined;
}

function xpathSegment(node: RLSCNode, parent: RLSCNode | undefined): string {
  const tag = node.tag.toLowerCase();
  const siblings = parent?.children.filter((child) => child.tag.toLowerCase() === tag) ?? [node];
  const index = Math.max(1, siblings.findIndex((sibling) => sibling.id === node.id) + 1);
  return `${tag}[${index}]`;
}

function flattenVisibleNodes(node: RLSCNode, depth: number, parent: RLSCNode | null): FlatNode[] {
  if (!node.visible) return [];
  const current = { node, depth, parent: parent ?? undefined };
  return [
    current,
    ...node.children.flatMap((child) => flattenVisibleNodes(child, depth + 1, node)),
  ];
}

function flattenNodes(node: RLSCNode): RLSCNode[] {
  return [node, ...node.children.flatMap((child) => flattenNodes(child))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cssColor(color: number, alpha: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
