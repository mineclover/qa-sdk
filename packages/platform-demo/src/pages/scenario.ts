// @def.boundary platform-demo-system
// @def.doc platform-demo-system

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 페이지 — 역할 전환 + 기능 접근 매트릭스 + 시뮬레이션 재생
// ═══════════════════════════════════════════════════════════════════════════

import type { ScenarioResponse, SimStep, FeaturesResponse } from '../registry.js';
import {
  fetchMockFeatures,
  fetchMockScenario,
  type ScenarioRequestTrace,
} from '../mock-scenario-api.js';
import { DEMO_KO, DEMO_FEATURE_KO, demoRolesFor, demoFeatures, type DemoVer } from 'demo-snapshot';

// ── Constants (demo-snapshot SSOT 기반) ───────────────────────────────────

function rolesMetaFor(ver: string) {
  return demoRolesFor(ver as DemoVer).map((id: string) => ({ id, ko: DEMO_KO.role[id] ?? id }));
}
// 하위 호환 (기존 default 파라미터 참조용)
const ROLES_META_V2 = rolesMetaFor('v2');

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦'] as const;

// ── Role selector bar ──────────────────────────────────────────────────────

function renderRoleBar(
  activeRole: string,
  onRoleChange: (role: string) => void,
  rolesMeta: readonly { id: string; ko: string }[] = ROLES_META_V2,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'scenario-role-bar';

  for (const rm of rolesMeta) {
    const btn = document.createElement('button');
    btn.className = `scenario-role-btn${rm.id === activeRole ? ' active' : ''}`;
    btn.textContent = `${rm.ko} (${rm.id})`;
    btn.dataset['role'] = rm.id;
    btn.addEventListener('click', () => {
      onRoleChange(rm.id);
    });
    bar.appendChild(btn);
  }

  return bar;
}

function updateRoleBar(bar: HTMLElement, activeRole: string): void {
  for (const btn of Array.from(bar.querySelectorAll<HTMLButtonElement>('.scenario-role-btn'))) {
    const role = btn.dataset['role'] ?? '';
    btn.classList.toggle('active', role === activeRole);
  }
}

// ── Representative request trace ──────────────────────────────────────────

