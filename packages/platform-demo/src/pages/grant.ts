// ═══════════════════════════════════════════════════════════════════════════
//  부여 관리 — 튜토리얼 + 인터랙티브 권한 매트릭스
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchGrantTable,
  patchGrant,
  patchGrantBatch,
  resetGrants,
  type GrantRow,
} from "../registry.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface GrantMatrix {
  features: { id: string; name: string }[];
  roles:    { id: string; ko: string }[];
  // matrix[featureIdx][roleIdx] = granted
  cells:    boolean[][];
}

// Tutorial changes: customer gets payment_history + payment_cancel_req
const TUTORIAL_CHANGES = [
  { featureId: "payment_history",    featureName: "결제 내역 조회", role: "customer", roleKo: "고객", granted: true },
  { featureId: "payment_cancel_req", featureName: "결제 취소 요청", role: "customer", roleKo: "고객", granted: true },
];

// ── Tutorial section ───────────────────────────────────────────────────────

function buildTutorial(
  currentRows: GrantRow[],
  onApply: () => void,
  onReset: () => void,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "gm-tutorial-card";

  // Check which changes have already been applied
  const rowMap = new Map<string, GrantRow>();
  for (const r of currentRows) rowMap.set(`${r.featureId}:${r.role}`, r);

  const allApplied = TUTORIAL_CHANGES.every((ch) => {
    const row = rowMap.get(`${ch.featureId}:${ch.role}`);
    return row ? row.granted === ch.granted : false;
  });

  card.innerHTML = `
    <div class="gm-tutorial-header">
      <span class="gm-tutorial-icon">🎓</span>
      <span class="gm-tutorial-title">권한 변경 튜토리얼</span>
      <span class="gm-tutorial-desc">고객 역할에 결제 권한을 부여하여 취소 요청 워크플로우를 활성화합니다.</span>
    </div>
    <div class="gm-tutorial-goal">
      <div class="gm-tutorial-goal-title">변경 목표</div>
      <div class="gm-tutorial-goal-desc">
        customer에게 결제 내역 조회 및 결제 취소 요청 권한을 부여합니다.
        이로써 고객이 직접 취소를 요청하고 운영자가 승인하는 워크플로우가 활성화됩니다.
      </div>
    </div>
    <table class="gm-tutorial-table">
      <thead>
        <tr><th>기능</th><th>대상 역할</th><th>현재 상태</th><th>변경 후</th><th>상태</th></tr>
      </thead>
      <tbody>
        ${TUTORIAL_CHANGES.map((ch) => {
          const row = rowMap.get(`${ch.featureId}:${ch.role}`);
          const current = row?.granted ?? !ch.granted; // fallback
          const done = current === ch.granted;
          const arrow = ch.granted
            ? `<span class="status-denied">✗ 미부여</span> → <span class="status-ok">✓ 부여</span>`
            : `<span class="status-ok">✓ 부여</span> → <span class="status-denied">✗ 제거</span>`;
          return `
            <tr class="${done ? "gm-tutorial-row-done" : ""}">
              <td class="gm-tutorial-feat">${ch.featureName}</td>
              <td><span class="role-tag role-tag-${ch.role}">${ch.roleKo}</span></td>
              <td>${arrow.split(" → ")[0]}</td>
              <td>${arrow.split(" → ")[1]}</td>
              <td>${done ? '<span class="gm-done-badge">✓ 적용됨</span>' : '<span class="gm-pending-badge">대기</span>'}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    <div class="gm-tutorial-actions">
      <button class="gm-btn-apply" ${allApplied ? "disabled" : ""}>
        ${allApplied ? "✓ 이미 적용됨" : "▶ 변경 적용"}
      </button>
      <button class="gm-btn-reset">↺ 초기값으로 복원</button>
    </div>
  `;

  card.querySelector<HTMLButtonElement>(".gm-btn-apply")?.addEventListener("click", onApply);
  card.querySelector<HTMLButtonElement>(".gm-btn-reset")?.addEventListener("click", onReset);

  return card;
}

// ── Interactive matrix ─────────────────────────────────────────────────────

function buildMatrix(
  matrix: GrantMatrix,
  onToggle: (featureId: string, role: string, granted: boolean) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "gm-matrix-wrap";

  const title = document.createElement("div");
  title.className = "gm-section-title";
  title.textContent = "권한 매트릭스";
  wrap.appendChild(title);

  const tableWrap = document.createElement("div");
  tableWrap.style.overflowX = "auto";
  wrap.appendChild(tableWrap);

  const tbl = document.createElement("table");
  tbl.className = "gm-matrix-table";

  // Header
  const thead = tbl.createTHead();
  const hr = thead.insertRow();
  const thCorner = document.createElement("th");
  thCorner.textContent = "기능 \\ 역할";
  thCorner.className = "gm-matrix-corner";
  hr.appendChild(thCorner);
  for (const role of matrix.roles) {
    const th = document.createElement("th");
    th.innerHTML = `<span class="role-tag role-tag-${role.id}">${role.ko}</span>`;
    hr.appendChild(th);
  }

  // Body
  const tbody = tbl.createTBody();
  matrix.features.forEach((feat, fi) => {
    const tr = tbody.insertRow();
    const tdName = document.createElement("td");
    tdName.className = "gm-matrix-feat";
    tdName.textContent = feat.name;
    tr.appendChild(tdName);

    matrix.roles.forEach((role, ri) => {
      const td = tr.insertCell();
      td.className = "gm-matrix-cell";
      const granted = matrix.cells[fi]?.[ri] ?? false;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "gm-checkbox";
      cb.checked = granted;
      cb.addEventListener("change", () => {
        onToggle(feat.id, role.id, cb.checked);
      });

      td.appendChild(cb);
    });
  });

  tbl.appendChild(tbody);
  tableWrap.appendChild(tbl);
  return wrap;
}

function updateMatrix(wrap: HTMLElement, matrix: GrantMatrix): void {
  const rows = Array.from(wrap.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  matrix.features.forEach((_, fi) => {
    const cells = Array.from(rows[fi]?.querySelectorAll<HTMLTableCellElement>(".gm-matrix-cell") ?? []);
    matrix.roles.forEach((_, ri) => {
      const cb = cells[ri]?.querySelector<HTMLInputElement>(".gm-checkbox");
      if (cb) cb.checked = matrix.cells[fi]?.[ri] ?? false;
    });
  });
}

// ── Grant table (read-only view) ───────────────────────────────────────────

function buildGrantTable(rows: GrantRow[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "grant-table-wrap";

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="grant-empty">표시할 항목이 없습니다.</div>`;
    return wrap;
  }

  const tbl = document.createElement("table");
  tbl.className = "grant-table";

  const thead = tbl.createTHead();
  const hr = thead.insertRow();
  for (const col of ["기능", "역할", "권한 주소", "서비스", "부여 여부", "이벤트 주소", "이벤트명"]) {
    const th = document.createElement("th");
    th.textContent = col;
    hr.appendChild(th);
  }

  const tbody = tbl.createTBody();
  let lastFeatureId = "";

  for (const row of rows) {
    const tr = tbody.insertRow();
    if (row.featureId !== lastFeatureId) {
      tr.classList.add("grant-feature-first");
      lastFeatureId = row.featureId;
    }
    tr.classList.add(row.granted ? "grant-row-ok" : "grant-row-denied");

    const tdFeature = tr.insertCell();
    tdFeature.className = "grant-cell-feature";
    tdFeature.textContent = row.featureName;

    const tdRole = tr.insertCell();
    tdRole.innerHTML = `<span class="role-tag role-tag-${row.role}">${row.roleKo}</span>`;

    const tdPerm = tr.insertCell();
    tdPerm.innerHTML = `<span class="scenario-addr-chip">${row.permAddr}</span>`;

    const tdSvc = tr.insertCell();
    tdSvc.className = "grant-cell-svc";
    tdSvc.innerHTML = `
      <span class="grant-svc-name">${row.svcNameKo}</span>
      <span class="grant-svc-meta">${row.envKo} · ${row.regionKo} · ${row.namespaceKo}</span>
    `;

    const tdGrant = tr.insertCell();
    tdGrant.className = "grant-cell-status";
    if (row.granted) {
      tdGrant.innerHTML = `<span class="status-ok grant-status-badge">✓ 부여됨</span>`;
    } else {
      tdGrant.innerHTML = `
        <span class="status-denied grant-status-badge">✗ 미부여</span>
        <span class="grant-min-role">허용: ${row.grantedRolesKo.join(", ")}</span>
      `;
    }

    const tdEvtAddr = tr.insertCell();
    if (row.eventAddr) {
      const typeClass = row.eventType === "success" ? "grant-evt-success" : "grant-evt-fail";
      tdEvtAddr.innerHTML = `<span class="scenario-addr-chip ${typeClass}">${row.eventAddr}</span>`;
    } else {
      tdEvtAddr.innerHTML = `<span style="color:var(--text-muted)">—</span>`;
    }

    const tdEvtName = tr.insertCell();
    if (row.eventNameKo) {
      const typeBadge = row.eventType === "success"
        ? `<span class="grant-evt-type-badge ok">성공</span>`
        : `<span class="grant-evt-type-badge fail">실패</span>`;
      tdEvtName.innerHTML = `${row.eventNameKo} ${typeBadge}`;
    } else {
      tdEvtName.innerHTML = `<span style="color:var(--text-muted)">—</span>`;
    }
  }

  wrap.appendChild(tbl);
  return wrap;
}

