import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

const VIEW_SCALE = 130;
const DEPTH_GAP = 0.24;
const MIN_THICKNESS = 0.025;
const ISSUE_COLORS = {
  info: 0x3867d6,
  warning: 0xffd43b,
  error: 0xf03e3e,
} as const;

/**
 * WebGL 컨텍스트 사전 체크 — `new WebGLRenderer()` 는 컨텍스트 생성 실패 시 throw 하지 않고
 * 콘솔 에러만 로깅하므로 try/catch 만으로는 fallback 못 함.
 * (headless Chrome SwiftShader, 일부 GPU 비활성 환경)
 *
 * 별도 임시 canvas 로 `getContext("webgl2"/"webgl")` 시도 → 둘 다 실패하면 canvas 모드.
 */
function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const ctx =
      probe.getContext("webgl2") ??
      probe.getContext("webgl") ??
      probe.getContext("experimental-webgl");
    return ctx !== null;
  } catch {
    return false;
  }
}

export function createPerspectiveViewer(
  container: HTMLElement,
  doc: RLSCDocument,
  options: PerspectiveViewerOptions = {},
): PerspectiveViewer {
  container.innerHTML = "";
  if (options.renderer !== "webgl") {
    return createCanvasPerspectiveViewer(container, doc, options);
  }

  if (!isWebGLAvailable()) {
    return createCanvasPerspectiveViewer(container, doc, options);
  }

  const scene = new Scene();
  scene.background = new Color(0xf8fafc);

  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0.4, -5.2, 4.4);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    return createCanvasPerspectiveViewer(container, doc, options);
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0.8);
  controls.update();

  scene.add(new AmbientLight(0xffffff, 1.8));
  const light = new DirectionalLight(0xffffff, 2.4);
  light.position.set(2.5, -3.5, 5);
  scene.add(light);

  const root = new Group();
  scene.add(root);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const nodeMeshes = new Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>();
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  let animationFrame = 0;
  let currentDoc = doc;
  let currentOptions = options;
  let hoveredNodeId: string | null = null;
  let hoveredLayerId: string | null = null;
  let selectedLayerId: string | null = null;
  let currentIssueMap = createIssueMap(options);
  let currentLayers = createLayerModel(doc, currentOptions.groupBy, currentIssueMap, currentOptions.copyFormat);

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(): void {
    controls.update();
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  }

  function clearRoot(): void {
    nodeMeshes.clear();
    while (root.children.length > 0) {
      const child = root.children.pop();
      if (child) disposeObject(child);
    }
  }

  function update(nextDoc: RLSCDocument, nextOptions: PerspectiveViewerOptions = currentOptions): void {
    currentDoc = nextDoc;
    currentOptions = nextOptions;
    currentIssueMap = createIssueMap(nextOptions);
    currentLayers = createLayerModel(nextDoc, nextOptions.groupBy, currentIssueMap, nextOptions.copyFormat);
    clearRoot();
    root.add(new GridHelper(8, 32, 0xb7c2d0, 0xdce3ec));
    addNodeLayer(root, nextDoc.root, nextDoc.viewport, 0, null, nodeMeshes, currentIssueMap, currentLayers.nodeToLayer);
    if (hoveredNodeId && !nodeMeshes.has(hoveredNodeId)) {
      hoveredNodeId = null;
      hoveredLayerId = null;
    }
    if (selectedLayerId && !currentLayers.layers.has(selectedLayerId)) selectedLayerId = null;
    applyInteractionState(nodeMeshes, hoveredLayerId, selectedLayerId);
    resize();
    renderer.render(scene, camera);
  }

  function handlePointerMove(event: PointerEvent): void {
    const width = Math.max(1, renderer.domElement.clientWidth);
    const height = Math.max(1, renderer.domElement.clientHeight);
    pointer.x = (event.offsetX / width) * 2 - 1;
    pointer.y = -(event.offsetY / height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...nodeMeshes.values()], false)[0];
    const nextId = hit?.object.userData["nodeId"] as string | undefined;
    const nextLayerId = nextId ? currentLayers.nodeToLayer.get(nextId) ?? null : null;
    const nextHovered = nextId ?? null;
    if (nextHovered === hoveredNodeId && nextLayerId === hoveredLayerId) return;

    hoveredNodeId = nextHovered;
    hoveredLayerId = nextLayerId;
    renderer.domElement.style.cursor = hoveredLayerId ? "pointer" : "default";
    applyInteractionState(nodeMeshes, hoveredLayerId, selectedLayerId);
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, currentLayers, hoveredNodeId, hoveredLayerId);
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
  }

  function clearHover(): void {
    if (!hoveredNodeId && !hoveredLayerId) return;
    hoveredNodeId = null;
    hoveredLayerId = null;
    renderer.domElement.style.cursor = "default";
    applyInteractionState(nodeMeshes, hoveredLayerId, selectedLayerId);
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, currentLayers, hoveredNodeId, hoveredLayerId);
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
  }

  function handleSelect(): void {
    selectedLayerId = hoveredLayerId;
    applyInteractionState(nodeMeshes, hoveredLayerId, selectedLayerId);
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, currentLayers, hoveredNodeId, selectedLayerId);
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, selectedLayerId));
    renderer.domElement.focus();
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
    applyInteractionState(nodeMeshes, hoveredLayerId, selectedLayerId);
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, currentLayers, null, null);
    currentOptions.onSelect?.(nodeEvent(currentDoc, currentLayers, null, null));
  }

  function dispose(): void {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener("pointermove", handlePointerMove);
    renderer.domElement.removeEventListener("pointerleave", clearHover);
    renderer.domElement.removeEventListener("click", handleSelect);
    renderer.domElement.removeEventListener("copy", handleCopy);
    renderer.domElement.removeEventListener("keydown", handleKeyDown);
    controls.dispose();
    clearRoot();
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  update(doc, options);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerleave", clearHover);
  renderer.domElement.addEventListener("click", handleSelect);
  renderer.domElement.addEventListener("copy", handleCopy);
  renderer.domElement.addEventListener("keydown", handleKeyDown);
  animate();

  return { update, clearSelection, dispose };
}

