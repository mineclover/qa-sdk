/**
 * Inspector — 브라우저 렌더러. DOM 조작만 담당.
 * 순수 로직은 inspector-engine.ts에 위임.
 */
import {
  migrateCompositionV1toV2,
  MOTION_COMPOSITION_PRESET_DOCUMENTS,
  parseMotionComposition,
  parseMotionCompositionV2,
  type MotionCompositionDefV2,
} from "motion-content";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
} from "motion-workspace-client";
import {
  countNodes,
  createInspectorState,
  extractNodeDetail,
  extractTimeline,
  findNode,
  formatMs,
  loadComposition,
  selectNode as engineSelectNode,
  toggleExpand as engineToggleExpand,
  type DetailPropRow,
  type InspectorState,
  type NodeDetail,
  type TimelineData,
  type TreeNode,
  type TreeNodeKind,
} from "./inspector-engine.js";

// ---------------------------------------------------------------------------
// 렌더러 상수 (엔진에 속하지 않는 시각적 관심사)
// ---------------------------------------------------------------------------

const WORKSPACE_CLIENT_BASE_URL = "/api/motion-workspace";
const WORKSPACE_QUERY_KEY = "workspace";

const ICON_LABELS: Record<TreeNodeKind, string> = {
  composition: "C", target: "T", scene: "S", placement: "P",
  sequence: "Q", caption: "Cc", parameter: "Pa", asset: "As", cue: "Cu",
};

const SCENE_COLORS = [
  "#53c67a", "#4bb7ff", "#f08f20", "#b48eff", "#ff7f6b", "#f6c453",
] as const;

const PROP_STYLE_CLASS: Record<NonNullable<DetailPropRow["style"]>, string> = {
  mono: "ins-prop__value--mono",
  timing: "ins-prop__value--timing",
  dim: "ins-prop__value--dim",
};

// ---------------------------------------------------------------------------
// HTML 헬퍼
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// 렌더: 트리 노드
// ---------------------------------------------------------------------------

function renderTreeNode(node: TreeNode, state: InspectorState): string {
  const isLeaf = node.children.length === 0;
  const isExpanded = state.expandedNodes.has(node.id);
  const isSelected = state.selectedNodeId === node.id;

  const toggleCls = isLeaf ? "is-leaf" : isExpanded ? "is-expanded" : "";
  const rowCls = isSelected ? "is-selected" : "";

  let h = `<div class="ins-node">`;
  h += `<div class="ins-node__row ${rowCls}" data-node-id="${esc(node.id)}">`;
  h += `<span class="ins-node__toggle ${toggleCls}">&#9654;</span>`;
  h += `<span class="ins-node__icon ins-node__icon--${node.kind}">${ICON_LABELS[node.kind]}</span>`;
  h += `<span class="ins-node__label">${esc(node.label)}</span>`;
  if (node.meta) h += `<span class="ins-node__meta">${esc(node.meta)}</span>`;
  h += `</div>`;

  if (!isLeaf) {
    h += `<div class="ins-node__children${isExpanded ? "" : " is-collapsed"}">`;
    for (const child of node.children) h += renderTreeNode(child, state);
    h += `</div>`;
  }
  h += `</div>`;
  return h;
}

// ---------------------------------------------------------------------------
// 렌더: 디테일 패널
// ---------------------------------------------------------------------------

function renderDetail(detail: NodeDetail | null): string {
  if (!detail) {
    return `<div class="ins-detail__empty">트리에서 노드를 선택하세요</div>`;
  }

  let h = `<div class="ins-detail__header">`;
  h += `<span class="ins-node__icon ins-node__icon--${detail.kind}" style="width:24px;height:24px;font-size:12px">${ICON_LABELS[detail.kind]}</span>`;
  h += `<h2>${esc(detail.label)}</h2>`;
  h += `<span class="ins-detail__type-badge ins-node__icon--${detail.kind}">${detail.kind}</span>`;
  h += `</div>`;

  h += `<div class="ins-props">`;
  for (const section of detail.sections) {
    h += `<div class="ins-props__section-title">${esc(section.title)}</div>`;
    for (const r of section.rows) {
      const cls = r.style ? PROP_STYLE_CLASS[r.style] : "";
      h += `<div class="ins-prop">`;
      h += `<div class="ins-prop__key">${esc(r.key)}</div>`;
      h += `<div class="ins-prop__value ${cls}">${esc(r.value)}</div>`;
      h += `</div>`;
    }
  }
  h += `</div>`;

  h += `<button class="ins-json-toggle" data-action="toggle-json">Raw JSON</button>`;
  h += `<div class="ins-json-block" style="display:none" data-role="json-block">${esc(detail.rawJson)}</div>`;
  return h;
}

