import { relativeToNode, summarizeNodeSources } from "./normalize.js";
import type { FileTreeNode, NodeSourceSummary, NormalizedReport, RenderState } from "./types.js";

export function renderFileMapLayout(
  container: HTMLElement,
  state: RenderState,
  activeTree: FileTreeNode,
): void {
  const selectedNode = findNodeById(activeTree, state.selectedNodeId) ?? activeTree;
  const report = state.report;

  container.innerHTML = `
    <div class="fmap-page ${state.drawerExpanded ? "is-drawer-open" : "is-drawer-collapsed"}">
      <section class="fmap-main">
        <div class="fmap-main-toolbar">
          <div>
            <h2>Hierarchy</h2>
            <p>원 크기 = 포함 파일 수, 색 = 충돌 밀도</p>
          </div>
          <div class="fmap-main-actions">
            <div class="fmap-toggle-group">
              ${viewToggle("all", "전체 변경", state.viewMode)}
              ${viewToggle("current", "현재 브랜치", state.viewMode)}
              ${viewToggle("workspace", "작업중만", state.viewMode)}
              ${viewToggle("overlap", "충돌만", state.viewMode)}
            </div>
            <button class="dsl-btn fmap-reset-view" type="button">뷰 리셋</button>
          </div>
        </div>
        <div class="fmap-canvas-shell">
          <div id="fmap-canvas" class="fmap-canvas"></div>
          <div id="fmap-minimap" class="fmap-minimap"></div>
        </div>
      </section>

      <section class="fmap-side">
        <div class="fmap-drawer-handle">
          <div class="fmap-drawer-bar"></div>
          <div class="fmap-drawer-actions">
            <button class="dsl-btn fmap-refresh-toggle" type="button">
              ${state.autoRefreshEnabled ? "자동 새로고침 끄기" : "자동 새로고침 켜기"}
            </button>
            <button class="dsl-btn fmap-drawer-toggle" type="button">
              ${state.drawerExpanded ? "정보 패널 접기" : "정보 패널 펼치기"}
            </button>
          </div>
        </div>
        <div class="fmap-drawer-content">
        <div class="fmap-panel fmap-panel-hero">
          <div class="fmap-kicker">Git Conflict Map</div>
          <h2>파일 구조 시각화</h2>
          <p class="fmap-copy">
            <code>qa-sdk git conflicts --json</code> 결과를 붙여 넣거나
            <code>/git-conflicts.json</code>을 자동 로드해서 충돌 구조를 트리로 보여줍니다.
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
          ${summaryCard("로컬 worktree", String(report.stats.worktrees), "동시 작업 중인 worktree")}
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
          <p class="fmap-hint">권장: <code>qa-sdk git conflicts --output packages/registry-ui/public/git-conflicts.json</code></p>
          <textarea class="fmap-input" id="fmap-input" spellcheck="false">${escapeHtml(state.rawInput)}</textarea>
          <div class="fmap-status" id="fmap-status"></div>
        </div>

        <div class="fmap-panel">
          <div class="fmap-panel-header">
            <h3>범례</h3>
          </div>
          <div class="fmap-legend">
            ${legendRow("fmap-swatch-current", "현재 브랜치 변경")}
            ${legendRow("fmap-swatch-workspace", "repo 작업중 변경")}
            ${legendRow("fmap-swatch-execution", "실행 위치 작업중")}
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
          ${renderNodeDetail(selectedNode, report)}
        </div>
        </div>
      </section>
    </div>
  `;
}

function findNodeById(node: FileTreeNode, id: string): FileTreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const matched = findNodeById(child, id);
    if (matched) return matched;
  }
  return null;
}

