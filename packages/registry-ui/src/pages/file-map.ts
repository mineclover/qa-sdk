import * as d3 from "d3";

type JsonRecord = Record<string, unknown>;

interface GitConflictSource {
  branchName: string;
  displayName?: string;
  paths: string[];
  overlappingPaths?: string[];
  worktreePath?: string;
}

interface GitConflictAnalysis {
  current: { branchName: string; paths: string[] };
  branches: GitConflictSource[];
  worktrees?: GitConflictSource[];
  hotspots?: { path: string; branches: string[] }[];
  baseRef?: string;
  currentBranchName?: string | null;
  remoteName?: string;
}

interface GitConflictReportInput {
  analysis: GitConflictAnalysis;
  safeScopes?: string[];
}

interface PathMetrics {
  currentTouched: boolean;
  remoteBranches: string[];
  overlappingRemoteBranches: string[];
  worktrees: string[];
  overlappingWorktrees: string[];
  hotspotBranches: string[];
}

interface TreeMetrics {
  fileCount: number;
  directoryCount: number;
  currentTouchedFiles: number;
  remoteTouchCount: number;
  remoteOverlapCount: number;
  worktreeTouchCount: number;
  worktreeOverlapCount: number;
  hotspotCount: number;
  riskScore: number;
}

interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  kind: "dir" | "file";
  metrics: TreeMetrics;
  pathMetrics: PathMetrics;
  children: FileTreeNode[];
}

interface NormalizedReport {
  tree: FileTreeNode;
  stats: {
    currentFiles: number;
    remoteBranches: number;
    worktrees: number;
    hotspots: number;
    safeScopes: string[];
    baseRef: string;
    currentBranch: string;
    remoteName: string;
  };
}

interface RenderState {
  report: NormalizedReport;
  rawInput: string;
  selectedNodeId: string;
  autoLoadAttempted: boolean;
}

let container: HTMLElement;
let state: RenderState;

const SAMPLE_REPORT: GitConflictReportInput = {
  analysis: {
    current: {
      branchName: "feature/local",
      paths: [
        "packages/api/schema.sql",
        "packages/cli/src/index.ts",
        "packages/cli/src/commands/git-conflicts.ts",
      ],
    },
    currentBranchName: "feature/local",
    baseRef: "origin/main",
    remoteName: "origin",
    branches: [
      {
        branchName: "origin/feature/alpha",
        displayName: "origin/feature/alpha",
        paths: [
          "packages/api/schema.sql",
          "packages/api/migrations/20260402.sql",
        ],
        overlappingPaths: ["packages/api/schema.sql"],
      },
      {
        branchName: "origin/feature/beta",
        displayName: "origin/feature/beta",
        paths: [
          "packages/api/schema.sql",
          "packages/web/src/page.ts",
        ],
        overlappingPaths: ["packages/api/schema.sql"],
      },
      {
        branchName: "origin/feature/gamma",
        displayName: "origin/feature/gamma",
        paths: ["packages/worker/src/job.ts"],
        overlappingPaths: [],
      },
    ],
    worktrees: [
      {
        branchName: "feature/local-docs",
        displayName: "worktree:feature/local-docs",
        worktreePath: "/tmp/qa-sdk/worktree-docs",
        paths: [
          "packages/cli/src/index.ts",
          "docs/guide.md",
        ],
        overlappingPaths: ["packages/cli/src/index.ts"],
      },
    ],
    hotspots: [
      {
        path: "packages/api/schema.sql",
        branches: ["feature/local", "origin/feature/alpha", "origin/feature/beta"],
      },
      {
        path: "packages/cli/src/index.ts",
        branches: ["feature/local", "worktree:feature/local-docs"],
      },
    ],
  },
  safeScopes: ["(root)", "packages/worker"],
};

export function renderFileMapPage(el: HTMLElement): void {
  container = el;
  if (!state) {
    const normalized = normalizeReport(SAMPLE_REPORT);
    state = {
      report: normalized,
      rawInput: JSON.stringify(SAMPLE_REPORT, null, 2),
      selectedNodeId: normalized.tree.id,
      autoLoadAttempted: false,
    };
  }
  render();
  void maybeAutoLoadHostedReport();
}