function addNodeLayer(
  group: Group,
  node: RLSCNode,
  viewport: RLSCDocument["viewport"],
  depth: number,
  parentCenter: Vector3 | null,
  nodeMeshes: Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>,
  issueMap: ReadonlyMap<string, readonly PerspectiveIssue[]>,
  nodeToLayer: ReadonlyMap<string, string>,
): void {
  if (!node.visible) return;

  const issue = primaryIssue(issueMap.get(node.id) ?? []);
  const width = Math.max(node.rect.width / VIEW_SCALE, 0.08);
  const height = Math.max(node.rect.height / VIEW_SCALE, 0.08);
  const thickness = MIN_THICKNESS + Math.min(0.08, Math.max(0, node.zIndex) / 6000);
  const x = (node.rect.x + node.rect.width / 2 - viewport.width / 2) / VIEW_SCALE;
  const y = -(node.rect.y + node.rect.height / 2 - viewport.height / 2) / VIEW_SCALE;
  const z = depth * DEPTH_GAP + Math.max(0, node.zIndex) / 3500;
  const center = new Vector3(x, y, z);

  const material = new MeshStandardMaterial({
    color: issueColor(issue) ?? colorForNode(node, depth),
    emissive: issue ? issueColor(issue) : 0x000000,
    metalness: 0.08,
    opacity: issue ? 0.9 : node.children.length > 0 ? 0.34 : 0.7,
    roughness: 0.72,
    transparent: true,
  });
  const mesh = new Mesh(new BoxGeometry(width, height, thickness), material);
  mesh.position.copy(center);
  mesh.userData["nodeId"] = node.id;
  mesh.userData["layerId"] = nodeToLayer.get(node.id) ?? node.id;
  mesh.userData["baseOpacity"] = material.opacity;
  mesh.userData["baseScaleZ"] = mesh.scale.z;
  mesh.userData["baseEmissive"] = material.emissive.getHex();
  group.add(mesh);
  nodeMeshes.set(node.id, mesh);

  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry),
    new LineBasicMaterial({ color: issueColor(issue) ?? 0x203045, transparent: true, opacity: 0.56 }),
  );
  edges.position.copy(center);
  group.add(edges);

  if (parentCenter) {
    group.add(
      new Line(
        new BufferGeometry().setFromPoints([parentCenter, center]),
        new LineBasicMaterial({ color: 0x6b7a90, transparent: true, opacity: 0.38 }),
      ),
    );
  }

  for (const child of node.children) {
    addNodeLayer(group, child, viewport, depth + 1, center, nodeMeshes, issueMap, nodeToLayer);
  }
}

