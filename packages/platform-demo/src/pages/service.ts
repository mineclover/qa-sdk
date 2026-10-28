// @def.boundary platform-demo-system
// @def.doc platform-demo-system

// ═══════════════════════════════════════════════════════════════════════════
//  서비스 인덱스 — 4D grid page (catalog-backed mock read model)
// ═══════════════════════════════════════════════════════════════════════════

import type { ServiceCellsResponse, ServiceDecodeResponse } from '../registry.js';
import { fetchMockServiceCells, fetchMockServiceDecode } from '../mock-service-api.js';
import { densityFill, densityInk } from 'weighted-ui';
import {
  DEMO_ENVS,
  DEMO_REGIONS,
  DEMO_SVCS,
  DEMO_NSS,
  DEMO_KO,
  DEMO_PERM_SVC_VALUES,
  DEMO_EVT_SVC_VALUES,
  DEMO_SVC_SHAPE,
  DEMO_SVC_STRIDES,
  DEMO_ROLE_CAP,
  DEMO_EVENT_CAP,
  DEMO_INITIATORS,
  demoCalcPermAddr,
  demoRolesFor,
  demoEventsFor,
  type DemoVer,
} from 'demo-snapshot';
import { EVENT_INITIATOR_CAP, eventAddress } from '../event-address.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type SvcDimKey = 'env' | 'region' | 'svc_name' | 'namespace';

export interface ServiceState {
  xDim: SvcDimKey;
  yDim: SvcDimKey;
  fixed: Record<SvcDimKey, number>; // 1-based
  selectedValue: number | null;
}

// ── Dimension metadata (for axis bar labels only — no codec needed) ────────

const DIM_META: Record<SvcDimKey, { label: string; size: number; entries: number }> = {
  env: { label: '환경 (env)', size: DEMO_SVC_SHAPE[0], entries: DEMO_ENVS.length },
  region: { label: '리전 (region)', size: DEMO_SVC_SHAPE[1], entries: DEMO_REGIONS.length },
  svc_name: { label: '서비스 (svc)', size: DEMO_SVC_SHAPE[2], entries: DEMO_SVCS.length },
  namespace: { label: '네임스페이스 (ns)', size: DEMO_SVC_SHAPE[3], entries: DEMO_NSS.length },
};

const ALL_DIMS: readonly SvcDimKey[] = ['env', 'region', 'svc_name', 'namespace'] as const;

const SERVICE_CAPACITY = DEMO_SVC_SHAPE.reduce((total, capacity) => total * capacity, 1);
const SERVICE_VALID_ENTRIES =
  DEMO_ENVS.length * DEMO_REGIONS.length * DEMO_SVCS.length * DEMO_NSS.length;

function serviceFormula(): string {
  const labels = ['env', 'region', 'svc_name', 'ns'];
  return `encode([${labels.join(', ')}]) = ${labels
    .map((label, index) => `(${label}−1)×${DEMO_SVC_STRIDES[index]}`)
    .join(' + ')}`;
}

function serviceCatalogSummary(): string {
  const entries = `[${DEMO_ENVS.length}, ${DEMO_REGIONS.length}, ${DEMO_SVCS.length}, ${DEMO_NSS.length}]`;
  const capacity = `[${DEMO_SVC_SHAPE.join(', ')}]`;
  return `${serviceFormula()} · entries ${entries} · capacity ${capacity} · 유효 ${SERVICE_VALID_ENTRIES}개 / 주소 0–${SERVICE_CAPACITY - 1}`;
}

// ── Env tag ───────────────────────────────────────────────────────────────

function envTagClass(env: string): string {
  const map: Record<string, string> = {
    dev: 'svc-tag-dev',
    stage: 'svc-tag-stage',
    prod: 'svc-tag-prod',
    test: 'svc-tag-test',
    local: 'svc-tag-local',
  };
  return map[env] ?? '';
}

// ── Side panel ────────────────────────────────────────────────────────────

