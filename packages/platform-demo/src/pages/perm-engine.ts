// ═══════════════════════════════════════════════════════════════════════════
//  Permission Engine — v1 / v2 마이그레이션 비교 (API 기반)
// ═══════════════════════════════════════════════════════════════════════════
//
// permission-engine 패키지의 PermissionSet / migratePermissions를 사용하여
// v1→v2 마이그레이션 과정과 비트마스크 기반 권한 관리를 시각화합니다.
// 데이터는 platform-demo-api에서 실시간으로 가져옵니다.
//

import {
  PermissionSet,
  ScopedEngine,
  migratePermissions,
  type DimDef,
} from "permission-engine";
import {
  fetchFeatures,
  resetGrants,
  type FeaturesResponse,
} from "../registry.js";
import {
  DEMO_KO,
  DEMO_FEATURE_KO,
} from "demo-snapshot";

// ── API 데이터 → PermissionSet 변환 ─────────────────────────────────────────

function buildDimDefs(data: FeaturesResponse): { features: DimDef; roles: DimDef } {
  return {
    features: { name: "features", ids: data.features.map(f => f.id) },
    roles: { name: "roles", ids: data.roles.map(r => r.id) },
  };
}

function buildPermissionSet(data: FeaturesResponse): PermissionSet {
  const { features, roles } = buildDimDefs(data);
  const ps = new PermissionSet({ features, roles });
  for (let fi = 0; fi < data.matrix.length; fi++) {
    for (let ri = 0; ri < data.matrix[fi].length; ri++) {
      if (data.matrix[fi][ri]) {
        ps.grant(data.features[fi].id, data.roles[ri].id);
      }
    }
  }
  return ps;
}

// ── Migration ────────────────────────────────────────────────────────────────

function migrateV1toV2(
  source: PermissionSet,
  v1Defs: { features: DimDef; roles: DimDef },
  v2Defs: { features: DimDef; roles: DimDef },
): PermissionSet {
  return migratePermissions(source, v2Defs.features, v2Defs.roles, (fi, ri) => {
    const featId = v1Defs.features.ids[fi - 1];
    const roleId = v1Defs.roles.ids[ri - 1];

    if (featId === "payment_cancel") {
      const newRi = v2Defs.roles.ids.indexOf(roleId);
      if (newRi === -1) return null;
      return [v2Defs.features.ids.indexOf("payment_cancel_req") + 1, newRi + 1];
    }

    const newFi = v2Defs.features.ids.indexOf(featId);
    const newRi = v2Defs.roles.ids.indexOf(roleId);
    if (newFi === -1 || newRi === -1) return null;
    return [newFi + 1, newRi + 1];
  });
}

// ── Matrix rendering ────────────────────────────────────────────────────────

