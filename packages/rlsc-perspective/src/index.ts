import type { AreaOverflowIssue, RLSCDocument, RLSCNode, ScreenIdentifier, TextOccupancy } from "@qa-sdk/rlsc-analysis";

export type PerspectiveRendererKind = "auto" | "webgl" | "canvas";
export type PerspectiveGroupBy = "dom-node" | "componentId" | "qaAddress" | "role";
export type PerspectiveCopyFormat = "identifier" | "json";

export interface PerspectiveIssue {
  readonly nodeId?: string;
  readonly parentId?: string;
  readonly childId?: string;
  readonly kind?: "containment-leak" | "text-overflow" | "custom";
  readonly message?: string;
  readonly severity?: "info" | "warning" | "error";
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
  readonly componentId?: string;
  readonly qaAddress?: string;
  readonly role?: string;
  readonly textHint?: string;
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
  readonly onHover?: (event: PerspectiveNodeEvent) => void;
  readonly onSelect?: (event: PerspectiveNodeEvent) => void;
  readonly onCopy?: (event: PerspectiveCopyEvent) => void;
}

export interface PerspectiveViewer {
  update(doc: RLSCDocument, options?: PerspectiveViewerOptions): void;
  clearSelection(): void;
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
  return createCanvasPerspectiveViewer(container, doc, options);
}

function createCanvasPerspectiveViewer(
  container: HTMLElement,
  doc: RLSCDocument,
  options: PerspectiveViewerOptions,
): PerspectiveViewer {
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  const rawContext = canvas.getContext("2d", { alpha: false });
  if (!rawContext) throw new Error("2D canvas context unavailable");
  const context: CanvasRenderingContext2D = rawContext;

  const resizeObserver = new ResizeObserver(() => update(currentDoc, currentOptions));
  resizeObserver.observe(container);

  let currentDoc = doc;
  let currentOptions = options;
  let currentLayers = createLayerModel(doc, options.groupBy, createIssueMap(options), options.copyFormat);
  let sceneNodes: CanvasSceneNode[] = [];
  let hoveredNodeId: string | null = null;
  let hoveredLayerId: string | null = null;
  let selectedLayerId: string | null = null;
  let dragState: CanvasDragState | null = null;
  let viewState: CanvasViewState = {
    yaw: 0.28,
    pitch: 0.68,
    depthX: 2.15,
    depthY: 1.35,
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  function resize(): CanvasSize {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function update(nextDoc: RLSCDocument, nextOptions: PerspectiveViewerOptions = currentOptions): void {
    currentDoc = nextDoc;
    currentOptions = nextOptions;
    const issueMap = createIssueMap(currentOptions);
    currentLayers = createLayerModel(nextDoc, currentOptions.groupBy, issueMap, currentOptions.copyFormat);
    const size = resize();
    sceneNodes = projectScene(nextDoc, currentLayers, issueMap, viewState, size);

    if (hoveredNodeId && !sceneNodes.some((item) => item.node.id === hoveredNodeId)) {
      hoveredNodeId = null;
      hoveredLayerId = null;
    }
    if (selectedLayerId && !currentLayers.layers.has(selectedLayerId)) selectedLayerId = null;

    drawScene(context, size, nextDoc, sceneNodes, currentLayers, hoveredLayerId, selectedLayerId, viewState);
  }

  function setHover(nodeId: string | null): void {
    const layerId = nodeId ? currentLayers.nodeToLayer.get(nodeId) ?? null : null;
    if (nodeId === hoveredNodeId && layerId === hoveredLayerId) return;
    hoveredNodeId = nodeId;
    hoveredLayerId = layerId;
    canvas.style.cursor = hoveredLayerId ? "pointer" : "grab";
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, currentLayers, hoveredNodeId, hoveredLayerId);
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
    update(currentDoc, currentOptions);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (dragState) {
      const dx = event.offsetX - dragState.startX;
      const dy = event.offsetY - dragState.startY;
      dragState.moved ||= Math.hypot(dx, dy) > 4;
      viewState = event.shiftKey
        ? { ...viewState, panX: dragState.startPanX + dx, panY: dragState.startPanY + dy }
        : {
            ...viewState,
            yaw: clamp(dragState.startYaw + dx * 0.0028, -0.55, 0.75),
            pitch: clamp(dragState.startPitch + dy * 0.0024, 0.36, 0.95),
          };
      canvas.style.cursor = "grabbing";
      update(currentDoc, currentOptions);
      return;
    }

    setHover(hitTest({ x: event.offsetX, y: event.offsetY }, sceneNodes)?.node.id ?? null);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    dragState = {
      startX: event.offsetX,
      startY: event.offsetY,
      startYaw: viewState.yaw,
      startPitch: viewState.pitch,
      startPanX: viewState.panX,
      startPanY: viewState.panY,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  }

  function handlePointerUp(event: PointerEvent): void {
    const wasClick = dragState !== null && !dragState.moved;
    dragState = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    setHover(hitTest({ x: event.offsetX, y: event.offsetY }, sceneNodes)?.node.id ?? null);
    canvas.style.cursor = hoveredLayerId ? "pointer" : "grab";
    if (wasClick) selectHovered();
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const nextZoom = clamp(viewState.zoom * Math.exp(-event.deltaY * 0.0011), 0.45, 2.6);
    viewState = { ...viewState, zoom: nextZoom };
    update(currentDoc, currentOptions);
  }

  function clearHover(): void {
    setHover(null);
  }

  function selectHovered(): void {
    selectedLayerId = hoveredLayerId;
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, currentLayers, hoveredNodeId, selectedLayerId);
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, selectedLayerId));
    canvas.focus();
    update(currentDoc, currentOptions);
  }

  function handleCopy(event: ClipboardEvent): void {
    if (!selectedLayerId) return;
    const detail = copyEvent(currentDoc, currentLayers, selectedLayerId);
    event.clipboardData?.setData("text/plain", detail.text);
    event.preventDefault();
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!selectedLayerId || event.key.toLowerCase() !== "c" || (!event.metaKey && !event.ctrlKey)) return;
    const detail = copyEvent(currentDoc, currentLayers, selectedLayerId);
    void navigator.clipboard?.writeText(detail.text).catch(() => undefined);
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function clearSelection(): void {
    selectedLayerId = null;
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, currentLayers, null, null);
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, null, null));
    update(currentDoc, currentOptions);
  }

  function dispose(): void {
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerup", handlePointerUp);
    canvas.removeEventListener("pointerleave", clearHover);
    canvas.removeEventListener("copy", handleCopy);
    canvas.removeEventListener("keydown", handleKeyDown);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.remove();
  }

  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", clearHover);
  canvas.addEventListener("copy", handleCopy);
  canvas.addEventListener("keydown", handleKeyDown);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  update(doc, options);

  return { update, clearSelection, dispose };
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