function renderServiceDetail(
  container: HTMLElement,
  value: number,
  decoded: ServiceDecodeResponse,
  permPos: number,
  evtPos: number,
  ver: DemoVer,
): void {
  const { env, region, svc_name, namespace, envKo, regionKo, svcNameKo, namespaceKo } = decoded;
  const inPerm = permPos >= 0;
  const inEvt = evtPos >= 0;

  const roles = demoRolesFor(ver);
  const events = demoEventsFor(ver);
  const permissionCapacity = DEMO_ROLE_CAP[ver];
  const eventCapacity = DEMO_EVENT_CAP[ver] * EVENT_INITIATOR_CAP;
  const permAddr = inPerm ? demoCalcPermAddr(permPos + 1, 1, ver) : null;
  const evtAddr = inEvt ? eventAddress(evtPos + 1, 1, 1, ver) : null;
  const permStart = permAddr ?? 0;
  const evtStart = evtAddr ?? 0;
  const positions = [
    DEMO_ENVS.indexOf(env as (typeof DEMO_ENVS)[number]) + 1,
    DEMO_REGIONS.indexOf(region as (typeof DEMO_REGIONS)[number]) + 1,
    DEMO_SVCS.indexOf(svc_name as (typeof DEMO_SVCS)[number]) + 1,
    DEMO_NSS.indexOf(namespace as (typeof DEMO_NSS)[number]) + 1,
  ];
  const addressCalculation = positions
    .map((position, index) => `(${position}−1)×${DEMO_SVC_STRIDES[index]}`)
    .join(' + ');

  const permInfo = inPerm
    ? `<button type="button" class="service-ref-link" data-nav-sheet="permission" data-nav-address="${permAddr}" aria-label="권한 인덱스 permission:${ver}:${permAddr} 열기"><code>permission:${ver}:${permAddr}</code><span>권한 범위 열기 →</span></button>`
    : `<span class="info-badge info-badge-gray">권한 index_ref 없음</span>`;

  const evtInfo = inEvt
    ? `<button type="button" class="service-ref-link" data-nav-sheet="event" data-nav-address="${evtAddr}" aria-label="이벤트 인덱스 event:${ver}:${evtAddr} 열기"><code>event:${ver}:${evtAddr}</code><span>이벤트 범위 열기 →</span></button>`
    : `<span class="info-badge info-badge-gray">이벤트 index_ref 없음</span>`;

  container.innerHTML = `
    <div class="sp-section">
      <div class="sp-sec-header">서비스 ID</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">value</span>
          <span class="detail-value" style="font-size:1.4rem;font-family:var(--font-num)">${value}</span>
        </div>
        <code class="addr-code">service:v1:${value}</code>
        <div class="service-ref-range">
          <div>서비스 v1 · capacity [${DEMO_SVC_SHAPE.join(', ')}]</div>
          <code>${addressCalculation} = ${value}</code>
        </div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">4D 좌표</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">env</span>
          <span class="detail-value">
            <span class="svc-tag ${envTagClass(env)}">${env}</span>
          </span>
          <span class="detail-ko">${envKo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">region</span>
          <span class="detail-value">${region}</span>
          <span class="detail-ko">${regionKo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">svc_name</span>
          <span class="detail-value">${svc_name}</span>
          <span class="detail-ko">${svcNameKo}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">namespace</span>
          <span class="detail-value">${namespace}</span>
          <span class="detail-ko">${namespaceKo}</span>
        </div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-sec-header">인덱스 참조 (index_ref)</div>
      <div class="sp-sec-body">
        <div class="detail-row">
          <span class="detail-label">권한</span>
          ${permInfo}
        </div>
        <div class="detail-row">
          <span class="detail-label">이벤트</span>
          ${evtInfo}
        </div>
        ${
          inPerm
            ? `
        <div class="service-ref-range">
          <div class="service-ref-range-title">권한 범위 · ${ver}</div>
          <div>${roles.length}개 유효 역할 · capacity ${permissionCapacity}</div>
          <div>유효 값 ${permStart}–${permStart + roles.length - 1}</div>
          <code>주소 공간 ${permStart}–${permStart + permissionCapacity - 1}</code>
        </div>`
            : ''
        }
        ${
          inEvt
            ? `
        <div class="service-ref-range">
          <div class="service-ref-range-title">이벤트 범위 · ${ver}</div>
          <div>${events.length}개 이벤트 × ${DEMO_INITIATORS.length} initiator · capacity ${eventCapacity}</div>
          <div>유효 값 ${evtStart}–${evtStart + (events.length - 1) * EVENT_INITIATOR_CAP + DEMO_INITIATORS.length - 1}</div>
          <code>주소 공간 ${evtStart}–${evtStart + eventCapacity - 1}</code>
        </div>`
            : ''
        }
      </div>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.service-ref-link').forEach((link) => {
    link.addEventListener('click', () => {
      const sheet = link.dataset.navSheet;
      const address = Number(link.dataset.navAddress);
      if ((sheet !== 'permission' && sheet !== 'event') || !Number.isFinite(address)) return;
      document.dispatchEvent(
        new CustomEvent('navigate-to', {
          detail:
            sheet === 'permission' ? { sheet, permAddr: address } : { sheet, evtAddr: address },
        }),
      );
    });
  });
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function buildDimSidebar(
  container: HTMLElement,
  state: ServiceState,
  xLabels: ServiceCellsResponse['xLabels'],
  yLabels: ServiceCellsResponse['yLabels'],
  fixed: ServiceCellsResponse['fixed'],
  onFixedChange: (dim: SvcDimKey, idx1: number) => void,
): void {
  container.innerHTML = '';
  const fixedDims = ALL_DIMS.filter((d) => d !== state.xDim && d !== state.yDim);

  // Build label arrays for fixed dims from API response
  const labelsByDim: Record<string, Array<{ id: string; ko: string; pos: number }>> = {};
  for (const dim of fixedDims) {
    // Get labels from the fixed info (single entry) or reconstruct from dim meta
    // We'll use the API's fixed response to show current + all options
    // We don't have the full list from the cells endpoint for fixed dims,
    // so we use the same source as before: reconstruct from known data.
    labelsByDim[dim] = [];
  }

  // Since we need all entries for fixed dims, we use the API xLabels/yLabels
  // for x/y axes and reconstruct fixed dim entries from the fixed response.
  // For full sidebar entry lists, we pass them via a separate approach.
  // Use DIM_META size to generate placeholder entries when we don't have them.
  // Actually, the sidebar needs all entries for the fixed dims to allow selection.
  // We track this via a local static mapping since these are stable:
  const FIXED_DIM_ENTRIES: Record<SvcDimKey, readonly string[]> = {
    env: DEMO_ENVS,
    region: DEMO_REGIONS,
    svc_name: DEMO_SVCS,
    namespace: DEMO_NSS,
  };
  const FIXED_DIM_KO: Record<SvcDimKey, Record<string, string>> = {
    env: DEMO_KO.env,
    region: DEMO_KO.region,
    svc_name: DEMO_KO.svc,
    namespace: DEMO_KO.ns,
  };

  for (const dim of fixedDims) {
    const entries = FIXED_DIM_ENTRIES[dim];
    const koMap = FIXED_DIM_KO[dim];
    const meta = DIM_META[dim];

    const header = document.createElement('div');
    header.className = 'sb-header';
    header.innerHTML = `<span class="sb-header-name">${meta.label.toUpperCase()}</span>`;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'sb-list';

    entries.forEach((val, i) => {
      const idx1 = i + 1;
      const isActive = state.fixed[dim] === idx1;

      const item = document.createElement('div');
      item.className = 'sb-item' + (isActive ? ' sb-active' : '');
      if (isActive) {
        item.style.background = '#e8eef5';
        item.style.borderLeftColor = '#1e3a5f';
      }
      item.innerHTML = `
        <span class="sb-val">${val}</span>
        <span class="sb-ko">${koMap[val] ?? val}</span>
      `;
      item.addEventListener('click', () => onFixedChange(dim, idx1));
      list.appendChild(item);
    });

    container.appendChild(list);

    const sep = document.createElement('div');
    sep.className = 'sb-sep';
    container.appendChild(sep);
  }

  // suppress unused
  void xLabels;
  void yLabels;
  void fixed;
}

// ── Axis bar ──────────────────────────────────────────────────────────────

function buildAxisBar(
  xContainer: HTMLElement,
  yContainer: HTMLElement,
  state: ServiceState,
  onAxisChange: (axis: 'x' | 'y', dim: SvcDimKey) => void,
): void {
  for (const axis of ['x', 'y'] as const) {
    const container = axis === 'x' ? xContainer : yContainer;
    const currentDim = axis === 'x' ? state.xDim : state.yDim;
    const otherDim = axis === 'x' ? state.yDim : state.xDim;
    container.innerHTML = '';

    for (const dim of ALL_DIMS) {
      const meta = DIM_META[dim];
      const isActive = dim === currentDim;
      const isOther = dim === otherDim;

      const btn = document.createElement('button');
      btn.className =
        'axis-btn' + (isActive ? ' axis-btn-active' : '') + (isOther ? ' axis-btn-other' : '');
      btn.dataset.dim = dim;
      btn.dataset.axis = axis;
      btn.title = `${meta.label}: 유효 ${meta.entries}개 / capacity ${meta.size}`;

      if (isActive) {
        btn.style.background = '#e8eef5';
        btn.style.borderLeftColor = '#1e3a5f';
        btn.style.color = '#1e3a5f';
      }

      btn.innerHTML = `
        <span class="axis-btn-name">${dim}</span>
        <span class="axis-btn-ko">${meta.label} · ${meta.entries}개 / cap ${meta.size}</span>
      `;

      if (!isOther) {
        btn.addEventListener('click', () => onAxisChange(axis, dim));
      }

      container.appendChild(btn);
    }
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────

function renderGrid(
  container: HTMLElement,
  state: ServiceState,
  data: ServiceCellsResponse,
  onSelect: (v: number) => void,
): void {
  const { xLabels, yLabels, cells } = data;
  const { selectedValue } = state;
  const maxValue = DEMO_SVC_SHAPE.reduce((a, b) => a * b, 1) - 1;

  // Build a quick lookup: (xPos, yPos) → value
  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.xPos},${cell.yPos}`, cell.value);
  }

  const tbl = document.createElement('table');
  tbl.className = 'xl-grid';
  tbl.setAttribute('role', 'grid');

  const thead = tbl.createTHead();
  const headRow = thead.insertRow();

  const corner = document.createElement('th');
  corner.className = 'xl-corner';
  headRow.appendChild(corner);

  xLabels.forEach((xl, xi) => {
    const th = document.createElement('th');
    th.className = 'xl-col-header';
    const letter = String.fromCharCode(65 + xi);
    th.innerHTML = `
      <span class="col-letter">${letter}</span>
      <span class="col-value">${xl.id}</span>
      <span class="col-ko">${xl.ko}</span>
    `;
    headRow.appendChild(th);
  });

  const tbody = tbl.createTBody();
  yLabels.forEach((yl, yi) => {
    const tr = tbody.insertRow();

    const rh = document.createElement('th');
    rh.className = 'xl-row-header';
    rh.innerHTML = `
      <span class="row-num">${yi + 1}</span>
      <span class="row-value">${yl.id}</span>
      <span class="row-ko">${yl.ko}</span>
    `;
    tr.appendChild(rh);

    xLabels.forEach((_xl, xi) => {
      const value = cellMap.get(`${xi + 1},${yi + 1}`) ?? 0;
      const td = document.createElement('td');
      td.className = 'xl-cell svc-cell-density';
      td.setAttribute('role', 'gridcell');
      td.dataset.value = String(value);
      td.tabIndex = 0;
      if (value === selectedValue) td.classList.add('selected');

      const bg = densityFill(value, maxValue);
      const ink = densityInk(value, maxValue);
      td.style.backgroundColor = bg;
      td.style.color = ink;

      td.innerHTML = `
        <span class="cell-id-val" style="color:${ink}">${value}</span>
        <span class="cell-coord-tag" style="color:${ink};opacity:0.7">[${xi + 1},${yi + 1}]</span>
      `;

      td.addEventListener('click', () => onSelect(value));
      tr.appendChild(td);
    });
  });

  const shell = document.createElement('div');
  shell.className = 'service-grid-shell';

  const summary = document.createElement('div');
  summary.className = 'service-catalog-summary';
  summary.innerHTML = `
    <span class="service-catalog-summary-label">서비스 주소 계산</span>
    <code>${serviceCatalogSummary()}</code>
  `;

  shell.append(summary, tbl);
  container.dataset.serviceFormula = serviceFormula();
  container.dataset.serviceCapacity = String(SERVICE_CAPACITY);
  container.dataset.serviceStrides = DEMO_SVC_STRIDES.join(',');
  container.innerHTML = '';
  container.appendChild(shell);
}