function render(): void {
  const selectedNode = findNodeById(state.report.tree, state.selectedNodeId) ?? state.report.tree;
  const report = state.report;

  container.innerHTML = `
    <div class="fmap-page">
      <section class="fmap-side">
        <div class="fmap-panel fmap-panel-hero">
          <div class="fmap-kicker">Git Conflict Map</div>
          <h2>파일 구조 시각화</h2>
          <p class="fmap-copy">
            <code>qa-sdk git conflicts --json</code> 결과를 붙여 넣으면
            충돌 밀도와 작업 가능 영역을 트리로 시각화합니다.
          </p>
          <div class="fmap-hero-meta">
            <span>base: ${escapeHtml(report.stats.baseRef)}</span>
            <span>current: ${escapeHtml(report.stats.currentBranch)}</span>
            <span>remote: ${escapeHtml(report.stats.remoteName)}</span>
          </div>
        </div>

        <div class="fmap-summary">
          ${summaryCard("현재 파일", String(report.stats.currentFiles), "현재 브랜치에서 직접 수정")}
          ${summaryCard("원격 브랜치", String(report.stats.remoteBranches), "비교 대상 remote branch")}
          ${summaryCard("로컬 worktree", String(report.stats.worktrees), "함께 보는 로컬 병렬 작업")}
          ${summaryCard("Hotspots", String(report.stats.hotspots), "여러 작업이 만나는 지점")}
        </div>

        <div class="fmap-panel">
          <div class="fmap-panel-header">
            <h3>입력</h3>
            <div class="fmap-actions">
              <button class="dsl-btn fmap-load-hosted">자동 로드</button>
              <button class="dsl-btn fmap-load-file">파일 열기</button>
              <button class="dsl-btn fmap-load-sample">샘플</button>
              <button class="dsl-btn fmap-render">렌더</button>
            </div>
          </div>
          <input type="file" class="fmap-file-input" id="fmap-file-input" accept="application/json,.json" />
          <p class="fmap-hint">입력 형식: <code>qa-sdk git conflicts --json</code></p>
          <textarea class="fmap-input" id="fmap-input" spellcheck="false">${escapeHtml(state.rawInput)}</textarea>
          <div class="fmap-status" id="fmap-status"></div>
        </div>

        <div class="fmap-panel">
          <div class="fmap-panel-header">
            <h3>범례</h3>
          </div>
          <div class="fmap-legend">
            ${legendRow("fmap-swatch-current", "현재 브랜치 변경")}
            ${legendRow("fmap-swatch-remote", "remote 브랜치 영향")}
            ${legendRow("fmap-swatch-worktree", "local worktree 영향")}
            ${legendRow("fmap-swatch-overlap", "현재 변경과 직접 충돌")}
            ${legendRow("fmap-swatch-hotspot", "다중 소스 hotspot")}
          </div>
          <div class="fmap-safe">
            <strong>Safe scope</strong>
            <div class="fmap-chip-list">
              ${report.stats.safeScopes.length > 0
                ? report.stats.safeScopes.map((scope) => `<span class="fmap-chip">${escapeHtml(scope)}</span>`).join("")
                : '<span class="fmap-muted">사용 가능한 scope 없음</span>'}
            </div>
          </div>
        </div>

        <div class="fmap-panel">
          <div class="fmap-panel-header">
            <h3>선택 노드</h3>
          </div>
          ${renderNodeDetail(selectedNode)}
        </div>
      </section>

      <section class="fmap-main">
        <div class="fmap-main-toolbar">
          <div>
            <h2>Hierarchy</h2>
            <p>원 크기 = 포함 파일 수, 색 = 충돌 밀도</p>
          </div>
          <button class="dsl-btn fmap-reset-view">뷰 리셋</button>
        </div>
        <div class="fmap-canvas-shell">
          <div id="fmap-canvas" class="fmap-canvas"></div>
        </div>
      </section>
    </div>
  `;

  bindPageActions();
  renderTreeCanvas(report.tree);
}

