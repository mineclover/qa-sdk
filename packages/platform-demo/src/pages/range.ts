// ═══════════════════════════════════════════════════════════════════════════
//  범위 탐색 — 차원 고정/와일드카드로 주소 범위 시각화
// ═══════════════════════════════════════════════════════════════════════════

import { serializeAddress } from "weighted-index";
import {
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS, DEMO_KO,
  DEMO_SVC_STRIDES, DEMO_SVC_SHAPE,
} from "demo-snapshot";

const SVC_PREFIX = "service";
const SVC_VER    = "v1";

function svcAddr(index: number): string {
  return serializeAddress({ schema: SVC_PREFIX, version: SVC_VER, index }, "colon");
}

// ── Dimension metadata (service:v1 shape [5,2,5,2] = 100) ────────────────

interface DimMeta {
  key:    string;
  label:  string;
  size:   number;
  stride: number;
  values: { idx1: number; id: string; ko: string }[];
}

const DIMS: DimMeta[] = [
  {
    key: "env", label: "환경 (env)", size: DEMO_ENVS.length, stride: DEMO_SVC_STRIDES[0],
    values: DEMO_ENVS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.env[id] })),
  },
  {
    key: "region", label: "리전 (region)", size: DEMO_REGIONS.length, stride: DEMO_SVC_STRIDES[1],
    values: DEMO_REGIONS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.region[id] })),
  },
  {
    key: "svc_name", label: "서비스 (svc_name)", size: DEMO_SVCS.length, stride: DEMO_SVC_STRIDES[2],
    values: DEMO_SVCS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.svc[id] })),
  },
  {
    key: "namespace", label: "네임스페이스 (ns)", size: DEMO_NSS.length, stride: DEMO_SVC_STRIDES[3],
    values: DEMO_NSS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.ns[id] })),
  },
];

const TOTAL_SLOTS = DEMO_SVC_SHAPE.reduce((a: number, b: number) => a * b, 1);

// ── State ─────────────────────────────────────────────────────────────────

// null = wildcard (n)
type DimSelection = number | null;

interface RangeState {
  selections: DimSelection[]; // index by DIMS order
}

// ── Compute matching addresses ────────────────────────────────────────────

function computeRange(selections: DimSelection[]): number[] {
  // Start with a single partial sum [0], then for each dimension either
  // add a fixed offset or fan out across all values.
  let partials = [0];

  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const sel = selections[d];
    const next: number[] = [];

    if (sel !== null) {
      // Fixed: add (sel-1)*stride to every partial
      const offset = (sel - 1) * dim.stride;
      for (const p of partials) next.push(p + offset);
    } else {
      // Wildcard: fan out for every value
      for (const v of dim.values) {
        const offset = (v.idx1 - 1) * dim.stride;
        for (const p of partials) next.push(p + offset);
      }
    }

    partials = next;
  }

  return partials.toSorted((a, b) => a - b);
}

// ── Decode a value back to 4D coordinates ─────────────────────────────────

function decodeValue(v: number): { dimIdx1: number; id: string; ko: string }[] {
  const result: { dimIdx1: number; id: string; ko: string }[] = [];
  let remainder = v;
  for (const dim of DIMS) {
    const idx0 = Math.floor(remainder / dim.stride);
    remainder = remainder % dim.stride;
    const entry = dim.values[idx0];
    result.push({ dimIdx1: idx0 + 1, id: entry?.id ?? "?", ko: entry?.ko ?? "?" });
  }
  return result;
}

// ── Build formula string ──────────────────────────────────────────────────

function buildFormula(selections: DimSelection[]): string {
  const parts: string[] = [];
  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const sel = selections[d];
    if (sel !== null) {
      parts.push(`(${sel}-1)×${dim.stride}`);
    } else {
      parts.push(`(n-1)×${dim.stride}`);
    }
  }
  return parts.join(" + ");
}

function buildCoordDisplay(selections: DimSelection[]): string {
  return "[" + selections.map((s, i) => {
    if (s !== null) {
      const v = DIMS[i].values[s - 1];
      return v ? v.id : String(s);
    }
    return "n";
  }).join(", ") + "]";
}

// ── Render ────────────────────────────────────────────────────────────────