function renderRequestSection(request: ScenarioRequestTrace): HTMLElement {
  const section = document.createElement('section');
  section.className = 'scenario-panel scenario-request-trace';
  section.style.margin = '16px';

  const statusLabel = request.permission.status === 'ok' ? '허용됨' : '거부됨';
  const statusClass = request.permission.status === 'ok' ? 'status-ok' : 'status-denied';
  const serviceCoords = [
    request.service.env,
    request.service.region,
    request.service.svcName,
    request.service.namespace,
  ].join(' / ');

  section.innerHTML = `
    <div class="scenario-panel-header">
      <span style="font-weight:700">대표 요청 추적</span>
      <span style="color:var(--text-muted);font-size:0.72rem">${request.requestId} · ${request.featureName}</span>
      <span class="${statusClass}" style="margin-left:auto">${statusLabel}</span>
    </div>
    <div style="padding:12px 16px">
      <div style="display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-bottom:12px;font-size:0.76rem">
        <span style="color:var(--text-muted)">sourceRef</span>
        <code class="scenario-addr-chip">${request.sourceRef.namespace}/${request.sourceRef.entityType}/${request.sourceRef.localId}</code>
        <span style="color:var(--text-muted)">localId</span>
        <code class="scenario-addr-chip">${request.sourceRef.localId}</code>
        <span style="color:var(--text-muted)">revision ${request.sourceRef.revision}</span>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:7px">service → permission → event · 하나의 요청을 같은 address_context로 연결</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
        <div style="border:1px solid var(--border-cell);border-radius:var(--radius-sm);padding:9px;background:var(--surface-1)">
          <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:5px">service</div>
          <button type="button" class="scenario-nav-chip" data-nav-sheet="service" data-nav-address="${request.service.value}"><code class="scenario-addr-chip">${request.service.address}</code></button>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">${serviceCoords}</div>
        </div>
        <div style="border:1px solid var(--border-cell);border-radius:var(--radius-sm);padding:9px;background:var(--surface-1)">
          <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:5px">permission · ${request.permission.roleKo}</div>
          <button type="button" class="scenario-nav-chip" data-nav-sheet="permission" data-nav-address="${request.permission.value}"><code class="scenario-addr-chip">${request.permission.address}</code></button>
          <div class="${request.permission.status === 'ok' ? 'status-ok' : 'status-denied'}" style="font-size:0.7rem;margin-top:6px">${request.permission.status === 'ok' ? 'grant' : 'deny'}</div>
        </div>
        <div style="border:1px solid var(--border-cell);border-radius:var(--radius-sm);padding:9px;background:var(--surface-1)">
          <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:5px">event · ${request.event?.nameKo ?? '없음'}</div>
          ${request.event ? `<button type="button" class="scenario-nav-chip" data-nav-sheet="event" data-nav-address="${request.event.value}"><code class="scenario-addr-chip">${request.event.address}</code></button><div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px">${request.event.initiator} · ${request.event.status === 'ok' ? 'success' : 'denied'}</div>` : '<span style="font-size:0.7rem;color:var(--text-muted)">이벤트 주소 없음</span>'}
        </div>
      </div>
      <div style="margin-top:10px;font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">address_context</div>
    </div>
  `;

  const body = section.lastElementChild;
  if (body) {
    const pre = document.createElement('pre');
    pre.style.cssText =
      'margin:0 16px 14px;padding:9px 12px;border:1px solid var(--border-cell);border-radius:var(--radius-sm);background:var(--xl-navy-faint);font:0.7rem var(--font-num);color:var(--xl-navy);white-space:pre-wrap;overflow-wrap:anywhere;';
    pre.textContent = JSON.stringify(request.addressContext, null, 2);
    body.appendChild(pre);
  }

  section.querySelectorAll<HTMLButtonElement>('.scenario-nav-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const sheet = button.dataset.navSheet;
      const address = Number(button.dataset.navAddress);
      if (!sheet || !Number.isFinite(address)) return;
      const detail =
        sheet === 'service'
          ? { sheet, svcAddr: address }
          : sheet === 'permission'
            ? { sheet, permAddr: address }
            : { sheet, evtAddr: address };
      document.dispatchEvent(new CustomEvent('navigate-to', { detail }));
    });
  });

  return section;
}

// ── Mock website ───────────────────────────────────────────────────────────

type NavFeatureId = string;

function buildNavItems(
  features: readonly { id: string; name: string }[],
): { label: string; featureId: NavFeatureId; title: string }[] {
  const home = { label: '홈', featureId: 'home', title: '홈' };
  return [
    home,
    ...features.map((f) => ({
      label: DEMO_FEATURE_KO[f.id] ?? f.name,
      featureId: f.id,
      title: f.name,
    })),
  ];
}

function buildContentHtml(featureId: NavFeatureId, scenario: ScenarioResponse): string {
  if (featureId === 'home') {
    return `
      <div class="scenario-home-welcome">
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">안녕하세요, ${scenario.roleKo}님 👋</div>
        <div style="color:var(--text-muted);font-size:0.85rem">G-SHOP 플랫폼에 오신 것을 환영합니다. 상단 메뉴에서 원하는 페이지로 이동하세요.</div>
      </div>
    `;
  }

  const feature = scenario.features.find((f) => f.id === featureId);
  if (!feature) return `<div style="padding:12px;color:var(--text-muted)">알 수 없는 기능</div>`;
  const svc = feature.svcAddr; // DEMO_CATALOG 의미값에서 계산된 주소

  if (!feature.hasAccess) {
    return `
      <div class="scenario-forbidden">
        <div style="font-size:1rem;font-weight:700;margin-bottom:6px">⛔ 403 Forbidden — 접근 거부</div>
        <div style="margin-bottom:4px">${scenario.roleKo}(${feature.permAddr})은 부여 목록에 없습니다.</div>
        <div>허용 역할: ${feature.grantedRolesKo.join(', ')}</div>
      </div>
    `;
  }

  if (featureId === 'product_list') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>상품명</th><th>가격</th><th>재고</th><th>서비스</th></tr></thead>
        <tbody>
          <tr><td>무선 이어폰 Pro</td><td>₩129,000</td><td>재고 있음</td><td>${svc}</td></tr>
          <tr><td>스마트 워치 SE</td><td>₩289,000</td><td>재고 있음</td><td>${svc}</td></tr>
          <tr><td>노트북 슬리브</td><td>₩35,000</td><td>품절</td><td>${svc}</td></tr>
          <tr><td>USB-C 허브</td><td>₩49,000</td><td>재고 있음</td><td>${svc}</td></tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'order_list') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>주문번호</th><th>상품</th><th>금액</th><th>상태</th></tr></thead>
        <tbody>
          <tr><td>#ORD-2031</td><td>무선 이어폰 Pro</td><td>₩129,000</td><td>배송 중</td></tr>
          <tr><td>#ORD-2028</td><td>USB-C 허브</td><td>₩49,000</td><td>완료</td></tr>
          <tr><td>#ORD-2015</td><td>스마트 워치 SE</td><td>₩289,000</td><td>완료</td></tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'payment_history') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>일시</th><th>금액</th><th>상태</th><th>서비스</th></tr></thead>
        <tbody>
          <tr><td>2026-03-15 10:23</td><td>₩89,000</td><td>완료</td><td>${svc}</td></tr>
          <tr><td>2026-03-14 14:11</td><td>₩12,500</td><td>완료</td><td>${svc}</td></tr>
          <tr><td>2026-03-13 09:47</td><td>₩45,000</td><td>환불</td><td>${svc}</td></tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'payment_cancel') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>결제번호</th><th>금액</th><th>결제일시</th><th>서비스</th><th>취소</th></tr></thead>
        <tbody>
          <tr><td>#PAY-8821</td><td>₩89,000</td><td>2026-03-15 10:23</td><td>${svc}</td><td><button class="scenario-action-btn">취소</button></td></tr>
          <tr><td>#PAY-8814</td><td>₩12,500</td><td>2026-03-14 14:11</td><td>${svc}</td><td><button class="scenario-action-btn">취소</button></td></tr>
          <tr><td>#PAY-8799</td><td>₩45,000</td><td>2026-03-13 09:47</td><td>${svc}</td><td><span style="color:var(--text-muted);font-size:0.78rem">환불완료</span></td></tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'payment_cancel_req') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>결제번호</th><th>금액</th><th>결제일시</th><th>서비스</th><th>취소 요청</th></tr></thead>
        <tbody>
          <tr><td>#PAY-8821</td><td>₩89,000</td><td>2026-03-15 10:23</td><td>${svc}</td><td><button class="scenario-action-btn">취소 요청</button></td></tr>
          <tr><td>#PAY-8814</td><td>₩12,500</td><td>2026-03-14 14:11</td><td>${svc}</td><td><button class="scenario-action-btn">취소 요청</button></td></tr>
          <tr><td>#PAY-8799</td><td>₩45,000</td><td>2026-03-13 09:47</td><td>${svc}</td><td><span style="color:var(--text-muted);font-size:0.78rem">환불완료</span></td></tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'payment_cancel_approve') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>요청번호</th><th>고객</th><th>금액</th><th>요청일시</th><th>서비스</th><th>처리</th></tr></thead>
        <tbody>
          <tr>
            <td>#REQ-1042</td><td>홍길동</td><td>₩89,000</td><td>2026-03-15 11:00</td><td>${svc}</td>
            <td style="white-space:nowrap">
              <button class="scenario-action-btn">승인</button>
              <button class="scenario-action-btn" style="background:#c0392b;margin-left:4px">거부</button>
            </td>
          </tr>
          <tr>
            <td>#REQ-1039</td><td>김민수</td><td>₩34,500</td><td>2026-03-15 09:15</td><td>${svc}</td>
            <td style="white-space:nowrap">
              <button class="scenario-action-btn">승인</button>
              <button class="scenario-action-btn" style="background:#c0392b;margin-left:4px">거부</button>
            </td>
          </tr>
          <tr>
            <td>#REQ-1035</td><td>이수연</td><td>₩120,000</td><td>2026-03-14 16:40</td><td>${svc}</td>
            <td><span style="color:#27ae60;font-size:0.78rem;font-weight:600">승인완료</span></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  if (featureId === 'user_mgmt') {
    return `
      <table class="scenario-mock-table">
        <thead><tr><th>사용자</th><th>이메일</th><th>역할</th><th>서비스</th><th>관리</th></tr></thead>
        <tbody>
          <tr><td>홍길동</td><td>hong@example.com</td><td>viewer</td><td>${svc}</td><td><button class="scenario-action-btn">역할 변경</button></td></tr>
          <tr><td>김철수</td><td>kim@example.com</td><td>operator</td><td>${svc}</td><td><button class="scenario-action-btn">역할 변경</button></td></tr>
          <tr><td>이영희</td><td>lee@example.com</td><td>developer</td><td>${svc}</td><td><button class="scenario-action-btn">역할 변경</button></td></tr>
        </tbody>
      </table>
    `;
  }

  // config_change
  return `
    <div class="scenario-config-panel">
      <div class="scenario-config-row">
        <span class="scenario-config-label">서비스</span>
        <span class="scenario-config-value">${svc} (쇼핑 백엔드)</span>
      </div>
      <div class="scenario-config-row">
        <span class="scenario-config-label">최대 요청 수</span>
        <span class="scenario-config-value">1000 req/s <button class="scenario-action-btn" style="margin-left:8px">변경</button></span>
      </div>
      <div class="scenario-config-row">
        <span class="scenario-config-label">타임아웃</span>
        <span class="scenario-config-value">30s <button class="scenario-action-btn" style="margin-left:8px">변경</button></span>
      </div>
      <div class="scenario-config-row">
        <span class="scenario-config-label">캐시 TTL</span>
        <span class="scenario-config-value">300s <button class="scenario-action-btn" style="margin-left:8px">변경</button></span>
      </div>
    </div>
  `;
}

function renderSiteSection(
  scenario: ScenarioResponse,
  navItems: { label: string; featureId: string; title: string }[],
): HTMLElement {
  const site = document.createElement('div');
  site.className = 'scenario-site';

  let activeNav: NavFeatureId = 'payment_history';

  // Header
  const header = document.createElement('div');
  header.className = 'scenario-site-header';

  const brand = document.createElement('span');
  brand.className = 'scenario-site-brand';
  brand.textContent = '🛒 G-SHOP';

  const nav = document.createElement('nav');
  nav.className = 'scenario-site-nav';

  const userEl = document.createElement('div');
  userEl.className = 'scenario-site-user';
  userEl.textContent = `👤 ${scenario.roleKo} (${scenario.role})`;

  header.appendChild(brand);
  header.appendChild(nav);
  header.appendChild(userEl);

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'scenario-site-content';

  function switchNav(featureId: NavFeatureId): void {
    activeNav = featureId;

    // Update nav link highlights
    for (const a of Array.from(nav.querySelectorAll<HTMLAnchorElement>('a'))) {
      a.classList.toggle('active', a.dataset['featureId'] === featureId);
    }

    // Update content title + body
    // eslint-disable-next-line typescript/no-non-null-assertion -- featureId는 navItems에서 유래
    const navItem = navItems.find((n) => n.featureId === featureId)!;
    contentArea.innerHTML = `
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:12px;color:#1e3a5f">${navItem.title}</h2>
      ${buildContentHtml(featureId, scenario)}
    `;
  }

  // Build nav links
  for (const item of navItems) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = item.label;
    a.dataset['featureId'] = item.featureId;
    if (item.featureId === activeNav) a.classList.add('active');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchNav(item.featureId);
    });
    nav.appendChild(a);
  }

  site.appendChild(header);
  site.appendChild(contentArea);

  // Render initial content
  switchNav(activeNav);

  return site;
}

// ── Feature matrix ─────────────────────────────────────────────────────────

function renderMatrixSection(featuresData: FeaturesResponse, activeRole: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'scenario-matrix';

  const title = document.createElement('div');
  title.className = 'scenario-subsection-title';
  title.textContent = '기능별 역할 접근 매트릭스';
  section.appendChild(title);

  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';
  section.appendChild(tableWrap);

  const table = document.createElement('table');
  table.className = 'scenario-matrix-table';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const thFeature = document.createElement('th');
  thFeature.textContent = '기능';
  headerRow.appendChild(thFeature);

  for (const r of featuresData.roles) {
    const th = document.createElement('th');
    th.textContent = r.ko;
    th.dataset['roleId'] = r.id;
    if (r.id === activeRole) th.classList.add('active-col');
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  featuresData.features.forEach((f, fi) => {
    const tr = document.createElement('tr');
    if (f.id === 'payment_history') tr.classList.add('highlight-row');

    const tdName = document.createElement('td');
    tdName.textContent = f.name;
    tdName.style.fontWeight = '600';
    tr.appendChild(tdName);

    featuresData.roles.forEach((r, ri) => {
      const td = document.createElement('td');
      const hasAccess = featuresData.matrix[fi]?.[ri] ?? false;
      td.textContent = hasAccess ? '✓' : '✗';
      td.style.textAlign = 'center';
      td.style.color = hasAccess ? '#27ae60' : '#c0392b';
      td.style.fontWeight = '700';
      if (r.id === activeRole) td.style.background = 'rgba(46,117,182,0.08)';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  return section;
}

function updateMatrixColumnHighlight(matrixSection: HTMLElement, activeRole: string): void {
  for (const th of Array.from(matrixSection.querySelectorAll<HTMLElement>('th[data-role-id]'))) {
    th.classList.toggle('active-col', th.dataset['roleId'] === activeRole);
  }
  // Update td highlights
  const rows = Array.from(matrixSection.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  for (const tr of rows) {
    const cells = Array.from(tr.querySelectorAll<HTMLElement>('td'));
    // cells[0] is the feature name, cells[1..] are role cells
    const headers = Array.from(matrixSection.querySelectorAll<HTMLElement>('th[data-role-id]'));
    cells.slice(1).forEach((td, i) => {
      const roleId = headers[i]?.dataset['roleId'] ?? '';
      td.style.background = roleId === activeRole ? 'rgba(46,117,182,0.08)' : '';
    });
  }
}

// ── Simulation player ──────────────────────────────────────────────────────

function buildSimGroup(step: SimStep): HTMLElement {
  const group = document.createElement('div');
  group.className = `scenario-sim-group ${step.hasAccess ? 'ok' : 'denied'}`;
  group.style.opacity = '0';
  group.style.transition = 'opacity 0.4s';

  const circledNum = CIRCLED[step.featureNum - 1] ?? `(${step.featureNum})`;
  const statusIcon = step.hasAccess ? '✓ OK' : '✗ DENIED';
  const statusClass = step.hasAccess ? 'status-ok' : 'status-denied';

  // Feature title
  const titleRow = document.createElement('div');
  titleRow.className = 'scenario-sim-feature-title';
  titleRow.innerHTML = `
    <span style="font-size:1rem;margin-right:6px">${circledNum}</span>
    <span style="font-weight:700">${step.featureName}</span>
    <span class="${statusClass}" style="margin-left:8px">${statusIcon}</span>
  `;
  group.appendChild(titleRow);

  // Perm step
  const permRow = document.createElement('div');
  permRow.className = 'scenario-sim-step';
  permRow.innerHTML = `
    <span class="scenario-addr-chip">[${step.perm.addr.replace('permission:', 'perm:')}]</span>
    <span style="font-weight:600">${step.perm.svcNameKo}</span>
    <span style="color:var(--text-muted)">×</span>
    <span>${step.perm.roleNameKo}</span>
    <span style="color:var(--text-muted)">→</span>
    <span class="${step.perm.status === 'ok' ? 'status-ok' : 'status-denied'}">${step.perm.deniedReason}</span>
  `;
  group.appendChild(permRow);

  // Event step (if present)
  if (step.event !== null) {
    const evtRow = document.createElement('div');
    evtRow.className = 'scenario-sim-step';
    const evtStatusClass = step.event.status === 'ok' ? 'status-ok' : 'status-denied';
    const evtStatusIcon = step.event.status === 'ok' ? '✓' : '✗';
    evtRow.innerHTML = `
      <span class="scenario-addr-chip">[${step.event.addr.replace('event:', 'evt:')}]</span>
      <span style="font-weight:600">${step.event.svcNameKo}</span>
      <span style="color:var(--text-muted)">/</span>
      <span>${step.event.eventNameKo}</span>
      <span style="color:var(--text-muted)">/</span>
      <span>${step.event.initiator}</span>
      <span class="${evtStatusClass}" style="margin-left:4px">${evtStatusIcon}</span>
    `;
    group.appendChild(evtRow);
  }

  return group;
}

function renderSimSection(scenario: ScenarioResponse): HTMLElement {
  const sim = document.createElement('div');
  sim.className = 'scenario-sim';

  const header = document.createElement('div');
  header.className = 'scenario-sim-header';
  header.innerHTML = `
    <span style="font-weight:700;font-size:0.9rem">시뮬레이션</span>
    <button id="scenario-play-btn" class="scenario-play-btn">▶ 시뮬레이션 재생</button>
  `;
  sim.appendChild(header);

  const groups: HTMLElement[] = [];
  for (const step of scenario.simulation) {
    const group = buildSimGroup(step);
    sim.appendChild(group);
    groups.push(group);
  }

  // Show all groups by default
  for (const g of groups) {
    g.style.opacity = '1';
  }

  // Play button logic
  // eslint-disable-next-line typescript/no-non-null-assertion -- 바로 위에서 innerHTML로 생성
  const playBtn = header.querySelector<HTMLButtonElement>('#scenario-play-btn')!;
  let animTimer: ReturnType<typeof setTimeout> | null = null;

  playBtn.addEventListener('click', () => {
    if (animTimer !== null) {
      clearTimeout(animTimer);
      animTimer = null;
    }

    playBtn.textContent = '⏸ 재생 중...';
    playBtn.disabled = true;

    for (const g of groups) {
      g.style.opacity = '0';
    }

    groups.forEach((g, i) => {
      animTimer = setTimeout(
        () => {
          g.style.opacity = '1';
          if (i === groups.length - 1) {
            playBtn.textContent = '▶ 다시 재생';
            playBtn.disabled = false;
            animTimer = null;
          }
        },
        (i + 1) * 600,
      );
    });
  });

  return sim;
}

// ── Main export ────────────────────────────────────────────────────────────

export function renderScenarioPage(container: HTMLElement, ver = 'v2'): void {
  container.innerHTML = '';
  container.classList.add('scenario-body');

  const rolesMeta = rolesMetaFor(ver);
  const navItems = buildNavItems(demoFeatures(ver as DemoVer));

  let activeRole = 'viewer';

  // Elements we keep references to for updating
  let roleBar: HTMLElement | null = null;
  let requestSection: HTMLElement | null = null;
  let siteSection: HTMLElement | null = null;
  let matrixSection: HTMLElement | null = null;
  let simSection: HTMLElement | null = null;

  function showSimLoading(): void {
    if (simSection) {
      simSection.innerHTML = `
        <div class="scenario-sim-header">
          <span style="font-weight:700;font-size:0.9rem">시뮬레이션</span>
        </div>
        <div class="scenario-spinner-wrap">
          <div class="scenario-spinner"></div>
          <span class="scenario-spinner-text">시뮬레이션 로딩 중...</span>
        </div>
      `;
    }
  }

  function handleRoleChange(newRole: string): void {
    if (newRole === activeRole) return;
    activeRole = newRole;

    // Update role bar highlight
    if (roleBar) updateRoleBar(roleBar, activeRole);

    // Update site content immediately if we have cached scenario (optimistic)
    // We'll re-fetch anyway, so just show loading in sim
    if (matrixSection) updateMatrixColumnHighlight(matrixSection, activeRole);

    // Show loading in sim
    if (simSection) showSimLoading();
    if (requestSection) {
      requestSection.innerHTML = `
        <div class="scenario-panel-header"><span style="font-weight:700">대표 요청 추적</span></div>
        <div class="scenario-spinner-wrap"><div class="scenario-spinner"></div><span class="scenario-spinner-text">주소 컨텍스트 갱신 중...</span></div>
      `;
    }

    // Fetch scenario + features together so matrix reflects latest grant state
    Promise.all([fetchMockScenario(activeRole, ver as DemoVer), fetchMockFeatures(ver as DemoVer)])
      .then(([scenario, features]) => {
        const newRequest = renderRequestSection(scenario.request);
        newRequest.classList.add('scenario-content-enter');
        if (requestSection && requestSection.parentNode === container) {
          container.replaceChild(newRequest, requestSection);
        }
        requestSection = newRequest;

        if (siteSection && siteSection.parentNode === container) {
          const newSite = renderSiteSection(scenario, navItems);
          newSite.classList.add('scenario-content-enter');
          container.replaceChild(newSite, siteSection);
          siteSection = newSite;
        }

        const newMatrix = renderMatrixSection(features, activeRole);
        newMatrix.classList.add('scenario-content-enter');
        if (matrixSection && matrixSection.parentNode === container) {
          container.replaceChild(newMatrix, matrixSection);
        }
        matrixSection = newMatrix;

        const newSim = renderSimSection(scenario);
        newSim.classList.add('scenario-content-enter');
        if (simSection && simSection.parentNode === container) {
          container.replaceChild(newSim, simSection);
        }
        simSection = newSim;
        return undefined;
      })
      .catch((e: unknown) => {
        if (simSection) {
          simSection.innerHTML = `<div style="padding:16px;color:#c0392b">오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}</div>`;
        }
      });
  }

  // Initial skeleton
  const skeletonRoleBar = renderRoleBar(activeRole, handleRoleChange, rolesMeta);
  container.appendChild(skeletonRoleBar);
  roleBar = skeletonRoleBar;

  const loadingDiv = document.createElement('div');
  loadingDiv.innerHTML = `
    <div class="scenario-skeleton">
      <div class="scenario-skel-site">
        <div class="scenario-skel-site-header"></div>
        <div class="scenario-skel-site-body">
          <div class="scenario-skel-bar" style="width:40%"></div>
          <div class="scenario-skel-bar" style="width:100%"></div>
          <div class="scenario-skel-bar" style="width:85%"></div>
          <div class="scenario-skel-bar" style="width:70%"></div>
        </div>
      </div>
      <div style="margin-top:8px">
        <div class="scenario-skel-bar" style="width:30%;height:18px;margin-bottom:10px"></div>
        <div class="scenario-skel-bar" style="width:100%;height:40px"></div>
      </div>
      <div class="scenario-spinner-wrap" style="padding:16px">
        <div class="scenario-spinner"></div>
        <span class="scenario-spinner-text">목 데이터 준비 중...</span>
      </div>
    </div>
  `;
  container.appendChild(loadingDiv);

  // Fetch both in parallel
  Promise.all([fetchMockScenario(activeRole, ver as DemoVer), fetchMockFeatures(ver as DemoVer)])
    .then(([scenario, features]) => {
      container.removeChild(loadingDiv);

      // Render representative request trace
      requestSection = renderRequestSection(scenario.request);
      requestSection.classList.add('scenario-content-enter');
      // eslint-disable-next-line typescript/no-non-null-assertion -- roleBar 할당 완료
      roleBar!.insertAdjacentElement('afterend', requestSection);

      // Render site section
      siteSection = renderSiteSection(scenario, navItems);
      siteSection.classList.add('scenario-content-enter');
      requestSection.insertAdjacentElement('afterend', siteSection);

      // Render matrix section
      matrixSection = renderMatrixSection(features, activeRole);
      matrixSection.classList.add('scenario-content-enter');
      siteSection.insertAdjacentElement('afterend', matrixSection);

      // Render sim section
      simSection = renderSimSection(scenario);
      simSection.classList.add('scenario-content-enter');
      matrixSection.insertAdjacentElement('afterend', simSection);
      return undefined;
    })
    .catch((e: unknown) => {
      loadingDiv.style.color = '#c0392b';
      loadingDiv.textContent = `오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`;
    });
}