function renderNodeDetail(node: FileTreeNode, report: NormalizedReport): string {
  const metricRows = [
    detailMetric("파일", String(node.metrics.fileCount)),
    detailMetric("repo workspace", String(node.metrics.workspaceTouchedFiles)),
    detailMetric("cwd workspace", String(node.metrics.executionWorkspaceTouchedFiles)),
    detailMetric("remote touch", String(node.metrics.remoteTouchCount)),
    detailMetric("worktree touch", String(node.metrics.worktreeTouchCount)),
    detailMetric("overlap", String(node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount)),
    detailMetric("hotspot", String(node.metrics.hotspotCount)),
    detailMetric("risk", String(node.metrics.riskScore)),
  ].join("");
  const sourceSummaries = summarizeNodeSources(node, report.sources);

  return `
    <div class="fmap-node-head">
      <div class="fmap-node-type">${node.kind === "dir" ? "Directory" : "File"}</div>
      <div class="fmap-node-title">${escapeHtml(node.path || "(root)")}</div>
    </div>
    <div class="fmap-node-grid">${metricRows}</div>
    ${renderSourceSection("현재 브랜치", node.pathMetrics.currentTouched ? ["current"] : [])}
    ${renderSourceSection("작업중 변경", node.pathMetrics.workspaceTouched ? ["workspace"] : [])}
    ${renderSourceSection("실행 위치 변경", node.pathMetrics.executionWorkspaceTouched ? ["execution"] : [])}
    ${renderSourceSection("Remote branches", node.pathMetrics.remoteBranches)}
    ${renderSourceSection("Remote overlaps", node.pathMetrics.overlappingRemoteBranches)}
    ${renderSourceSection("Local worktrees", node.pathMetrics.worktrees)}
    ${renderSourceSection("Worktree overlaps", node.pathMetrics.overlappingWorktrees)}
    ${renderSourceSection("Workspace overlaps", node.pathMetrics.overlappingWorkspaceTargets)}
    ${renderSourceSection("Hotspot members", node.pathMetrics.hotspotBranches)}
    ${renderNodeSummaryBanner(node)}
    <div class="fmap-source-block">
      <strong>변경 요약</strong>
      <div class="fmap-source-summary-list">
        ${sourceSummaries.length > 0
          ? sourceSummaries.map((summary) => renderSourceSummaryCard(node, summary)).join("")
          : '<span class="fmap-muted">선택 영역 아래 변경 상세가 없습니다</span>'}
      </div>
    </div>
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

function renderSourceSummaryCard(node: FileTreeNode, summary: NodeSourceSummary): string {
  const previewFiles = summary.files.slice(0, 5).map((file) => {
    const relative = relativeToNode(node, file.path);
    const rename = file.previousPath ? ` <= ${escapeHtml(relativeToNode(node, file.previousPath))}` : "";
    const binary = file.binary ? " [binary]" : "";
    const overlapClass = summary.overlapCount > 0 && summaryHasOverlap(summary, file.path) ? "is-overlap" : "";
    return `
      <div class="fmap-file-row ${overlapClass}">
        <span class="fmap-file-status">${escapeHtml(file.status)}</span>
        <span class="fmap-file-path">${escapeHtml(relative)}${rename}${binary}</span>
      </div>
    `;
  }).join("");

  const previewCommits = summary.commits.slice(0, 4).map((commit) => {
    const touchedPaths = commit.changedPaths
      .filter((path) => path === node.path || path.startsWith(`${node.path}/`) || node.path === "")
      .slice(0, 3)
      .map((path) => `<span class="fmap-commit-path">${escapeHtml(relativeToNode(node, path))}</span>`)
      .join("");

    return `
      <div class="fmap-commit-row">
        <div class="fmap-commit-head">
          <span class="fmap-commit-oid">${escapeHtml(commit.shortOid)}</span>
          <span class="fmap-commit-meta">${escapeHtml(formatDate(commit.committedAt))} · ${escapeHtml(commit.authorName)}</span>
        </div>
        <div class="fmap-commit-summary">${escapeHtml(commit.summary)}</div>
        <div class="fmap-commit-tags">
          ${commit.conventionalType ? `<span class="fmap-commit-tag">${escapeHtml(commit.conventionalType)}</span>` : ""}
          ${commit.conventionalScope ? `<span class="fmap-commit-tag">${escapeHtml(commit.conventionalScope)}</span>` : ""}
          ${commit.breaking ? '<span class="fmap-commit-tag fmap-commit-tag-breaking">breaking</span>' : ""}
        </div>
        ${touchedPaths ? `<div class="fmap-commit-paths">${touchedPaths}</div>` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="fmap-source-card fmap-source-${summary.type}">
      <div class="fmap-source-card-head">
        <div>
          <div class="fmap-source-label">${escapeHtml(summary.label)}</div>
          ${summary.worktreePath ? `<div class="fmap-source-meta">${escapeHtml(summary.worktreePath)}</div>` : ""}
        </div>
        <div class="fmap-source-count">${summary.fileCount} files</div>
      </div>
      <div class="fmap-source-badges">
        ${summary.statusCounts.map((entry) => statusBadge(entry.status, entry.count)).join("")}
        ${summary.overlapCount > 0 ? `<span class="fmap-status-pill fmap-status-overlap">overlap ${summary.overlapCount}</span>` : ""}
        <span class="fmap-status-pill fmap-status-touched">commits ${summary.commitCount}</span>
        <span class="fmap-status-pill fmap-status-touched">files ${summary.diffStats.filesChanged}</span>
        <span class="fmap-status-pill fmap-status-added">+${summary.diffStats.insertions}</span>
        <span class="fmap-status-pill fmap-status-deleted">-${summary.diffStats.deletions}</span>
      </div>
      ${summary.splitPoint ? `
        <details class="fmap-split-point">
          <summary class="fmap-split-summary-row">
            <span class="fmap-split-label">분기점</span>
            <span class="fmap-commit-oid">${escapeHtml(summary.splitPoint.shortOid)}</span>
            <span class="fmap-commit-meta">${escapeHtml(formatDate(summary.splitPoint.committedAt))} · ${escapeHtml(summary.splitPoint.authorName)}</span>
          </summary>
          <div class="fmap-split-main">
            <div class="fmap-split-summary">${escapeHtml(summary.splitPoint.summary)}</div>
            <div class="fmap-source-badges">
              <span class="fmap-status-pill fmap-status-touched">files ${summary.splitPoint.diffStats.filesChanged}</span>
              <span class="fmap-status-pill fmap-status-added">+${summary.splitPoint.diffStats.insertions}</span>
              <span class="fmap-status-pill fmap-status-deleted">-${summary.splitPoint.diffStats.deletions}</span>
            </div>
            <div class="fmap-commit-paths">
              ${summary.splitPoint.changedPaths.length > 0
                ? summary.splitPoint.changedPaths.map((path) => `<span class="fmap-commit-path">${escapeHtml(relativeToNode(node, path))}</span>`).join("")
                : '<span class="fmap-muted">분기점 변경 파일 없음</span>'}
            </div>
          </div>
        </details>
      ` : ""}
      <div class="fmap-file-list">${previewFiles}</div>
      ${summary.files.length > 5 ? `<div class="fmap-file-more">… ${summary.files.length - 5}개 추가 파일</div>` : ""}
      <div class="fmap-commit-list">
        <div class="fmap-commit-title">최근 커밋</div>
        ${summary.commits.length > 0
          ? previewCommits
          : '<div class="fmap-muted">선택 영역에 매칭되는 커밋이 없습니다</div>'}
        ${summary.commits.length > 4 ? `<div class="fmap-file-more">… ${summary.commits.length - 4}개 추가 커밋</div>` : ""}
      </div>
    </div>
  `;
}

function renderNodeSummaryBanner(node: FileTreeNode): string {
  return `
    <div class="fmap-node-banner">
      <span class="fmap-status-pill fmap-status-touched">files ${node.metrics.fileCount}</span>
      <span class="fmap-status-pill fmap-status-added">current ${node.metrics.currentTouchedFiles}</span>
      <span class="fmap-status-pill fmap-status-workspace">workspace ${node.metrics.workspaceTouchedFiles}</span>
      <span class="fmap-status-pill fmap-status-execution">cwd ${node.metrics.executionWorkspaceTouchedFiles}</span>
      <span class="fmap-status-pill fmap-status-remote">remote ${node.metrics.remoteTouchCount}</span>
      <span class="fmap-status-pill fmap-status-worktree">worktree ${node.metrics.worktreeTouchCount}</span>
      <span class="fmap-status-pill fmap-status-overlap">overlap ${node.metrics.remoteOverlapCount + node.metrics.worktreeOverlapCount + node.metrics.workspaceOverlapCount}</span>
    </div>
  `;
}

function summaryHasOverlap(summary: NodeSourceSummary, path: string): boolean {
  return summary.overlapCount > 0
    && summary.files.some((file) => file.path === path)
    && summary.type !== "current";
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

function viewToggle(
  value: "all" | "current" | "workspace" | "overlap",
  label: string,
  current: "all" | "current" | "workspace" | "overlap",
): string {
  const active = value === current ? "is-active" : "";
  return `<button class="fmap-toggle ${active}" data-view-mode="${value}" type="button">${escapeHtml(label)}</button>`;
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

function statusBadge(status: string, count: number): string {
  const normalized = status.toLowerCase();
  const variant = normalized.includes("add")
    ? "added"
    : normalized.includes("delete")
      ? "deleted"
      : normalized.includes("rename")
        ? "renamed"
        : normalized.includes("copy")
          ? "copied"
          : normalized.includes("modify")
            ? "modified"
            : "touched";

  return `<span class="fmap-status-pill fmap-status-${variant}">${escapeHtml(status)} ${count}</span>`;
}

function formatDate(value: string): string {
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
