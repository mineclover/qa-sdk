// ═══════════════════════════════════════════════════════════════════════════
//  Prefix 메타 — 축(dim) + 합성(index) prefix의 capacity/version 조회
// ═══════════════════════════════════════════════════════════════════════════

import { API_BASE } from "../registry.js";

interface DimSnapshot {
  snapshotId: string;
  entries: number;
  capacity: number;
  headroom: number;
}

interface DimMeta {
  id: string;
  type: "dim";
  kind: { type: string; indexId?: string };
  snapshots: DimSnapshot[];
}

interface IndexVersionDim {
  dimId: string;
  snapshotId: string;
  entries: number;
  capacity: number;
}

interface IndexVersionMeta {
  versionId: string;
  dims: IndexVersionDim[];
  totalCapacity: number;
  totalEntries: number;
  utilization: number;
}

interface IndexMeta {
  id: string;
  type: "index";
  dims: string[];
  versions: IndexVersionMeta[];
}

interface PrefixMetaResponse {
  dims: DimMeta[];
  indices: IndexMeta[];
}

async function fetchPrefixMeta(): Promise<PrefixMetaResponse> {
  const res = await fetch(`${API_BASE}/api/prefix-meta`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderDimCard(dim: DimMeta): string {
  return `
    <div class="pm-card pm-card-dim">
      <div class="pm-card-header">
        <span class="pm-card-icon">◇</span>
        <span class="pm-card-id">${dim.id}</span>
        <span class="pm-card-type">leaf</span>
        <span class="pm-card-kind">${dim.kind.type}${dim.kind.indexId ? ` → ${dim.kind.indexId}` : ""}</span>
      </div>
      <table class="pm-snap-table">
        <thead>
          <tr><th>snapshot</th><th>entries</th><th>capacity</th><th>headroom</th><th>사용률</th></tr>
        </thead>
        <tbody>
          ${dim.snapshots.map(s => {
            const util = s.capacity > 0 ? (s.entries / s.capacity * 100).toFixed(0) : "0";
            const barWidth = s.capacity > 0 ? (s.entries / s.capacity * 100) : 0;
            return `
            <tr>
              <td class="pm-snap-id">${s.snapshotId}</td>
              <td class="pm-num">${s.entries}</td>
              <td class="pm-num">${s.capacity}</td>
              <td class="pm-num ${s.headroom > 0 ? "pm-headroom" : ""}">${s.headroom > 0 ? `+${s.headroom}` : "0"}</td>
              <td>
                <div class="pm-bar-wrap">
                  <div class="pm-bar" style="width:${barWidth}%"></div>
                  <span class="pm-bar-label">${util}%</span>
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderIndexCard(idx: IndexMeta): string {
  return `
    <div class="pm-card pm-card-index">
      <div class="pm-card-header">
        <span class="pm-card-icon">⊞</span>
        <span class="pm-card-id">${idx.id}</span>
        <span class="pm-card-type">composite</span>
        <span class="pm-card-dims">[${idx.dims.join(", ")}]</span>
      </div>
      ${idx.versions.map(v => {
        const barWidth = v.totalCapacity > 0 ? (v.totalEntries / v.totalCapacity * 100) : 0;
        return `
        <div class="pm-ver-block">
          <div class="pm-ver-header">
            <span class="pm-ver-id">${v.versionId}</span>
            <span class="pm-ver-cap">capacity: ${v.totalCapacity.toLocaleString()}</span>
            <span class="pm-ver-used">used: ${v.totalEntries.toLocaleString()}</span>
            <div class="pm-bar-wrap pm-bar-wide">
              <div class="pm-bar" style="width:${barWidth}%"></div>
              <span class="pm-bar-label">${v.utilization}%</span>
            </div>
          </div>
          <div class="pm-dim-chips">
            ${v.dims.map(d => {
              const hasHeadroom = d.capacity > d.entries;
              return `<span class="pm-dim-chip ${hasHeadroom ? "pm-chip-headroom" : ""}">
                ${d.dimId}
                <span class="pm-chip-nums">${d.entries}/${d.capacity}</span>
                <span class="pm-chip-snap">${d.snapshotId}</span>
              </span>`;
            }).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

export async function renderPrefixMetaPage(container: HTMLElement): Promise<void> {
  container.innerHTML = `<div style="padding:16px;color:var(--text-muted)">Prefix 메타 로딩 중...</div>`;

  try {
    const data = await fetchPrefixMeta();

    container.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header">
          <h2 class="pm-title">Prefix 메타 조회</h2>
          <p class="pm-desc">
            MetaRegistry에 등록된 모든 prefix(축)의 capacity, snapshot, version별 형상을 표시합니다.
            <strong>headroom</strong>이 있는 항목은 stride 변경 없이 항목 추가가 가능합니다.
          </p>
        </div>

        <div class="pm-section">
          <div class="pm-section-title">
            <span class="pm-section-icon">⊞</span>
            합성 Prefix (Index) — ${data.indices.length}개
          </div>
          <div class="pm-grid">
            ${data.indices.map(renderIndexCard).join("")}
          </div>
        </div>

        <div class="pm-section">
          <div class="pm-section-title">
            <span class="pm-section-icon">◇</span>
            축 Prefix (Dim) — ${data.dims.length}개
          </div>
          <div class="pm-grid">
            ${data.dims.map(renderDimCard).join("")}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error-state">API 연결 실패: ${e instanceof Error ? e.message : String(e)}</div>`;
  }
}