function bindPageActions(): void {
  container.querySelector<HTMLButtonElement>(".fmap-load-sample")?.addEventListener("click", () => {
    state.rawInput = JSON.stringify(SAMPLE_REPORT, null, 2);
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
    const rawText = await file.text();
    applyInput(rawText);
    fileInput.value = "";
  });

  container.querySelector<HTMLButtonElement>(".fmap-render")?.addEventListener("click", () => {
    const input = container.querySelector<HTMLTextAreaElement>("#fmap-input");
    if (!input) return;
    applyInput(input.value);
  });

  container.querySelector<HTMLButtonElement>(".fmap-reset-view")?.addEventListener("click", () => {
    renderTreeCanvas(state.report.tree);
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

  try {
    const response = await fetch("/git-conflicts.json", { cache: "no-store" });
    if (!response.ok) {
      if (showEmptyState && status) {
        status.textContent = "git-conflicts.json을 찾지 못했습니다.";
        status.className = "fmap-status fmap-status-error";
      } else if (status) {
        status.textContent = "호스팅된 데이터가 없어 샘플을 사용 중입니다.";
        status.className = "fmap-status";
      }
      return;
    }

    const rawText = await response.text();
    applyInput(rawText, "호스팅된 git-conflicts.json을 불러왔습니다.");
  } catch (error) {
    if (!status) return;
    const message = error instanceof Error ? error.message : "자동 로드 실패";
    status.textContent = showEmptyState ? `에러: ${message}` : "호스팅된 데이터가 없어 샘플을 사용 중입니다.";
    status.className = showEmptyState ? "fmap-status fmap-status-error" : "fmap-status";
  }
}

function applyInput(rawText: string, successMessage = "JSON을 적용했습니다."): void {
  const status = container.querySelector<HTMLElement>("#fmap-status");

  try {
    const parsed = JSON.parse(rawText) as JsonRecord;
    const normalized = normalizeReport(parsed);
    state = {
      report: normalized,
      rawInput: rawText,
      selectedNodeId: normalized.tree.id,
      autoLoadAttempted: true,
    };
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

function renderTreeCanvas(tree: FileTreeNode): void {
  const canvas = container.querySelector<HTMLElement>("#fmap-canvas");
  if (!canvas) return;
  canvas.innerHTML = "";

  const width = Math.max(canvas.clientWidth, 980);
  const hierarchy = d3.hierarchy<FileTreeNode>(tree, (node) => node.children);
  const totalNodes = hierarchy.descendants().length;
  const rowHeight = totalNodes > 120 ? 20 : 30;
  const columnWidth = 220;
  const layout = d3.tree<FileTreeNode>().nodeSize([rowHeight, columnWidth]);
  layout(hierarchy);

  const nodes = hierarchy.descendants();
  const links = hierarchy.links();
  const minX = d3.min(nodes, (node) => node.x) ?? 0;
  const maxX = d3.max(nodes, (node) => node.x) ?? 0;
  const maxY = d3.max(nodes, (node) => node.y) ?? 0;

  const height = Math.max(maxX - minX + 180, 620);
  const svg = d3
    .select(canvas)
    .append("svg")
    .attr("viewBox", `0 0 ${Math.max(width, maxY + 320)} ${height}`)
    .attr("class", "fmap-svg");

  const zoomLayer = svg.append("g");
  const rootGroup = zoomLayer.append("g").attr("transform", `translate(90, ${80 - minX})`);

  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.45, 2.2])
    .on("zoom", (event) => {
      zoomLayer.attr("transform", event.transform.toString());
    });
  svg.call(zoomBehavior);
  svg.call(
    zoomBehavior.transform,
    d3.zoomIdentity.translate(12, 0).scale(width > 1200 ? 0.92 : 0.78),
  );

  rootGroup
    .append("g")
    .attr("class", "fmap-links")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<FileTreeNode>, d3.HierarchyPointNode<FileTreeNode>>()
      .x((link) => link.y)
      .y((link) => link.x))
    .attr("fill", "none")
    .attr("stroke", (link) => linkStroke(link.target.data))
    .attr("stroke-width", (link) => 1.1 + Math.min(link.target.data.metrics.riskScore * 0.3, 3.6))
    .attr("stroke-opacity", 0.46);

  const nodeGroup = rootGroup
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("transform", (node) => `translate(${node.y},${node.x})`)
    .attr("class", (node) => {
      const classes = ["fmap-node"];
      if (node.data.id === state.selectedNodeId) classes.push("is-selected");
      return classes.join(" ");
    })
    .style("cursor", "pointer")
    .on("click", (_, node) => {
      state.selectedNodeId = node.data.id;
      render();
    });

  nodeGroup
    .append("circle")
    .attr("r", (node) => nodeRadius(node.data))
    .attr("fill", (node) => nodeFill(node.data))
    .attr("stroke", (node) => nodeStroke(node.data))
    .attr("stroke-width", (node) => node.data.id === state.selectedNodeId ? 3 : 1.6);

  nodeGroup
    .append("text")
    .attr("x", (node) => node.children ? -14 : 14)
    .attr("y", 4)
    .attr("text-anchor", (node) => node.children ? "end" : "start")
    .attr("class", "fmap-label")
    .text((node) => labelForNode(node.data));

  nodeGroup
    .append("text")
    .attr("x", (node) => node.children ? -14 : 14)
    .attr("y", 21)
    .attr("text-anchor", (node) => node.children ? "end" : "start")
    .attr("class", "fmap-sub-label")
    .text((node) => metricLabel(node.data));
}

function renderNodeDetail(node: FileTreeNode): string {
  const metricRows = [
    detailMetric("파일", String(node.metrics.fileCount)),
    detailMetric("remote touch", String(node.metrics.remoteTouchCount)),
    detailMetric("worktree touch", String(node.metrics.worktreeTouchCount)),
    detailMetric("overlap", String(node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount)),
    detailMetric("hotspot", String(node.metrics.hotspotCount)),
    detailMetric("risk", String(node.metrics.riskScore)),
  ].join("");

  return `
    <div class="fmap-node-head">
      <div class="fmap-node-type">${node.kind === "dir" ? "Directory" : "File"}</div>
      <div class="fmap-node-title">${escapeHtml(node.path || "(root)")}</div>
    </div>
    <div class="fmap-node-grid">${metricRows}</div>
    ${renderSourceSection("현재 브랜치", node.pathMetrics.currentTouched ? ["current"] : [])}
    ${renderSourceSection("Remote branches", node.pathMetrics.remoteBranches)}
    ${renderSourceSection("Remote overlaps", node.pathMetrics.overlappingRemoteBranches)}
    ${renderSourceSection("Local worktrees", node.pathMetrics.worktrees)}
    ${renderSourceSection("Worktree overlaps", node.pathMetrics.overlappingWorktrees)}
    ${renderSourceSection("Hotspot members", node.pathMetrics.hotspotBranches)}
  `;
}

function renderSourceSection(title: string, values: string[]): string {
  return `
    <div class="fmap-source-block">
      <strong>${escapeHtml(title)}</strong>
      <div class="fmap-chip-list">
        ${values.length > 0
          ? values.map((value) => `<span class="fmap-chip">${escapeHtml(value)}</span>`).join("")
          : '<span class="fmap-muted">없음</span>'}
      </div>
    </div>
  `;
}

function normalizeReport(raw: JsonRecord): NormalizedReport {
  const report = "analysis" in raw
    ? raw as unknown as GitConflictReportInput
    : { analysis: raw as unknown as GitConflictAnalysis, safeScopes: [] };

  const analysis = report.analysis;
  if (!analysis?.current || !Array.isArray(analysis.current.paths)) {
    throw new Error("analysis.current.paths가 필요합니다");
  }
  if (!Array.isArray(analysis.branches)) {
    throw new Error("analysis.branches가 배열이어야 합니다");
  }

  const pathMap = new Map<string, PathMetrics>();
  const ensurePath = (path: string): PathMetrics => {
    const existing = pathMap.get(path);
    if (existing) return existing;
    const created: PathMetrics = {
      currentTouched: false,
      remoteBranches: [],
      overlappingRemoteBranches: [],
      worktrees: [],
      overlappingWorktrees: [],
      hotspotBranches: [],
    };
    pathMap.set(path, created);
    return created;
  };

  for (const path of analysis.current.paths) {
    ensurePath(path).currentTouched = true;
  }

  for (const branch of analysis.branches) {
    for (const path of branch.paths) {
      ensurePath(path).remoteBranches.push(branch.displayName ?? branch.branchName);
    }
    for (const path of branch.overlappingPaths ?? []) {
      ensurePath(path).overlappingRemoteBranches.push(branch.displayName ?? branch.branchName);
    }
  }

  for (const worktree of analysis.worktrees ?? []) {
    for (const path of worktree.paths) {
      ensurePath(path).worktrees.push(worktree.displayName ?? worktree.branchName);
    }
    for (const path of worktree.overlappingPaths ?? []) {
      ensurePath(path).overlappingWorktrees.push(worktree.displayName ?? worktree.branchName);
    }
  }

  for (const hotspot of analysis.hotspots ?? []) {
    ensurePath(hotspot.path).hotspotBranches.push(...hotspot.branches);
  }

  const root = createEmptyNode("", "", "dir");
  for (const [path, metrics] of pathMap.entries()) {
    insertPath(root, path, metrics);
  }
  computeMetrics(root);

  return {
    tree: root,
    stats: {
      currentFiles: analysis.current.paths.length,
      remoteBranches: analysis.branches.length,
      worktrees: analysis.worktrees?.length ?? 0,
      hotspots: analysis.hotspots?.length ?? 0,
      safeScopes: (report.safeScopes ?? []).slice(0, 12),
      baseRef: analysis.baseRef ?? "(unknown)",
      currentBranch: analysis.currentBranchName ?? analysis.current.branchName,
      remoteName: analysis.remoteName ?? "origin",
    },
  };
}

function insertPath(root: FileTreeNode, path: string, metrics: PathMetrics): void {
  const segments = path.split("/").filter(Boolean);
  let current = root;
  let currentPath = "";

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const isLeaf = index === segments.length - 1;
    let child = current.children.find((node) => node.name === segment);
    if (!child) {
      child = createEmptyNode(currentPath, segment, isLeaf ? "file" : "dir");
      current.children.push(child);
      current.children.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
    }

    if (isLeaf) {
      child.pathMetrics = dedupePathMetrics(metrics);
    }

    current = child;
  }
}

