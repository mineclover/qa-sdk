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
import type { AreaOverflowIssue, RLSCDocument, RLSCNode } from "@qa-sdk/rlsc-analysis";

export type PerspectiveRendererKind = "auto" | "webgl" | "canvas";

export interface PerspectiveIssue {
  readonly nodeId?: string;
  readonly parentId?: string;
  readonly childId?: string;
  readonly severity?: "info" | "warning" | "error";
  readonly color?: number;
}

export interface PerspectiveNodeEvent {
  readonly nodeId: string | null;
  readonly node?: RLSCNode;
}

export interface PerspectiveCopyEvent extends PerspectiveNodeEvent {
  readonly text: string;
}

export interface PerspectiveViewerOptions {
  readonly renderer?: PerspectiveRendererKind;
  readonly issues?: readonly PerspectiveIssue[];
  readonly overflowIssues?: readonly AreaOverflowIssue[];
  readonly onHover?: (event: PerspectiveNodeEvent) => void;
  readonly onSelect?: (event: PerspectiveNodeEvent) => void;
  readonly onCopy?: (event: PerspectiveCopyEvent) => void;
}

export interface PerspectiveViewer {
  update(doc: RLSCDocument, options?: PerspectiveViewerOptions): void;
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
  if (options.renderer === "canvas") {
    return createCanvasPerspectiveViewer(container, doc, options);
  }
  // auto 모드 + 명시 webgl 모두 사전 체크. fallback 보장.
  if (options.renderer !== "webgl" && !isWebGLAvailable()) {
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
  let selectedNodeId: string | null = null;
  let currentIssueMap = createIssueMap(options);

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
    clearRoot();
    root.add(new GridHelper(8, 32, 0xb7c2d0, 0xdce3ec));
    addNodeLayer(root, nextDoc.root, nextDoc.viewport, 0, null, nodeMeshes, currentIssueMap);
    if (hoveredNodeId && !nodeMeshes.has(hoveredNodeId)) hoveredNodeId = null;
    if (selectedNodeId && !nodeMeshes.has(selectedNodeId)) selectedNodeId = null;
    applyInteractionState(nodeMeshes, hoveredNodeId, selectedNodeId);
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
    const nextHovered = nextId ?? null;
    if (nextHovered === hoveredNodeId) return;

    hoveredNodeId = nextHovered;
    renderer.domElement.style.cursor = hoveredNodeId ? "pointer" : "default";
    applyInteractionState(nodeMeshes, hoveredNodeId, selectedNodeId);
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, hoveredNodeId);
    currentOptions.onHover?.(nodeEvent(currentDoc, hoveredNodeId));
  }

  function clearHover(): void {
    if (!hoveredNodeId) return;
    hoveredNodeId = null;
    renderer.domElement.style.cursor = "default";
    applyInteractionState(nodeMeshes, hoveredNodeId, selectedNodeId);
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, hoveredNodeId);
    currentOptions.onHover?.(nodeEvent(currentDoc, hoveredNodeId));
  }

  function handleSelect(): void {
    selectedNodeId = hoveredNodeId;
    applyInteractionState(nodeMeshes, hoveredNodeId, selectedNodeId);
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, selectedNodeId);
    currentOptions.onSelect?.(nodeEvent(currentDoc, selectedNodeId));
  }

  function handleCopy(event: ClipboardEvent): void {
    if (!selectedNodeId) return;
    const detail = copyEvent(currentDoc, selectedNodeId);
    event.clipboardData?.setData("text/plain", detail.text);
    event.preventDefault();
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!selectedNodeId || event.key.toLowerCase() !== "c" || (!event.metaKey && !event.ctrlKey)) return;
    const detail = copyEvent(currentDoc, selectedNodeId);
    void navigator.clipboard?.writeText(detail.text).catch(() => undefined);
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
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

  return { update, dispose };
}

function addNodeLayer(
  group: Group,
  node: RLSCNode,
  viewport: RLSCDocument["viewport"],
  depth: number,
  parentCenter: Vector3 | null,
  nodeMeshes: Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>,
  issueMap: ReadonlyMap<string, PerspectiveIssue>,
): void {
  if (!node.visible) return;

  const issue = issueMap.get(node.id);
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
    addNodeLayer(group, child, viewport, depth + 1, center, nodeMeshes, issueMap);
  }
}

