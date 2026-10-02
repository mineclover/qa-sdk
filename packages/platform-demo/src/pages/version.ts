// @def.boundary platform-demo-system
// @def.doc platform-demo-system

// ═══════════════════════════════════════════════════════════════════════════
//  버전 변경 — v1 / v2 비교 (SSOT 기반)
// ═══════════════════════════════════════════════════════════════════════════
//
// weighted-index의 demo-snapshot(SSOT)에서 차원 데이터를 직접 가져오고,
// 기능 × 역할 매트릭스는 API에서 실시간으로 조회합니다.
// 하드코딩 없이 실제 구현 데이터를 기반으로 v1/v2 차이를 표현합니다.
//

import {
  DEMO_ROLE_CAP,
  DEMO_EVENT_CAP,
  DEMO_KO,
  DEMO_SVC_SHAPE,
  DEMO_SVC_STRIDES,
  DEMO_PERM_SVC_VALUES,
  DEMO_EVT_SVC_VALUES,
  demoEncodeSvc,
  demoRolesFor,
  demoRoleStride,
  demoEventsFor,
  demoCalcPermAddr,
  type DemoVer,
} from 'demo-snapshot';
import { fetchFeatures, type FeaturesResponse } from '../registry.js';
import { EVENT_INITIATOR_CAP, eventAddress, eventStride } from '../event-address.js';

type Ver = DemoVer;
const ALL_VERS: Ver[] = ['v1', 'v2', 'v3', 'v4'];

// ── SSOT 파생 메타데이터 ──────────────────────────────────────────────────────

interface DimEntry {
  id: string;
  ko: string;
  pos: number;
  isNew: boolean;
}

/** 이전 버전 대비 신규 항목 판별 */
function prevVer(ver: Ver): Ver | null {
  const idx = ALL_VERS.indexOf(ver);
  return idx > 0 ? ALL_VERS[idx - 1] : null;
}

function rolesFor(ver: Ver): DimEntry[] {
  const entries = demoRolesFor(ver);
  const prev = prevVer(ver);
  const prevSet = prev ? new Set<string>(demoRolesFor(prev)) : null;
  return [...entries].map((id, i) => ({
    id,
    ko: DEMO_KO.role[id] ?? id,
    pos: i + 1,
    isNew: prevSet ? !prevSet.has(id) : false,
  }));
}

function eventsFor(ver: Ver): DimEntry[] {
  const entries = demoEventsFor(ver);
  const prev = prevVer(ver);
  const prevSet = prev ? new Set<string>(demoEventsFor(prev)) : null;
  return [...entries].map((id, i) => ({
    id,
    ko: DEMO_KO.event[id] ?? id,
    pos: i + 1,
    isNew: prevSet ? !prevSet.has(id) : false,
  }));
}

function dimPos(entries: DimEntry[], id: string): number | null {
  return entries.find((e) => e.id === id)?.pos ?? null;
}

function evtTagClass(id: string): string {
  if (id.startsWith('user.')) return 'evt-tag evt-tag-user';
  if (id.startsWith('order.')) return 'evt-tag evt-tag-order';
  if (id.startsWith('payment.')) return 'evt-tag evt-tag-payment';
  if (id.startsWith('session.')) return 'evt-tag evt-tag-session';
  if (id.startsWith('config.')) return 'evt-tag evt-tag-config';
  return 'evt-tag';
}

// 주소 예시에 사용할 서비스: prod/asia/payment/shop (catalog에서 파생)
const EXAMPLE_SVC_VALUE = demoEncodeSvc([3, 1, 4, 1]);
const EXAMPLE_PERM_SVC_POS = DEMO_PERM_SVC_VALUES.indexOf(EXAMPLE_SVC_VALUE) + 1;
const EXAMPLE_EVT_SVC_POS = DEMO_EVT_SVC_VALUES.indexOf(EXAMPLE_SVC_VALUE) + 1;

// ── Feature data (API) ───────────────────────────────────────────────────────

interface FeatureData {
  v1: FeaturesResponse;
  v2: FeaturesResponse;
  v3?: FeaturesResponse;
  v4?: FeaturesResponse;
}

// ── Section builders ─────────────────────────────────────────────────────────

function buildRolesSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  const roles = rolesFor(ver);
  const addedCount = roles.filter((r) => r.isNew).length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">👤</span>
      <span class="vd-sec-title">역할 (role) 차원</span>
      <span class="vd-shape-badge">${roles.length}개 항목</span>
      ${addedCount > 0 ? `<span class="vd-tag-new">+${addedCount} 추가</span>` : ''}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${roles
          .map(
            (r) => `
          <div class="vd-dim-row ${r.isNew ? 'vd-row-added' : ''}">
            <span class="vd-dim-pos">${r.pos}</span>
            <span class="role-tag role-tag-${r.id}">${r.id}</span>
            <span class="vd-dim-ko">${r.ko}</span>
            ${r.isNew ? '<span class="vd-badge-new">NEW</span>' : ''}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
  return sec;
}

function buildEventsSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  const events = eventsFor(ver);
  const addedCount = events.filter((e) => e.isNew).length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">◈</span>
      <span class="vd-sec-title">이벤트명 (event_name) 차원</span>
      <span class="vd-shape-badge">${events.length}개 항목</span>
      ${addedCount > 0 ? `<span class="vd-tag-new">+${addedCount} 추가</span>` : ''}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${events
          .map(
            (e) => `
          <div class="vd-dim-row ${e.isNew ? 'vd-row-added' : ''}">
            <span class="vd-dim-pos">${e.pos}</span>
            <span class="${evtTagClass(e.id)}">${e.id}</span>
            <span class="vd-dim-ko">${e.ko}</span>
            ${e.isNew ? '<span class="vd-badge-new">NEW</span>' : ''}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
  return sec;
}

function buildIndexShapeSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  const roleEntries = demoRolesFor(ver).length;
  const roleCap = DEMO_ROLE_CAP[ver];
  const evtEntries = demoEventsFor(ver).length;
  const evtCap = DEMO_EVENT_CAP[ver];
  const roleCount = roleCap; // shape uses capacity, not entry count
  const evtCount = evtCap;
  const initCount = EVENT_INITIATOR_CAP;
  const permSvcCount = DEMO_PERM_SVC_VALUES.length;
  const evtSvcCount = DEMO_EVT_SVC_VALUES.length;

  const roleStride = demoRoleStride(ver);
  const evtStride = eventStride(ver);
  const permSlots = permSvcCount * roleCount;
  const evtSlots = evtSvcCount * evtCount * initCount;

  const svcShape = DEMO_SVC_SHAPE;
  const svcSlots = svcShape.reduce((a, b) => a * b, 1);
  const svcDimNames = ['env', 'region', 'svc', 'ns'];
  const svcFormula = DEMO_SVC_STRIDES.map((s, i) =>
    s === 1 ? `(${svcDimNames[i]}−1)` : `(${svcDimNames[i]}−1)×${s}`,
  ).join(' + ');

  const prev = prevVer(ver);
  const prevRoleStride = prev ? demoRoleStride(prev) : roleStride;
  const prevEvtStride = prev ? eventStride(prev) : evtStride;
  const strideChanged = roleStride !== prevRoleStride || evtStride !== prevEvtStride;
  const hasHeadroom = roleEntries < roleCap || evtEntries < evtCap;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊙</span>
      <span class="vd-sec-title">인덱스 형상 (Index Shape)</span>
      ${strideChanged ? '<span class="vd-tag-changed">stride 변경</span>' : ''}
      ${!strideChanged && prev ? '<span class="vd-tag-stable">stride 불변 ✓</span>' : ''}
      ${hasHeadroom ? `<span class="vd-tag-headroom">headroom: role +${roleCap - roleEntries}, event +${evtCap - evtEntries}</span>` : ''}
    </div>
    <div class="vd-sec-body">
      <div class="vd-index-grid">

        <div class="vd-index-card ${strideChanged ? 'vd-card-changed' : ''}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">permission:${ver}</code>
            <span class="vd-shape-badge">[${permSvcCount}, ${roleCap}]</span>
            ${roleEntries < roleCap ? `<span class="vd-headroom-badge">${roleEntries}/${roleCap} used</span>` : ''}
            <span class="vd-slot-count">${permSlots}슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">(perm_svc−1)×${roleStride} + (role−1)</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>${permSlots - 1}</strong>
            &nbsp;·&nbsp; role stride = <strong>×${roleStride}</strong>
          </div>
        </div>

        <div class="vd-index-card ${strideChanged ? 'vd-card-changed' : ''}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">event:${ver}</code>
            <span class="vd-shape-badge">[${evtSvcCount}, ${evtCap}, ${initCount}]</span>
            ${evtEntries < evtCap ? `<span class="vd-headroom-badge">${evtEntries}/${evtCap} used</span>` : ''}
            <span class="vd-slot-count">${evtSlots}슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">(svc−1)×${evtStride} + (event−1)×${initCount} + (initiator−1)</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>${evtSlots - 1}</strong>
            &nbsp;·&nbsp; svc stride = <strong>×${evtStride}</strong>
          </div>
        </div>

        <div class="vd-index-card">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">service:v1</code>
            <span class="vd-shape-badge">[${svcShape.join(', ')}]</span>
            <span class="vd-slot-count">${svcSlots}슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">${svcFormula}</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>${svcSlots - 1}</strong>
            &nbsp;·&nbsp; <span style="color:#27ae60;font-weight:600">v1 유지 (변경 없음)</span>
          </div>
        </div>

      </div>
    </div>
  `;
  return sec;
}

function buildFeaturesSection(ver: Ver, data: FeatureData | null): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  if (!data) {
    sec.innerHTML = `
      <div class="vd-sec-header">
        <span class="vd-sec-icon">⊡</span>
        <span class="vd-sec-title">기능 × 역할 접근 배정</span>
      </div>
      <div class="vd-sec-body"><p style="color:var(--text-muted)">로딩 중...</p></div>
    `;
    return sec;
  }

  const currentData: Record<string, FeaturesResponse | undefined> = {
    v1: data.v1,
    v2: data.v2,
    v3: data.v3,
    v4: data.v4,
  };
  const current = currentData[ver] ?? data.v2;
  const allRoles = current.roles;
  const prev = prevVer(ver);
  const prevData = prev ? currentData[prev] : null;
  const prevFeatureIds = prevData ? new Set(prevData.features.map((f) => f.id)) : new Set<string>();
  // prev version grant lookup for diff
  const prevGrants = new Map<string, Set<string>>();
  if (prevData) {
    for (const f of prevData.features) prevGrants.set(f.id, new Set(f.grantedRoles));
  }

  // prev가 있으면 prev 인덱스 순서 기준으로 통합 렌더 (비활성화 항목도 원래 위치에 표시)
  const currentFeatureMap = new Map(current.features.map((f) => [f.id, f]));

  type RowEntry = {
    id: string;
    name: string;
    kind: 'active' | 'new' | 'removed';
    grantedRoles: string[];
  };
  let mergedRows: RowEntry[];

  if (prev && prevData) {
    // prev 순서 유지 + current에만 있는 새 항목은 끝에 추가
    mergedRows = prevData.features.map((f) => {
      const cur = currentFeatureMap.get(f.id);
      if (cur) {
        return {
          id: cur.id,
          name: cur.name,
          kind: 'active' as const,
          grantedRoles: cur.grantedRoles,
        };
      }
      return { id: f.id, name: f.name, kind: 'removed' as const, grantedRoles: [] };
    });
    // current에만 있는 새 항목
    for (const f of current.features) {
      if (!prevFeatureIds.has(f.id)) {
        mergedRows.push({ id: f.id, name: f.name, kind: 'new', grantedRoles: f.grantedRoles });
      }
    }
  } else {
    mergedRows = current.features.map((f) => ({
      id: f.id,
      name: f.name,
      kind: 'active' as const,
      grantedRoles: f.grantedRoles,
    }));
  }

  const tbody = mergedRows
    .map((row) => {
      if (row.kind === 'removed') {
        return `
        <tr class="vd-row-removed">
          <td class="vd-feat-name" style="text-decoration:line-through;color:var(--text-muted)">${row.name}</td>
          ${allRoles.map(() => `<td class="vd-feat-cell vd-cell-no">—</td>`).join('')}
          <td class="vd-feat-status"><span class="vd-badge-removed">비활성화</span></td>
        </tr>
      `;
      }

      const isNew = row.kind === 'new';
      const grantedSet = new Set(row.grantedRoles);
      const prevSet = prevGrants.get(row.id);

      return `
      <tr class="${isNew ? 'vd-row-added' : ''}">
        <td class="vd-feat-name">${row.name}</td>
        ${allRoles
          .map((r) => {
            const has = grantedSet.has(r.id);
            if (!prev) {
              return `<td class="vd-feat-cell ${has ? 'vd-cell-ok' : 'vd-cell-no'}">${has ? '✓' : '✗'}</td>`;
            }
            let cls = has ? 'vd-cell-ok' : 'vd-cell-no';
            if (isNew) {
              cls += ' vd-cell-new';
            } else if (prevSet) {
              const had = prevSet.has(r.id);
              if (had !== has) cls = has ? 'vd-cell-ok vd-cell-gained' : 'vd-cell-no vd-cell-lost';
            }
            return `<td class="vd-feat-cell ${cls}">${has ? '✓' : '✗'}</td>`;
          })
          .join('')}
        ${
          prev
            ? `<td class="vd-feat-status">${
                isNew
                  ? '<span class="vd-badge-new">NEW</span>'
                  : '<span class="vd-badge-unchanged">유지</span>'
              }</td>`
            : ''
        }
      </tr>
    `;
    })
    .join('');

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊡</span>
      <span class="vd-sec-title">기능 × 역할 접근 배정</span>
      ${prev ? '<span class="vd-tag-changed">이전 버전 대비</span>' : ''}
    </div>
    <div class="vd-sec-body">
      <div style="overflow-x:auto">
        <table class="vd-feat-table">
          <thead>
            <tr>
              <th class="vd-feat-name-col">기능</th>
              ${allRoles.map((r) => `<th><span class="role-tag role-tag-${r.id}">${r.id}</span></th>`).join('')}
              ${prev ? '<th class="vd-feat-status-col">상태</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${tbody}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildAddressExamplesSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  const prev = prevVer(ver);
  const curRoles = rolesFor(ver);
  const prevRoles = prev ? rolesFor(prev) : null;
  const curEvents = eventsFor(ver);
  const prevEvents = prev ? eventsFor(prev) : null;
  const hasPrev = prev !== null;

  // 대표 역할: 현재 버전의 마지막 3개 + 신규
  const sampleRoleIds = [
    ...new Set([...curRoles.filter((r) => r.isNew).map((r) => r.id), 'operator', 'viewer']),
  ].slice(0, 4);

  const permExamples = sampleRoleIds.map((id) => {
    const curP = dimPos(curRoles, id);
    const prevP = prevRoles ? dimPos(prevRoles, id) : null;
    return {
      role: id,
      ko: DEMO_KO.role[id] ?? id,
      prev: prevP !== null && prev ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, prevP, prev) : null,
      cur: curP !== null ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, curP, ver) : null,
      isNew: prevRoles ? !prevRoles.some((r) => r.id === id) : false,
    };
  });

  const sampleEvtIds = [
    'order.paid',
    ...curEvents
      .filter((e) => e.isNew)
      .map((e) => e.id)
      .slice(0, 2),
  ];

  const evtExamples = sampleEvtIds.map((id) => {
    const curP = dimPos(curEvents, id);
    const prevP = prevEvents ? dimPos(prevEvents, id) : null;
    return {
      id,
      ko: DEMO_KO.event[id] ?? id,
      prev: prevP !== null && prev ? eventAddress(EXAMPLE_EVT_SVC_POS, prevP, 1, prev) : null,
      cur: curP !== null ? eventAddress(EXAMPLE_EVT_SVC_POS, curP, 1, ver) : null,
      isNew: prevEvents ? !prevEvents.some((e) => e.id === id) : false,
    };
  });

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">🔢</span>
      <span class="vd-sec-title">주소 값 예시 — payment 서비스</span>
    </div>
    <div class="vd-sec-body">
      <div class="vd-addr-title">permission 주소 (역할별)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>역할</th>
              <th>논리 의미</th>
              ${hasPrev ? `<th class="vd-col-dimmed">permission:${prev}</th>` : ''}
              <th class="vd-col-active">permission:${ver}</th>
              ${hasPrev ? `<th>변동</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${permExamples
              .map((ex) => {
                const delta = ex.prev !== null && ex.cur !== null ? ex.cur - ex.prev : null;
                return `
              <tr class="${ex.isNew ? 'vd-row-added' : ''}">
                <td><span class="role-tag role-tag-${ex.role}">${ex.role}</span></td>
                <td class="vd-addr-desc">payment × ${ex.ko}</td>
                ${hasPrev ? `<td class="vd-col-dimmed">${ex.prev !== null ? `<code class="vd-addr-chip">permission:${prev}:${ex.prev}</code>` : `<span style="color:var(--text-muted)">—</span>`}</td>` : ''}
                <td class="vd-col-active">
                  ${ex.cur !== null ? `<code class="vd-addr-chip vd-chip-active">permission:${ver}:${ex.cur}</code>` : '—'}
                  ${ex.isNew ? '<span class="vd-badge-new">NEW</span>' : ''}
                </td>
                ${hasPrev ? `<td>${ex.isNew ? '<span class="vd-badge-new">NEW</span>' : delta === 0 ? '<span class="vd-delta-zero">±0</span>' : delta !== null ? `<span class="vd-delta-shift">${delta > 0 ? '+' : ''}${delta}</span>` : '—'}</td>` : ''}
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="vd-addr-title" style="margin-top:14px">event 주소 (payment:prod)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>이벤트</th>
              ${hasPrev ? `<th class="vd-col-dimmed">event:${prev}</th>` : ''}
              <th class="vd-col-active">event:${ver}</th>
              ${hasPrev ? `<th>변동</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${evtExamples
              .map((ex) => {
                const delta = ex.prev !== null && ex.cur !== null ? ex.cur - ex.prev : null;
                return `
              <tr class="${ex.isNew ? 'vd-row-added' : ''}">
                <td><span class="evt-tag evt-tag-payment">${ex.ko}</span></td>
                ${hasPrev ? `<td class="vd-col-dimmed">${ex.prev !== null ? `<code class="vd-addr-chip">event:${prev}:${ex.prev}</code>` : '—'}</td>` : ''}
                <td class="vd-col-active">
                  ${ex.cur !== null ? `<code class="vd-addr-chip vd-chip-active">event:${ver}:${ex.cur}</code>` : '—'}
                  ${ex.isNew ? '<span class="vd-badge-new">NEW</span>' : ''}
                </td>
                ${hasPrev ? `<td>${ex.isNew ? '<span class="vd-badge-new">NEW</span>' : delta === 0 ? '<span class="vd-delta-zero">±0</span>' : delta !== null ? `<span class="vd-delta-shift">${delta > 0 ? '+' : ''}${delta}</span>` : '—'}</td>` : ''}
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildCompositeIndexSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section';

  const prev = prevVer(ver);
  if (!prev) {
    sec.innerHTML = `<div class="vd-sec-header"><span class="vd-sec-icon">⇄</span><span class="vd-sec-title">합성 인덱스 비교</span></div>
      <div class="vd-sec-body"><p style="color:var(--text-muted)">v1은 기준 버전이므로 비교 대상이 없습니다.</p></div>`;
    return sec;
  }

  const curRoles = rolesFor(ver);
  const prevRoles = rolesFor(prev);
  const curEvents = eventsFor(ver);
  const prevEvents = eventsFor(prev);

  const curRS = demoRoleStride(ver);
  const prevRS = demoRoleStride(prev);
  const curES = eventStride(ver);
  const prevES = eventStride(prev);
  const IC = EVENT_INITIATOR_CAP;
  const strideChanged = curRS !== prevRS || curES !== prevES;

  const svcPos = EXAMPLE_PERM_SVC_POS;
  const evtSvcPos = EXAMPLE_EVT_SVC_POS;

  const allRoles = curRoles; // 현재 버전 기준
  const permRows = allRoles.map((r) => {
    const curP = dimPos(curRoles, r.id);
    const prevP = dimPos(prevRoles, r.id);
    const prevAddr = prevP !== null ? demoCalcPermAddr(svcPos, prevP, prev) : null;
    const curAddr = curP !== null ? demoCalcPermAddr(svcPos, curP, ver) : null;
    const isNew = !prevRoles.some((pr) => pr.id === r.id);
    const delta = prevAddr !== null && curAddr !== null ? curAddr - prevAddr : null;
    const formula = curP !== null ? `(${svcPos}−1)×${curRS} + (${curP}−1)` : '';
    return { role: r, prevAddr, curAddr, isNew, delta, formula };
  });

  const allEvents = curEvents;
  const evtRows = allEvents.map((e) => {
    const curP = dimPos(curEvents, e.id);
    const prevP = dimPos(prevEvents, e.id);
    const prevAddr = prevP !== null ? eventAddress(evtSvcPos, prevP, 1, prev) : null;
    const curAddr = curP !== null ? eventAddress(evtSvcPos, curP, 1, ver) : null;
    const isNew = !prevEvents.some((pe) => pe.id === e.id);
    const delta = prevAddr !== null && curAddr !== null ? curAddr - prevAddr : null;
    const formula = curP !== null ? `(${evtSvcPos}−1)×${curES} + (${curP}−1)×${IC} + 0` : '';
    return { event: e, prevAddr, curAddr, isNew, delta, formula };
  });

  function deltaCell(d: number | null, isNew: boolean): string {
    if (isNew) return `<span class="vd-badge-new">NEW</span>`;
    if (d === null) return '—';
    if (d === 0) return `<span class="vd-delta-zero">±0</span>`;
    return `<span class="vd-delta-shift">${d > 0 ? '+' : ''}${d}</span>`;
  }

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⇄</span>
      <span class="vd-sec-title">합성 인덱스 비교 — ${prev} → ${ver} (payment 서비스)</span>
      ${strideChanged ? '<span class="vd-tag-changed">stride 변경</span>' : '<span class="vd-tag-stable">stride 불변 ✓</span>'}
    </div>
    <div class="vd-sec-body">

      <div class="vd-ci-block">
        <div class="vd-ci-header">
          <span class="vd-ci-prefix">permission</span>
          <span class="vd-ci-meta">perm_svc pos=${svcPos} · stride ${prev}=×${prevRS} → ${ver}=×${curRS}</span>
        </div>
        <div class="vd-addr-table-wrap">
          <table class="vd-addr-table vd-ci-table">
            <thead>
              <tr>
                <th>역할</th>
                <th>pos</th>
                <th class="vd-col-dimmed">${prev} 주소</th>
                <th class="vd-col-active">${ver} 주소</th>
                <th>변동</th>
                <th>${ver} 계산식</th>
              </tr>
            </thead>
            <tbody>
              ${permRows
                .map(
                  (r) => `
                <tr class="${r.isNew ? 'vd-row-added' : ''}">
                  <td><span class="role-tag role-tag-${r.role.id}">${r.role.id}</span></td>
                  <td class="vd-ci-pos">${r.role.pos}</td>
                  <td class="vd-col-dimmed">${
                    r.prevAddr !== null
                      ? `<code class="vd-addr-chip">permission:${prev}:${r.prevAddr}</code>`
                      : `<span class="vd-ci-na">—</span>`
                  }</td>
                  <td class="vd-col-active">${
                    r.curAddr !== null
                      ? `<code class="vd-addr-chip vd-chip-active">permission:${ver}:${r.curAddr}</code>`
                      : '—'
                  }</td>
                  <td class="vd-ci-delta">${deltaCell(r.delta, r.isNew)}</td>
                  <td class="vd-ci-formula"><code>${r.formula}${r.curAddr !== null ? ` = ${r.curAddr}` : ''}</code></td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="vd-ci-block">
        <div class="vd-ci-header">
          <span class="vd-ci-prefix">event</span>
          <span class="vd-ci-meta">evt_svc pos=${evtSvcPos} · initiator=web(1) · stride ${prev}=×${prevES} → ${ver}=×${curES}</span>
        </div>
        <div class="vd-addr-table-wrap">
          <table class="vd-addr-table vd-ci-table">
            <thead>
              <tr>
                <th>이벤트</th>
                <th>pos</th>
                <th class="vd-col-dimmed">${prev} 주소</th>
                <th class="vd-col-active">${ver} 주소</th>
                <th>변동</th>
                <th>${ver} 계산식</th>
              </tr>
            </thead>
            <tbody>
              ${evtRows
                .map(
                  (r) => `
                <tr class="${r.isNew ? 'vd-row-added' : ''}">
                  <td><span class="${evtTagClass(r.event.id)}">${r.event.ko}</span></td>
                  <td class="vd-ci-pos">${r.event.pos}</td>
                  <td class="vd-col-dimmed">${
                    r.prevAddr !== null
                      ? `<code class="vd-addr-chip">event:${prev}:${r.prevAddr}</code>`
                      : `<span class="vd-ci-na">—</span>`
                  }</td>
                  <td class="vd-col-active">${
                    r.curAddr !== null
                      ? `<code class="vd-addr-chip vd-chip-active">event:${ver}:${r.curAddr}</code>`
                      : '—'
                  }</td>
                  <td class="vd-ci-delta">${deltaCell(r.delta, r.isNew)}</td>
                  <td class="vd-ci-formula"><code>${r.formula}${r.curAddr !== null ? ` = ${r.curAddr}` : ''}</code></td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
  return sec;
}

function buildProtocolSection(ver: Ver): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'vd-section vd-section-protocol';

  const prev = prevVer(ver);
  if (!prev) {
    sec.innerHTML = `<div class="vd-sec-header"><span class="vd-sec-icon">📡</span><span class="vd-sec-title">프로토콜 변경 설명</span></div>
      <div class="vd-sec-body"><p style="color:var(--text-muted)">v1은 기준 버전이므로 변경 사항이 없습니다.</p></div>`;
    return sec;
  }

  const prevRS = demoRoleStride(prev);
  const curRS = demoRoleStride(ver);
  const prevES = eventStride(prev);
  const curES = eventStride(ver);
  const prevRC = demoRolesFor(prev).length;
  const curRC = demoRolesFor(ver).length;
  const prevEC = demoEventsFor(prev).length;
  const curEC = demoEventsFor(ver).length;
  const IC = EVENT_INITIATOR_CAP;
  const strideChanged = prevRS !== curRS || prevES !== curES;

  const curRoles = rolesFor(ver);
  const prevRoles = rolesFor(prev);
  const newRoles = curRoles.filter((r) => r.isNew);
  const newEvents = eventsFor(ver).filter((e) => e.isNew);

  // 주소 예시: viewer
  const viewerPrevPos = dimPos(prevRoles, 'viewer');
  const viewerCurPos = dimPos(curRoles, 'viewer');
  const viewerPrevAddr = viewerPrevPos
    ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, viewerPrevPos, prev)
    : null;
  const viewerCurAddr = viewerCurPos
    ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, viewerCurPos, ver)
    : null;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">📡</span>
      <span class="vd-sec-title">${prev} → ${ver} 프로토콜 변경</span>
      ${strideChanged ? '<span class="vd-tag-changed">Breaking Change</span>' : '<span class="vd-tag-stable">Non-Breaking ✓</span>'}
    </div>
    <div class="vd-sec-body">
      <div class="vd-protocol-grid">

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">① 주소 prefix</div>
          <div class="vd-protocol-card-body">
            <div class="vd-proto-row">
              <span class="vd-proto-label">권한</span>
              <code class="vd-addr-chip vd-chip-old">permission:${prev}:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">permission:${ver}:X</code>
            </div>
            <div class="vd-proto-row">
              <span class="vd-proto-label">이벤트</span>
              <code class="vd-addr-chip vd-chip-old">event:${prev}:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">event:${ver}:X</code>
            </div>
            ${
              viewerPrevAddr !== null && viewerCurAddr !== null
                ? `
            <div class="vd-protocol-note">
              viewer 주소: <code>permission:${prev}:${viewerPrevAddr}</code> → <code>permission:${ver}:${viewerCurAddr}</code>
              ${viewerPrevAddr === viewerCurAddr ? ' — <strong>동일 (stride 불변)</strong>' : ' — stride 변경으로 값 달라짐'}
            </div>`
                : ''
            }
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">② 인코딩 공식</div>
          <div class="vd-protocol-card-body">
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">${prev}</span>
                <span class="vd-formula-expr">perm stride = <strong>×${prevRS}</strong> (role cap ${DEMO_ROLE_CAP[prev]})</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">${ver}</span>
                <span class="vd-formula-expr">perm stride = <strong>×${curRS}</strong> (role cap ${DEMO_ROLE_CAP[ver]})</span>
              </div>
            </div>
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">${prev}</span>
                <span class="vd-formula-expr">evt stride = <strong>×${prevES}</strong> (event cap ${DEMO_EVENT_CAP[prev]}×${IC})</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">${ver}</span>
                <span class="vd-formula-expr">evt stride = <strong>×${curES}</strong> (event cap ${DEMO_EVENT_CAP[ver]}×${IC})</span>
              </div>
            </div>
            <div class="vd-protocol-note">
              ${
                strideChanged
                  ? `role ${prevRC}→${curRC}개, event ${prevEC}→${curEC}개로 변경. stride 재계산 필요.`
                  : `capacity 동일 (role cap ${DEMO_ROLE_CAP[ver]}, event cap ${DEMO_EVENT_CAP[ver]}). <strong>stride 불변 → 기존 주소 그대로 사용 가능.</strong>`
              }
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">③ 마이그레이션 영향</div>
          <div class="vd-protocol-card-body">
            <div class="vd-migration-list">
              ${
                strideChanged
                  ? `
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span>permission/event 주소 재계산 필요 (stride 변경)</span>
              </div>`
                  : `
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span><strong>주소 재계산 불필요</strong> — stride 불변, capacity headroom 활용</span>
              </div>`
              }
              ${
                newRoles.length > 0
                  ? `
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>신규 역할 ${newRoles.map((r) => `${r.ko}(pos=${r.pos})`).join(', ')} — 끝에 추가</span>
              </div>`
                  : ''
              }
              ${
                newEvents.length > 0
                  ? `
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>신규 이벤트 ${newEvents.length}개 — 끝에 추가</span>
              </div>`
                  : ''
              }
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>기존 ${prevRC}개 역할, ${prevEC}개 이벤트 position 유지</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
  return sec;
}

// ── Main render ──────────────────────────────────────────────────────────────

export function renderVersionPage(
  container: HTMLElement,
  onVersionChange?: (ver: Ver) => void,
  initialVer: Ver = 'v2',
): void {
  container.innerHTML = '';

  let activeVer: Ver = initialVer;
  let featureData: FeatureData | null = null;
  let featuresEl: HTMLElement | null = null;

  // ── Version selector bar ──
  const verBar = document.createElement('div');
  verBar.className = 'vd-ver-bar';
  verBar.innerHTML = `
    <span class="vd-ver-label">스키마 버전</span>
    ${ALL_VERS.map((v) => `<button class="vd-ver-btn${v === initialVer ? ' vd-ver-btn-active' : ''}" data-ver="${v}">${v}</button>`).join('')}
    <span class="vd-ver-hint">이전 버전 대비 신규 항목이 강조됩니다</span>
  `;
  container.appendChild(verBar);

  // ── Content area ──
  const content = document.createElement('div');
  content.className = 'vd-content';
  container.appendChild(content);

  function render(ver: Ver): void {
    content.innerHTML = '';

    const twoCol = document.createElement('div');
    twoCol.className = 'vd-two-col';

    const leftCol = document.createElement('div');
    leftCol.className = 'vd-col';
    leftCol.appendChild(buildRolesSection(ver));
    leftCol.appendChild(buildEventsSection(ver));

    const rightCol = document.createElement('div');
    rightCol.className = 'vd-col';
    rightCol.appendChild(buildIndexShapeSection(ver));
    rightCol.appendChild(buildAddressExamplesSection(ver));

    twoCol.appendChild(leftCol);
    twoCol.appendChild(rightCol);
    content.appendChild(twoCol);

    content.appendChild(buildCompositeIndexSection(ver));

    featuresEl = buildFeaturesSection(ver, featureData);
    content.appendChild(featuresEl);
    content.appendChild(buildProtocolSection(ver));
  }

  // 기능 데이터 비동기 로드 (v3/v4는 API 미지원 시 v2로 폴백)
  Promise.all([
    fetchFeatures('v1'),
    fetchFeatures('v2'),
    fetchFeatures('v3').catch(() => null),
    fetchFeatures('v4').catch(() => null),
  ])
    .then(([v1, v2, v3, v4]) => {
      featureData = { v1, v2, v3: v3 ?? v2, v4: v4 ?? v2 };
      if (featuresEl) {
        const newEl = buildFeaturesSection(activeVer, featureData);
        featuresEl.replaceWith(newEl);
        featuresEl = newEl;
      }
      return undefined;
    })
    .catch(() => {
      /* API 미접속 시 로딩 상태 유지 */
    });

  verBar.querySelectorAll<HTMLButtonElement>('.vd-ver-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeVer = btn.dataset['ver'] as Ver;
      verBar.querySelectorAll<HTMLButtonElement>('.vd-ver-btn').forEach((b) => {
        b.classList.toggle('vd-ver-btn-active', b.dataset['ver'] === activeVer);
      });
      render(activeVer);
      onVersionChange?.(activeVer as Ver);
    });
  });

  render(activeVer);
}
