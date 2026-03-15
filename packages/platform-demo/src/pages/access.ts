// ═══════════════════════════════════════════════════════════════════════════
//  권한 범위 부여 — 서비스 범위에 역할을 부여하는 1:N 시뮬레이션
// ═══════════════════════════════════════════════════════════════════════════

type Ver = "v1" | "v2";

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
    key: "env", label: "환경", size: 5, stride: 20,
    values: [
      { idx1: 1, id: "dev",   ko: "개발" },
      { idx1: 2, id: "stage", ko: "스테이지" },
      { idx1: 3, id: "prod",  ko: "운영" },
      { idx1: 4, id: "test",  ko: "테스트" },
      { idx1: 5, id: "local", ko: "로컬" },
    ],
  },
  {
    key: "region", label: "리전", size: 2, stride: 10,
    values: [
      { idx1: 1, id: "asia", ko: "아시아" },
      { idx1: 2, id: "usa",  ko: "미국" },
    ],
  },
  {
    key: "svc_name", label: "서비스", size: 5, stride: 2,
    values: [
      { idx1: 1, id: "shopping-web",     ko: "쇼핑 웹" },
      { idx1: 2, id: "shopping-backend", ko: "쇼핑 백엔드" },
      { idx1: 3, id: "auth",             ko: "인증" },
      { idx1: 4, id: "payment",          ko: "결제" },
      { idx1: 5, id: "gateway",          ko: "게이트웨이" },
    ],
  },
  {
    key: "namespace", label: "네임스페이스", size: 2, stride: 1,
    values: [
      { idx1: 1, id: "shop", ko: "쇼핑몰" },
      { idx1: 2, id: "cms",  ko: "CMS" },
    ],
  },
];

const TOTAL_SLOTS = 100;

// ── Role metadata ─────────────────────────────────────────────────────────

interface RoleMeta { idx1: number; id: string; ko: string }

const ROLES_V1: RoleMeta[] = [
  { idx1: 1, id: "admin",     ko: "관리자" },
  { idx1: 2, id: "developer", ko: "개발자" },
  { idx1: 3, id: "operator",  ko: "운영자" },
  { idx1: 4, id: "viewer",    ko: "뷰어" },
  { idx1: 5, id: "readonly",  ko: "읽기전용" },
];

const ROLES_V2: RoleMeta[] = [
  { idx1: 1, id: "admin",     ko: "관리자" },
  { idx1: 2, id: "developer", ko: "개발자" },
  { idx1: 3, id: "operator",  ko: "운영자" },
  { idx1: 4, id: "customer",  ko: "고객" },
  { idx1: 5, id: "viewer",    ko: "뷰어" },
  { idx1: 6, id: "readonly",  ko: "읽기전용" },
];

function rolesForVer(ver: Ver): RoleMeta[] {
  return ver === "v1" ? ROLES_V1 : ROLES_V2;
}

function roleCountForVer(ver: Ver): number {
  return ver === "v1" ? 5 : 6;
}

// ── Permission address derivation ─────────────────────────────────────────
// perm_svc = (svc_name_idx1 - 1) × 2 + (ns_idx1 - 1) + 1   (1..10)
// permAddr = (perm_svc - 1) × roleCount + (role_idx1 - 1)

function derivPermSvc(svcNameIdx1: number, nsIdx1: number): number {
  return (svcNameIdx1 - 1) * 2 + (nsIdx1 - 1) + 1;
}

function derivPermAddr(permSvc: number, roleIdx1: number, rc: number): number {
  return (permSvc - 1) * rc + (roleIdx1 - 1);
}

// ── State ─────────────────────────────────────────────────────────────────

type DimSelection = number | null;

interface AccessState {
  selections: DimSelection[];
  roleIdx1: number;
}

// ── Compute matching service addresses ────────────────────────────────────

function computeRange(selections: DimSelection[]): number[] {
  let partials = [0];
  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const sel = selections[d];
    const next: number[] = [];
    if (sel !== null) {
      const offset = (sel - 1) * dim.stride;
      for (const p of partials) next.push(p + offset);
    } else {
      for (const v of dim.values) {
        const offset = (v.idx1 - 1) * dim.stride;
        for (const p of partials) next.push(p + offset);
      }
    }
    partials = next;
  }
  return partials.sort((a, b) => a - b);
}