function applyInteractionState(
  nodeMeshes: Map<string, Mesh<BoxGeometry, MeshStandardMaterial>>,
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
): void {
  for (const [nodeId, mesh] of nodeMeshes) {
    const material = mesh.material;
    const baseOpacity = mesh.userData["baseOpacity"] as number;
    const baseEmissive = mesh.userData["baseEmissive"] as number;
    const isHovered = hoveredNodeId === nodeId;
    const isSelected = selectedNodeId === nodeId;
    material.opacity = hoveredNodeId || selectedNodeId ? (isHovered || isSelected ? 0.98 : Math.min(baseOpacity, 0.14)) : baseOpacity;
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
  let selectedNodeId: string | null = null;
  let projectedNodes: ProjectedNode[] = [];

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
    resize();
    const width = container.clientWidth;
    const height = container.clientHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, width, height);
    drawGrid(context, width, height);

    const flat = flattenVisibleNodes(nextDoc.root, 0, null).toSorted(
      (a, b) => a.depth - b.depth || a.node.rect.y - b.node.rect.y,
    );
    projectedNodes = flat.map((item) => projectNode(item, nextDoc.viewport, width, height));
    if (hoveredNodeId && !projectedNodes.some((item) => item.node.id === hoveredNodeId)) {
      hoveredNodeId = null;
    }
    if (selectedNodeId && !projectedNodes.some((item) => item.node.id === selectedNodeId)) {
      selectedNodeId = null;
    }
    for (const item of projectedNodes) {
      drawNode(context, item, hoveredNodeId, selectedNodeId, issueMap.get(item.node.id));
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    const point = { x: event.offsetX, y: event.offsetY };
    const hit = projectedNodes.toReversed().find((item) => pointInPolygon(point, item.points));
    const nextHovered = hit?.node.id ?? null;
    if (nextHovered === hoveredNodeId) return;

    hoveredNodeId = nextHovered;
    canvas.style.cursor = hoveredNodeId ? "pointer" : "default";
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, hoveredNodeId);
    currentOptions.onHover?.(nodeEvent(currentDoc, hoveredNodeId));
    update(currentDoc, currentOptions);
  }

  function clearHover(): void {
    if (!hoveredNodeId) return;
    hoveredNodeId = null;
    canvas.style.cursor = "default";
    emitNodeEvent(container, "rlsc-perspective-hover", currentDoc, hoveredNodeId);
    currentOptions.onHover?.(nodeEvent(currentDoc, hoveredNodeId));
    update(currentDoc, currentOptions);
  }

  function handleSelect(): void {
    selectedNodeId = hoveredNodeId;
    emitNodeEvent(container, "rlsc-perspective-select", currentDoc, selectedNodeId);
    currentOptions.onSelect?.(nodeEvent(currentDoc, selectedNodeId));
    canvas.focus();
    update(currentDoc, currentOptions);
  }

  function handleCopy(event: ClipboardEvent): void {
    if (!selectedNodeId) return;
    const detail = copyEvent(currentDoc, selectedNodeId);
    event.clipboardData?.setData("text/plain", detail.text);
    event.preventDefault();
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!selectedNodeId || event.key.toLowerCase() !== "c" || (!event.metaKey && !event.ctrlKey)) return;
    const detail = copyEvent(currentDoc, selectedNodeId);
    void navigator.clipboard?.writeText(detail.text).catch(() => undefined);
    emitCopyEvent(container, detail);
    currentOptions.onCopy?.(detail);
  }

  function dispose(): void {
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerleave", clearHover);
    canvas.removeEventListener("click", handleSelect);
    canvas.removeEventListener("copy", handleCopy);
    canvas.removeEventListener("keydown", handleKeyDown);
    canvas.remove();
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", clearHover);
  canvas.addEventListener("click", handleSelect);
  canvas.addEventListener("copy", handleCopy);
  canvas.addEventListener("keydown", handleKeyDown);
  update(doc, options);
  return { update, dispose };
}

function createIssueMap(options: PerspectiveViewerOptions): Map<string, PerspectiveIssue> {
  const result = new Map<string, PerspectiveIssue>();
  for (const issue of options.issues ?? []) {
    for (const id of [issue.nodeId, issue.childId, issue.parentId]) {
      if (id) result.set(id, issue);
    }
  }
  for (const issue of options.overflowIssues ?? []) {
    result.set(issue.childId, { childId: issue.childId, parentId: issue.parentId, severity: "error" });
  }
  return result;
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
): ProjectedNode {
  const scale = Math.min(canvasWidth / viewport.width, canvasHeight / viewport.height) * 0.72;
  const baseX = canvasWidth / 2 - (viewport.width * scale) / 2;
  const baseY = canvasHeight * 0.18;
  const z = item.depth * 14 + Math.max(0, item.node.zIndex) / 180;
  const x = baseX + item.node.rect.x * scale + z * 1.8;
  const y = baseY + item.node.rect.y * scale - z * 1.2;
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
        x: baseX + (item.parent.rect.x + item.parent.rect.width / 2) * scale + (item.depth - 1) * 14 * 1.8,
        y: baseY + (item.parent.rect.y + item.parent.rect.height / 2) * scale - (item.depth - 1) * 14 * 1.2,
      }
    : undefined;

  return { ...item, points, parentCenter };
}

function drawNode(
  context: CanvasRenderingContext2D,
  item: ProjectedNode,
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  issue: PerspectiveIssue | undefined,
): void {
  const isHovered = hoveredNodeId === item.node.id;
  const isSelected = selectedNodeId === item.node.id;
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
    hoveredNodeId || selectedNodeId ? (isHovered || isSelected ? 0.9 : 0.12) : issue ? 0.88 : item.node.children.length > 0 ? 0.38 : 0.72,
  );
  context.strokeStyle = isHovered || issue ? "rgba(111, 76, 0, 0.9)" : isSelected ? "rgba(27, 126, 71, 0.95)" : "rgba(32, 48, 69, 0.5)";
  context.lineWidth = isHovered || isSelected || issue ? 2.5 : 1;
  context.fill();
  context.stroke();
  context.restore();
}

function nodeEvent(doc: RLSCDocument, nodeId: string | null): PerspectiveNodeEvent {
  return { nodeId, node: nodeId ? findNodeById(doc.root, nodeId) : undefined };
}

function copyEvent(doc: RLSCDocument, nodeId: string): PerspectiveCopyEvent {
  const detail = nodeEvent(doc, nodeId);
  return {
    ...detail,
    text: JSON.stringify(
      {
        nodeId,
        address: detail.node?.address,
        identifier: detail.node?.identifier,
        rect: detail.node?.rect,
      },
      null,
      2,
    ),
  };
}

function emitNodeEvent(container: HTMLElement, name: string, doc: RLSCDocument, nodeId: string | null): void {
  container.dispatchEvent(new CustomEvent(name, { detail: nodeEvent(doc, nodeId), bubbles: true }));
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
