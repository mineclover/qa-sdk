// ═══════════════════════════════════════════════════════════════════════════
//  버전 변경 — v1 / v2 비교 (SSOT 기반)
// ═══════════════════════════════════════════════════════════════════════════
//
// weighted-index의 demo-snapshot(SSOT)에서 차원 데이터를 직접 가져오고,
// 기능 × 역할 매트릭스는 API에서 실시간으로 조회합니다.
// 하드코딩 없이 실제 구현 데이터를 기반으로 v1/v2 차이를 표현합니다.
//

import {
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2,
  DEMO_INITIATORS, DEMO_KO,
  DEMO_SVC_SHAPE, DEMO_SVC_STRIDES,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  demoRoleStride, demoEvtStride,
  demoCalcPermAddr, demoCalcEvtAddr,
  type DemoVer,
} from "demo-snapshot";
import { fetchFeatures, type FeaturesResponse } from "../registry.js";

type Ver = DemoVer;

// ── SSOT 파생 메타데이터 ──────────────────────────────────────────────────────

interface DimEntry { id: string; ko: string; pos: number; isNew: boolean }

function rolesFor(ver: Ver): DimEntry[] {
  const entries = ver === "v1" ? DEMO_ROLES_V1 : DEMO_ROLES_V2;
  const v1Set = new Set<string>(DEMO_ROLES_V1);
  return [...entries].map((id, i) => ({
    id, ko: DEMO_KO.role[id] ?? id, pos: i + 1,
    isNew: ver === "v2" && !v1Set.has(id),
  }));
}

function eventsFor(ver: Ver): DimEntry[] {
  const entries = ver === "v1" ? DEMO_EVENTS_V1 : DEMO_EVENTS_V2;
  const v1Set = new Set<string>(DEMO_EVENTS_V1);
  return [...entries].map((id, i) => ({
    id, ko: DEMO_KO.event[id] ?? id, pos: i + 1,
    isNew: ver === "v2" && !v1Set.has(id),
  }));
}

function dimPos(entries: DimEntry[], id: string): number | null {
  return entries.find(e => e.id === id)?.pos ?? null;
}

function evtTagClass(id: string): string {
  if (id.startsWith("user."))    return "evt-tag evt-tag-user";
  if (id.startsWith("order."))   return "evt-tag evt-tag-order";
  if (id.startsWith("payment.")) return "evt-tag evt-tag-payment";
  if (id.startsWith("session.")) return "evt-tag evt-tag-session";
  if (id.startsWith("config."))  return "evt-tag evt-tag-config";
  return "evt-tag";
}

// 주소 예시에 사용할 서비스: payment:prod:shop (value=46)
const EXAMPLE_SVC_VALUE = 46;
const EXAMPLE_PERM_SVC_POS = DEMO_PERM_SVC_VALUES.indexOf(EXAMPLE_SVC_VALUE) + 1;
const EXAMPLE_EVT_SVC_POS  = DEMO_EVT_SVC_VALUES.indexOf(EXAMPLE_SVC_VALUE) + 1;

// ── Feature data (API) ───────────────────────────────────────────────────────

interface FeatureData { v1: FeaturesResponse; v2: FeaturesResponse }

// ── Section builders ─────────────────────────────────────────────────────────