// ---------------------------------------------------------------------------
// 렌더: 타임라인
// ---------------------------------------------------------------------------

function renderTimeline(timeline: TimelineData | null, selectedNodeId: string | null): string {
  if (!timeline || timeline.blocks.length === 0) {
    return `<div class="ins-timeline-bar"><div class="ins-timeline-bar__label">TIMELINE</div><div style="color:var(--ins-text-dim);font-size:12px">씬이 없습니다</div></div>`;
  }

  let h = `<div class="ins-timeline-bar">`;
  h += `<div class="ins-timeline-bar__label">SCENE TIMELINE (${formatMs(timeline.totalMs)})</div>`;
  h += `<div class="ins-timeline-track" style="min-width:${Math.max(600, timeline.totalMs / 5)}px">`;

  for (const block of timeline.blocks) {
    const color = SCENE_COLORS[block.colorIndex % SCENE_COLORS.length];
    const isSel = selectedNodeId === block.nodeId;
    h += `<div class="ins-timeline-block${isSel ? " is-selected" : ""}"
      data-node-id="${esc(block.nodeId)}"
      style="left:${block.leftPercent}%;width:${block.widthPercent}%;background:${color}20;color:${color};border-color:${isSel ? color : "transparent"}"
    >${esc(block.title)}</div>`;
  }
  h += `</div>`;

  const steps = 5;
  h += `<div class="ins-timeline-ruler">`;
  for (let i = 0; i <= steps; i++) {
    h += `<span>${formatMs(Math.round((timeline.totalMs / steps) * i))}</span>`;
  }
  h += `</div></div>`;
  return h;
}

// ---------------------------------------------------------------------------
// 앱 상태 + 클라이언트
// ---------------------------------------------------------------------------

const state = createInspectorState();
const client = new MotionWorkspaceClient({ baseUrl: WORKSPACE_CLIENT_BASE_URL });
const rootEl = document.getElementById("inspector")!;

// ---------------------------------------------------------------------------
// 소스 로딩
// ---------------------------------------------------------------------------

function parseToV2(source: string): MotionCompositionDefV2 {
  try {
    return /"schemaVersion"\s*:\s*"qa-sdk\.motion-composition\/v2"/.test(source)
      ? parseMotionCompositionV2(source)
      : migrateCompositionV1toV2(parseMotionComposition(source));
  } catch {
    return migrateCompositionV1toV2(parseMotionComposition(source));
  }
}

async function loadWorkspace(workspaceId: string): Promise<void> {
  state.status = `workspace ${workspaceId} 로딩 중...`;
  state.statusOk = false;
  state.statusError = false;
  render();

  try {
    const response = await client.get(workspaceId);
    const composition = response.workspace.document.composition as MotionCompositionDefV2;
    loadComposition(state, composition, workspaceId, `workspace ${workspaceId} 로드 완료`);
    updateUrl({ workspace: workspaceId });
  } catch (error) {
    const msg = error instanceof MotionWorkspaceClientError ? error.message : String(error);
    state.status = `로드 실패: ${msg}`;
    state.statusError = true;
  }
  render();
}

function loadPreset(presetId: string): void {
  const preset = MOTION_COMPOSITION_PRESET_DOCUMENTS.find((p) => p.id === presetId);
  if (!preset) return;
  loadComposition(state, parseToV2(preset.document), null, `preset "${preset.label}" 로드 완료`);
  updateUrl({ workspace: null });
  render();
}

function updateUrl(params: { workspace: string | null }): void {
  const url = new URL(window.location.href);
  if (params.workspace) {
    url.searchParams.set(WORKSPACE_QUERY_KEY, params.workspace);
  } else {
    url.searchParams.delete(WORKSPACE_QUERY_KEY);
  }
  window.history.replaceState({}, "", url);
}

// ---------------------------------------------------------------------------
// 메인 렌더
// ---------------------------------------------------------------------------

