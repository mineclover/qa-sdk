// ═══════════════════════════════════════════════════════════════════════════
//  부여 관리 — 권한 매트릭스 (좌) + 권한 확인 시뮬레이션 (우)
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchGrantTable,
  fetchFeatures,
  fetchPermissionMask,
  patchGrant,
  patchGrantBatch,
  resetGrants,
  type GrantRow,
  type FeaturesResponse,
  type PermissionMaskResponse,
} from "../registry.js";
import {
  DEMO_FEATURE_KO,
  DEMO_KO,
} from "demo-snapshot";
import { hasBit } from "weighted-index";
import { base64ToUint8 } from "bit-index";

// ── Types ──────────────────────────────────────────────────────────────────

interface GrantMatrix {
  features: { id: string; name: string }[];
  roles:    { id: string; ko: string }[];
  cells:    boolean[][];
}

// Tutorial changes
const TUTORIAL_CHANGES = [
  { featureId: "payment_history",    featureName: DEMO_FEATURE_KO["payment_history"] ?? "결제 내역 조회", role: "customer", roleKo: DEMO_KO.role["customer"] ?? "고객", granted: true },
  { featureId: "payment_cancel_req", featureName: DEMO_FEATURE_KO["payment_cancel_req"] ?? "결제 취소 요청", role: "customer", roleKo: DEMO_KO.role["customer"] ?? "고객", granted: true },
];

// ── 시뮬레이션용 유저 데이터 ──────────────────────────────────────────────

const DEMO_USERS = [
  { id: "u-1001", name: "홍길동", role: "admin" },
  { id: "u-1002", name: "김철수", role: "developer" },
  { id: "u-1003", name: "이영희", role: "operator" },
  { id: "u-1004", name: "박민수", role: "viewer" },
  { id: "u-1005", name: "정수연", role: "readonly" },
  { id: "u-1006", name: "최고객", role: "customer" },
  { id: "u-1007", name: "감사원", role: "auditor" },
];

// ── Tutorial section ───────────────────────────────────────────────────────

