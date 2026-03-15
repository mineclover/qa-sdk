// ═══════════════════════════════════════════════════════════════════════════
//  권한 인덱스 — 2D grid page (API-backed)
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchPermCells,
  fetchPermDecode,
  type PermCellsResponse,
} from "../registry.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PermState {
  selectedValue: number | null;
}

// ── Label maps ────────────────────────────────────────────────────────────

const ENV_KO: Record<string, string> = {
  dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬",
};
const REGION_KO: Record<string, string> = { asia: "아시아", usa: "미국" };
const NS_KO: Record<string, string>     = { shop: "쇼핑몰", cms: "CMS" };

// ── Color helpers ─────────────────────────────────────────────────────────

function permDensityFill(value: number): string {
  const maxValue = 59;
  const t = value / maxValue;
  const from = [232, 238, 245];
  const to   = [30,  58,  95];
  const r = Math.round(from[0] + (to[0] - from[0]) * t * 0.75);
  const g = Math.round(from[1] + (to[1] - from[1]) * t * 0.75);
  const b = Math.round(from[2] + (to[2] - from[2]) * t * 0.75);
  return `rgb(${r},${g},${b})`;
}

function permDensityInk(value: number): string {
  return value > 36 ? "#ffffff" : "#000000";
}

// ── Side panel ────────────────────────────────────────────────────────────

function renderPermDetail(
  container: HTMLElement,
  value: number,
  data: PermCellsResponse
): void {
  const svcPos  = Math.floor(value / 6); // 0-based
  const rolePos = value % 6;             // 0-based

  const svcLabel  = data.svcLabels[svcPos];
  const roleLabel = data.roleLabels[rolePos];
  if (!svcLabel || !roleLabel) {
    container.innerHTML = `<div style="padding:1rem;color:#c0392b">디코딩 오류</div>`;
    return;
  }

  const { svcValue, svcName, env, region, namespace } = svcLabel;
  const role = roleLabel.id;
  const roleKo = roleLabel.ko;
  const roleTagClass = `role-tag-${role}`;

  container.innerHTML = `
    <div class="sp-section">
      <div class="sp-sec-header">권한 값</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">value</span>
          <span class="detail-value" style="font-size:1.4rem;font-family:var(--font-num)">${value}</span>
        </div>
        <code class="addr-code">permission:v2:${value}</code>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">서비스 (index_ref → service)</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">svc value</span>
          <span class="detail-value">${svcValue}</span>
          <span class="ref-badge"><span class="ref-badge-arrow">→</span> service:v1:${svcValue}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">env</span>
          <span class="detail-value">${env}</span>
          <span class="detail-ko">${ENV_KO[env] ?? env}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">region</span>
          <span class="detail-value">${region}</span>
          <span class="detail-ko">${REGION_KO[region] ?? region}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">svc_name</span>
          <span class="detail-value">${svcName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">namespace</span>
          <span class="detail-value">${namespace}</span>
          <span class="detail-ko">${NS_KO[namespace] ?? namespace}</span>
        </div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">역할 (role)</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">role</span>
          <span class="detail-value">
            <span class="role-tag ${roleTagClass}">${role}</span>
          </span>
          <span class="detail-ko">${roleKo}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Grid ──────────────────────────────────────────────────────────────────

function renderGrid(
  container: HTMLElement,
  state: PermState,
  data: PermCellsResponse,
  onSelect: (v: number) => void
): void {
  const { selectedValue } = state;
  const { svcLabels, roleLabels, cells } = data;

  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.svcPos},${cell.rolePos}`, cell.value);
  }

  const tbl = document.createElement("table");
  tbl.className = "xl-grid";

  const thead = tbl.createTHead();
  const headRow = thead.insertRow();

  const corner = document.createElement("th");
  corner.className = "xl-corner";
  corner.innerHTML = `<span style="font-size:0.62rem;color:var(--text-muted)">svc \\ role</span>`;
  headRow.appendChild(corner);

  roleLabels.forEach((rl, ri) => {
    const th = document.createElement("th");
    th.className = "xl-col-header";
    const letter = String.fromCharCode(65 + ri);
    th.innerHTML = `
      <span class="col-letter">${letter}</span>
      <span class="col-value">${rl.id}</span>
      <span class="col-ko">${rl.ko}</span>
    `;
    headRow.appendChild(th);
  });

  const tbody = tbl.createTBody();
  svcLabels.forEach((sl, si) => {
    const tr = tbody.insertRow();

    const rh = document.createElement("th");
    rh.className = "xl-row-header";
    rh.innerHTML = `
      <span class="row-num">${si + 1}</span>
      <span class="row-value">${sl.svcName}</span>
      <span class="row-ko">${ENV_KO[sl.env] ?? sl.env} · ${REGION_KO[sl.region] ?? sl.region} · ${NS_KO[sl.namespace] ?? sl.namespace}</span>
    `;
    tr.appendChild(rh);

    roleLabels.forEach((_rl, ri) => {
      const value = cellMap.get(`${si + 1},${ri + 1}`) ?? (si * 6 + ri);
      const td = document.createElement("td");
      td.className = "xl-cell perm-cell";
      if (value === selectedValue) td.classList.add("selected");

      const bg  = permDensityFill(value);
      const ink = permDensityInk(value);
      td.style.backgroundColor = bg;
      td.style.color = ink;

      td.innerHTML = `
        <span class="cell-id-val" style="color:${ink}">${value}</span>
        <span class="cell-coord-tag" style="color:${ink};opacity:0.7">[${si + 1},${ri + 1}]</span>
      `;

      td.addEventListener("click", () => onSelect(value));
      tr.appendChild(td);
    });
  });

  container.innerHTML = "";
  container.appendChild(tbl);
}