export function renderRangePage(container: HTMLElement): void {
  container.innerHTML = "";

  const st: RangeState = {
    selections: [3, 1, null, 1], // default: prod, asia, n, shop
  };

  // Pin state: click a cell to lock its detail (allows text selection / copy)
  let pinnedCell: number | null = null;

  const wrap = document.createElement("div");
  wrap.className = "rng-wrap";

  // ── Two-column layout ─────────────────────────────────────────────────
  const columns = document.createElement("div");
  columns.className = "rng-columns";

  // ── LEFT PANEL: controls + formula + detail ───────────────────────────
  const left = document.createElement("div");
  left.className = "rng-left";

  // Header
  const header = document.createElement("div");
  header.className = "rng-header";
  header.innerHTML = `
    <h2 class="rng-title">범위 탐색 시뮬레이터</h2>
    <p class="rng-desc">
      차원 값을 고정하거나 <strong>n</strong>으로 설정하여,
      해당 조건에 매칭되는 주소 범위를 탐색합니다.
    </p>
  `;
  left.appendChild(header);

  // Dimension controls
  const controls = document.createElement("div");
  controls.className = "rng-controls";

  const dimRows: HTMLElement[] = [];

  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const row = document.createElement("div");
    row.className = "rng-dim-row";

    const label = document.createElement("div");
    label.className = "rng-dim-label";
    label.innerHTML = `
      <span class="rng-dim-key">${dim.key}</span>
      <span class="rng-dim-info">${dim.label} · size ${dim.size} · stride ${dim.stride}</span>
    `;
    row.appendChild(label);

    const btns = document.createElement("div");
    btns.className = "rng-dim-btns";

    // Wildcard button
    const wBtn = document.createElement("button");
    wBtn.className = "rng-btn rng-btn-wild" + (st.selections[d] === null ? " rng-btn-active-wild" : "");
    wBtn.textContent = "n";
    wBtn.title = "와일드카드 — 이 차원의 모든 값";
    wBtn.addEventListener("click", () => {
      st.selections[d] = null;
      repaint();
    });
    btns.appendChild(wBtn);

    // Value buttons
    for (const v of dim.values) {
      const btn = document.createElement("button");
      btn.className = "rng-btn" + (st.selections[d] === v.idx1 ? " rng-btn-active" : "");
      btn.innerHTML = `<span class="rng-btn-id">${v.id}</span><span class="rng-btn-ko">${v.ko}</span>`;
      btn.title = `${v.id} (${v.ko}) — idx ${v.idx1}`;
      btn.addEventListener("click", () => {
        st.selections[d] = v.idx1;
        repaint();
      });
      btns.appendChild(btn);
    }

    row.appendChild(btns);
    controls.appendChild(row);
    dimRows.push(row);
  }

  left.appendChild(controls);

  // Formula display
  const formulaEl = document.createElement("div");
  formulaEl.className = "rng-formula";
  left.appendChild(formulaEl);

  // Detail panel
  const detail = document.createElement("div");
  detail.className = "rng-detail";
  left.appendChild(detail);

  // ── LEFT PANEL: grid (fixed size) ────────────────────────────────────
  const right = document.createElement("div");
  right.className = "rng-right";

  const gridTitle = document.createElement("div");
  gridTitle.className = "rng-grid-title";
  right.appendChild(gridTitle);

  const grid = document.createElement("div");
  grid.className = "rng-grid";
  right.appendChild(grid);

  columns.appendChild(right);
  columns.appendChild(left);

  wrap.appendChild(columns);
  container.appendChild(wrap);

  // ── Repaint ───────────────────────────────────────────────────────────
  function repaint(): void {
    // Reset pin on dimension change (grid is rebuilt)
    pinnedCell = null;
    detail.className = "rng-detail";

    const matched = computeRange(st.selections);
    const matchedSet = new Set(matched);
    const wildcardDims = st.selections.reduce<number>((c, s) => c + (s === null ? 1 : 0), 0);

    // Update button active states
    for (let d = 0; d < DIMS.length; d++) {
      const row = dimRows[d];
      const buttons = row.querySelectorAll<HTMLButtonElement>(".rng-btn");
      buttons.forEach((btn, bi) => {
        if (bi === 0) {
          // wildcard button
          btn.classList.toggle("rng-btn-active-wild", st.selections[d] === null);
        } else {
          btn.classList.toggle("rng-btn-active", st.selections[d] === DIMS[d].values[bi - 1].idx1);
        }
      });
    }

    // Formula
    const coord = buildCoordDisplay(st.selections);
    const formula = buildFormula(st.selections);
    formulaEl.innerHTML = `
      <div class="rng-formula-coord">
        <span class="rng-formula-label">좌표</span>
        <code class="rng-formula-code">${coord}</code>
      </div>
      <div class="rng-formula-expr">
        <span class="rng-formula-label">수식</span>
        <code class="rng-formula-code">${formula}</code>
      </div>
      <div class="rng-formula-result">
        <span class="rng-formula-label">매칭</span>
        <code class="rng-formula-code">${matched.length}개 주소${wildcardDims > 0 ? ` (${wildcardDims}개 차원 와일드카드)` : " (완전 고정)"}</code>
      </div>
    `;

    // Grid title
    gridTitle.innerHTML = `
      <span class="rng-grid-title-text">서비스 주소 공간 0–99</span>
      <span class="rng-grid-title-count">
        <span class="rng-count-matched">${matched.length}</span> / ${TOTAL_SLOTS}
      </span>
    `;

    // Grid cells
    grid.innerHTML = "";
    for (let row = 0; row < 10; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "rng-grid-row";

      // Row header
      const rh = document.createElement("div");
      rh.className = "rng-grid-rh";
      rh.textContent = String(row * 10);
      rowEl.appendChild(rh);

      for (let col = 0; col < 10; col++) {
        const v = row * 10 + col;
        const cell = document.createElement("div");
        cell.className = "rng-cell" + (matchedSet.has(v) ? " rng-cell-hit" : "");
        cell.innerHTML = `<span class="rng-cell-val">${v}</span><span class="rng-cell-addr">${svcAddr(v)}</span>`;

        cell.addEventListener("mouseenter", () => {
          if (pinnedCell === null) showDetail(v, matchedSet.has(v));
        });
        cell.addEventListener("mouseleave", () => {
          if (pinnedCell === null) clearDetail();
        });
        cell.addEventListener("click", () => {
          if (pinnedCell === v) {
            // Unpin
            pinnedCell = null;
            cell.classList.remove("rng-cell-pinned");
            clearDetail();
          } else {
            // Unpin previous
            const prev = grid.querySelector(".rng-cell-pinned");
            if (prev) prev.classList.remove("rng-cell-pinned");
            // Pin new
            pinnedCell = v;
            cell.classList.add("rng-cell-pinned");
            showDetail(v, matchedSet.has(v), true);
          }
        });

        rowEl.appendChild(cell);
      }

      grid.appendChild(rowEl);
    }

    // Show range summary in detail
    if (matched.length > 0 && matched.length <= 20) {
      detail.innerHTML = buildRangeSummary(matched);
    } else if (matched.length > 20) {
      detail.innerHTML = buildRangeSummary(matched.slice(0, 10), matched.length);
    } else {
      detail.innerHTML = `<div class="rng-detail-empty">차원을 설정하면 매칭 결과가 여기에 표시됩니다.</div>`;
    }
  }

  function buildRangeSummary(addresses: number[], total?: number): string {
    const rows = addresses.map((v) => {
      const coords = decodeValue(v);
      const coordStr = coords.map((c, i) => {
        const isWild = st.selections[i] === null;
        return `<span class="rng-coord-val${isWild ? " rng-coord-wild" : ""}">${c.id}</span>`;
      }).join(`<span class="rng-coord-sep">·</span>`);
      return `
        <div class="rng-summary-row">
          <span class="rng-summary-val">${v}</span>
          <span class="rng-summary-coords">${coordStr}</span>
        </div>`;
    }).join("");

    const more = total && total > addresses.length
      ? `<div class="rng-summary-more">… 외 ${total - addresses.length}개</div>`
      : "";

    return `<div class="rng-summary">${rows}${more}</div>`;
  }

  function showDetail(v: number, isMatch: boolean, pinned = false): void {
    const coords = decodeValue(v);
    const coordParts = coords.map((c, i) => {
      const dim = DIMS[i];
      const isWild = st.selections[i] === null;
      return `
        <div class="rng-dtl-dim${isWild ? " rng-dtl-wild" : ""}">
          <span class="rng-dtl-key">${dim.key}</span>
          <span class="rng-dtl-val">${c.id}</span>
          <span class="rng-dtl-ko">${c.ko}</span>
          ${isWild ? '<span class="rng-dtl-badge">n</span>' : ""}
        </div>`;
    }).join("");

    const pinnedIcon = pinned
      ? '<span class="rng-dtl-pin" title="클릭하여 고정 해제">📌</span>'
      : "";

    detail.className = "rng-detail" + (pinned ? " rng-detail-pinned" : "");
    detail.innerHTML = `
      <div class="rng-detail-hover">
        <div class="rng-dtl-header">
          <span class="rng-dtl-value">${v}</span>
          <span class="rng-dtl-status ${isMatch ? "rng-dtl-match" : "rng-dtl-miss"}">${isMatch ? "매칭" : "미매칭"}</span>
          ${pinnedIcon}
        </div>
        <div class="rng-dtl-coords">${coordParts}</div>
      </div>`;
  }

  function clearDetail(): void {
    // If pinned, don't clear — keep showing pinned cell's detail
    if (pinnedCell !== null) return;

    detail.className = "rng-detail";
    const matched = computeRange(st.selections);
    if (matched.length > 0 && matched.length <= 20) {
      detail.innerHTML = buildRangeSummary(matched);
    } else if (matched.length > 20) {
      detail.innerHTML = buildRangeSummary(matched.slice(0, 10), matched.length);
    } else {
      detail.innerHTML = `<div class="rng-detail-empty">차원을 설정하면 매칭 결과가 여기에 표시됩니다.</div>`;
    }
  }

  // Initial render
  repaint();
}