function _appendFeatureRow(
  tbody: HTMLElement,
  ps: PermissionSet,
  feat: string,
  roles: readonly string[],
  isNewFeat: boolean,
  opts: { editable: boolean; diffBase?: PermissionSet | null; onChange?: () => void },
  baseGrants: Map<string, Set<string>>,
): void {
  const tr = document.createElement("tr");
  if (isNewFeat) tr.className = "pe-row-new";

  tr.innerHTML = `<th class="pe-row-head${isNewFeat ? " pe-new" : ""}">
    <span class="pe-feat-id">${feat}</span>
    <span class="pe-feat-ko">${DEMO_FEATURE_KO[feat] ?? feat}</span>
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

  const baseGrants = new Map<string, Set<string>>();
  if (opts.diffBase) {
    for (const f of opts.diffBase.features) {
      baseGrants.set(f, new Set(opts.diffBase.rolesFor(f)));
    }
  }

  const tbl = document.createElement("table");
  tbl.className = "pe-matrix";

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

  const tbody = document.createElement("tbody");

  // v1(diffBase) 순서를 기준으로 제거된 항목을 원래 위치에 표시.
  // 병합 순서: v1 features를 순회하며 v2에 있으면 정상 행, 없으면 "제거됨" 행.
  // 이후 v2에만 있는 NEW 항목을 append.
  const v2Set = new Set(features);
  const rendered = new Set<string>();

  // diffBase(v1) 순서대로 렌더 — 제거된 항목은 원래 위치에 표시
  const baseFeatures = opts.diffBase ? opts.diffBase.features : [];
  for (const f of baseFeatures) {
    if (v2Set.has(f)) {
      // v1에도 v2에도 있음 — 정상 행
      _appendFeatureRow(tbody, ps, f, roles, false, opts, baseGrants);
      rendered.add(f);
    } else {
      // v1에는 있지만 v2에서 제거됨 — 원래 위치에 "제거됨" 행
      const tr = document.createElement("tr");
      tr.className = "pe-row-removed";
      tr.innerHTML = `<th class="pe-row-head pe-removed">
        <span class="pe-feat-id" style="text-decoration:line-through">${f}</span>
        <span class="pe-feat-ko">${DEMO_FEATURE_KO[f] ?? f}</span>
        <span class="pe-badge-removed">제거됨</span>
      </th>`;
      for (const _role of roles) {
        tr.innerHTML += `<td class="pe-cell pe-denied pe-cell-lost">—</td>`;
      }
      tbody.appendChild(tr);
    }
  }

  // v2에만 있는 NEW 항목 (append-only: 기존 뒤에 추가)
  for (const feat of features) {
    if (!rendered.has(feat)) {
      _appendFeatureRow(tbody, ps, feat, roles, true, opts, baseGrants);
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

function renderScopedSection(
  container: HTMLElement,
  v2Data: FeaturesResponse,
): void {
  const { features, roles } = buildDimDefs(v2Data);
  const engine = new ScopedEngine(features, roles);

  // prod:asia — API에서 받은 v2 기본 grant 적용
  const prod = engine.scope("prod:asia");
  for (let fi = 0; fi < v2Data.matrix.length; fi++) {
    const grantedRoles = v2Data.roles
      .filter((_, ri) => v2Data.matrix[fi][ri])
      .map(r => r.id);
    if (grantedRoles.length > 0) {
      prod.grantRoles(v2Data.features[fi].id, grantedRoles);
    }
  }

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

  const prodPanel = document.createElement("div");
  prodPanel.className = "pe-scope-panel";
  prodPanel.innerHTML = `<div class="pe-scope-key"><code>prod:asia</code> <span class="pe-scope-tag">운영</span></div>`;
  prodPanel.appendChild(renderStats(prod, "prod:asia"));

  const devPanel = document.createElement("div");
  devPanel.className = "pe-scope-panel";
  devPanel.innerHTML = `<div class="pe-scope-key"><code>dev:asia</code> <span class="pe-scope-tag pe-scope-tag-dev">개발</span></div>`;
  devPanel.appendChild(renderStats(dev, "dev:asia"));

  grid.appendChild(prodPanel);
  grid.appendChild(devPanel);
  container.appendChild(grid);

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

type DemoVer = "v1" | "v2" | "v3" | "v4";
const ALL_VERS: DemoVer[] = ["v1", "v2", "v3", "v4"];
function prevVerOf(ver: DemoVer): DemoVer | null {
  const idx = ALL_VERS.indexOf(ver);
  return idx > 0 ? ALL_VERS[idx - 1] : null;
}

export async function renderPermEnginePage(container: HTMLElement, ver: DemoVer = "v2"): Promise<void> {
  container.innerHTML = `<div class="pe-loading">데이터 로딩 중...</div>`;

  const prev = prevVerOf(ver) ?? "v1";

  // API에서 prev, ver 데이터 동시 로드
  let prevData: FeaturesResponse;
  let curData: FeaturesResponse;
  try {
    [prevData, curData] = await Promise.all([
      fetchFeatures(prev),
      fetchFeatures(ver),
    ]);
  } catch (e) {
    container.innerHTML = `<div class="pe-error">API 연결 실패: ${e instanceof Error ? e.message : String(e)}</div>`;
    return;
  }

  container.innerHTML = "";

  let prevDefs = buildDimDefs(prevData);
  let curDefs = buildDimDefs(curData);

  let prevPS = buildPermissionSet(prevData);
  let curPS = migrateV1toV2(prevPS, prevDefs, curDefs);

  const wrap = document.createElement("div");
  wrap.className = "pe-wrap";

  // ── Header + 초기화 버튼 ──
  const header = document.createElement("div");
  header.className = "pe-header";
  header.innerHTML = `
    <h2 class="pe-title">Permission Engine — 비트마스크 권한 비교</h2>
    <p class="pe-desc">
      <code>permission-engine</code> 패키지의 <code>PermissionSet</code>과
      <code>migratePermissions</code>를 사용하여 ${prev}→${ver} 마이그레이션을 시각화합니다.
      ${prev} 매트릭스의 셀을 클릭하여 권한을 변경하면 ${ver}가 자동으로 재계산됩니다.
    </p>
  `;

  const toolbar = document.createElement("div");
  toolbar.className = "pe-toolbar";

  const resetBtn = document.createElement("button");
  resetBtn.className = "pe-reset-btn";
  resetBtn.textContent = "⟲ 초기화";
  resetBtn.title = "DB 기본 상태로 초기화 후 다시 로드";
  resetBtn.addEventListener("click", async () => {
    resetBtn.disabled = true;
    resetBtn.textContent = "초기화 중...";
    try {
      await resetGrants();
      // 재로드
      const [newPrev, newCur] = await Promise.all([
        fetchFeatures(prev),
        fetchFeatures(ver),
      ]);
      prevData = newPrev;
      curData = newCur;
      prevDefs = buildDimDefs(prevData);
      curDefs = buildDimDefs(curData);
      prevPS = buildPermissionSet(prevData);
      curPS = migrateV1toV2(prevPS, prevDefs, curDefs);
      repaint();
      scopedContainer.innerHTML = "";
      renderScopedSection(scopedContainer, curData);
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      resetBtn.disabled = false;
      resetBtn.textContent = "⟲ 초기화";
    }
  });

  toolbar.appendChild(resetBtn);
  header.appendChild(toolbar);
  wrap.appendChild(header);

  // ── Migration comparison ──
  const comparison = document.createElement("div");
  comparison.className = "pe-comparison";

  const prevPanel = document.createElement("div");
  prevPanel.className = "pe-panel";

  const curPanel = document.createElement("div");
  curPanel.className = "pe-panel";

  const prevStatsEl = document.createElement("div");
  const curStatsEl = document.createElement("div");

  function repaint(): void {
    curPS = migrateV1toV2(prevPS, prevDefs, curDefs);

    prevPanel.innerHTML = "";
    prevPanel.innerHTML = `<div class="pe-panel-header"><span class="pe-ver-badge pe-ver-v1">${prev}</span> 원본 권한 (클릭하여 편집)</div>`;
    prevPanel.appendChild(renderMatrix(prevPS, {
      editable: true,
      onChange: repaint,
    }));
    prevStatsEl.innerHTML = "";
    prevStatsEl.appendChild(renderStats(prevPS, `${prev} PermissionSet`));
    prevPanel.appendChild(prevStatsEl);

    curPanel.innerHTML = "";
    curPanel.innerHTML = `<div class="pe-panel-header"><span class="pe-ver-badge pe-ver-v2">${ver}</span> 마이그레이션 결과 (자동 계산)</div>`;
    curPanel.appendChild(renderMatrix(curPS, {
      editable: false,
      diffBase: prevPS,
    }));
    curStatsEl.innerHTML = "";
    curStatsEl.appendChild(renderStats(curPS, `${ver} PermissionSet`));
    curPanel.appendChild(curStatsEl);
  }

  comparison.appendChild(prevPanel);

  const arrow = document.createElement("div");
  arrow.className = "pe-arrow";
  arrow.innerHTML = `<div class="pe-arrow-line">→</div><div class="pe-arrow-label">migrate</div>`;
  comparison.appendChild(arrow);

  comparison.appendChild(curPanel);
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
  renderScopedSection(scopedContainer, curData);
}
