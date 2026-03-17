// ═══════════════════════════════════════════════════════════════════════════
//  Permission Engine — v1 / v2 마이그레이션 비교
// ═══════════════════════════════════════════════════════════════════════════
//
// permission-engine 패키지의 PermissionSet / migratePermissions를 사용하여
// v1→v2 마이그레이션 과정과 비트마스크 기반 권한 관리를 시각화합니다.
//

import {
  PermissionSet,
  ScopedEngine,
  migratePermissions,
  type DimDef,
} from "permission-engine";
import {
  DEMO_ROLES_V1, DEMO_ROLES_V2,
  DEMO_KO,
} from "demo-snapshot";

// ── Dimension definitions (SSOT 기반) ────────────────────────────────────────

const FEATURES_V1: DimDef = {
  name: "features",
  ids: ["product_list", "order_list", "payment_history", "payment_cancel", "user_mgmt", "config_change"],
};

const FEATURES_V2: DimDef = {
  name: "features",
  ids: ["product_list", "order_list", "payment_history", "payment_cancel_req", "payment_cancel_approve", "user_mgmt", "config_change"],
};

const ROLES_V1: DimDef = { name: "roles", ids: [...DEMO_ROLES_V1] };
const ROLES_V2: DimDef = { name: "roles", ids: [...DEMO_ROLES_V2] };

const FEATURE_KO: Record<string, string> = {
  product_list: "상품 목록", order_list: "주문 목록",
  payment_history: "결제 내역", payment_cancel: "결제 취소",
  payment_cancel_req: "취소 요청", payment_cancel_approve: "취소 승인",
  user_mgmt: "사용자 관리", config_change: "설정 변경",
};

// ── Default v1 grants (데모 초기 상태) ───────────────────────────────────────

function createDefaultV1(): PermissionSet {
  const ps = new PermissionSet({ features: FEATURES_V1, roles: ROLES_V1 });
  ps.grantRoles("product_list", ["admin", "developer", "operator", "viewer", "readonly"]);
  ps.grantRoles("order_list", ["admin", "developer", "operator", "viewer"]);
  ps.grantRoles("payment_history", ["admin", "developer", "operator"]);
  ps.grantRoles("payment_cancel", ["admin", "developer", "operator"]);
  ps.grantRoles("user_mgmt", ["admin"]);
  ps.grantRoles("config_change", ["admin"]);
  return ps;
}

// ── Migration with custom mapper ─────────────────────────────────────────────

function migrateV1toV2(source: PermissionSet): PermissionSet {
  return migratePermissions(source, FEATURES_V2, ROLES_V2, (fi, ri) => {
    const featId = FEATURES_V1.ids[fi - 1];
    const roleId = ROLES_V1.ids[ri - 1];

    if (featId === "payment_cancel") {
      // payment_cancel → payment_cancel_req에 이관 (approve는 별도 배정)
      const newRi = ROLES_V2.ids.indexOf(roleId);
      if (newRi === -1) return null;
      return [FEATURES_V2.ids.indexOf("payment_cancel_req") + 1, newRi + 1];
    }

    const newFi = FEATURES_V2.ids.indexOf(featId);
    const newRi = ROLES_V2.ids.indexOf(roleId);
    if (newFi === -1 || newRi === -1) return null;
    return [newFi + 1, newRi + 1];
  });
}

// ── Matrix rendering ────────────────────────────────────────────────────────

