// ═══════════════════════════════════════════════════════════════════════════
//  접근 제어 — perm_svc(1D 압축) × role × event 매핑 시뮬레이터
// ═══════════════════════════════════════════════════════════════════════════

import {
  serializeAddress,
  DEMO_SVCS, DEMO_NSS, DEMO_KO,
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2,
  demoRoleStride, demoEvtStride,
  demoCalcPermAddr, demoCalcEvtAddr,
  type DemoVer,
} from "weighted-index";

type Ver = DemoVer;

function fmtAddr(schema: string, ver: Ver, index: number): string {
  return serializeAddress({ schema, version: ver, index }, "colon");
}

// ── perm_svc: svc_name(5) × namespace(2) → 1D (1..10) ──────────────────

interface PermSvcMeta {
  pos: number; svcId: string; svcKo: string; nsId: string; nsKo: string;
}

const SVC_NAMES = DEMO_SVCS.map(id => ({ id, ko: DEMO_KO.svc[id] }));
const NS = DEMO_NSS.map(id => ({ id, ko: DEMO_KO.ns[id] }));

const PERM_SVCS: PermSvcMeta[] = [];
{
  let p = 1;
  for (const s of SVC_NAMES)
    for (const n of NS)
      PERM_SVCS.push({ pos: p++, svcId: s.id, svcKo: s.ko, nsId: n.id, nsKo: n.ko });
}

// ── Role metadata ───────────────────────────────────────────────────────

interface RoleMeta { idx1: number; id: string; ko: string }

const ROLES_V1: RoleMeta[] = DEMO_ROLES_V1.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.role[id] }));
const ROLES_V2: RoleMeta[] = DEMO_ROLES_V2.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.role[id] }));

// ── Event metadata ──────────────────────────────────────────────────────

interface EvtMeta { idx1: number; id: string; ko: string }

const EVENTS_V1: EvtMeta[] = DEMO_EVENTS_V1.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.event[id] }));
const EVENTS_V2: EvtMeta[] = DEMO_EVENTS_V2.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.event[id] }));

// ── Helpers ──────────────────────────────────────────────────────────────

function rolesFor(v: Ver) { return v === "v1" ? ROLES_V1 : ROLES_V2; }
function eventsFor(v: Ver) { return v === "v1" ? EVENTS_V1 : EVENTS_V2; }
const rc = demoRoleStride;
const evtStride = demoEvtStride;
const calcPermAddr = demoCalcPermAddr;
const calcEvtAddr = demoCalcEvtAddr;

// Backend services don't support mobile initiator
function svcSupportsInit(ps: PermSvcMeta, init: number): boolean {
  return !(ps.svcId === "shopping-backend" && init === 2);
}

// ── State ───────────────────────────────────────────────────────────────

interface AccessState {
  permSvc: number | null;  // null = wildcard
  roleIdx1: number;
  initiator: number;       // 1=web, 2=mobile
}

// ── Render ───────────────────────────────────────────────────────────────