// ── Cached data ────────────────────────────────────────────────────────────

let _cachedPermData: PermCellsResponse | null = null;

// ── Main export ───────────────────────────────────────────────────────────

export async function renderPermissionPage(
  gridContainer: HTMLElement,
  spPlaceholder: HTMLElement,
  spContent: HTMLElement,
  state: PermState,
  onSelect: (v: number | null) => void
): Promise<void> {
  // Use cached data if available, otherwise fetch
  if (!_cachedPermData) {
    gridContainer.innerHTML = `<div style="padding:2rem;color:var(--text-muted)">로딩 중...</div>`;
    try {
      _cachedPermData = await fetchPermCells();
    } catch (e) {
      gridContainer.innerHTML = `<div style="padding:2rem;color:#c0392b">오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}</div>`;
      return;
    }
  }

  const data = _cachedPermData;

  renderGrid(gridContainer, state, data, (v) => {
    if (state.selectedValue === v) {
      onSelect(null);
    } else {
      onSelect(v);
    }
  });

  if (state.selectedValue !== null) {
    spPlaceholder.classList.add("hidden");
    spContent.classList.remove("hidden");
    renderPermDetail(spContent, state.selectedValue, data);
  } else {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
  }
}

export function updatePermSelection(
  gridContainer: HTMLElement,
  prevValue: number | null,
  newValue: number | null
): void {
  gridContainer.querySelectorAll<HTMLElement>(".xl-cell").forEach((td) => {
    const span = td.querySelector<HTMLElement>(".cell-id-val");
    if (!span) return;
    const v = Number(span.textContent);
    if (v === prevValue) td.classList.remove("selected");
    if (v === newValue)  td.classList.add("selected");
  });
}

export async function refreshPermDetail(
  spPlaceholder: HTMLElement,
  spContent: HTMLElement,
  value: number | null
): Promise<void> {
  if (value === null) {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
    return;
  }
  spPlaceholder.classList.add("hidden");
  spContent.classList.remove("hidden");

  if (!_cachedPermData) {
    spContent.innerHTML = `<div style="padding:1rem;color:var(--text-muted)">로딩 중...</div>`;
    try {
      _cachedPermData = await fetchPermCells();
    } catch (e) {
      spContent.innerHTML = `<div style="padding:1rem;color:#c0392b">오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}</div>`;
      return;
    }
  }
  renderPermDetail(spContent, value, _cachedPermData);
}