function renderMatrix(
  ps: PermissionSet,
  opts: {
    editable: boolean;
    diffBase?: PermissionSet | null;
    onChange?: () => void;
  },
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pe-matrix-wrap";

  const features = ps.features;
  const roles = ps.roles;

  // v1 grants 비교용
  const baseGrants = new Map<string, Set<string>>();
  if (opts.diffBase) {
    for (const f of opts.diffBase.features) {
      baseGrants.set(f, new Set(opts.diffBase.rolesFor(f)));
    }
  }

  const tbl = document.createElement("table");
  tbl.className = "pe-matrix";

  // thead
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = `<th class="pe-corner">기능 \\ 역할</th>`;
  for (const role of roles) {
    const isNew = opts.diffBase && !opts.diffBase.roles.includes(role);
    headRow.innerHTML += `<th class="pe-col-head${isNew ? " pe-new" : ""}">
      <span class="role-tag role-tag-${role}">${role}</span>
      <div class="pe-ko">${DEMO_KO.role[role] ?? role}</div>
      ${isNew ? '<span class="pe-badge-new">NEW</span>' : ""}
    </th>`;
  }
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  // tbody
  const tbody = document.createElement("tbody");
  for (const feat of features) {
    const isNewFeat = opts.diffBase && !opts.diffBase.features.includes(feat);
    const tr = document.createElement("tr");
    if (isNewFeat) tr.className = "pe-row-new";

    tr.innerHTML = `<th class="pe-row-head${isNewFeat ? " pe-new" : ""}">
      <span class="pe-feat-id">${feat}</span>
      <span class="pe-feat-ko">${FEATURE_KO[feat] ?? feat}</span>
      ${isNewFeat ? '<span class="pe-badge-new">NEW</span>' : ""}
    </th>`;

    for (const role of roles) {
      const has = ps.has(feat, role);
      const baseSet = baseGrants.get(feat);
      const hadInBase = baseSet?.has(role) ?? false;
      const isNewRole = opts.diffBase && !opts.diffBase.roles.includes(role);

      let cls = "pe-cell";
      if (has) cls += " pe-granted";
      else cls += " pe-denied";

      // diff highlighting
      if (opts.diffBase) {
        if (isNewFeat || isNewRole) {
          cls += has ? " pe-cell-new" : "";
        } else if (has && !hadInBase) {
          cls += " pe-cell-gained";
        } else if (!has && hadInBase) {
          cls += " pe-cell-lost";
        }
      }

      const td = document.createElement("td");
      td.className = cls;
      td.textContent = has ? "✓" : "✗";
      td.title = `${feat} × ${role}`;

      if (opts.editable) {
        td.style.cursor = "pointer";
        td.addEventListener("click", () => {
          if (ps.has(feat, role)) ps.revoke(feat, role);
          else ps.grant(feat, role);
          opts.onChange?.();
        });
      }

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // removed features row
  if (opts.diffBase) {
    for (const f of opts.diffBase.features) {
      if (!features.includes(f)) {
        const tr = document.createElement("tr");
        tr.className = "pe-row-removed";
        tr.innerHTML = `<th class="pe-row-head pe-removed">
          <span class="pe-feat-id" style="text-decoration:line-through">${f}</span>
          <span class="pe-feat-ko">${FEATURE_KO[f] ?? f}</span>
          <span class="pe-badge-removed">제거됨</span>
        </th>`;
        for (const _role of roles) {
          tr.innerHTML += `<td class="pe-cell pe-denied pe-cell-lost">—</td>`;
        }
        tbody.appendChild(tr);
      }
    }
  }

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

// ── Stats panel ─────────────────────────────────────────────────────────────

function renderStats(ps: PermissionSet, label: string): HTMLElement {
  const snap = ps.toSnapshot();
  const byteSize = ps.toBytes().length;

  const el = document.createElement("div");
  el.className = "pe-stats";
  el.innerHTML = `
    <div class="pe-stats-title">${label}</div>
    <div class="pe-stats-grid">
      <div class="pe-stat">
        <span class="pe-stat-val">${ps.size}</span>
        <span class="pe-stat-label">전체 슬롯</span>
      </div>
      <div class="pe-stat">
        <span class="pe-stat-val">${ps.grantCount}</span>
        <span class="pe-stat-label">부여됨</span>
      </div>
      <div class="pe-stat">
        <span class="pe-stat-val">${(ps.grantCount / ps.size * 100).toFixed(1)}%</span>
        <span class="pe-stat-label">밀도</span>
      </div>
      <div class="pe-stat">
        <span class="pe-stat-val">${byteSize}B</span>
        <span class="pe-stat-label">마스크 크기</span>
      </div>
    </div>
    <div class="pe-serial">
      <div class="pe-serial-label">Base64 마스크</div>
      <code class="pe-serial-val">${snap.mask}</code>
    </div>
  `;
  return el;
}

// ── Scoped Engine section ────────────────────────────────────────────────────

function renderScopedSection(container: HTMLElement): void {
  const engine = new ScopedEngine(FEATURES_V2, ROLES_V2);

  // prod:asia — 전체 v2 기본 부여
  const prod = engine.scope("prod:asia");
  prod.grantRoles("product_list", ["admin", "developer", "operator", "viewer", "readonly", "customer"]);
  prod.grantRoles("order_list", ["admin", "developer", "operator", "viewer"]);
  prod.grantRoles("payment_history", ["admin", "developer", "operator"]);
  prod.grantRoles("payment_cancel_req", ["admin", "customer"]);
  prod.grantRoles("payment_cancel_approve", ["admin", "operator"]);
  prod.grantRoles("user_mgmt", ["admin"]);
  prod.grantRoles("config_change", ["admin"]);

  // dev:asia — 개발자에게 넓은 권한
  const dev = engine.scope("dev:asia");
  dev.grantAll();

  const uni = engine.unionScopes(["prod:asia", "dev:asia"]);
  const inter = engine.intersectScopes(["prod:asia", "dev:asia"]);

  container.innerHTML = `
    <div class="pe-section">
      <div class="pe-sec-header">
        <span class="pe-sec-icon">⊕</span>
        <span class="pe-sec-title">ScopedEngine — 스코프별 독립 권한</span>
      </div>
      <div class="pe-scope-desc">
        환경(env)·리전(region) 같은 외부 차원을 키로 사용하여 스코프별 독립 PermissionSet을 관리합니다.
      </div>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "pe-scope-grid";

  // prod:asia panel
  const prodPanel = document.createElement("div");
  prodPanel.className = "pe-scope-panel";
  prodPanel.innerHTML = `<div class="pe-scope-key"><code>prod:asia</code> <span class="pe-scope-tag">운영</span></div>`;
  prodPanel.appendChild(renderStats(prod, "prod:asia"));

  // dev:asia panel
  const devPanel = document.createElement("div");
  devPanel.className = "pe-scope-panel";
  devPanel.innerHTML = `<div class="pe-scope-key"><code>dev:asia</code> <span class="pe-scope-tag pe-scope-tag-dev">개발</span></div>`;
  devPanel.appendChild(renderStats(dev, "dev:asia"));

  grid.appendChild(prodPanel);
  grid.appendChild(devPanel);
  container.appendChild(grid);

  // Union / Intersect
  const algebraEl = document.createElement("div");
  algebraEl.className = "pe-algebra";
  algebraEl.innerHTML = `
    <div class="pe-algebra-row">
      <div class="pe-algebra-card">
        <div class="pe-algebra-title">합집합 (union) — "어느 환경에서든 접근 가능?"</div>
        <div class="pe-algebra-stat">부여: <strong>${uni.grantCount}</strong> / ${uni.size}</div>
      </div>
      <div class="pe-algebra-card">
        <div class="pe-algebra-title">교집합 (intersect) — "모든 환경에서 접근 가능?"</div>
        <div class="pe-algebra-stat">부여: <strong>${inter.grantCount}</strong> / ${inter.size}</div>
      </div>
    </div>
  `;
  container.appendChild(algebraEl);

  // Snapshot
  const snapEl = document.createElement("div");
  snapEl.className = "pe-snapshot-section";
  const snap = engine.toSnapshot();
  snapEl.innerHTML = `
    <div class="pe-serial">
      <div class="pe-serial-label">ScopedEngine Snapshot (${Object.keys(snap.scopes).length}개 스코프)</div>
      <pre class="pe-serial-json">${JSON.stringify(snap, null, 2)}</pre>
    </div>
  `;
  container.appendChild(snapEl);
}

// ── Main render ──────────────────────────────────────────────────────────────

export function renderPermEnginePage(container: HTMLElement): void {
  container.innerHTML = "";

  let v1 = createDefaultV1();
  let v2 = migrateV1toV2(v1);

  const wrap = document.createElement("div");
  wrap.className = "pe-wrap";

  // ── Header ──
  const header = document.createElement("div");
  header.className = "pe-header";
  header.innerHTML = `
    <h2 class="pe-title">Permission Engine — 비트마스크 권한 비교</h2>
    <p class="pe-desc">
      <code>permission-engine</code> 패키지의 <code>PermissionSet</code>과
      <code>migratePermissions</code>를 사용하여 v1→v2 마이그레이션을 시각화합니다.
      v1 매트릭스의 셀을 클릭하여 권한을 변경하면 v2가 자동으로 재계산됩니다.
    </p>
  `;
  wrap.appendChild(header);

  // ── Migration comparison ──
  const comparison = document.createElement("div");
  comparison.className = "pe-comparison";

  const v1Panel = document.createElement("div");
  v1Panel.className = "pe-panel";

  const v2Panel = document.createElement("div");
  v2Panel.className = "pe-panel";

  const v1StatsEl = document.createElement("div");
  const v2StatsEl = document.createElement("div");

  function repaint(): void {
    v2 = migrateV1toV2(v1);

    v1Panel.innerHTML = "";
    v1Panel.innerHTML = `<div class="pe-panel-header"><span class="pe-ver-badge pe-ver-v1">v1</span> 원본 권한 (클릭하여 편집)</div>`;
    v1Panel.appendChild(renderMatrix(v1, {
      editable: true,
      onChange: repaint,
    }));
    v1StatsEl.innerHTML = "";
    v1StatsEl.appendChild(renderStats(v1, "v1 PermissionSet"));
    v1Panel.appendChild(v1StatsEl);

    v2Panel.innerHTML = "";
    v2Panel.innerHTML = `<div class="pe-panel-header"><span class="pe-ver-badge pe-ver-v2">v2</span> 마이그레이션 결과 (자동 계산)</div>`;
    v2Panel.appendChild(renderMatrix(v2, {
      editable: false,
      diffBase: v1,
    }));
    v2StatsEl.innerHTML = "";
    v2StatsEl.appendChild(renderStats(v2, "v2 PermissionSet"));
    v2Panel.appendChild(v2StatsEl);
  }

  comparison.appendChild(v1Panel);

  // Arrow
  const arrow = document.createElement("div");
  arrow.className = "pe-arrow";
  arrow.innerHTML = `<div class="pe-arrow-line">→</div><div class="pe-arrow-label">migrate</div>`;
  comparison.appendChild(arrow);

  comparison.appendChild(v2Panel);
  wrap.appendChild(comparison);

  // ── Migration explanation ──
  const explainer = document.createElement("div");
  explainer.className = "pe-section";
  explainer.innerHTML = `
    <div class="pe-sec-header">
      <span class="pe-sec-icon">⚙</span>
      <span class="pe-sec-title">마이그레이션 규칙</span>
    </div>
    <div class="pe-rules">
      <div class="pe-rule">
        <span class="pe-rule-icon">✓</span>
        <span>공통 feature/role의 기존 grant → <strong>자동 보존</strong></span>
      </div>
      <div class="pe-rule">
        <span class="pe-rule-icon">✓</span>
        <span><code>payment_cancel</code> → <code>payment_cancel_req</code>로 <strong>커스텀 매퍼</strong>로 이관</span>
      </div>
      <div class="pe-rule">
        <span class="pe-rule-icon">✓</span>
        <span>신규 역할 (<code>customer</code>) → 기본 <strong>deny</strong> (빈 비트)</span>
      </div>
      <div class="pe-rule">
        <span class="pe-rule-icon">✓</span>
        <span>삭제된 feature (<code>payment_cancel</code>) → 비트 <strong>제거</strong></span>
      </div>
      <div class="pe-rule">
        <span class="pe-rule-icon pe-rule-perf">⚡</span>
        <span>모든 grant/check 연산: <strong>O(1)</strong> 비트 연산</span>
      </div>
    </div>
  `;
  wrap.appendChild(explainer);

  // ── Scoped Engine ──
  const scopedContainer = document.createElement("div");
  wrap.appendChild(scopedContainer);

  container.appendChild(wrap);

  // Initial render
  repaint();
  renderScopedSection(scopedContainer);
}