// ── Main export ───────────────────────────────────────────────────────────

export interface ServicePageHandlers {
  onSelect: (v: number | null) => void;
  onAxisChange: (axis: 'x' | 'y', dim: SvcDimKey) => void;
  onFixedChange: (dim: SvcDimKey, idx1: number) => void;
}

export async function renderServicePage(
  gridContainer: HTMLElement,
  sidebarContainer: HTMLElement,
  xAxisContainer: HTMLElement,
  yAxisContainer: HTMLElement,
  spPlaceholder: HTMLElement,
  spContent: HTMLElement,
  state: ServiceState,
  handlers: ServicePageHandlers,
  ver: DemoVer = 'v2',
): Promise<void> {
  // Axis bar (synchronous — no API needed)
  buildAxisBar(xAxisContainer, yAxisContainer, state, handlers.onAxisChange);

  // Read from the bundled catalog. No API, Worker, or registry is required.
  gridContainer.innerHTML = `<div style="padding:2rem;color:var(--text-muted)">목 데이터 준비 중...</div>`;
  const data = await fetchMockServiceCells({
    xDim: state.xDim,
    yDim: state.yDim,
    fixed: state.fixed,
  });

  // Grid
  renderGrid(gridContainer, state, data, (v) => {
    if (state.selectedValue === v) {
      handlers.onSelect(null);
    } else {
      handlers.onSelect(v);
    }
  });

  // Sidebar (fixed dims)
  buildDimSidebar(
    sidebarContainer,
    state,
    data.xLabels,
    data.yLabels,
    data.fixed,
    handlers.onFixedChange,
  );

  // Detail panel
  if (state.selectedValue !== null) {
    spPlaceholder.classList.add('hidden');
    spContent.classList.remove('hidden');
    await renderServiceDetailPanel(spContent, state.selectedValue, ver);
  } else {
    spContent.classList.add('hidden');
    spPlaceholder.classList.remove('hidden');
  }
}