function buildTutorial(
  currentRows: GrantRow[],
  onApply: () => void,
  onReset: () => void,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "gm-tutorial-card";

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
    <table class="gm-tutorial-table">
      <thead>
        <tr><th>기능</th><th>대상 역할</th><th>현재</th><th>변경 후</th><th>상태</th></tr>
      </thead>
      <tbody>
        ${TUTORIAL_CHANGES.map((ch) => {
          const row = rowMap.get(`${ch.featureId}:${ch.role}`);
          const current = row?.granted ?? !ch.granted;
          const done = current === ch.granted;
          return `
            <tr class="${done ? "gm-tutorial-row-done" : ""}">
              <td class="gm-tutorial-feat">${ch.featureName}</td>
              <td><span class="role-tag role-tag-${ch.role}">${ch.roleKo}</span></td>
              <td><span class="status-denied">✗</span></td>
              <td><span class="status-ok">✓</span></td>
              <td>${done ? '<span class="gm-done-badge">✓</span>' : '<span class="gm-pending-badge">대기</span>'}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    <div class="gm-tutorial-actions">
      <button class="gm-btn-apply" ${allApplied ? "disabled" : ""}>
        ${allApplied ? "✓ 적용됨" : "▶ 변경 적용"}
      </button>
      <button class="gm-btn-reset">↺ 초기화</button>
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

  const tbl = document.createElement("table");
  tbl.className = "gm-matrix-table";

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
      cb.addEventListener("change", () => onToggle(feat.id, role.id, cb.checked));
      td.appendChild(cb);
    });
  });

  wrap.appendChild(tbl);
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

// ═══════════════════════════════════════════════════════════════════════════
//  권한 확인 시뮬레이션 패널 (하단 full-width, 실제 API 호출)
// ═══════════════════════════════════════════════════════════════════════════

function buildSimPanel(
  features: FeaturesResponse,
  ver: string,
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "gm-sim-panel";

  let selectedRole = DEMO_USERS[3].role; // viewer
  let selectedFeat = features.features[0]?.id ?? "";

  // ── Header ──
  const header = document.createElement("div");
  header.className = "gm-sim-header";
  header.innerHTML = `
    <div class="gm-sim-title">권한 확인 시뮬레이션</div>
    <div class="gm-sim-desc">실제 API 호출로 클라이언트 → 서버 권한 체크 흐름을 시각화합니다</div>
  `;
  panel.appendChild(header);

  // ── Inputs (가로) ──
  const inputs = document.createElement("div");
  inputs.className = "gm-sim-inputs";

  // User select
  const userGroup = document.createElement("div");
  userGroup.className = "gm-sim-input-group";
  userGroup.innerHTML = `<label class="gm-sim-label">유저 (role)</label>`;
  const userSelect = document.createElement("select");
  userSelect.className = "gm-sim-select";
  for (const u of DEMO_USERS) {
    const ko = DEMO_KO.role[u.role] ?? u.role;
    const opt = document.createElement("option");
    opt.value = u.role;
    opt.textContent = `${u.name} — ${ko} (${u.role})`;
    if (u.role === selectedRole) opt.selected = true;
    userSelect.appendChild(opt);
  }
  userSelect.addEventListener("change", () => { selectedRole = userSelect.value; });
  userGroup.appendChild(userSelect);
  inputs.appendChild(userGroup);

  // Feature select
  const featGroup = document.createElement("div");
  featGroup.className = "gm-sim-input-group";
  featGroup.innerHTML = `<label class="gm-sim-label">접근 리소스</label>`;
  const featSelect = document.createElement("select");
  featSelect.className = "gm-sim-select";
  for (const f of features.features) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.name} (${f.id})`;
    featSelect.appendChild(opt);
  }
  featSelect.addEventListener("change", () => { selectedFeat = featSelect.value; });
  featGroup.appendChild(featSelect);
  inputs.appendChild(featGroup);

  // Check button
  const checkBtn = document.createElement("button");
  checkBtn.className = "gm-sim-check-btn";
  checkBtn.textContent = "▶ 권한 확인";
  inputs.appendChild(checkBtn);

  panel.appendChild(inputs);

  // ── Result area ──
  const resultArea = document.createElement("div");
  resultArea.className = "gm-sim-result";
  resultArea.innerHTML = `<div class="gm-sim-placeholder">유저와 리소스를 선택한 후 "권한 확인"을 클릭하세요.</div>`;
  panel.appendChild(resultArea);

  // ── Check handler: 실제 API 호출 ──
  checkBtn.addEventListener("click", async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = "요청 중...";
    resultArea.innerHTML = `<div class="gm-sim-placeholder">API 요청 중...</div>`;

    const user = DEMO_USERS.find(u => u.role === selectedRole)!;
    const roleKo = DEMO_KO.role[user.role] ?? user.role;
    const featName = DEMO_FEATURE_KO[selectedFeat] ?? selectedFeat;

    try {
      // Step 1: 서버에서 mask 요청 (실제 네트워크)
      const mask: PermissionMaskResponse = await fetchPermissionMask(user.role, ver);

      // Step 2: 클라이언트에서 hasBit으로 체크 (permission-engine/bit-index 사용)
      const maskBytes = base64ToUint8(mask.maskBase64);
      const featIdx = mask.features.findIndex(f => f.id === selectedFeat);
      const granted = featIdx >= 0 && hasBit(maskBytes, featIdx);

      // mask bits 시각화 데이터
      const bitsHex = Array.from(maskBytes).map(b => b.toString(16).padStart(2, "0")).join(" ");

      resultArea.innerHTML = `
        <div class="gm-sim-flow">
          <div class="gm-sim-step">
            <div class="gm-sim-step-badge client">1. REQUEST</div>
            <div class="gm-sim-step-title">서버에서 mask 수신</div>
            <pre class="gm-sim-code">GET /api/permission/mask?role=${user.role}&ver=${ver}

→ maskBase64: "${mask.maskBase64}"
  (${mask.maskBytes}B, ${mask.grantCount}/${mask.totalSlots} 부여)</pre>
          </div>

          <div class="gm-sim-arrow">→</div>

          <div class="gm-sim-step gm-sim-step-wide">
            <div class="gm-sim-step-badge server">2. MASK</div>
            <div class="gm-sim-step-title">${roleKo}의 permission mask</div>
            <div class="gm-sim-mask">
              ${mask.bits.map((b, i) => `<span class="gm-sim-mask-bit ${b ? "on" : "off"} ${i === featIdx ? "target" : ""}" title="${mask.features[i]?.name ?? ""}">${b}</span>`).join("")}
            </div>
            <div class="gm-sim-mask-legend">
              ${mask.features.map((f, i) => `<span class="gm-sim-mask-label ${i === featIdx ? "target" : ""}">${DEMO_FEATURE_KO[f.id] ?? f.id}</span>`).join("")}
            </div>
            <pre class="gm-sim-code">bytes: [${bitsHex}]
base64ToUint8("${mask.maskBase64}")
hasBit(mask, ${featIdx}) → ${granted}</pre>
          </div>

          <div class="gm-sim-arrow">→</div>

          <div class="gm-sim-step">
            <div class="gm-sim-step-badge ${granted ? "ok" : "denied"}">3. RESULT</div>
            <div class="gm-sim-step-title">${granted ? "✓ 접근 허용" : "✗ 접근 거부"}</div>
            <pre class="gm-sim-code gm-sim-result-${granted ? "ok" : "denied"}">${featName}: ${granted ? "허용" : "거부"}
hasBit(mask, ${featIdx}) = ${granted}${!granted ? `\n\n허용 역할: ${mask.features[featIdx]?.granted ? "" : mask.features.filter(f => f.granted).map(f => DEMO_FEATURE_KO[f.id] ?? f.id).join(", ") || "없음"}` : ""}</pre>
          </div>
        </div>
      `;
    } catch (e) {
      resultArea.innerHTML = `<div class="gm-sim-placeholder">API 오류: ${e instanceof Error ? e.message : String(e)}</div>`;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "▶ 권한 확인";
    }
  });

  return panel;
}

// ── Main export ────────────────────────────────────────────────────────────

export function renderGrantPage(container: HTMLElement, ver = "v2"): void {
  container.innerHTML = `<div style="padding:16px;color:var(--text-muted)">로딩 중...</div>`;

  Promise.all([fetchGrantTable(ver), fetchFeatures(ver)]).then(([data, featData]) => {
    container.innerHTML = "";

    const allRows = data.rows;

    // Build matrix data
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

    const matrixData: GrantMatrix = { features, roles, cells: buildCells(allRows) };

    // ── 2:1 레이아웃 ──
    const layout = document.createElement("div");
    layout.className = "gm-layout";

    // ── 좌측: 기존 grant 관리 ──
    const leftCol = document.createElement("div");
    leftCol.className = "gm-left";

    // Tutorial
    let tutorialEl: HTMLElement | null = null;
    if (ver === "v2") {
      tutorialEl = buildTutorial(allRows, handleApplyTutorial, handleReset);
      leftCol.appendChild(tutorialEl);
    }

    // Matrix
    const matrixTitle = document.createElement("div");
    matrixTitle.className = "gm-section-title";
    matrixTitle.textContent = "권한 매트릭스";
    leftCol.appendChild(matrixTitle);

    const matrixEl = buildMatrix(matrixData, handleToggle);
    leftCol.appendChild(matrixEl);

    layout.appendChild(leftCol);

    // ── 우측: 저장된 mask 값 표시 (DOM 직접 업데이트로 플리커 방지) ──
    const rightCol = document.createElement("div");
    rightCol.className = "gm-right";
    layout.appendChild(rightCol);

    // 초기 DOM 구조 생성 (한 번만)
    const maskPanel = document.createElement("div");
    maskPanel.className = "gm-mask-panel";
    const maskHeader = document.createElement("div");
    maskHeader.className = "gm-mask-panel-header";
    maskHeader.textContent = "저장된 Permission Mask";
    maskPanel.appendChild(maskHeader);

    // role별 블록 사전 생성
    const roleBlocks = new Map<string, {
      block: HTMLElement;
      statsEl: HTMLElement;
      bitsEl: HTMLElement;
      b64El: HTMLElement;
    }>();

    for (const role of matrixData.roles) {
      const block = document.createElement("div");
      block.className = "gm-mask-role-block";

      const head = document.createElement("div");
      head.className = "gm-mask-role-head";
      head.innerHTML = `<span class="role-tag role-tag-${role.id}">${role.ko}</span>`;
      const statsEl = document.createElement("span");
      statsEl.className = "gm-mask-stats";
      head.appendChild(statsEl);
      block.appendChild(head);

      const bitsEl = document.createElement("div");
      bitsEl.className = "gm-stored-bits";
      block.appendChild(bitsEl);

      const labelsEl = document.createElement("div");
      labelsEl.className = "gm-stored-labels";
      labelsEl.innerHTML = matrixData.features.map(f =>
        `<span class="gm-stored-label">${DEMO_FEATURE_KO[f.id] ?? f.id}</span>`
      ).join("");
      block.appendChild(labelsEl);

      const b64El = document.createElement("div");
      b64El.className = "gm-mask-b64";
      block.appendChild(b64El);

      maskPanel.appendChild(block);
      roleBlocks.set(role.id, { block, statsEl, bitsEl, b64El });
    }

    rightCol.appendChild(maskPanel);

    /** 비트/통계만 업데이트 (DOM 교체 없음, 플리커 없음) */
    async function refreshMaskPanel(): Promise<void> {
      try {
        const promises = matrixData.roles.map(r => fetchPermissionMask(r.id, ver));
        const masks = await Promise.all(promises);

        for (let ri = 0; ri < matrixData.roles.length; ri++) {
          const mask = masks[ri];
          const els = roleBlocks.get(matrixData.roles[ri].id);
          if (!els) continue;

          els.statsEl.textContent = `${mask.grantCount}/${mask.totalSlots} (${mask.density}%)`;

          // 비트: 개별 span 업데이트 또는 생성
          const existingBits = els.bitsEl.children;
          for (let i = 0; i < mask.bits.length; i++) {
            const on = mask.bits[i] === 1;
            if (i < existingBits.length) {
              const span = existingBits[i] as HTMLElement;
              span.className = `gm-stored-bit ${on ? "on" : "off"}`;
              span.textContent = String(mask.bits[i]);
              span.title = mask.features[i]?.name ?? "";
            } else {
              const span = document.createElement("span");
              span.className = `gm-stored-bit ${on ? "on" : "off"}`;
              span.textContent = String(mask.bits[i]);
              span.title = mask.features[i]?.name ?? "";
              els.bitsEl.appendChild(span);
            }
          }

          els.b64El.innerHTML = `<code>${mask.maskBase64}</code><span class="gm-mask-bytes">${mask.maskBytes}B</span>`;
        }
      } catch {
        // 조용히 실패 — 다음 refresh에서 재시도
      }
    }

    refreshMaskPanel();

    // ── 하단: 권한 확인 시뮬레이션 (full-width) ──
    const bottomCol = document.createElement("div");
    bottomCol.className = "gm-bottom";

    const simPanel = buildSimPanel(featData, ver);
    bottomCol.appendChild(simPanel);

    layout.appendChild(bottomCol);
    container.appendChild(layout);

    // ── Handlers ──
    async function refresh(): Promise<void> {
      try {
        const fresh = await fetchGrantTable(ver);
        if (ver === "v2" && tutorialEl) {
          const newTutorial = buildTutorial(fresh.rows, handleApplyTutorial, handleReset);
          tutorialEl.replaceWith(newTutorial);
          tutorialEl = newTutorial;
        }
        matrixData.cells = buildCells(fresh.rows);
        updateMatrix(matrixEl, matrixData);
        refreshMaskPanel();
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
      const btn = container.querySelector<HTMLButtonElement>(".gm-btn-apply");
      if (btn) { btn.disabled = true; btn.textContent = "적용 중..."; }
      try {
        await patchGrantBatch(TUTORIAL_CHANGES);
        await refresh();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "▶ 변경 적용"; }
      }
    }

    async function handleReset(): Promise<void> {
      const btn = container.querySelector<HTMLButtonElement>(".gm-btn-reset");
      if (btn) { btn.disabled = true; btn.textContent = "복원 중..."; }
      try {
        await resetGrants();
        await refresh();
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "↺ 초기화"; }
      }
    }
  }).catch((e: unknown) => {
    container.innerHTML = `<div class="error-state">데이터를 불러올 수 없습니다. ${e instanceof Error ? e.message : ""}</div>`;
  });
}