interface FlatNode {
  readonly node: RLSCNode;
  readonly depth: number;
  readonly parent?: RLSCNode;
}

interface CanvasSceneNode extends FlatNode {
  readonly layerId: string;
  readonly issue?: PerspectiveIssue;
  readonly points: readonly [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint];
  readonly center: CanvasPoint;
  readonly parentCenter?: CanvasPoint;
}

interface CanvasViewState {
  readonly yaw: number;
  readonly pitch: number;
  readonly depthX: number;
  readonly depthY: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

interface ProjectionFrame {
  readonly scale: number;
  readonly zCenter: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface CanvasDragState {
  readonly startX: number;
  readonly startY: number;
  readonly startYaw: number;
  readonly startPitch: number;
  readonly startPanX: number;
  readonly startPanY: number;
  moved: boolean;
}

function projectScene(
  doc: RLSCDocument,
  model: LayerModel,
  issueMap: ReadonlyMap<string, readonly PerspectiveIssue[]>,
  view: CanvasViewState,
  size: CanvasSize,
): CanvasSceneNode[] {
  const flat = flattenVisibleNodes(doc.root, 0, null).sort(
    (a, b) => a.depth - b.depth || a.node.rect.y - b.node.rect.y || a.node.rect.x - b.node.rect.x,
  );
  const frame = createProjectionFrame(doc, flat, view, size);
  const project = (x: number, y: number, z: number): CanvasPoint => projectPoint(doc, view, frame, x, y, z);

  return flat
    .map((item) => {
      const z = nodeDepth(item);
      const left = item.node.rect.x;
      const top = item.node.rect.y;
      const right = left + item.node.rect.width;
      const bottom = top + item.node.rect.height;
      const points = [
        project(left, top, z),
        project(right, top, z),
        project(right, bottom, z),
        project(left, bottom, z),
      ] as const;
      const parentCenter = item.parent
        ? project(
            item.parent.rect.x + item.parent.rect.width / 2,
            item.parent.rect.y + item.parent.rect.height / 2,
            parentDepth(item),
          )
        : undefined;
      return {
        ...item,
        layerId: model.nodeToLayer.get(item.node.id) ?? item.node.id,
        issue: primaryIssue(issueMap.get(item.node.id) ?? []),
        points,
        center: project(left + item.node.rect.width / 2, top + item.node.rect.height / 2, z),
        parentCenter,
      };
    });
}

function createProjectionFrame(
  doc: RLSCDocument,
  flat: readonly FlatNode[],
  view: CanvasViewState,
  size: CanvasSize,
): ProjectionFrame {
  const scale = Math.min(size.width / doc.viewport.width, size.height / doc.viewport.height) * 0.62 * view.zoom;
  const zValues = flat.map((item) => nodeDepth(item));
  const minZ = Math.min(...zValues, 0);
  const maxZ = Math.max(...zValues, 0);
  const zCenter = (minZ + maxZ) / 2;
  const points = flat.flatMap((item) => {
    const z = nodeDepth(item);
    const { x, y, width, height } = item.node.rect;
    return [
      rawProjectPoint(doc, view, scale, zCenter, x, y, z),
      rawProjectPoint(doc, view, scale, zCenter, x + width, y, z),
      rawProjectPoint(doc, view, scale, zCenter, x + width, y + height, z),
      rawProjectPoint(doc, view, scale, zCenter, x, y + height, z),
    ];
  });
  const bounds = pointBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    zCenter,
    offsetX: size.width / 2 - centerX + view.panX,
    offsetY: size.height / 2 - centerY + view.panY,
  };
}

function projectPoint(
  doc: RLSCDocument,
  view: CanvasViewState,
  frame: ProjectionFrame,
  x: number,
  y: number,
  z: number,
): CanvasPoint {
  const point = rawProjectPoint(doc, view, frame.scale, frame.zCenter, x, y, z);
  return { x: point.x + frame.offsetX, y: point.y + frame.offsetY };
}

function rawProjectPoint(
  doc: RLSCDocument,
  view: CanvasViewState,
  scale: number,
  zCenter: number,
  x: number,
  y: number,
  z: number,
): CanvasPoint {
  const localX = x - doc.viewport.width / 2;
  const localY = y - doc.viewport.height / 2;
  const localZ = z - zCenter;
  return {
    x: localX * scale + localY * scale * view.yaw + localZ * view.depthX * view.zoom,
    y: localY * scale * view.pitch - localZ * view.depthY * view.zoom,
  };
}

function pointBounds(points: readonly CanvasPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function nodeDepth(item: FlatNode): number {
  return item.depth * 18 + Math.max(0, item.node.zIndex) / 140;
}

function parentDepth(item: FlatNode): number {
  return Math.max(0, item.depth - 1) * 18 + Math.max(0, item.parent?.zIndex ?? 0) / 140;
}

function drawScene(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  doc: RLSCDocument,
  nodes: readonly CanvasSceneNode[],
  model: LayerModel,
  hoveredLayerId: string | null,
  selectedLayerId: string | null,
  view: CanvasViewState,
): void {
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, size.width, size.height);
  drawPerspectiveGrid(context, size, doc, view);

  for (const node of nodes) {
    if (node.parentCenter) {
      context.save();
      context.strokeStyle = "rgba(71, 85, 105, 0.28)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(node.parentCenter.x, node.parentCenter.y);
      context.lineTo(node.center.x, node.center.y);
      context.stroke();
      context.restore();
    }
  }

  for (const node of nodes) drawSceneNode(context, node, hoveredLayerId, selectedLayerId);

  const activeLayerId = hoveredLayerId ?? selectedLayerId;
  const activeNode = activeLayerId ? [...nodes].reverse().find((node) => node.layerId === activeLayerId) : undefined;
  if (activeNode && activeLayerId) drawNodeLabel(context, activeNode, model.layers.get(activeLayerId));
}

function drawPerspectiveGrid(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  doc: RLSCDocument,
  view: CanvasViewState,
): void {
  const flat = flattenVisibleNodes(doc.root, 0, null);
  const frame = createProjectionFrame(doc, flat, view, size);
  const project = (x: number, y: number): CanvasPoint => projectPoint(doc, view, frame, x, y, 0);

  context.save();
  context.lineWidth = 1;
  context.strokeStyle = "rgba(148, 163, 184, 0.22)";
  for (let x = 0; x <= doc.viewport.width; x += 80) drawLine(context, project(x, 0), project(x, doc.viewport.height));
  for (let y = 0; y <= doc.viewport.height; y += 80) drawLine(context, project(0, y), project(doc.viewport.width, y));
  context.strokeStyle = "rgba(71, 85, 105, 0.36)";
  context.lineWidth = 1.5;
  drawLine(context, project(0, 0), project(doc.viewport.width, 0));
  drawLine(context, project(doc.viewport.width, 0), project(doc.viewport.width, doc.viewport.height));
  drawLine(context, project(doc.viewport.width, doc.viewport.height), project(0, doc.viewport.height));
  drawLine(context, project(0, doc.viewport.height), project(0, 0));
  context.restore();
}

function drawSceneNode(
  context: CanvasRenderingContext2D,
  item: CanvasSceneNode,
  hoveredLayerId: string | null,
  selectedLayerId: string | null,
): void {
  const isHovered = hoveredLayerId === item.layerId;
  const isSelected = selectedLayerId === item.layerId;
  const color = issueColor(item.issue) ?? colorForNode(item.node, item.depth);
  const faded = hoveredLayerId !== null && !isHovered;
  const baseAlpha = item.issue ? 0.86 : item.node.children.length > 0 ? 0.34 : 0.68;
  const alpha = faded ? 0.12 : isHovered ? 0.94 : isSelected ? 0.88 : baseAlpha;

  context.save();
  context.beginPath();
  context.moveTo(item.points[0].x, item.points[0].y);
  context.lineTo(item.points[1].x, item.points[1].y);
  context.lineTo(item.points[2].x, item.points[2].y);
  context.lineTo(item.points[3].x, item.points[3].y);
  context.closePath();
  context.shadowColor = isHovered || isSelected ? "rgba(15, 23, 42, 0.22)" : "transparent";
  context.shadowBlur = isHovered || isSelected ? 10 : 0;
  context.shadowOffsetY = isHovered || isSelected ? 4 : 0;
  context.fillStyle = cssColor(isHovered ? 0xffd43b : isSelected ? 0x40c057 : color, alpha);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = item.issue
    ? "rgba(185, 28, 28, 0.9)"
    : isHovered
      ? "rgba(111, 76, 0, 0.95)"
      : isSelected
        ? "rgba(22, 101, 52, 0.95)"
        : "rgba(30, 41, 59, 0.46)";
  context.lineWidth = isHovered || isSelected || item.issue ? 2.5 : 1;
  context.stroke();
  context.restore();
}

function drawNodeLabel(context: CanvasRenderingContext2D, item: CanvasSceneNode, layer: PerspectiveLayer | undefined): void {
  const text = layer?.value ?? item.node.id;
  const label = text.length > 42 ? `${text.slice(0, 39)}...` : text;
  const x = clamp(item.center.x + 10, 8, context.canvas.clientWidth - 180);
  const y = clamp(item.center.y - 26, 8, context.canvas.clientHeight - 34);
  context.save();
  context.font = "12px ui-sans-serif, system-ui, sans-serif";
  const width = Math.min(176, Math.max(64, context.measureText(label).width + 18));
  context.fillStyle = "rgba(15, 23, 42, 0.86)";
  context.beginPath();
  context.roundRect(x, y, width, 26, 6);
  context.fill();
  context.fillStyle = "#f8fafc";
  context.fillText(label, x + 9, y + 17);
  context.restore();
}

function drawLine(context: CanvasRenderingContext2D, from: CanvasPoint, to: CanvasPoint): void {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function hitTest(point: CanvasPoint, nodes: readonly CanvasSceneNode[]): CanvasSceneNode | undefined {
  return [...nodes].reverse().find((item) => pointInPolygon(point, item.points));
}

function createIssueMap(options: PerspectiveViewerOptions): Map<string, readonly PerspectiveIssue[]> {
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
      kind: "containment-leak",
      message: `Child exceeds parent by ${issue.exceededPx.toFixed(1)}px`,
      severity: "error",
    });
  }
  for (const occupancy of options.textOccupancies ?? []) {
    if (!occupancy.overflows) continue;
    addIssue(occupancy.nodeId, {
      nodeId: occupancy.nodeId,
      kind: "text-overflow",
      message: "Text overflows its visual content area",
      severity: "warning",
    });
  }
  return result;
}

