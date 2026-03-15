// ═══════════════════════════════════════════════════════════════════════════
//  이벤트 인덱스 — 3D grid page (API-backed)
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchEvtCells,
  type EvtCellsResponse,
} from "../registry.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface EventState {
  fixedInitiator: number; // 1-based: 1=web, 2=mobile
  selectedValue: number | null;
}

// ── Color helpers ─────────────────────────────────────────────────────────

function evtDensityFill(value: number): string {
  const maxValue = 179;
  const t = value / maxValue;
  const from = [232, 238, 245];
  const to   = [30,  58,  95];
  const r = Math.round(from[0] + (to[0] - from[0]) * t * 0.8);
  const g = Math.round(from[1] + (to[1] - from[1]) * t * 0.8);
  const b = Math.round(from[2] + (to[2] - from[2]) * t * 0.8);
  return `rgb(${r},${g},${b})`;
}

function evtDensityInk(value: number): string {
  return value > 100 ? "#ffffff" : "#000000";
}

// ── Event type → tag class ─────────────────────────────────────────────────

function evtTagClass(event: string): string {
  if (event.startsWith("user."))    return "evt-tag evt-tag-user";
  if (event.startsWith("order."))   return "evt-tag evt-tag-order";
  if (event.startsWith("payment.")) return "evt-tag evt-tag-payment";
  if (event.startsWith("session.")) return "evt-tag evt-tag-session";
  if (event.startsWith("config."))  return "evt-tag evt-tag-config";
  return "evt-tag";
}

// ── Side panel ────────────────────────────────────────────────────────────

function renderEventDetail(
  container: HTMLElement,
  value: number,
  data: EvtCellsResponse
): void {
  // Decode: value = (svc_pos-1)*18 + (evt_pos-1)*2 + (init_pos-1)
  const svcPos  = Math.floor(value / 18) + 1;
  const rem1    = value % 18;
  const evtPos  = Math.floor(rem1 / 2) + 1;
  const initPos = (rem1 % 2) + 1;

  const svcLabel = data.svcLabels[svcPos - 1];
  const evtLabel = data.eventLabels[evtPos - 1];
  const initiator = initPos === 1 ? "web" : "mobile";

  if (!svcLabel || !evtLabel) {
    container.innerHTML = `<div style="padding:1rem;color:#c0392b">디코딩 오류</div>`;
    return;
  }

  const ENV_KO: Record<string, string> = {
    dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬"
  };
  const INIT_KO: Record<string, string> = { web: "웹", mobile: "모바일" };

  container.innerHTML = `
    <div class="sp-section">
      <div class="sp-sec-header">이벤트 값</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">value</span>
          <span class="detail-value" style="font-size:1.4rem;font-family:var(--font-num)">${value}</span>
        </div>
        <code class="addr-code">event:v2:${value}</code>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">서비스 (index_ref → service)</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">svc value</span>
          <span class="detail-value">${svcLabel.svcValue}</span>
          <span class="ref-badge"><span class="ref-badge-arrow">→</span> service:v1:${svcLabel.svcValue}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">env</span>
          <span class="detail-value">${svcLabel.env}</span>
          <span class="detail-ko">${ENV_KO[svcLabel.env] ?? svcLabel.env}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">svc_name</span>
          <span class="detail-value">${svcLabel.svcName}</span>
        </div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">이벤트 / 발원</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">event</span>
          <span class="detail-value">
            <span class="${evtTagClass(evtLabel.id)}">${evtLabel.id}</span>
          </span>
          <span class="detail-ko">${evtLabel.ko}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">initiator</span>
          <span class="detail-value">${initiator}</span>
          <span class="detail-ko">${INIT_KO[initiator] ?? initiator}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Initiator toggle bar ──────────────────────────────────────────────────

const INITIATORS = ["web", "mobile"] as const;
const INIT_KO: Record<string, string> = { web: "웹", mobile: "모바일" };

function renderInitiatorBar(
  container: HTMLElement,
  fixedInitiator: number,
  onChange: (init: number) => void
): void {
  container.innerHTML = `
    <span class="initiator-label">발원 (initiator):</span>
    ${INITIATORS.map((init, i) => `
      <button class="init-btn${fixedInitiator === i + 1 ? " active" : ""}" data-init="${i + 1}">
        ${init} · ${INIT_KO[init] ?? init}
      </button>
    `).join("")}
  `;

  container.querySelectorAll<HTMLButtonElement>(".init-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const init = Number(btn.dataset.init);
      if (init) onChange(init);
    });
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────

function renderGrid(
  container: HTMLElement,
  state: EventState,
  data: EvtCellsResponse,
  onSelect: (v: number) => void
): void {
  const { selectedValue } = state;
  const { svcLabels, eventLabels, cells } = data;

  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.svcPos},${cell.evtPos}`, cell.value);
  }

  const tbl = document.createElement("table");
  tbl.className = "xl-grid";

  const thead = tbl.createTHead();
  const headRow = thead.insertRow();

  const corner = document.createElement("th");
  corner.className = "xl-corner";
  corner.innerHTML = `<span style="font-size:0.62rem;color:var(--text-muted)">svc \\ event</span>`;
  headRow.appendChild(corner);

  eventLabels.forEach((el, ei) => {
    const th = document.createElement("th");
    th.className = "xl-col-header";
    const letter = String.fromCharCode(65 + ei);
    th.innerHTML = `
      <span class="col-letter">${letter}</span>
      <span class="col-value" style="font-size:0.68rem">${el.id}</span>
      <span class="col-ko">${el.ko}</span>
    `;
    headRow.appendChild(th);
  });

  const ENV_KO_SIMPLE: Record<string, string> = {
    dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬"
  };

  const tbody = tbl.createTBody();
  svcLabels.forEach((sl, si) => {
    const tr = tbody.insertRow();

    const rh = document.createElement("th");
    rh.className = "xl-row-header";
    rh.innerHTML = `
      <span class="row-num">${si + 1}</span>
      <span class="row-value">${sl.svcName}</span>
      <span class="row-ko">${sl.env} · ${ENV_KO_SIMPLE[sl.env] ?? sl.env}</span>
    `;
    tr.appendChild(rh);

    eventLabels.forEach((_el, ei) => {
      const value = cellMap.get(`${si + 1},${ei + 1}`) ?? 0;
      const td = document.createElement("td");
      td.className = "xl-cell evt-cell";
      if (value === selectedValue) td.classList.add("selected");

      const bg  = evtDensityFill(value);
      const ink = evtDensityInk(value);
      td.style.backgroundColor = bg;
      td.style.color = ink;

      td.innerHTML = `
        <span class="cell-id-val" style="color:${ink}">${value}</span>
        <span class="cell-coord-tag" style="color:${ink};opacity:0.7">[${si + 1},${ei + 1}]</span>
      `;

      td.addEventListener("click", () => onSelect(value));
      tr.appendChild(td);
    });
  });

  container.innerHTML = "";
  container.appendChild(tbl);
}