// ── Decode service address to coordinates ─────────────────────────────────

interface DecodedCoord { dimIdx1: number; id: string; ko: string }

function decodeValue(v: number): DecodedCoord[] {
  const result: DecodedCoord[] = [];
  let remainder = v;
  for (const dim of DIMS) {
    const idx0 = Math.floor(remainder / dim.stride);
    remainder = remainder % dim.stride;
    const entry = dim.values[idx0];
    result.push({ dimIdx1: idx0 + 1, id: entry?.id ?? "?", ko: entry?.ko ?? "?" });
  }
  return result;
}

// ── Compute permission grants ─────────────────────────────────────────────

interface PermGroup {
  permAddr:   number;
  permSvc:    number;
  svcName:    string;
  svcNameKo:  string;
  nsName:     string;
  nsNameKo:   string;
  roleId:     string;
  roleKo:     string;
  instances:  { addr: number; envId: string; envKo: string; regionId: string; regionKo: string }[];
}

function computeGrants(matched: number[], roleIdx1: number, ver: Ver): PermGroup[] {
  const rc = roleCountForVer(ver);
  const role = rolesForVer(ver).find(r => r.idx1 === roleIdx1)!;
  const groupMap = new Map<number, PermGroup>();

  for (const addr of matched) {
    const coords = decodeValue(addr);
    const svcNameIdx1 = coords[2].dimIdx1;
    const nsIdx1      = coords[3].dimIdx1;
    const permSvc  = derivPermSvc(svcNameIdx1, nsIdx1);
    const permAddr = derivPermAddr(permSvc, roleIdx1, rc);

    let group = groupMap.get(permAddr);
    if (!group) {
      group = {
        permAddr, permSvc,
        svcName: coords[2].id, svcNameKo: coords[2].ko,
        nsName:  coords[3].id, nsNameKo:  coords[3].ko,
        roleId:  role.id,      roleKo:    role.ko,
        instances: [],
      };
      groupMap.set(permAddr, group);
    }

    group.instances.push({
      addr,
      envId:    coords[0].id, envKo:    coords[0].ko,
      regionId: coords[1].id, regionKo: coords[1].ko,
    });
  }

  return Array.from(groupMap.values()).sort((a, b) => a.permAddr - b.permAddr);
}

// ── Render ────────────────────────────────────────────────────────────────