export async function renderServiceDetailPanel(
  container: HTMLElement,
  value: number,
  ver: DemoVer = 'v2',
): Promise<void> {
  container.innerHTML = `<div style="padding:1rem;color:var(--text-muted)">목 데이터 해석 중...</div>`;
  try {
    const decoded = await fetchMockServiceDecode(value);
    const permPos = (DEMO_PERM_SVC_VALUES as readonly number[]).indexOf(value);
    const evtPos = (DEMO_EVT_SVC_VALUES as readonly number[]).indexOf(value);
    renderServiceDetail(container, value, decoded, permPos, evtPos, ver);
  } catch (e) {
    container.innerHTML = `<div style="padding:1rem;color:#c0392b">오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}</div>`;
  }
}

export function updateServiceSelection(
  gridContainer: HTMLElement,
  prevValue: number | null,
  newValue: number | null,
): void {
  const maxValue = DEMO_SVC_SHAPE.reduce((a, b) => a * b, 1) - 1;
  const cells = Array.from(gridContainer.querySelectorAll<HTMLElement>('.xl-cell'));
  const cellValues = cells.map((td) => Number(td.dataset.value));
  cells.forEach((td, i) => {
    const v = cellValues[i];
    if (v === prevValue) {
      const bg = densityFill(v, maxValue);
      const ink = densityInk(v, maxValue);
      td.classList.remove('selected');
      td.style.backgroundColor = bg;
      td.style.color = ink;
    }
    if (v === newValue) {
      td.classList.add('selected');
    }
  });
}