// ── Cached data ────────────────────────────────────────────────────────────

const _evtCache = new Map<string, EvtCellsResponse>();

// ── Main export ───────────────────────────────────────────────────────────

export async function renderEventPage(
  gridContainer: HTMLElement,
  initBarContainer: HTMLElement,
  spPlaceholder: HTMLElement,
  spContent: HTMLElement,
  state: EventState,
  onSelect: (v: number | null) => void,
  onInitiatorChange: (init: number) => void
): Promise<void> {
  const initiator = state.fixedInitiator === 1 ? "web" : "mobile";

  // Initiator bar (synchronous)
  renderInitiatorBar(initBarContainer, state.fixedInitiator, onInitiatorChange);

  // Fetch or use cached data
  if (!_evtCache.has(initiator)) {
    gridContainer.innerHTML = `<div style="padding:2rem;color:var(--text-muted)">로딩 중...</div>`;
    try {
      const data = await fetchEvtCells(initiator);
      _evtCache.set(initiator, data);
    } catch (e) {
      gridContainer.innerHTML = `<div style="padding:2rem;color:#c0392b">오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}</div>`;
      return;
    }
  }

  const data = _evtCache.get(initiator)!;

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
    renderEventDetail(spContent, state.selectedValue, data);
  } else {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
  }
}

export function updateEventSelection(
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

export function refreshEventDetail(
  spPlaceholder: HTMLElement,
  spContent: HTMLElement,
  value: number | null,
  initiator: string
): void {
  if (value === null) {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
    return;
  }
  const data = _evtCache.get(initiator);
  if (!data) {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
    return;
  }
  spPlaceholder.classList.add("hidden");
  spContent.classList.remove("hidden");
  renderEventDetail(spContent, value, data);
}