export function renderAccessPage(container: HTMLElement, ver: Ver): void {
  container.innerHTML = "";

  const st: AccessState = {
    selections: [3, null, 4, null], // prod / * / payment / *
    roleIdx1: 1,                    // admin
  };

  const wrap = document.createElement("div");
  wrap.className = "acc-wrap";

  // ── Top-level two-column layout ─────────────────────────────────────
  const columns = document.createElement("div");
  columns.className = "acc-columns";

  // ── LEFT: controls + grants ─────────────────────────────────────────
  const left = document.createElement("div");
  left.className = "acc-left";

  // Header
  const header = document.createElement("div");
  header.className = "acc-header";
  header.innerHTML = `
    <h2 class="acc-title">권한 범위 부여 시뮬레이터</h2>
    <p class="acc-desc">
      서비스 범위를 지정하고 역할을 선택하면,
      해당 범위의 <strong>모든 서비스 인스턴스</strong>에 권한이 부여됩니다.
    </p>
  `;
  left.appendChild(header);

  // Dimension controls
  const controls = document.createElement("div");
  controls.className = "acc-controls";
  const dimRows: HTMLElement[] = [];

  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const row = document.createElement("div");
    row.className = "acc-dim-row";

    const label = document.createElement("div");
    label.className = "acc-dim-label";
    label.innerHTML = `
      <span class="acc-dim-key">${dim.key}</span>
      <span class="acc-dim-info">${dim.label} · ${dim.size}개</span>
    `;
    row.appendChild(label);

    const btns = document.createElement("div");
    btns.className = "acc-dim-btns";

    const wBtn = document.createElement("button");
    wBtn.className = "acc-btn acc-btn-wild" + (st.selections[d] === null ? " acc-btn-active-wild" : "");
    wBtn.textContent = "*";
    wBtn.title = "와일드카드 — 이 차원의 모든 값";
    wBtn.addEventListener("click", () => { st.selections[d] = null; repaint(); });
    btns.appendChild(wBtn);

    for (const v of dim.values) {
      const btn = document.createElement("button");
      btn.className = "acc-btn" + (st.selections[d] === v.idx1 ? " acc-btn-active" : "");
      btn.innerHTML = `<span class="acc-btn-id">${v.id}</span><span class="acc-btn-ko">${v.ko}</span>`;
      btn.addEventListener("click", () => { st.selections[d] = v.idx1; repaint(); });
      btns.appendChild(btn);
    }

    row.appendChild(btns);
    controls.appendChild(row);
    dimRows.push(row);
  }

  left.appendChild(controls);

  // Role selector
  const roleBar = document.createElement("div");
  roleBar.className = "acc-role-bar";
  roleBar.innerHTML = `<div class="acc-role-label">부여할 역할</div>`;

  const roleBtns = document.createElement("div");
  roleBtns.className = "acc-role-btns";
  roleBar.appendChild(roleBtns);
  left.appendChild(roleBar);

  // Grant list
  const grantSection = document.createElement("div");
  grantSection.className = "acc-grant-section";
  left.appendChild(grantSection);

  columns.appendChild(left);

  // ── RIGHT: address space grid + summary + insight ───────────────────
  const right = document.createElement("div");
  right.className = "acc-right";

  const gridTitle = document.createElement("div");
  gridTitle.className = "acc-grid-title";
  right.appendChild(gridTitle);

  const grid = document.createElement("div");
  grid.className = "acc-grid";
  right.appendChild(grid);

  // Summary (below grid)
  const summaryEl = document.createElement("div");
  summaryEl.className = "acc-summary";
  right.appendChild(summaryEl);

  // Insight callout (below summary)
  const insight = document.createElement("div");
  insight.className = "acc-insight";
  right.appendChild(insight);

  columns.appendChild(right);

  wrap.appendChild(columns);
  container.appendChild(wrap);

  // ── Repaint ─────────────────────────────────────────────────────────
  function repaint(): void {
    const matched   = computeRange(st.selections);
    const matchedSet = new Set(matched);
    const grants    = computeGrants(matched, st.roleIdx1, ver);
    const roles     = rolesForVer(ver);
    const curRole   = roles.find(r => r.idx1 === st.roleIdx1)!;
    const totalInst = grants.reduce((s, g) => s + g.instances.length, 0);

    // Dim buttons
    for (let d = 0; d < DIMS.length; d++) {
      const row = dimRows[d];
      row.querySelectorAll<HTMLButtonElement>(".acc-btn").forEach((btn, bi) => {
        if (bi === 0) {
          btn.classList.toggle("acc-btn-active-wild", st.selections[d] === null);
        } else {
          btn.classList.toggle("acc-btn-active", st.selections[d] === DIMS[d].values[bi - 1].idx1);
        }
      });
    }

    // Role buttons
    roleBtns.innerHTML = "";
    for (const role of roles) {
      const btn = document.createElement("button");
      btn.className = `acc-role-btn role-tag-${role.id}${role.idx1 === st.roleIdx1 ? " acc-role-btn-active" : ""}`;
      btn.textContent = role.ko;
      btn.addEventListener("click", () => { st.roleIdx1 = role.idx1; repaint(); });
      roleBtns.appendChild(btn);
    }

    // Summary
    const scopeParts = st.selections.map((s, i) => {
      if (s !== null) {
        const v = DIMS[i].values[s - 1];
        return v ? v.id : String(s);
      }
      return "*";
    });

    summaryEl.innerHTML = `
      <div class="acc-summary-rule">
        <span class="acc-summary-label">규칙</span>
        <code class="acc-summary-scope">${scopeParts.join(" · ")}</code>
        <span class="acc-summary-plus">+</span>
        <span class="acc-summary-role role-tag-${curRole.id}">${curRole.ko}</span>
      </div>
      <div class="acc-summary-result">
        <span class="acc-summary-num">${totalInst}</span> 서비스 인스턴스
        <span class="acc-summary-sep">→</span>
        <span class="acc-summary-num">${grants.length}</span> 권한 부여
      </div>
    `;

    // Insight
    if (grants.length > 0 && totalInst > grants.length) {
      const ratio = Math.round(totalInst / grants.length);
      insight.innerHTML = `
        <div class="acc-insight-inner">
          <span class="acc-insight-mark">i</span>
          <span class="acc-insight-text">
            권한은 <strong>서비스 + 네임스페이스</strong> 단위로 부여되며, 환경·리전과 무관합니다.
            ${grants.length}개 권한이 ${totalInst}개 인스턴스를 커버합니다 (1:${ratio}).
          </span>
        </div>
      `;
      insight.style.display = "";
    } else if (grants.length > 0) {
      insight.innerHTML = `
        <div class="acc-insight-inner">
          <span class="acc-insight-mark">i</span>
          <span class="acc-insight-text">
            현재 선택은 1:1 매핑입니다.
            환경이나 리전을 와일드카드(*)로 설정하면 1:N 효과를 확인할 수 있습니다.
          </span>
        </div>
      `;
      insight.style.display = "";
    } else {
      insight.style.display = "none";
    }

    // Grid
    gridTitle.innerHTML = `
      <span class="acc-grid-title-text">서비스 주소 공간 0–99</span>
      <span class="acc-grid-title-count">
        <span class="acc-count-hit">${matched.length}</span> / ${TOTAL_SLOTS}
      </span>
    `;

    grid.innerHTML = "";
    for (let r = 0; r < 10; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "acc-grid-row";

      const rh = document.createElement("div");
      rh.className = "acc-grid-rh";
      rh.textContent = String(r * 10);
      rowEl.appendChild(rh);

      for (let c = 0; c < 10; c++) {
        const v = r * 10 + c;
        const cell = document.createElement("div");
        cell.className = "acc-cell" + (matchedSet.has(v) ? " acc-cell-hit" : "");
        cell.textContent = String(v);
        rowEl.appendChild(cell);
      }
      grid.appendChild(rowEl);
    }

    // Grant cards
    if (grants.length === 0) {
      grantSection.innerHTML = `
        <div class="acc-grant-empty">
          서비스 범위와 역할을 선택하면<br/>권한 부여 결과가 여기에 표시됩니다.
        </div>`;
      return;
    }

    let html = `
      <div class="acc-grant-list-head">
        <span class="acc-grant-list-title">권한 부여 목록</span>
        <span class="acc-grant-list-count">${grants.length}개 권한 · ${totalInst}개 인스턴스</span>
      </div>`;

    for (const g of grants) {
      const chips = g.instances.map(inst =>
        `<span class="acc-inst-chip" title="${inst.envKo} · ${inst.regionKo}">
          <span class="acc-inst-addr">${inst.addr}</span>
          <span class="acc-inst-env">${inst.envId}/${inst.regionId}</span>
        </span>`
      ).join("");

      html += `
        <div class="acc-grant-card">
          <div class="acc-grant-card-head">
            <span class="acc-perm-badge">permission:${ver}:${g.permAddr}</span>
            <span class="acc-grant-inst-count">→ ${g.instances.length}개 인스턴스</span>
          </div>
          <div class="acc-grant-card-body">
            <div class="acc-grant-row">
              <span class="acc-grant-key">서비스</span>
              <span class="acc-grant-val">${g.svcNameKo} <code>${g.svcName}</code></span>
            </div>
            <div class="acc-grant-row">
              <span class="acc-grant-key">네임스페이스</span>
              <span class="acc-grant-val">${g.nsNameKo} <code>${g.nsName}</code></span>
            </div>
            <div class="acc-grant-row">
              <span class="acc-grant-key">역할</span>
              <span class="acc-grant-val"><span class="role-tag role-tag-${g.roleId}">${g.roleKo}</span></span>
            </div>
            <div class="acc-grant-instances">
              <span class="acc-grant-key">커버하는 서비스 주소</span>
              <div class="acc-inst-chips">${chips}</div>
            </div>
          </div>
        </div>`;
    }

    grantSection.innerHTML = html;
  }

  repaint();
}