function render(): void {
  const selectedNode = state.tree && state.selectedNodeId
    ? findNode(state.tree, state.selectedNodeId) : null;
  const detail = selectedNode ? extractNodeDetail(selectedNode) : null;
  const timeline = state.composition ? extractTimeline(state.composition) : null;

  let h = "";

  // 상단 네비
  h += `<div class="ins-topbar">`;
  h += `<span class="ins-topbar__title">Scene Inspector</span>`;
  h += `<nav class="ins-topbar__nav"><a href="/">Editor</a><a href="/inspector.html" class="is-active">Inspector</a></nav>`;
  h += `<span class="ins-topbar__spacer"></span>`;
  h += `<span class="ins-topbar__meta">motion-content v2</span>`;
  h += `</div>`;

  // 소스 바
  const statusCls = state.statusOk ? "is-ok" : state.statusError ? "is-error" : "";
  h += `<div class="ins-workspace-bar">`;
  h += `<label>Source</label>`;
  h += `<select data-action="preset-select"><option value="">-- Preset --</option>`;
  for (const p of MOTION_COMPOSITION_PRESET_DOCUMENTS) {
    h += `<option value="${esc(p.id)}">${esc(p.label)}</option>`;
  }
  h += `</select>`;
  h += `<label>or</label>`;
  h += `<input data-role="workspace-input" placeholder="workspace ID" value="${esc(state.workspaceId ?? "")}" />`;
  h += `<button data-action="load-workspace">Load</button>`;
  h += `<span class="ins-workspace-bar__status ${statusCls}">${esc(state.status)}</span>`;
  h += `</div>`;

  // 메인 레이아웃
  h += `<div class="ins-layout">`;

  // 좌측 트리
  h += `<div class="ins-tree-panel">`;
  if (state.tree) {
    h += `<div class="ins-tree-panel__header"><h2>Composition Tree</h2><span class="ins-badge">${countNodes(state.tree)}</span></div>`;
    h += renderTreeNode(state.tree, state);
  } else {
    h += `<div style="padding:20px;color:var(--ins-text-dim);font-size:12px">Preset을 선택하거나 workspace를 로드하세요</div>`;
  }
  h += `</div>`;

  // 우측 디테일
  h += `<div class="ins-detail">${renderDetail(detail)}</div>`;
  h += `</div>`;

  // 하단 타임라인
  h += renderTimeline(timeline, state.selectedNodeId);

  rootEl.innerHTML = h;
  bindElementEvents();
}

// ---------------------------------------------------------------------------
// 이벤트
// ---------------------------------------------------------------------------

function initDelegatedEvents(): void {
  rootEl.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;

    // JSON toggle
    if (el.closest("[data-action='toggle-json']")) {
      const block = rootEl.querySelector("[data-role='json-block']") as HTMLElement | null;
      if (block) block.style.display = block.style.display === "none" ? "block" : "none";
      return;
    }

    // 타임라인 블록
    const timelineBlock = el.closest(".ins-timeline-block") as HTMLElement | null;
    if (timelineBlock?.dataset["nodeId"]) {
      engineSelectNode(state, timelineBlock.dataset["nodeId"]);
      render();
      return;
    }

    // 트리 노드 row
    const row = el.closest(".ins-node__row") as HTMLElement | null;
    if (!row?.dataset["nodeId"]) return;
    const nodeId = row.dataset["nodeId"];

    const toggle = el.closest(".ins-node__toggle");
    if (toggle && !toggle.classList.contains("is-leaf")) {
      engineToggleExpand(state, nodeId);
    } else {
      engineSelectNode(state, nodeId);
    }
    render();
  });
}

function bindElementEvents(): void {
  const presetSelect = rootEl.querySelector("[data-action='preset-select']") as HTMLSelectElement | null;
  presetSelect?.addEventListener("change", () => {
    if (presetSelect.value) loadPreset(presetSelect.value);
  });

  const workspaceInput = rootEl.querySelector("[data-role='workspace-input']") as HTMLInputElement | null;
  rootEl.querySelector("[data-action='load-workspace']")?.addEventListener("click", () => {
    const id = workspaceInput?.value.trim();
    if (id) void loadWorkspace(id);
  });
  workspaceInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const id = workspaceInput.value.trim();
      if (id) void loadWorkspace(id);
    }
  });
}

// ---------------------------------------------------------------------------
// 초기화
// ---------------------------------------------------------------------------

initDelegatedEvents();

const urlWorkspaceId = new URLSearchParams(window.location.search).get(WORKSPACE_QUERY_KEY)?.trim();
if (urlWorkspaceId) {
  void loadWorkspace(urlWorkspaceId);
} else {
  const firstPreset = MOTION_COMPOSITION_PRESET_DOCUMENTS[0];
  if (firstPreset) loadPreset(firstPreset.id);
  else render();
}