function buildRolesSection(ver: Ver): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const roles = rolesFor(ver);
  const addedCount = roles.filter(r => r.isNew).length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">👤</span>
      <span class="vd-sec-title">역할 (role) 차원</span>
      <span class="vd-shape-badge">${roles.length}개 항목</span>
      ${addedCount > 0 ? `<span class="vd-tag-new">+${addedCount} 추가</span>` : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${roles.map(r => `
          <div class="vd-dim-row ${r.isNew ? "vd-row-added" : ""}">
            <span class="vd-dim-pos">${r.pos}</span>
            <span class="role-tag role-tag-${r.id}">${r.id}</span>
            <span class="vd-dim-ko">${r.ko}</span>
            ${r.isNew ? '<span class="vd-badge-new">NEW</span>' : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return sec;
}

function buildEventsSection(ver: Ver): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const events = eventsFor(ver);
  const addedCount = events.filter(e => e.isNew).length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">◈</span>
      <span class="vd-sec-title">이벤트명 (event_name) 차원</span>
      <span class="vd-shape-badge">${events.length}개 항목</span>
      ${addedCount > 0 ? `<span class="vd-tag-new">+${addedCount} 추가</span>` : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${events.map(e => `
          <div class="vd-dim-row ${e.isNew ? "vd-row-added" : ""}">
            <span class="vd-dim-pos">${e.pos}</span>
            <span class="${evtTagClass(e.id)}">${e.id}</span>
            <span class="vd-dim-ko">${e.ko}</span>
            ${e.isNew ? '<span class="vd-badge-new">NEW</span>' : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return sec;
}

function buildIndexShapeSection(ver: Ver): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const roleCount = (ver === "v1" ? DEMO_ROLES_V1 : DEMO_ROLES_V2).length;
  const evtCount = (ver === "v1" ? DEMO_EVENTS_V1 : DEMO_EVENTS_V2).length;
  const initCount = DEMO_INITIATORS.length;
  const permSvcCount = DEMO_PERM_SVC_VALUES.length;
  const evtSvcCount = DEMO_EVT_SVC_VALUES.length;

  const roleStride = demoRoleStride(ver);
  const evtStride = demoEvtStride(ver);
  const permSlots = permSvcCount * roleCount;
  const evtSlots = evtSvcCount * evtCount * initCount;

  const svcShape = DEMO_SVC_SHAPE;
  const svcSlots = svcShape.reduce((a, b) => a * b, 1);
  const svcDimNames = ["env", "region", "svc", "ns"];
  const svcFormula = DEMO_SVC_STRIDES.map((s, i) =>
    s === 1 ? `(${svcDimNames[i]}−1)` : `(${svcDimNames[i]}−1)×${s}`
  ).join(" + ");

  const changed = ver === "v2";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊙</span>
      <span class="vd-sec-title">인덱스 형상 (Index Shape)</span>
      ${changed ? '<span class="vd-tag-changed">공식 변경</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-index-grid">

        <div class="vd-index-card ${changed ? "vd-card-changed" : ""}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">permission:${ver}</code>
            <span class="vd-shape-badge">[${permSvcCount}, ${roleCount}]</span>
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

        <div class="vd-index-card ${changed ? "vd-card-changed" : ""}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">event:${ver}</code>
            <span class="vd-shape-badge">[${evtSvcCount}, ${evtCount}, ${initCount}]</span>
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
            <span class="vd-shape-badge">[${svcShape.join(", ")}]</span>
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
  const sec = document.createElement("div");
  sec.className = "vd-section";

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

  const current = ver === "v1" ? data.v1 : data.v2;
  const allRoles = current.roles;
  const v1FeatureIds = new Set(data.v1.features.map(f => f.id));
  const v2FeatureIds = new Set(data.v2.features.map(f => f.id));

  // v1 grant lookup for diff
  const v1Grants = new Map<string, Set<string>>();
  for (const f of data.v1.features) v1Grants.set(f.id, new Set(f.grantedRoles));

  const tbody = current.features.map(f => {
    const isNew = ver === "v2" && !v1FeatureIds.has(f.id);
    const grantedSet = new Set(f.grantedRoles);
    const v1Set = v1Grants.get(f.id);

    return `
      <tr class="${isNew ? "vd-row-added" : ""}">
        <td class="vd-feat-name">${f.name}</td>
        ${allRoles.map(r => {
          const has = grantedSet.has(r.id);
          if (ver === "v1") {
            return `<td class="vd-feat-cell ${has ? "vd-cell-ok" : "vd-cell-no"}">${has ? "✓" : "✗"}</td>`;
          }
          let cls = has ? "vd-cell-ok" : "vd-cell-no";
          if (isNew) {
            cls += " vd-cell-new";
          } else if (v1Set) {
            const had = v1Set.has(r.id);
            if (had !== has) cls = has ? "vd-cell-ok vd-cell-gained" : "vd-cell-no vd-cell-lost";
          }
          return `<td class="vd-feat-cell ${cls}">${has ? "✓" : "✗"}</td>`;
        }).join("")}
        ${ver === "v2"
          ? `<td class="vd-feat-status">${isNew
              ? '<span class="vd-badge-new">NEW</span>'
              : '<span class="vd-badge-unchanged">유지</span>'}</td>`
          : ""}
      </tr>
    `;
  }).join("");

  const removedRows = ver === "v2"
    ? data.v1.features
        .filter(f => !v2FeatureIds.has(f.id))
        .map(f => `
          <tr class="vd-row-removed">
            <td class="vd-feat-name" style="text-decoration:line-through;color:var(--text-muted)">${f.name}</td>
            ${allRoles.map(() => `<td class="vd-feat-cell vd-cell-no">—</td>`).join("")}
            <td class="vd-feat-status"><span class="vd-badge-removed">분리됨</span></td>
          </tr>
        `).join("")
    : "";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊡</span>
      <span class="vd-sec-title">기능 × 역할 접근 배정</span>
      ${ver === "v2" ? '<span class="vd-tag-changed">구조 변경</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div style="overflow-x:auto">
        <table class="vd-feat-table">
          <thead>
            <tr>
              <th class="vd-feat-name-col">기능</th>
              ${allRoles.map(r => `<th><span class="role-tag role-tag-${r.id}">${r.id}</span></th>`).join("")}
              ${ver === "v2" ? '<th class="vd-feat-status-col">상태</th>' : ""}
            </tr>
          </thead>
          <tbody>
            ${tbody}
            ${removedRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildAddressExamplesSection(ver: Ver): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const v1Roles = rolesFor("v1");
  const v2Roles = rolesFor("v2");
  const v1Events = eventsFor("v1");
  const v2Events = eventsFor("v2");

  // permission 주소 예시 (payment service, permSvcPos)
  const permExamples = ["operator", "viewer", "customer"].map(id => {
    const v1p = dimPos(v1Roles, id);
    const v2p = dimPos(v2Roles, id);
    return {
      role: id, ko: DEMO_KO.role[id] ?? id,
      v1: v1p !== null ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, v1p, "v1") : null,
      v2: v2p !== null ? demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, v2p, "v2") : null,
    };
  });

  // event 주소 예시 (payment:prod service, evtSvcPos, web initiator)
  const evtExamples = [
    { id: "order.paid",               label: "order.paid × payment:prod × web" },
    { id: "payment.cancel_requested", label: "payment.cancel_requested × payment:prod × web" },
    { id: "payment.cancel_approved",  label: "payment.cancel_approved × payment:prod × web" },
  ].map(ex => {
    const v1p = dimPos(v1Events, ex.id);
    const v2p = dimPos(v2Events, ex.id);
    return {
      name: ex.label,
      ko: DEMO_KO.event[ex.id] ?? ex.id,
      v1: v1p !== null ? demoCalcEvtAddr(EXAMPLE_EVT_SVC_POS, v1p, 1, "v1") : null,
      v2: v2p !== null ? demoCalcEvtAddr(EXAMPLE_EVT_SVC_POS, v2p, 1, "v2") : null,
    };
  });

  const showV2 = ver === "v2";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">🔢</span>
      <span class="vd-sec-title">주소 값 예시 — payment 서비스 (permSvcPos=${EXAMPLE_PERM_SVC_POS}, evtSvcPos=${EXAMPLE_EVT_SVC_POS})</span>
    </div>
    <div class="vd-sec-body">
      <div class="vd-addr-title">permission 주소 (역할별)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>역할</th>
              <th>논리 의미</th>
              <th class="${showV2 ? "vd-col-dimmed" : ""}">permission:v1</th>
              <th class="${showV2 ? "vd-col-active" : ""}">permission:v2</th>
            </tr>
          </thead>
          <tbody>
            ${permExamples.map(ex => `
              <tr class="${ex.v1 === null ? "vd-row-added" : ""}">
                <td><span class="role-tag role-tag-${ex.role}">${ex.role}</span></td>
                <td class="vd-addr-desc">payment × ${ex.ko}</td>
                <td class="${showV2 ? "vd-col-dimmed" : ""}">
                  ${ex.v1 !== null
                    ? `<code class="vd-addr-chip">permission:v1:${ex.v1}</code>`
                    : `<span style="color:var(--text-muted)">존재 안 함</span>`}
                </td>
                <td class="${showV2 ? "vd-col-active" : ""}">
                  ${ex.v2 !== null
                    ? `<code class="vd-addr-chip ${showV2 ? "vd-chip-active" : ""}">${`permission:v2:${ex.v2}`}</code>`
                    : `<span style="color:var(--text-muted)">—</span>`}
                  ${ex.v1 !== null && ex.v2 !== null && ex.v1 !== ex.v2 && showV2
                    ? `<span class="vd-addr-diff">(v1: ${ex.v1})</span>`
                    : ""}
                  ${ex.v1 === null && showV2 ? '<span class="vd-badge-new">NEW</span>' : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="vd-addr-title" style="margin-top:14px">event 주소 (payment:prod 서비스)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>이벤트</th>
              <th>설명</th>
              <th class="${showV2 ? "vd-col-dimmed" : ""}">event:v1</th>
              <th class="${showV2 ? "vd-col-active" : ""}">event:v2</th>
            </tr>
          </thead>
          <tbody>
            ${evtExamples.map(ex => `
              <tr class="${ex.v1 === null ? "vd-row-added" : ""}">
                <td><span class="evt-tag evt-tag-payment">${ex.ko}</span></td>
                <td class="vd-addr-desc" style="font-size:0.72rem">${ex.name}</td>
                <td class="${showV2 ? "vd-col-dimmed" : ""}">
                  ${ex.v1 !== null
                    ? `<code class="vd-addr-chip">event:v1:${ex.v1}</code>`
                    : `<span style="color:var(--text-muted)">존재 안 함</span>`}
                </td>
                <td class="${showV2 ? "vd-col-active" : ""}">
                  ${ex.v2 !== null
                    ? `<code class="vd-addr-chip ${showV2 ? "vd-chip-active" : ""}">${`event:v2:${ex.v2}`}</code>`
                    : `<span style="color:var(--text-muted)">—</span>`}
                  ${ex.v1 !== null && ex.v2 !== null && ex.v1 !== ex.v2 && showV2
                    ? `<span class="vd-addr-diff">(v1: ${ex.v1})</span>`
                    : ""}
                  ${ex.v1 === null && showV2 ? '<span class="vd-badge-new">NEW</span>' : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildCompositeIndexSection(ver: Ver): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const v1Roles = rolesFor("v1");
  const v2Roles = rolesFor("v2");
  const v1Events = eventsFor("v1");
  const v2Events = eventsFor("v2");

  const v1RS = demoRoleStride("v1");
  const v2RS = demoRoleStride("v2");
  const v1ES = demoEvtStride("v1");
  const v2ES = demoEvtStride("v2");
  const IC = DEMO_INITIATORS.length;

  const svcPos = EXAMPLE_PERM_SVC_POS;
  const evtSvcPos = EXAMPLE_EVT_SVC_POS;

  // permission: 모든 역할에 대해 v1 vs v2 주소 비교
  const v1RoleSet = new Set<string>(DEMO_ROLES_V1);
  const allRoles = v2Roles; // v2가 상위 집합
  const permRows = allRoles.map(r => {
    const v1p = dimPos(v1Roles, r.id);
    const v2p = dimPos(v2Roles, r.id);
    const v1Addr = v1p !== null ? demoCalcPermAddr(svcPos, v1p, "v1") : null;
    const v2Addr = v2p !== null ? demoCalcPermAddr(svcPos, v2p, "v2") : null;
    const isNew = !v1RoleSet.has(r.id);
    const delta = v1Addr !== null && v2Addr !== null ? v2Addr - v1Addr : null;
    // ver에 맞는 formula: v1 뷰에서 NEW 역할(v1p===null)은 formula 비표시
    const activeP = ver === "v1" ? v1p : v2p;
    const activeRS = ver === "v1" ? v1RS : v2RS;
    const formula = activeP !== null ? `(${svcPos}−1)×${activeRS} + (${activeP}−1)` : "";
    return { role: r, v1Addr, v2Addr, isNew, delta, formula };
  });

  // event: 모든 이벤트에 대해 v1 vs v2 주소 비교 (initiator=web, pos=1)
  const v1EvtSet = new Set<string>(DEMO_EVENTS_V1);
  const allEvents = v2Events;
  const evtRows = allEvents.map(e => {
    const v1p = dimPos(v1Events, e.id);
    const v2p = dimPos(v2Events, e.id);
    const v1Addr = v1p !== null ? demoCalcEvtAddr(evtSvcPos, v1p, 1, "v1") : null;
    const v2Addr = v2p !== null ? demoCalcEvtAddr(evtSvcPos, v2p, 1, "v2") : null;
    const isNew = !v1EvtSet.has(e.id);
    const delta = v1Addr !== null && v2Addr !== null ? v2Addr - v1Addr : null;
    const stride = ver === "v1" ? v1ES : v2ES;
    const formula = v2p !== null ? `(${evtSvcPos}−1)×${stride} + (${v2p}−1)×${IC} + 0` : "";
    return { event: e, v1Addr, v2Addr, isNew, delta, formula };
  });

  function deltaCell(d: number | null, isNew: boolean): string {
    if (isNew) return `<span class="vd-badge-new">NEW</span>`;
    if (d === null) return "—";
    if (d === 0) return `<span class="vd-delta-zero">±0</span>`;
    return `<span class="vd-delta-shift">${d > 0 ? "+" : ""}${d}</span>`;
  }

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⇄</span>
      <span class="vd-sec-title">합성 인덱스 변경 비교 — payment 서비스 (svcValue=${EXAMPLE_SVC_VALUE})</span>
      <span class="vd-tag-changed">stride 변경</span>
    </div>
    <div class="vd-sec-body">

      <div class="vd-ci-block">
        <div class="vd-ci-header">
          <span class="vd-ci-prefix">permission</span>
          <span class="vd-ci-meta">perm_svc pos=${svcPos} · stride v1=×${v1RS} → v2=×${v2RS}</span>
        </div>
        <div class="vd-addr-table-wrap">
          <table class="vd-addr-table vd-ci-table">
            <thead>
              <tr>
                <th>역할</th>
                <th>pos</th>
                <th class="vd-col-dimmed">v1 주소</th>
                <th class="vd-col-active">v2 주소</th>
                <th>변동</th>
                <th>v2 계산식</th>
              </tr>
            </thead>
            <tbody>
              ${permRows.map(r => `
                <tr class="${r.isNew ? "vd-row-added" : ""}">
                  <td><span class="role-tag role-tag-${r.role.id}">${r.role.id}</span></td>
                  <td class="vd-ci-pos">${r.role.pos}</td>
                  <td class="vd-col-dimmed">${r.v1Addr !== null
                    ? `<code class="vd-addr-chip">permission:v1:${r.v1Addr}</code>`
                    : `<span class="vd-ci-na">—</span>`}</td>
                  <td class="vd-col-active"><code class="vd-addr-chip vd-chip-active">permission:v2:${r.v2Addr}</code></td>
                  <td class="vd-ci-delta">${deltaCell(r.delta, r.isNew)}</td>
                  <td class="vd-ci-formula"><code>${r.formula} = ${r.v2Addr}</code></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="vd-ci-block">
        <div class="vd-ci-header">
          <span class="vd-ci-prefix">event</span>
          <span class="vd-ci-meta">evt_svc pos=${evtSvcPos} · initiator=web(1) · stride v1=×${v1ES} → v2=×${v2ES}</span>
        </div>
        <div class="vd-addr-table-wrap">
          <table class="vd-addr-table vd-ci-table">
            <thead>
              <tr>
                <th>이벤트</th>
                <th>pos</th>
                <th class="vd-col-dimmed">v1 주소</th>
                <th class="vd-col-active">v2 주소</th>
                <th>변동</th>
                <th>v2 계산식</th>
              </tr>
            </thead>
            <tbody>
              ${evtRows.map(r => `
                <tr class="${r.isNew ? "vd-row-added" : ""}">
                  <td><span class="${evtTagClass(r.event.id)}">${r.event.ko}</span></td>
                  <td class="vd-ci-pos">${r.event.pos}</td>
                  <td class="vd-col-dimmed">${r.v1Addr !== null
                    ? `<code class="vd-addr-chip">event:v1:${r.v1Addr}</code>`
                    : `<span class="vd-ci-na">—</span>`}</td>
                  <td class="vd-col-active"><code class="vd-addr-chip vd-chip-active">event:v2:${r.v2Addr}</code></td>
                  <td class="vd-ci-delta">${deltaCell(r.delta, r.isNew)}</td>
                  <td class="vd-ci-formula"><code>${r.formula} = ${r.v2Addr}</code></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
  return sec;
}

function buildProtocolSection(): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section vd-section-protocol";

  // SSOT에서 계산
  const v1RS = demoRoleStride("v1");
  const v2RS = demoRoleStride("v2");
  const v1ES = demoEvtStride("v1");
  const v2ES = demoEvtStride("v2");
  const v1RC = DEMO_ROLES_V1.length;
  const v2RC = DEMO_ROLES_V2.length;
  const v1EC = DEMO_EVENTS_V1.length;
  const v2EC = DEMO_EVENTS_V2.length;
  const IC = DEMO_INITIATORS.length;

  // 주소 예시: viewer at payment
  const v1Roles = rolesFor("v1");
  const v2Roles = rolesFor("v2");
  const viewerV1Pos = dimPos(v1Roles, "viewer")!;
  const viewerV2Pos = dimPos(v2Roles, "viewer")!;
  const viewerV1Addr = demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, viewerV1Pos, "v1");
  const viewerV2Addr = demoCalcPermAddr(EXAMPLE_PERM_SVC_POS, viewerV2Pos, "v2");

  // 신규 항목 정보
  const newRoles = v2Roles.filter(r => r.isNew);
  const newEvents = eventsFor("v2").filter(e => e.isNew);
  const newRolesDesc = newRoles.map(r => `${r.ko}는 끝에 추가, pos=${r.pos}`).join("; ");

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">📡</span>
      <span class="vd-sec-title">API 프로토콜 변경 설명</span>
      <span class="vd-tag-changed">Breaking Change</span>
    </div>
    <div class="vd-sec-body">

      <div class="vd-protocol-grid">

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">① 주소 prefix 변경</div>
          <div class="vd-protocol-card-body">
            <div class="vd-proto-row">
              <span class="vd-proto-label">권한 주소</span>
              <code class="vd-addr-chip vd-chip-old">permission:v1:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">permission:v2:X</code>
            </div>
            <div class="vd-proto-row">
              <span class="vd-proto-label">이벤트 주소</span>
              <code class="vd-addr-chip vd-chip-old">event:v1:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">event:v2:X</code>
            </div>
            <div class="vd-proto-row">
              <span class="vd-proto-label">서비스 주소</span>
              <code class="vd-addr-chip">service:v1:X</code>
              <span class="vd-proto-note">변경 없음</span>
            </div>
            <div class="vd-protocol-note">
              v1과 v2 주소는 동일한 숫자라도 <strong>다른 논리 의미</strong>를 가집니다.<br/>
              예) <code>permission:v1:${viewerV1Addr}</code> = payment × viewer(pos=${viewerV1Pos}),
              <code>permission:v2:${viewerV2Addr}</code> = payment × viewer(pos=${viewerV2Pos}) — stride 변경으로 주소 달라짐
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">② 인코딩 공식 변경</div>
          <div class="vd-protocol-card-body">
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">v1</span>
                <span class="vd-formula-expr">(perm_svc−1) × <strong>${v1RS}</strong> + (role−1)</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">v2</span>
                <span class="vd-formula-expr">(perm_svc−1) × <strong>${v2RS}</strong> + (role−1)</span>
              </div>
            </div>
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">v1</span>
                <span class="vd-formula-expr">(svc−1) × <strong>${v1ES}</strong> + (evt−1)×${IC} + (init−1)</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">v2</span>
                <span class="vd-formula-expr">(svc−1) × <strong>${v2ES}</strong> + (evt−1)×${IC} + (init−1)</span>
              </div>
            </div>
            <div class="vd-protocol-note">
              role 차원이 ${v1RC}→${v2RC}개로 늘어나 permission stride가 ${v1RS}→${v2RS}으로 변경.<br/>
              event 차원이 ${v1EC}→${v2EC}개로 늘어나 event stride가 ${v1ES}(=${v1EC}×${IC})→${v2ES}(=${v2EC}×${IC})으로 변경.
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">③ 기능 분리 (Breaking)</div>
          <div class="vd-protocol-card-body">
            <div class="vd-split-diagram">
              <div class="vd-split-old">
                <code class="vd-feat-chip vd-chip-old">payment_cancel</code>
                <div class="vd-split-old-roles">admin · developer · operator</div>
              </div>
              <div class="vd-split-arrow">분리 ↓</div>
              <div class="vd-split-new">
                <div class="vd-split-row">
                  <code class="vd-feat-chip vd-chip-active">payment_cancel_req</code>
                  <span class="vd-split-roles">admin · <span class="role-tag role-tag-customer">customer</span></span>
                </div>
                <div class="vd-split-row">
                  <code class="vd-feat-chip vd-chip-active">payment_cancel_approve</code>
                  <span class="vd-split-roles">admin · <span class="role-tag role-tag-operator">operator</span></span>
                </div>
              </div>
            </div>
            <div class="vd-protocol-note">
              developer는 v1에서 결제 취소 권한을 보유했으나<br/>
              v2에서는 두 기능 모두에서 <strong>의도적으로 제외</strong>됩니다.
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">④ 마이그레이션 영향</div>
          <div class="vd-protocol-card-body">
            <div class="vd-migration-list">
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span>저장된 <code>permission:v1:X</code> 주소를 v2 주소로 재계산 필요</span>
              </div>
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span>저장된 <code>event:v1:X</code> 주소를 v2 주소로 재계산 필요</span>
              </div>
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span><code>payment_cancel</code> featureId 참조를 두 개로 분리</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span><code>service:v1:X</code> 주소 변경 없음</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>기존 ${v1RC}개 역할의 position 유지 (${newRolesDesc})</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>기존 ${v1EC}개 이벤트명의 position 유지 (신규 ${newEvents.length}개는 뒤에 추가)</span>
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
  onVersionChange?: (ver: "v1" | "v2") => void,
  initialVer: "v1" | "v2" = "v2",
): void {
  container.innerHTML = "";

  let activeVer: Ver = initialVer;
  let featureData: FeatureData | null = null;
  let featuresEl: HTMLElement | null = null;

  // ── Version selector bar ──
  const verBar = document.createElement("div");
  verBar.className = "vd-ver-bar";
  verBar.innerHTML = `
    <span class="vd-ver-label">스키마 버전</span>
    <button class="vd-ver-btn${initialVer === "v1" ? " vd-ver-btn-active" : ""}" data-ver="v1">v1</button>
    <button class="vd-ver-btn${initialVer === "v2" ? " vd-ver-btn-active" : ""}" data-ver="v2">v2</button>
    <span class="vd-ver-hint">v2에는 신규 항목이 강조 표시됩니다</span>
  `;
  container.appendChild(verBar);

  // ── Content area ──
  const content = document.createElement("div");
  content.className = "vd-content";
  container.appendChild(content);

  function render(ver: Ver): void {
    content.innerHTML = "";

    const twoCol = document.createElement("div");
    twoCol.className = "vd-two-col";

    const leftCol = document.createElement("div");
    leftCol.className = "vd-col";
    leftCol.appendChild(buildRolesSection(ver));
    leftCol.appendChild(buildEventsSection(ver));

    const rightCol = document.createElement("div");
    rightCol.className = "vd-col";
    rightCol.appendChild(buildIndexShapeSection(ver));
    rightCol.appendChild(buildAddressExamplesSection(ver));

    twoCol.appendChild(leftCol);
    twoCol.appendChild(rightCol);
    content.appendChild(twoCol);

    content.appendChild(buildCompositeIndexSection(ver));

    featuresEl = buildFeaturesSection(ver, featureData);
    content.appendChild(featuresEl);
    content.appendChild(buildProtocolSection());
  }

  // 기능 데이터 비동기 로드
  Promise.all([fetchFeatures("v1"), fetchFeatures("v2")])
    .then(([v1, v2]) => {
      featureData = { v1, v2 };
      if (featuresEl) {
        const newEl = buildFeaturesSection(activeVer, featureData);
        featuresEl.replaceWith(newEl);
        featuresEl = newEl;
      }
    })
    .catch(() => { /* API 미접속 시 로딩 상태 유지 */ });

  verBar.querySelectorAll<HTMLButtonElement>(".vd-ver-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeVer = btn.dataset["ver"] as Ver;
      verBar.querySelectorAll<HTMLButtonElement>(".vd-ver-btn").forEach((b) => {
        b.classList.toggle("vd-ver-btn-active", b.dataset["ver"] === activeVer);
      });
      render(activeVer);
      onVersionChange?.(activeVer);
    });
  });

  render(activeVer);
}