function primaryIssue(issues: readonly PerspectiveIssue[]): PerspectiveIssue | undefined {
  const rank = { error: 3, warning: 2, info: 1 } as const;
  return [...issues].sort((a, b) => rank[b.severity ?? "warning"] - rank[a.severity ?? "warning"])[0];
}

function issueColor(issue: PerspectiveIssue | undefined): number | undefined {
  if (!issue) return undefined;
  return issue.color ?? ISSUE_COLORS[issue.severity ?? "warning"];
}

function colorForNode(node: RLSCNode, depth: number): number {
  if (node.role && ROLE_COLORS[node.role]) return ROLE_COLORS[node.role];
  if (node.tag === "button" || node.tag === "select") return 0xd59a32;
  if (node.tag === "form") return 0x1b8f75;
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
  groupBy: PerspectiveGroupBy = "dom-node",
  issueMap: ReadonlyMap<string, readonly PerspectiveIssue[]> = new Map(),
  copyFormat: PerspectiveCopyFormat = "identifier",
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
    const preferred = [...entry.nodes].sort(
      (a, b) => identifierRank(a) - identifierRank(b) || b.rect.width * b.rect.height - a.rect.width * a.rect.height,
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
  if (groupBy === "componentId") return node.identifier?.componentId ?? node.attributes["data-component-id"] ?? node.id;
  if (groupBy === "qaAddress") return node.identifier?.qaAddress ?? node.address ?? node.attributes["data-qa-address"] ?? node.id;
  if (groupBy === "role") return node.role ?? node.tag;
  return node.id;
}

function identifierRank(node: RLSCNode): number {
  if (node.identifier?.componentId || node.attributes["data-component-id"]) return 0;
  if (node.identifier?.qaAddress || node.address || node.attributes["data-qa-address"]) return 1;
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
    selection: layer && node ? selectionDetail(layer, node, model) : undefined,
  };
}