// ── Main export ────────────────────────────────────────────────────────────

export function renderGrantPage(container: HTMLElement): void {
  container.innerHTML = `<div style="padding:16px;color:var(--text-muted)">로딩 중...</div>`;

  fetchGrantTable().then((data) => {
    container.innerHTML = "";

    const allRows = data.rows;

    // Build matrix data from rows
    const featMap = new Map<string, string>();
    const roleMap = new Map<string, string>();
    for (const r of allRows) {
      featMap.set(r.featureId, r.featureName);
      roleMap.set(r.role, r.roleKo);
    }
    const features = Array.from(featMap.entries()).map(([id, name]) => ({ id, name }));
    const roles    = Array.from(roleMap.entries()).map(([id, ko]) => ({ id, ko }));

    function buildCells(rows: GrantRow[]): boolean[][] {
      return features.map((feat) =>
        roles.map((role) => rows.find((r) => r.featureId === feat.id && r.role === role.id)?.granted ?? false)
      );
    }

    const matrixData: GrantMatrix = {
      features,
      roles,
      cells: buildCells(allRows),
    };

    // ── Tutorial ──
    let tutorialEl = buildTutorial(allRows, handleApplyTutorial, handleReset);
    container.appendChild(tutorialEl);

    // ── Matrix ──
    const matrixEl = buildMatrix(matrixData, handleToggle);
    container.appendChild(matrixEl);

    // ── Detail table title ──
    const detailTitle = document.createElement("div");
    detailTitle.className = "gm-section-title";
    detailTitle.style.marginTop = "20px";
    detailTitle.textContent = "부여 현황 상세";
    container.appendChild(detailTitle);

    // ── Detail table ──
    let tableEl = buildGrantTable(allRows);
    container.appendChild(tableEl);

    async function refresh(): Promise<void> {
      try {
        const fresh = await fetchGrantTable();
        // Rebuild tutorial
        const newTutorial = buildTutorial(fresh.rows, handleApplyTutorial, handleReset);
        tutorialEl.replaceWith(newTutorial);
        tutorialEl = newTutorial;
        // Update matrix
        matrixData.cells = buildCells(fresh.rows);
        updateMatrix(matrixEl, matrixData);
        // Rebuild table
        const newTable = buildGrantTable(fresh.rows);
        tableEl.replaceWith(newTable);
        tableEl = newTable;
      } catch (e) {
        console.error("refresh failed", e);
      }
    }

    async function handleToggle(featureId: string, role: string, granted: boolean): Promise<void> {
      try {
        await patchGrant(featureId, role, granted);
        await refresh();
      } catch (e) {
        console.error("patchGrant failed", e);
      }
    }

    async function handleApplyTutorial(): Promise<void> {
      const applyBtn = container.querySelector<HTMLButtonElement>(".gm-btn-apply");
      if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = "적용 중..."; }
      try {
        await patchGrantBatch(TUTORIAL_CHANGES);
        await refresh();
      } catch (e) {
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = "▶ 변경 적용"; }
        console.error("patchGrantBatch failed", e);
      }
    }

    async function handleReset(): Promise<void> {
      const resetBtn = container.querySelector<HTMLButtonElement>(".gm-btn-reset");
      if (resetBtn) { resetBtn.disabled = true; resetBtn.textContent = "복원 중..."; }
      try {
        await resetGrants();
        await refresh();
      } catch (e) {
        console.error("resetGrants failed", e);
      } finally {
        if (resetBtn) { resetBtn.disabled = false; resetBtn.textContent = "↺ 초기값으로 복원"; }
      }
    }
  }).catch((e: unknown) => {
    container.innerHTML = `<div style="padding:16px;color:#c0392b">오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}</div>`;
  });
}