function createEmptyNode(path: string, name: string, kind: "dir" | "file"): FileTreeNode {
  return {
    id: path || "root",
    path,
    name,
    kind,
    children: [],
    pathMetrics: {
      currentTouched: false,
      remoteBranches: [],
      overlappingRemoteBranches: [],
      worktrees: [],
      overlappingWorktrees: [],
      hotspotBranches: [],
    },
    metrics: {
      fileCount: 0,
      directoryCount: 0,
      currentTouchedFiles: 0,
      remoteTouchCount: 0,
      remoteOverlapCount: 0,
      worktreeTouchCount: 0,
      worktreeOverlapCount: 0,
      hotspotCount: 0,
      riskScore: 0,
    },
  };
}

function computeMetrics(node: FileTreeNode): TreeMetrics {
  if (node.kind === "file") {
    const metrics = {
      fileCount: 1,
      directoryCount: 0,
      currentTouchedFiles: node.pathMetrics.currentTouched ? 1 : 0,
      remoteTouchCount: node.pathMetrics.remoteBranches.length,
      remoteOverlapCount: node.pathMetrics.overlappingRemoteBranches.length,
      worktreeTouchCount: node.pathMetrics.worktrees.length,
      worktreeOverlapCount: node.pathMetrics.overlappingWorktrees.length,
      hotspotCount: node.pathMetrics.hotspotBranches.length > 0 ? 1 : 0,
      riskScore: scorePathMetrics(node.pathMetrics),
    };
    node.metrics = metrics;
    return metrics;
  }

  const aggregate: TreeMetrics = {
    fileCount: 0,
    directoryCount: 1,
    currentTouchedFiles: 0,
    remoteTouchCount: 0,
    remoteOverlapCount: 0,
    worktreeTouchCount: 0,
    worktreeOverlapCount: 0,
    hotspotCount: 0,
    riskScore: 0,
  };

  for (const child of node.children) {
    const childMetrics = computeMetrics(child);
    aggregate.fileCount += childMetrics.fileCount;
    aggregate.directoryCount += childMetrics.directoryCount;
    aggregate.currentTouchedFiles += childMetrics.currentTouchedFiles;
    aggregate.remoteTouchCount += childMetrics.remoteTouchCount;
    aggregate.remoteOverlapCount += childMetrics.remoteOverlapCount;
    aggregate.worktreeTouchCount += childMetrics.worktreeTouchCount;
    aggregate.worktreeOverlapCount += childMetrics.worktreeOverlapCount;
    aggregate.hotspotCount += childMetrics.hotspotCount;
    aggregate.riskScore += childMetrics.riskScore;
  }

  node.metrics = aggregate;
  return aggregate;
}