function copyEvent(doc: RLSCDocument, model: LayerModel, layerId: string): PerspectiveCopyEvent {
  const detail = nodeEvent(doc, model, null, layerId);
  const selection = detail.selection;
  return {
    ...detail,
    text: model.copyFormat === "json"
      ? JSON.stringify(selection ?? {}, null, 2)
      : selection?.preferredIdentifier ?? detail.nodeId ?? "",
  };
}

function selectionDetail(layer: PerspectiveLayer, node: RLSCNode, model: LayerModel): PerspectiveSelectionDetail {
  const componentId = node.identifier?.componentId ?? node.attributes["data-component-id"];
  const qaAddress = node.identifier?.qaAddress ?? node.address ?? node.attributes["data-qa-address"];
  const identifier = node.identifier ?? {
    kind: componentId ? "componentId" : qaAddress ? "qaAddress" : "nodeId",
    value: componentId ?? qaAddress ?? node.id,
    componentId,
    qaAddress,
    nodeId: node.id,
  };
  return {
    nodeId: node.id,
    nodeIds: layer.nodeIds,
    identifier,
    componentId,
    qaAddress,
    role: node.role,
    textHint: node.textContent,
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
  container.dispatchEvent(new CustomEvent(name, { detail: nodeEvent(doc, model, nodeId, layerId), bubbles: true }));
}

function emitCopyEvent(container: HTMLElement, detail: PerspectiveCopyEvent): void {
  container.dispatchEvent(new CustomEvent("rlsc-perspective-copy", { detail, bubbles: true }));
}

function findNodeById(node: RLSCNode, nodeId: string): RLSCNode | undefined {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

function flattenVisibleNodes(node: RLSCNode, depth: number, parent: RLSCNode | null): FlatNode[] {
  if (!node.visible) return [];
  const current = { node, depth, parent: parent ?? undefined };
  return [current, ...node.children.flatMap((child) => flattenVisibleNodes(child, depth + 1, node))];
}

function flattenNodes(node: RLSCNode): RLSCNode[] {
  return [node, ...node.children.flatMap((child) => flattenNodes(child))];
}

function pointInPolygon(point: CanvasPoint, polygon: readonly CanvasPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const intersects = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
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
