/**
 * Inspector Engine — 순수 로직. DOM/브라우저 의존 없음.
 *
 * 책임: 트리 빌드, 노드 조회, 디테일 추출, 타임라인 계산, 상태 관리.
 * 비책임: HTML, 아이콘, 색상, DOM 이벤트 — 렌더러가 담당.
 *
 * @see docs/specs/ui/inspector-engine.spec.md
 */
import type {
  MotionAssetDef,
  MotionCaptionCue,
  MotionCompositionDefV2,
  MotionCuePreset,
  MotionCueRef,
  MotionParameterDef,
  MotionSceneDef,
  MotionSceneSequenceDef,
  MotionTargetDef,
  SceneLayerPlacement,
} from "motion-content";

// ═══════════════════════════════════════════════════════════════════════════
// 노드 타입 시스템
// ═══════════════════════════════════════════════════════════════════════════

export type TreeNodeKind =
  | "composition" | "target" | "scene" | "placement"
  | "sequence" | "caption" | "parameter" | "asset" | "cue";

/** kind → 원본 데이터 타입 매핑. data 필드의 타입 안전성 보장. */
export interface TreeNodeDataMap {
  composition: MotionCompositionDefV2;
  target: MotionTargetDef;
  scene: MotionSceneDef;
  placement: SceneLayerPlacement;
  sequence: MotionSceneSequenceDef;
  caption: MotionCaptionCue;
  parameter: MotionParameterDef;
  asset: MotionAssetDef;
  cue: MotionCuePreset;
}