function applyInteractionState(
  nodeMeshes: Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>,
  hoveredLayerId: string | null,
  selectedLayerId: string | null,
): void {
  for (const [nodeId, mesh] of nodeMeshes) {
    const material = mesh.material;
    const baseOpacity = mesh.userData["baseOpacity"] as number;
    const baseEmissive = mesh.userData["baseEmissive"] as number;
    const layerId = mesh.userData["layerId"] as string | undefined ?? nodeId;
    const isHovered = hoveredLayerId === layerId;
    const isSelected = selectedLayerId === layerId;
    material.opacity = hoveredLayerId ? (isHovered ? 0.98 : Math.min(baseOpacity, 0.14)) : selectedLayerId ? (isSelected ? 0.88 : baseOpacity) : baseOpacity;
    material.emissive.setHex(isHovered ? 0xffd43b : isSelected ? 0x40c057 : baseEmissive);
    mesh.scale.z = isHovered ? 3.2 : (mesh.userData["baseScaleZ"] as number);
    material.needsUpdate = true;
  }
}

function createCanvasPerspectiveViewer(
  container: HTMLElement,
  doc: RLSCDocument,
  options: PerspectiveViewerOptions,
): PerspectiveViewer {
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  const rawContext = canvas.getContext("2d");
  if (!rawContext) throw new Error("2D canvas context unavailable");
  const context: CanvasRenderingContext2D = rawContext;
  container.appendChild(canvas);

  const resizeObserver = new ResizeObserver(() => update(currentDoc, currentOptions));
  resizeObserver.observe(container);
  let currentDoc = doc;
  let currentOptions = options;
  let hoveredNodeId: string | null = null;
  let hoveredLayerId: string | null = null;
  let selectedLayerId: string | null = null;
  let currentLayers = createLayerModel(doc, currentOptions.groupBy, createIssueMap(currentOptions), currentOptions.copyFormat);
  let projectedNodes: ProjectedNode[] = [];
  let viewState: CanvasViewState = { skewX: 1.8, skewY: 1.2, zoom: 1, panX: 0, panY: 0 };
  let dragState: CanvasDragState | null = null;

  function resize(): void {
    const ratio = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function update(nextDoc: RLSCDocument, nextOptions: PerspectiveViewerOptions = currentOptions): void {
    currentDoc = nextDoc;
    currentOptions = nextOptions;
    const issueMap = createIssueMap(currentOptions);
    currentLayers = createLayerModel(nextDoc, nextOptions.groupBy, issueMap, nextOptions.copyFormat);
    resize();
    const width = container.clientWidth;
    const height = container.clientHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, width, height);
    drawGrid(context, width, height);

    const flat = [...flattenVisibleNodes(nextDoc.root, 0, null)].sort(
      (a, b) => a.depth - b.depth || a.node.rect.y - b.node.rect.y,
    );
    projectedNodes = flat.map((item) => projectNode(item, nextDoc.viewport, width, height, viewState));
    if (hoveredNodeId && !projectedNodes.some((item) => item.node.id === hoveredNodeId)) {
      hoveredNodeId = null;
      hoveredLayerId = null;
    }
    if (selectedLayerId && !currentLayers.layers.has(selectedLayerId)) selectedLayerId = null;
    for (const item of projectedNodes) {
      drawNode(context, item, hoveredLayerId, selectedLayerId, currentLayers.nodeToLayer, primaryIssue(issueMap.get(item.node.id) ?? []));
    }
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
            skewX: clamp(dragState.startSkewX + dx * 0.018, -3.2, 3.2),
            skewY: clamp(dragState.startSkewY + dy * 0.018, -2.8, 2.8),
          };
      canvas.style.cursor = "grabbing";
      update(currentDoc, currentOptions);
      return;
    }

    const point = { x: event.offsetX, y: event.offsetY };
    const hit = [...projectedNodes].reverse().find((item) => pointInPolygon(point, item.points));
    const nextHovered = hit?.node.id ?? null;
    const nextLayerId = nextHovered ? currentLayers.nodeToLayer.get(nextHovered) ?? null : null;
    if (nextHovered === hoveredNodeId && nextLayerId === hoveredLayerId) return;

    hoveredNodeId = nextHovered;
    hoveredLayerId = nextLayerId;
    canvas.style.cursor = hoveredLayerId ? "pointer" : "default";
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, currentLayers, hoveredNodeId, hoveredLayerId);
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
    update(currentDoc, currentOptions);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    dragState = {
      startX: event.offsetX,
      startY: event.offsetY,
      startSkewX: viewState.skewX,
      startSkewY: viewState.skewY,
      startPanX: viewState.panX,
      startPanY: viewState.panY,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  }

  function handlePointerUp(event: PointerEvent): void {
    const shouldSelect = dragState !== null && !dragState.moved;
    dragState = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    canvas.style.cursor = hoveredLayerId ? "pointer" : "grab";
    if (shouldSelect) handleSelect();
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    viewState = { ...viewState, zoom: clamp(viewState.zoom * Math.exp(-event.deltaY * 0.0012), 0.45, 2.5) };
    update(currentDoc, currentOptions);
  }

  function clearHover(): void {
    if (!hoveredNodeId && !hoveredLayerId) return;
    hoveredNodeId = null;
    hoveredLayerId = null;
    canvas.style.cursor = "default";
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, currentLayers, hoveredNodeId, hoveredLayerId);
    currentOptions.onHover?.(nodeEvent(currentDoc, currentLayers, hoveredNodeId, hoveredLayerId));
    update(currentDoc, currentOptions);
  }

  function handleSelect(): void {
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

function createIssueMap(options: PerspectiveViewerOptions): Map<string, readonly PerspectiveIssue[]> {
  const result = new Map<string, PerspectiveIssue[]>();
  const addIssue = (nodeId: string | undefined, issue: PerspectiveIssue): void => {
    if (!nodeId) return;
    const issues = result.get(nodeId) ?? [];
    issues.push(issue);
    result.set(nodeId, issues);
  };
  for (const issue of options.issues ?? []) {
    for (const id of [issue.nodeId, issue.childId, issue.parentId]) {
      addIssue(id, issue);
    }
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
  return issues.toSorted((a, b) => rank[b.severity ?? "warning"] - rank[a.severity ?? "warning"])[0];
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

interface FlatNode {
  readonly node: RLSCNode;
  readonly depth: number;
  readonly parent?: RLSCNode;
}

interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

interface ProjectedNode extends FlatNode {
  readonly points: readonly [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint];
  readonly parentCenter?: CanvasPoint;
}

interface CanvasViewState {
  readonly skewX: number;
  readonly skewY: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

interface CanvasDragState {
  readonly startX: number;
  readonly startY: number;
  readonly startSkewX: number;
  readonly startSkewY: number;
  readonly startPanX: number;
  readonly startPanY: number;
  moved: boolean;
}

function flattenVisibleNodes(node: RLSCNode, depth: number, parent: RLSCNode | null): FlatNode[] {
  if (!node.visible) return [];
  const current = { node, depth, parent: parent ?? undefined };
  return [current, ...node.children.flatMap((child) => flattenVisibleNodes(child, depth + 1, node))];
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.strokeStyle = "#dce3ec";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 16) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 16) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

function projectNode(
  item: FlatNode,
  viewport: RLSCDocument["viewport"],
  canvasWidth: number,
  canvasHeight: number,
  viewState: CanvasViewState,
): ProjectedNode {
  const scale = Math.min(canvasWidth / viewport.width, canvasHeight / viewport.height) * 0.72 * viewState.zoom;
  const baseX = canvasWidth / 2 - (viewport.width * scale) / 2 + viewState.panX;
  const baseY = canvasHeight * 0.18 + viewState.panY;
  const z = item.depth * 14 + Math.max(0, item.node.zIndex) / 180;
  const x = baseX + item.node.rect.x * scale + z * viewState.skewX * viewState.zoom;
  const y = baseY + item.node.rect.y * scale - z * viewState.skewY * viewState.zoom;
  const w = Math.max(item.node.rect.width * scale, 2);
  const h = Math.max(item.node.rect.height * scale, 2);
  const skew = Math.min(42, 10 + item.depth * 4);
  const points = [
    { x: x + skew, y },
    { x: x + w + skew, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ] as const;
  const parentCenter = item.parent
    ? {
        x:
          baseX +
          (item.parent.rect.x + item.parent.rect.width / 2) * scale +
          (item.depth - 1) * 14 * viewState.skewX * viewState.zoom,
        y:
          baseY +
          (item.parent.rect.y + item.parent.rect.height / 2) * scale -
          (item.depth - 1) * 14 * viewState.skewY * viewState.zoom,
      }
    : undefined;

  return { ...item, points, parentCenter };
}

function drawNode(
  context: CanvasRenderingContext2D,
  item: ProjectedNode,
  hoveredLayerId: string | null,
  selectedLayerId: string | null,
  nodeToLayer: ReadonlyMap<string, string>,
  issue: PerspectiveIssue | undefined,
): void {
  const layerId = nodeToLayer.get(item.node.id) ?? item.node.id;
  const isHovered = hoveredLayerId === layerId;
  const isSelected = selectedLayerId === layerId;
  const color = issueColor(issue) ?? colorForNode(item.node, item.depth);

  if (item.parentCenter) {
    context.save();
    context.strokeStyle = "rgba(96, 113, 135, 0.36)";
    context.beginPath();
    context.moveTo(item.parentCenter.x, item.parentCenter.y);
    context.lineTo((item.points[0].x + item.points[2].x) / 2, (item.points[0].y + item.points[2].y) / 2);
    context.stroke();
    context.restore();
  }

  context.save();
  context.beginPath();
  context.moveTo(item.points[0].x, item.points[0].y);
  context.lineTo(item.points[1].x, item.points[1].y);
  context.lineTo(item.points[2].x, item.points[2].y);
  context.lineTo(item.points[3].x, item.points[3].y);
  context.closePath();
  context.fillStyle = cssColor(
    isHovered ? 0xffd43b : isSelected ? 0x40c057 : color,
    hoveredLayerId ? (isHovered ? 0.9 : 0.12) : selectedLayerId ? (isSelected ? 0.82 : issue ? 0.88 : item.node.children.length > 0 ? 0.38 : 0.72) : issue ? 0.88 : item.node.children.length > 0 ? 0.38 : 0.72,
  );
  context.strokeStyle = isHovered || issue ? "rgba(111, 76, 0, 0.9)" : isSelected ? "rgba(27, 126, 71, 0.95)" : "rgba(32, 48, 69, 0.5)";
  context.lineWidth = isHovered || isSelected || issue ? 2.5 : 1;
  context.fill();
  context.stroke();
  context.restore();
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
    const preferred = entry.nodes.toSorted((a, b) => identifierRank(a) - identifierRank(b) || b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
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

function disposeObject(object: { children?: unknown[]; geometry?: unknown; material?: unknown }): void {
  if (Array.isArray(object.children)) {
    for (const child of object.children) disposeObject(child as never);
  }
  const geometry = object.geometry as { dispose?: () => void } | undefined;
  geometry?.dispose?.();
  const material = object.material as { dispose?: () => void } | { dispose?: () => void }[] | undefined;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose?.();
  } else {
    material?.dispose?.();
  }
}