export function renderAccessPage(container: HTMLElement, ver: Ver): void {
  container.innerHTML = "";

  const st: AccessState = {
    permSvc: 7,     // payment/shop
    roleIdx1: 1,    // admin
    initiator: 1,   // web
  };

  const wrap = document.createElement("div");
  wrap.className = "acc-wrap";

  const columns = document.createElement("div");
  columns.className = "acc-columns";

  // ── Controls (visually RIGHT, uses acc-left for flex:1) ────────────
  const ctrlPanel = document.createElement("div");
  ctrlPanel.className = "acc-left";

  const header = document.createElement("div");
  header.className = "acc-header";
  header.innerHTML = `
    <h2 class="acc-title">접근 제어 시뮬레이터</h2>
    <p class="acc-desc">
      서비스를 1차원으로 압축한 <strong>perm_svc</strong>에
      <strong>역할</strong>과 <strong>이벤트</strong>를 매핑하여
      권한·이벤트 주소를 생성합니다.
    </p>
  `;
  ctrlPanel.appendChild(header);

  // perm_svc selector
  const svcCtrl = document.createElement("div");
  svcCtrl.className = "acc-controls";
  ctrlPanel.appendChild(svcCtrl);

  // Role selector
  const roleBar = document.createElement("div");
  roleBar.className = "acc-role-bar";
  roleBar.innerHTML = `<div class="acc-role-label">역할 (role)</div>`;
  const roleBtns = document.createElement("div");
  roleBtns.className = "acc-role-btns";
  roleBar.appendChild(roleBtns);
  ctrlPanel.appendChild(roleBar);

  // Initiator toggle
  const initBar = document.createElement("div");
  initBar.className = "acc-role-bar";
  initBar.innerHTML = `<div class="acc-role-label">발원 (initiator)</div>`;
  const initBtns = document.createElement("div");
  initBtns.className = "acc-role-btns";
  initBar.appendChild(initBtns);
  ctrlPanel.appendChild(initBar);

  // Summary
  const summaryEl = document.createElement("div");
  summaryEl.className = "acc-summary";
  ctrlPanel.appendChild(summaryEl);

  // Insight
  const insightEl = document.createElement("div");
  insightEl.className = "acc-insight";
  ctrlPanel.appendChild(insightEl);

  // ── Grids (visually LEFT, uses acc-right for fixed size) ───────────
  const gridPanel = document.createElement("div");
  gridPanel.className = "acc-right";

  const permSection = document.createElement("div");
  permSection.className = "acc-tbl-section";
  gridPanel.appendChild(permSection);

  const evtSection = document.createElement("div");
  evtSection.className = "acc-tbl-section";
  gridPanel.appendChild(evtSection);

  // Cell detail panel (shown on click)
  const detailPanel = document.createElement("div");
  detailPanel.className = "acc-cell-detail";
  gridPanel.appendChild(detailPanel);

  columns.appendChild(gridPanel);
  columns.appendChild(ctrlPanel);

  wrap.appendChild(columns);
  container.appendChild(wrap);

  // ── Repaint ────────────────────────────────────────────────────────
  function repaint(): void {
    const curRoles = rolesFor(ver);
    const curEvents = eventsFor(ver);
    const curRole = curRoles.find(r => r.idx1 === st.roleIdx1)!;
    const totalPermCells = PERM_SVCS.length * rc(ver);
    const totalEvtCells = PERM_SVCS.length * curEvents.length;

    const selectedSvcs = st.permSvc !== null
      ? [st.permSvc]
      : PERM_SVCS.map(ps => ps.pos);

    // Highlighted addresses
    const permHits = new Set<number>();
    const evtHits = new Set<number>();
    for (const svc of selectedSvcs) {
      permHits.add(calcPermAddr(svc, st.roleIdx1, ver));
      const ps = PERM_SVCS[svc - 1];
      if (svcSupportsInit(ps, st.initiator)) {
        for (const evt of curEvents) {
          evtHits.add(calcEvtAddr(svc, evt.idx1, st.initiator, ver));
        }
      }
    }

    // ── perm_svc selector ──
    svcCtrl.innerHTML = "";
    const svcLabel = document.createElement("div");
    svcLabel.className = "acc-dim-label";
    svcLabel.innerHTML = `
      <span class="acc-dim-key">perm_svc</span>
      <span class="acc-dim-info">서비스(${SVC_NAMES.length}) × 네임스페이스(${NS.length}) → ${PERM_SVCS.length}개</span>
    `;
    svcCtrl.appendChild(svcLabel);

    const svcBtns = document.createElement("div");
    svcBtns.className = "acc-dim-btns";

    const wBtn = document.createElement("button");
    wBtn.className = "acc-btn acc-btn-wild" + (st.permSvc === null ? " acc-btn-active-wild" : "");
    wBtn.textContent = "*";
    wBtn.addEventListener("click", () => { st.permSvc = null; repaint(); });
    svcBtns.appendChild(wBtn);

    for (const ps of PERM_SVCS) {
      const btn = document.createElement("button");
      btn.className = "acc-btn" + (st.permSvc === ps.pos ? " acc-btn-active" : "");
      btn.innerHTML = `<span class="acc-btn-id">${ps.pos}</span><span class="acc-btn-ko">${ps.svcKo}/${ps.nsKo}</span>`;
      btn.title = `${ps.svcId} / ${ps.nsId}`;
      btn.addEventListener("click", () => { st.permSvc = ps.pos; repaint(); });
      svcBtns.appendChild(btn);
    }
    svcCtrl.appendChild(svcBtns);

    // ── Role buttons ──
    roleBtns.innerHTML = "";
    for (const role of curRoles) {
      const btn = document.createElement("button");
      btn.className = `acc-role-btn role-tag-${role.id}${role.idx1 === st.roleIdx1 ? " acc-role-btn-active" : ""}`;
      btn.textContent = role.ko;
      btn.addEventListener("click", () => { st.roleIdx1 = role.idx1; repaint(); });
      roleBtns.appendChild(btn);
    }

    // ── Initiator buttons ──
    initBtns.innerHTML = "";
    for (const [init, label, ko] of [[1, "web", "웹"], [2, "mobile", "모바일"]] as [number, string, string][]) {
      const btn = document.createElement("button");
      btn.className = `acc-role-btn${st.initiator === init ? " acc-role-btn-active" : ""}`;
      btn.textContent = `${label} · ${ko}`;
      btn.addEventListener("click", () => { st.initiator = init; repaint(); });
      initBtns.appendChild(btn);
    }

    // ── Permission table ──
    const permTitleHtml = `
      <div class="acc-grid-title">
        <span class="acc-grid-title-text">권한 주소 (permission:${ver})</span>
        <span class="acc-grid-title-count">
          <span class="acc-count-hit">${permHits.size}</span> / ${totalPermCells}
        </span>
      </div>
    `;

    let permHead = `<tr><th class="acc-tbl-corner">svc \\ role</th>`;
    for (const role of curRoles) {
      const isActive = role.idx1 === st.roleIdx1;
      permHead += `<th class="acc-tbl-ch${isActive ? " acc-tbl-ch-active" : ""}">${role.ko}</th>`;
    }
    permHead += `</tr>`;

    let permBody = "";
    for (const ps of PERM_SVCS) {
      const isRow = selectedSvcs.includes(ps.pos);
      permBody += `<tr class="${isRow ? "acc-tbl-row-active" : ""}">`;
      permBody += `<th class="acc-tbl-rh" title="${ps.svcId}/${ps.nsId}">${ps.svcKo}<br/><span class="acc-tbl-rh-sub">${ps.nsKo}</span></th>`;
      for (const role of curRoles) {
        const addr = calcPermAddr(ps.pos, role.idx1, ver);
        const isHit = permHits.has(addr);
        permBody += `<td class="acc-tbl-td${isHit ? " acc-tbl-td-hit" : ""}" data-type="permission" data-addr="${addr}" data-svc="${ps.pos}" data-role="${role.idx1}"><span class="acc-td-val">${addr}</span><span class="acc-td-addr">${fmtAddr("permission", ver, addr)}</span></td>`;
      }
      permBody += `</tr>`;
    }

    permSection.innerHTML = permTitleHtml;
    const permTbl = document.createElement("table");
    permTbl.className = "acc-tbl";
    permTbl.innerHTML = `<thead>${permHead}</thead><tbody>${permBody}</tbody>`;
    permSection.appendChild(permTbl);

    // ── Event table ──
    const initLabel = st.initiator === 1 ? "web" : "mobile";
    const evtTitleHtml = `
      <div class="acc-grid-title">
        <span class="acc-grid-title-text">이벤트 주소 (event:${ver}) · ${initLabel}</span>
        <span class="acc-grid-title-count">
          <span class="acc-count-hit">${evtHits.size}</span> / ${totalEvtCells}
        </span>
      </div>
    `;

    let evtHead = `<tr><th class="acc-tbl-corner">svc \\ event</th>`;
    for (const evt of curEvents) {
      evtHead += `<th class="acc-tbl-ch">${evt.ko}</th>`;
    }
    evtHead += `</tr>`;

    let evtBody = "";
    for (const ps of PERM_SVCS) {
      const isRow = selectedSvcs.includes(ps.pos);
      const supported = svcSupportsInit(ps, st.initiator);
      evtBody += `<tr class="${isRow ? "acc-tbl-row-active" : ""}">`;
      evtBody += `<th class="acc-tbl-rh" title="${ps.svcId}/${ps.nsId}">${ps.svcKo}<br/><span class="acc-tbl-rh-sub">${ps.nsKo}</span></th>`;
      for (const evt of curEvents) {
        if (!supported) {
          evtBody += `<td class="acc-tbl-td acc-tbl-td-disabled">—</td>`;
        } else {
          const addr = calcEvtAddr(ps.pos, evt.idx1, st.initiator, ver);
          const isHit = evtHits.has(addr);
          evtBody += `<td class="acc-tbl-td${isHit ? " acc-tbl-td-hit" : ""}" data-type="event" data-addr="${addr}" data-svc="${ps.pos}" data-evt="${evt.idx1}" data-init="${st.initiator}"><span class="acc-td-val">${addr}</span><span class="acc-td-addr">${fmtAddr("event", ver, addr)}</span></td>`;
        }
      }
      evtBody += `</tr>`;
    }

    evtSection.innerHTML = evtTitleHtml;
    const evtTbl = document.createElement("table");
    evtTbl.className = "acc-tbl";
    evtTbl.innerHTML = `<thead>${evtHead}</thead><tbody>${evtBody}</tbody>`;
    evtSection.appendChild(evtTbl);

    // ── Summary ──
    const svcDisplay = st.permSvc !== null
      ? PERM_SVCS[st.permSvc - 1].svcKo + "/" + PERM_SVCS[st.permSvc - 1].nsKo
      : "* (전체)";
    const permAddrStr = st.permSvc !== null
      ? `permission:${ver}:${calcPermAddr(st.permSvc, st.roleIdx1, ver)}`
      : `${permHits.size}개`;

    summaryEl.innerHTML = `
      <div class="acc-summary-rule">
        <span class="acc-summary-label">perm_svc</span>
        <code class="acc-summary-scope">${svcDisplay}</code>
        <span class="acc-summary-plus">×</span>
        <span class="acc-summary-role role-tag-${curRole.id}">${curRole.ko}</span>
        <span class="acc-summary-plus">→</span>
        <code class="acc-summary-scope">${permAddrStr}</code>
      </div>
      <div class="acc-summary-result">
        <span class="acc-summary-num">${permHits.size}</span> 권한 주소
        <span class="acc-summary-sep">·</span>
        <span class="acc-summary-num">${evtHits.size}</span> 이벤트 주소
      </div>
    `;

    // ── Insight ──
    const totalEvtFull = PERM_SVCS.length * curEvents.length * 2;
    insightEl.innerHTML = `
      <div class="acc-insight-inner">
        <span class="acc-insight-mark">i</span>
        <span class="acc-insight-text">
          <strong>perm_svc</strong>는 서비스(${SVC_NAMES.length})×네임스페이스(${NS.length})를 1차원(${PERM_SVCS.length})으로 압축한 축입니다.
          이 축 위에 역할을 곱하면 권한 주소(<strong>${totalPermCells}</strong>개),
          이벤트×발원을 곱하면 이벤트 주소(<strong>${totalEvtFull}</strong>개)가 됩니다.
        </span>
      </div>
    `;
    insightEl.style.display = "";

    // ── Cell click → detail panel ──
    gridPanel.querySelectorAll<HTMLTableCellElement>(".acc-tbl-td[data-type]").forEach(td => {
      td.style.cursor = "pointer";
      td.addEventListener("click", () => {
        // Remove previous selection
        gridPanel.querySelectorAll(".acc-tbl-td-selected").forEach(el =>
          el.classList.remove("acc-tbl-td-selected")
        );
        td.classList.add("acc-tbl-td-selected");

        const type = td.dataset.type!;
        const addr = Number(td.dataset.addr);
        const svcPos = Number(td.dataset.svc);
        const ps = PERM_SVCS[svcPos - 1];

        if (type === "permission") {
          const roleIdx1 = Number(td.dataset.role);
          const role = curRoles.find(r => r.idx1 === roleIdx1)!;
          const isHit = permHits.has(addr);
          detailPanel.innerHTML = `
            <div class="acc-detail-head">
              <code class="acc-detail-addr${isHit ? " acc-detail-addr-hit" : ""}">${fmtAddr("permission", ver, addr)}</code>
            </div>
            <div class="acc-detail-body">
              <div class="acc-detail-row">
                <span class="acc-detail-key">주소</span>
                <span class="acc-detail-val">${addr}</span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">perm_svc</span>
                <span class="acc-detail-val">${ps.svcKo} / ${ps.nsKo} <code>${ps.svcId}/${ps.nsId}</code> (#${svcPos})</span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">역할</span>
                <span class="acc-detail-val"><span class="role-tag role-tag-${role.id}">${role.ko}</span> <code>${role.id}</code></span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">산식</span>
                <span class="acc-detail-val"><code>(${svcPos} − 1) × ${rc(ver)} + (${roleIdx1} − 1) = ${addr}</code></span>
              </div>
            </div>
          `;
        } else {
          const evtIdx1 = Number(td.dataset.evt);
          const initIdx = Number(td.dataset.init);
          const evt = curEvents.find(e => e.idx1 === evtIdx1)!;
          const initLabel = initIdx === 1 ? "web" : "mobile";
          const isHit = evtHits.has(addr);
          detailPanel.innerHTML = `
            <div class="acc-detail-head">
              <code class="acc-detail-addr${isHit ? " acc-detail-addr-hit" : ""}">${fmtAddr("event", ver, addr)}</code>
            </div>
            <div class="acc-detail-body">
              <div class="acc-detail-row">
                <span class="acc-detail-key">주소</span>
                <span class="acc-detail-val">${addr}</span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">perm_svc</span>
                <span class="acc-detail-val">${ps.svcKo} / ${ps.nsKo} <code>${ps.svcId}/${ps.nsId}</code> (#${svcPos})</span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">이벤트</span>
                <span class="acc-detail-val">${evt.ko} <code>${evt.id}</code></span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">발원</span>
                <span class="acc-detail-val">${initLabel}</span>
              </div>
              <div class="acc-detail-row">
                <span class="acc-detail-key">산식</span>
                <span class="acc-detail-val"><code>(${svcPos} − 1) × ${evtStride(ver)} + (${evtIdx1} − 1) × 2 + (${initIdx} − 1) = ${addr}</code></span>
              </div>
            </div>
          `;
        }
        detailPanel.style.display = "block";
      });
    });
  }

  repaint();
}
