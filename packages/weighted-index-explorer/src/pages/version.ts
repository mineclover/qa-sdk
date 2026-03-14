// ═══════════════════════════════════════════════════════════════════════════
//  버전 관리 페이지 — schema evolution, weight analysis, recalculation demo
// ═══════════════════════════════════════════════════════════════════════════

import { SCHEMA_VERSIONS, getVersion } from "../data.js";
import { dimBadge } from "../utils/badge.js";
import { encodeRowsHtml } from "../utils/encode-html.js";

export function renderVersion(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">${buildVersionPage()}</div>`;
  wireDemo(container);
}

// ─────────────────────────────────────────────────────────────────────────
//  Static HTML
// ─────────────────────────────────────────────────────────────────────────

function buildVersionPage(): string {
  return `
    ${buildIntro()}
    <div class="concept-dim-sep"></div>
    ${buildVersionMatrix()}
    <div class="concept-dim-sep"></div>
    ${buildWeightAnalysis()}
    <div class="concept-dim-sep"></div>
    ${buildRecalcDemo()}
  `;
}

// ── 1. 개요 ───────────────────────────────────────────────────────────────

function buildIntro(): string {
  return `
    <h2 class="concept-section-title">버전 관리 — 스키마 진화와 ID 재계산</h2>
    <p class="concept-desc">
      가중진법 시스템에서 <strong>좌표(coordinates)가 진실</strong>입니다.
      ID는 좌표와 가중치 테이블로부터 계산된 결과물일 뿐입니다.
      새 버전에서 차원이 확장되더라도, 좌표를 그대로 유지한 채
      새 가중치로 재인코딩하면 새 버전의 ID를 즉시 얻을 수 있습니다.
      <strong>데이터 손실이 없고, "마이그레이션"이 아닌 "재계산"입니다.</strong>
    </p>

    <div class="insight-box">
      <span class="insight-icon">🔑</span>
      <span>
        <strong>핵심 원칙:</strong>
        <code>oldId → decode(old_W) → coords → encode(new_W) → newId</code><br/>
        좌표는 불변. 버전 변경은 새 가중치 테이블로 다시 계산하는 것.
        저장할 때는 버전 정보와 함께 보관합니다: <code>perm:v1:42</code>
      </span>
    </div>
  `;
}

// ── 2. 버전 매트릭스 ──────────────────────────────────────────────────────