function scorePathMetrics(metrics: PathMetrics): number {
  return (metrics.currentTouched ? 1 : 0)
    + metrics.remoteBranches.length
    + metrics.worktrees.length
    + metrics.overlappingRemoteBranches.length * 4
    + metrics.overlappingWorktrees.length * 5
    + Math.min(metrics.hotspotBranches.length, 4) * 3;
}

function dedupePathMetrics(metrics: PathMetrics): PathMetrics {
  return {
    currentTouched: metrics.currentTouched,
    remoteBranches: dedupe(metrics.remoteBranches),
    overlappingRemoteBranches: dedupe(metrics.overlappingRemoteBranches),
    worktrees: dedupe(metrics.worktrees),
    overlappingWorktrees: dedupe(metrics.overlappingWorktrees),
    hotspotBranches: dedupe(metrics.hotspotBranches),
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function findNodeById(node: FileTreeNode, id: string): FileTreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const matched = findNodeById(child, id);
    if (matched) return matched;
  }
  return null;
}

function nodeRadius(node: FileTreeNode): number {
  if (node.kind === "file") {
    return 5 + Math.min(node.metrics.riskScore, 10) * 0.65;
  }
  return 7 + Math.min(Math.sqrt(node.metrics.fileCount) * 1.8, 18);
}