export interface TreeNode<K extends TreeNodeKind = TreeNodeKind> {
  readonly id: string;
  readonly kind: K;
  readonly label: string;
  readonly meta?: string;
  readonly data: TreeNodeDataMap[K];
  readonly children: readonly TreeNode[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 노드 ID — 유일한 생성 경로
// ═══════════════════════════════════════════════════════════════════════════

/** 글로벌 유일한 노드 ID. 씬 내부 노드는 sceneId를 포함하여 경합을 방지한다. */
export function nodeId(kind: TreeNodeKind, sourceId: string, sceneId?: string): string {
  if (kind === "composition") return "composition";
  // 씬 내부 노드: placement, sequence, caption — sceneId를 포함하여 씬 간 충돌 방지
  if (sceneId && (kind === "placement" || kind === "sequence" || kind === "caption")) {
    return `${kind}:${sceneId}/${sourceId}`;
  }
  return `${kind}:${sourceId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 포맷 헬퍼 (렌더러에서도 재사용)
// ═══════════════════════════════════════════════════════════════════════════

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function describeCue(cue: MotionCueRef): string {
  return "preset" in cue ? `preset:${cue.preset}` : `${cue.kind} ${formatMs(cue.durationMs)}`;
}

function timingMeta(startMs: number, durationMs: number): string {
  return `${formatMs(startMs)}+${formatMs(durationMs)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 트리 빌드
// ═══════════════════════════════════════════════════════════════════════════

function leaf<K extends TreeNodeKind>(
  kind: K,
  sourceId: string,
  label: string,
  data: TreeNodeDataMap[K],
  meta?: string,
): TreeNode<K> {
  return { id: nodeId(kind, sourceId), kind, label, meta, data, children: [] };
}

function buildPlacementNode(p: SceneLayerPlacement, targets: readonly MotionTargetDef[], sceneId: string, index: number): TreeNode<"placement"> {
  const exists = targets.some((t) => t.id === p.targetId);
  return {
    id: nodeId("placement", `${p.targetId}#${index}`, sceneId),
    kind: "placement",
    label: exists ? p.targetId : `${p.targetId} (missing)`,
    meta: timingMeta(p.startMs, p.durationMs),
    data: p,
    children: [],
  };
}

function buildSceneNode(scene: MotionSceneDef, targets: readonly MotionTargetDef[]): TreeNode<"scene"> {
  return {
    id: nodeId("scene", scene.id),
    kind: "scene",
    label: scene.title,
    meta: timingMeta(scene.startMs, scene.durationMs),
    data: scene,
    children: [
      ...scene.layers.map((p, i) => buildPlacementNode(p, targets, scene.id, i)),
      ...scene.sequences.map((s): TreeNode<"sequence"> => ({
        id: nodeId("sequence", s.id, scene.id),
        kind: "sequence", label: s.title,
        meta: `${s.targetIds.length}t ${timingMeta(s.startMs, s.durationMs)}`,
        data: s, children: [],
      })),
      ...scene.captions.map((c): TreeNode<"caption"> => ({
        id: nodeId("caption", c.id, scene.id),
        kind: "caption",
        label: c.text.length > 30 ? `${c.text.slice(0, 30)}...` : c.text,
        meta: timingMeta(c.startMs, c.durationMs),
        data: c, children: [],
      })),
    ],
  };
}

export function buildCompositionTree(comp: MotionCompositionDefV2): TreeNode<"composition"> {
  return {
    id: nodeId("composition", comp.id),
    kind: "composition",
    label: comp.title,
    meta: `${formatMs(comp.durationMs)} / ${comp.scenes.length} scenes / ${comp.targets.length} targets`,
    data: comp,
    children: [
      ...comp.scenes.map((s) => buildSceneNode(s, comp.targets)),
      ...comp.targets.map((t) => leaf("target", t.id, t.id, t, t.content?.type ?? "dom")),
      ...comp.parameters.map((p) => leaf("parameter", p.id, p.label, p, `${p.type} = ${p.defaultValue}`)),
      ...comp.assets.map((a) => leaf("asset", a.id, a.id, a, a.type)),
      ...(comp.cuePresets ?? []).map((c) => leaf("cue", c.id, c.label, c, `${c.kind} ${formatMs(c.durationMs)}`)),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 노드 조회
// ═══════════════════════════════════════════════════════════════════════════

export function findNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function countNodes(root: TreeNode): number {
  return 1 + root.children.reduce((sum, c) => sum + countNodes(c), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 디테일 추출
// ═══════════════════════════════════════════════════════════════════════════

export interface DetailPropRow {
  readonly key: string;
  readonly value: string;
  readonly style?: "mono" | "timing" | "dim";
}

export interface DetailSection {
  readonly title: string;
  readonly rows: readonly DetailPropRow[];
}

export interface NodeDetail {
  readonly kind: TreeNodeKind;
  readonly label: string;
  readonly sections: readonly DetailSection[];
  readonly rawJson: string;
}

function r(key: string, value: string, style?: DetailPropRow["style"]): DetailPropRow {
  return { key, value, style };
}

/** kind별 디테일 추출 레지스트리 */
type DetailExtractor = (data: never) => readonly DetailSection[];

const detailExtractors: Record<TreeNodeKind, DetailExtractor> = {
  composition(data: MotionCompositionDefV2) {
    return [
      {
        title: "기본 정보",
        rows: [
          r("id", data.id, "mono"), r("title", data.title),
          r("description", data.description || "(없음)", data.description ? undefined : "dim"),
          r("durationMs", formatMs(data.durationMs), "timing"),
        ],
      },
      {
        title: "구성 요소",
        rows: [
          r("targets", `${data.targets.length}개`), r("scenes", `${data.scenes.length}개`),
          r("parameters", `${data.parameters.length}개`), r("assets", `${data.assets.length}개`),
          r("cuePresets", `${(data.cuePresets ?? []).length}개`),
        ],
      },
    ];
  },

  target(data: MotionTargetDef) {
    return [{
      title: "Target 정보",
      rows: [
        r("id", data.id, "mono"), r("target.kind", data.target.kind),
        r("target.nodeId", data.target.nodeId, "mono"), r("content", data.content?.type ?? "dom"),
      ],
    }];
  },

  scene(data: MotionSceneDef) {
    return [
      {
        title: "Scene 타이밍",
        rows: [
          r("id", data.id, "mono"), r("title", data.title),
          r("startMs", formatMs(data.startMs), "timing"), r("durationMs", formatMs(data.durationMs), "timing"),
          r("endMs", formatMs(data.startMs + data.durationMs), "timing"),
        ],
      },
      {
        title: "내부 구성",
        rows: [
          r("placements", `${data.layers.length}개`), r("sequences", `${data.sequences.length}개`),
          r("captions", `${data.captions.length}개`),
        ],
      },
    ];
  },

  placement(data: SceneLayerPlacement) {
    return [
      {
        title: "Placement 정보",
        rows: [
          r("targetId", data.targetId, "mono"),
          r("startMs", formatMs(data.startMs), "timing"), r("durationMs", formatMs(data.durationMs), "timing"),
        ],
      },
      {
        title: "애니메이션",
        rows: [
          r("enter", describeCue(data.enter)),
          r("exit", data.exit ? describeCue(data.exit) : "(없음)", data.exit ? undefined : "dim"),
        ],
      },
    ];
  },

  sequence(data: MotionSceneSequenceDef) {
    const targetRows: DetailPropRow[] = [r("targetIds", data.targetIds.join(", "), "mono")];
    if (data.stagger) {
      targetRows.push(
        r("stagger.startOffsetMs", formatMs(data.stagger.startOffsetMs), "timing"),
        r("stagger.intervalMs", formatMs(data.stagger.intervalMs), "timing"),
      );
    }
    return [
      {
        title: "Sequence 정보",
        rows: [
          r("id", data.id, "mono"), r("title", data.title),
          r("startMs", formatMs(data.startMs), "timing"), r("durationMs", formatMs(data.durationMs), "timing"),
        ],
      },
      { title: "Target 구성", rows: targetRows },
    ];
  },

  caption(data: MotionCaptionCue) {
    return [{
      title: "Caption 정보",
      rows: [
        r("id", data.id, "mono"), r("text", data.text),
        r("startMs", formatMs(data.startMs), "timing"), r("durationMs", formatMs(data.durationMs), "timing"),
        r("tone", data.tone ?? "neutral"),
      ],
    }];
  },

  parameter(data: MotionParameterDef) {
    const rows: DetailPropRow[] = [
      r("id", data.id, "mono"), r("label", data.label),
      r("type", data.type), r("defaultValue", String(data.defaultValue)),
    ];
    if (data.options) {
      rows.push(r("options", data.options.map((o) => `${o.label}(${o.value})`).join(", ")));
    }
    return [{ title: "Parameter 정보", rows }];
  },

  asset(data: MotionAssetDef) {
    const rows: DetailPropRow[] = [
      r("id", data.id, "mono"), r("type", data.type),
      r("target.nodeId", data.target.nodeId, "mono"), r("template", data.template),
    ];
    if (data.type === "style") rows.push(r("property", data.property));
    return [{ title: "Asset 정보", rows }];
  },

  cue(data: MotionCuePreset) {
    const rows: DetailPropRow[] = [
      r("id", data.id, "mono"), r("label", data.label),
      r("kind", data.kind), r("durationMs", formatMs(data.durationMs), "timing"),
    ];
    if (data.ease) rows.push(r("ease", data.ease));
    if (data.amount !== undefined) rows.push(r("amount", String(data.amount)));
    return [{ title: "Cue Preset 정보", rows }];
  },
} as unknown as Record<TreeNodeKind, DetailExtractor>;

export function extractNodeDetail(node: TreeNode): NodeDetail {
  const extractor = detailExtractors[node.kind];
  return {
    kind: node.kind,
    label: node.label,
    sections: extractor(node.data as never),
    rawJson: JSON.stringify(node.data, null, 2),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 타임라인 추출
// ═══════════════════════════════════════════════════════════════════════════

export interface TimelineBlock {
  readonly sceneId: string;
  readonly nodeId: string;
  readonly title: string;
  readonly leftPercent: number;
  readonly widthPercent: number;
  readonly colorIndex: number;
}

export interface TimelineData {
  readonly totalMs: number;
  readonly blocks: readonly TimelineBlock[];
}

export function extractTimeline(comp: MotionCompositionDefV2): TimelineData {
  const rawMax = Math.max(comp.durationMs, ...comp.scenes.map((s) => s.startMs + s.durationMs));
  // totalMs=0 → division by zero 방지
  const totalMs = rawMax > 0 ? rawMax : 1;
  return {
    totalMs,
    blocks: comp.scenes.map((scene, i) => ({
      sceneId: scene.id,
      nodeId: nodeId("scene", scene.id),
      title: scene.title,
      leftPercent: (scene.startMs / totalMs) * 100,
      widthPercent: (scene.durationMs / totalMs) * 100,
      colorIndex: i,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 상태 관리
// ═══════════════════════════════════════════════════════════════════════════

export interface InspectorState {
  composition: MotionCompositionDefV2 | null;
  workspaceId: string | null;
  tree: TreeNode<"composition"> | null;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  status: string;
  statusOk: boolean;
  statusError: boolean;
}

export function createInspectorState(): InspectorState {
  return {
    composition: null,
    workspaceId: null,
    tree: null,
    expandedNodes: new Set(["composition"]),
    selectedNodeId: null,
    status: "",
    statusOk: false,
    statusError: false,
  };
}

export function loadComposition(
  state: InspectorState,
  composition: MotionCompositionDefV2,
  workspaceId: string | null,
  status: string,
): void {
  state.composition = composition;
  state.workspaceId = workspaceId;
  state.tree = buildCompositionTree(composition);
  state.expandedNodes = new Set(["composition"]);
  for (const scene of composition.scenes) {
    state.expandedNodes.add(nodeId("scene", scene.id));
  }
  state.selectedNodeId = null;
  state.status = status;
  state.statusOk = true;
  state.statusError = false;
}

export function selectNode(state: InspectorState, id: string): void {
  state.selectedNodeId = id;
  state.expandedNodes.add(id);
}

export function toggleExpand(state: InspectorState, id: string): void {
  if (state.expandedNodes.has(id)) {
    state.expandedNodes.delete(id);
  } else {
    state.expandedNodes.add(id);
  }
}