function buildVersionMatrix(): string {
  const rows = SCHEMA_VERSIONS.map((vd) => {
    const newEntries = Object.entries(vd.newDimValues)
      .map(([dim, set]) => {
        const vals = Array.from(set!).map((v) => dimBadge(dim as any, v)).join(" ");
        return `<span class="vt-dim-tag">${dim}</span> ${vals}`;
      }).join("<br/>");

    return `
      <tr class="vt-row">
        <td class="vt-ver"><strong>${vd.v}</strong></td>
        <td class="vt-shape">[${vd.shape.join(", ")}]</td>
        <td class="vt-size">${vd.size.toLocaleString()}</td>
        <td class="vt-weights">[${vd.weights.join(", ")}]</td>
        <td class="vt-new">${newEntries || '<span style="color:#aaa">없음 (초기)</span>'}</td>
        <td class="vt-changelog">${vd.changelog}</td>
      </tr>
    `;
  }).join("");

  return `
    <h2 class="concept-section-title">버전 매트릭스</h2>

    <div class="concept-block">
      <div class="cb-header">스키마 버전 이력 <span class="cb-badge">${SCHEMA_VERSIONS.length}개 버전</span></div>
      <div class="cb-body">
        <div class="ev-tbl-wrap">
          <table class="ev-tbl vt-table">
            <thead>
              <tr>
                <th>버전</th>
                <th>shape</th>
                <th>슬롯 수</th>
                <th>가중치 [W₁,W₂,W₃,W₄]</th>
                <th>신규 값</th>
                <th>변경 내용</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── 3. 가중치 변화 분석 ────────────────────────────────────────────────────

function buildWeightAnalysis(): string {
  const [v1, v2, v3] = SCHEMA_VERSIONS;

  const compareRow = (label: string, w1: number, w2: number, w3: number, c12: boolean, c23: boolean) => `
    <tr>
      <td><code>${label}</code></td>
      <td class="td-num">${w1}</td>
      <td class="td-num ${c12 ? "vt-changed" : "vt-stable"}">${w2} ${c12 ? "⚠" : "="}</td>
      <td class="td-num ${c23 ? "vt-changed" : "vt-stable"}">${w3} ${c23 ? "⚠" : "="}</td>
    </tr>
  `;

  const [w1_1, w1_2, w1_3, w1_4] = v1.weights;
  const [w2_1, w2_2, w2_3, w2_4] = v2.weights;
  const [w3_1, w3_2, w3_3, w3_4] = v3.weights;

  return `
    <h2 class="concept-section-title">가중치 변화 분석</h2>

    <div class="concept-block">
      <div class="cb-header">버전별 가중치 비교</div>
      <div class="cb-body">
        <table class="nd-table">
          <thead>
            <tr><th>차원</th><th>v1 W</th><th>v2 W</th><th>v3 W</th></tr>
          </thead>
          <tbody>
            ${compareRow("resource (W₁)", w1_1, w2_1, w3_1, w1_1 !== w2_1, w2_1 !== w3_1)}
            ${compareRow("action (W₂)",   w1_2, w2_2, w3_2, w1_2 !== w2_2, w2_2 !== w3_2)}
            ${compareRow("role (W₃)",     w1_3, w2_3, w3_3, w1_3 !== w2_3, w2_3 !== w3_3)}
            ${compareRow("env (W₄)",      w1_4, w2_4, w3_4, w1_4 !== w2_4, w2_4 !== w3_4)}
          </tbody>
        </table>
        <p class="mini-note">
          <span class="vt-stable">= 불변 (기존 ID 보존)</span>&nbsp;&nbsp;
          <span class="vt-changed">⚠ 변경 (재계산 필요)</span>
        </p>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">v1 → v2: resource +2 — 가중치 불변, ID 보존</div>
      <div class="cb-body">
        <div class="insight-box" style="margin:0">
          <span class="insight-icon">✅</span>
          <span>
            resource(N₁)만 8→10으로 확장. W₁ = N₂×N₃×N₄ = 4×5×4 = <strong>80</strong> 그대로.
            기존 v1 ID는 v2에서도 동일하게 유효합니다.
          </span>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">v2 → v3: role +1 — 가중치 변경, 재계산</div>
      <div class="cb-body">
        <div class="insight-box" style="margin:0">
          <span class="insight-icon">♻️</span>
          <span>
            role(N₃) 5→6. W₁ = 4×5×4=80 → 4×6×4=<strong>96</strong>. W₂ = 5×4=20 → 6×4=<strong>24</strong>.<br/>
            <strong>재계산:</strong> <code>oldId → decode(v2.W) → coords → encode(v3.W) → newId</code><br/>
            좌표가 동일하므로 의미는 보존됩니다. "마이그레이션"이 아닌 순수 산술 재계산.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 4. 재계산 데모 ─────────────────────────────────────────────────────────

function buildRecalcDemo(): string {
  const versionOpts = SCHEMA_VERSIONS.map((vd) =>
    `<option value="${vd.v}">${vd.v} — [${vd.shape.join(",")}] · ${vd.size}개</option>`
  ).join("");

  const toOpts = SCHEMA_VERSIONS.map((vd, i) =>
    `<option value="${vd.v}"${i === 2 ? " selected" : ""}>${vd.v} — [${vd.shape.join(",")}] · ${vd.size}개</option>`
  ).join("");

  return `
    <h2 class="concept-section-title">재계산 데모</h2>
    <p class="concept-desc">
      이전 버전의 ID를 입력하면, 좌표를 거쳐 새 버전의 ID로 재계산하는 과정을 확인합니다.
    </p>

    <div class="concept-block">
      <div class="cb-header">ID 재계산 (decode → coords → encode)</div>
      <div class="cb-body">
        <div class="recalc-form">
          <div class="recalc-row">
            <label class="recalc-label">이전 버전</label>
            <select class="recalc-sel" id="rc-from">${versionOpts}</select>
            <label class="recalc-label">ID</label>
            <input class="recalc-input" id="rc-id" type="number" min="0" value="42" />
            <label class="recalc-label">새 버전</label>
            <select class="recalc-sel" id="rc-to">${toOpts}</select>
            <button class="recalc-btn" id="rc-run">계산</button>
          </div>
        </div>
        <div id="rc-result" class="recalc-result"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
//  Demo wiring
// ─────────────────────────────────────────────────────────────────────────

function wireDemo(container: HTMLElement): void {
  const fromSel = container.querySelector<HTMLSelectElement>("#rc-from")!;
  const toSel   = container.querySelector<HTMLSelectElement>("#rc-to")!;
  const idInput = container.querySelector<HTMLInputElement>("#rc-id")!;
  const runBtn  = container.querySelector<HTMLButtonElement>("#rc-run")!;
  const result  = container.querySelector<HTMLDivElement>("#rc-result")!;

  function run(): void {
    const fromV   = fromSel.value;
    const toV     = toSel.value;
    const inputId = parseInt(idInput.value, 10);

    const fromDef = getVersion(fromV);
    const toDef   = getVersion(toV);

    if (isNaN(inputId) || inputId < 0 || inputId >= fromDef.size) {
      result.innerHTML = `<div class="recalc-error">ID ${inputId}는 ${fromV} 범위 [0, ${fromDef.size - 1}] 밖입니다.</div>`;
      return;
    }

    const coords = fromDef.wi.decode(inputId) as [number, number, number, number];
    const [r, a, ro, e] = coords;

    const [N1, N2, N3, N4] = toDef.shape;
    if (r > N1 || a > N2 || ro > N3 || e > N4) {
      result.innerHTML = `<div class="recalc-error">
        좌표 [${r},${a},${ro},${e}]는 ${toV} shape [${toDef.shape.join(",")}] 범위를 초과합니다.
      </div>`;
      return;
    }

    const newId = toDef.wi.encode(coords);

    const rVal  = String(fromDef.dims.resource.values[r  - 1]);
    const aVal  = String(fromDef.dims.action.values[a    - 1]);
    const roVal = String(fromDef.dims.role.values[ro     - 1]);
    const eVal  = String(fromDef.dims.env.values[e       - 1]);

    const wFrom   = fromDef.weights;
    const wTo     = toDef.weights;
    const sameId  = inputId === newId;
    const wChange = JSON.stringify(wFrom) !== JSON.stringify(wTo);
    const isNewInTo = (toDef.newDimValues.role?.has(roVal) ?? false);

    result.innerHTML = `
      <div class="recalc-steps">
        <div class="rc-step">
          <span class="rc-step-num">①</span>
          <span class="rc-step-label">입력 ID (${fromV})</span>
          <code class="rc-code">perm:${fromV}:${inputId}</code>
        </div>
        <div class="rc-arrow">↓ decode(W = [${wFrom.join(",")}])</div>
        <div class="rc-step">
          <span class="rc-step-num">②</span>
          <span class="rc-step-label">좌표 (불변)</span>
          <span class="rc-coords">
            [${r}, ${a}, ${ro}, ${e}] →
            ${dimBadge("resource", rVal)}
            ${dimBadge("action",   aVal)}
            ${dimBadge("role",     roVal)}${isNewInTo ? " <span class='new-tag'>NEW</span>" : ""}
            ${dimBadge("env",      eVal)}
          </span>
        </div>
        <div class="rc-arrow">↓ encode(W = [${wTo.join(",")}])${wChange ? " — 가중치 변경" : " — 가중치 동일"}</div>
        <div class="rc-step">
          <span class="rc-step-num">③</span>
          <span class="rc-step-label">새 ID (${toV})</span>
          <code class="rc-code ${sameId ? "rc-same" : "rc-different"}">perm:${toV}:${newId}</code>
          ${sameId
            ? '<span class="rc-note rc-note-same">ID 불변 ✓</span>'
            : `<span class="rc-note rc-note-changed">${inputId} → ${newId}</span>`}
        </div>
      </div>
    `;
  }

  runBtn.addEventListener("click", run);
  idInput.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  run();
}