function nodeFill(node: FileTreeNode): string {
  if (node.metrics.hotspotCount > 0 && node.kind === "file") return "#c0392b";
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount > 0) return "#e67e22";
  if (node.metrics.worktreeTouchCount > 0) return "#8e44ad";
  if (node.metrics.remoteTouchCount > 0) return "#2980b9";
  if (node.metrics.currentTouchedFiles > 0) return "#16a085";
  return "#cfd8dc";
}

function nodeStroke(node: FileTreeNode): string {
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount > 0) return "#943126";
  if (node.metrics.hotspotCount > 0) return "#641e16";
  return "#1f2d3d";
}

function linkStroke(node: FileTreeNode): string {
  if (node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount > 0) return "#f39c12";
  if (node.metrics.worktreeTouchCount > 0) return "#af7ac5";
  if (node.metrics.remoteTouchCount > 0) return "#7fb3d5";
  if (node.metrics.currentTouchedFiles > 0) return "#73c6b6";
  return "#d5d8dc";
}

function labelForNode(node: FileTreeNode): string {
  if (node.path === "") return "repo";
  return node.name;
}

function metricLabel(node: FileTreeNode): string {
  const overlap = node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount;
  if (node.kind === "file") {
    return `risk ${node.metrics.riskScore} · overlap ${overlap}`;
  }
  return `${node.metrics.fileCount} files · overlap ${overlap}`;
}

function summaryCard(title: string, value: string, desc: string): string {
  return `
    <div class="fmap-stat">
      <div class="fmap-stat-value">${escapeHtml(value)}</div>
      <div class="fmap-stat-title">${escapeHtml(title)}</div>
      <div class="fmap-stat-desc">${escapeHtml(desc)}</div>
    </div>
  `;
}

function legendRow(className: string, label: string): string {
  return `
    <div class="fmap-legend-row">
      <span class="fmap-swatch ${className}"></span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function detailMetric(label: string, value: string): string {
  return `
    <div class="fmap-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
