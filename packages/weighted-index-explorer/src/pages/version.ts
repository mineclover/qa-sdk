// @def.boundary weighted-index-system
// @def.doc weighted-index-system

// ═══════════════════════════════════════════════════════════════════════════
//  버전 관리 페이지 — schema evolution, weight analysis, recalculation demo,
//  cross-index migration, address state gate, sparse migration warning
// ═══════════════════════════════════════════════════════════════════════════

import { SCHEMA_VERSIONS, getVersion, type DimKey } from "../data.js";
import { dimBadge } from "../utils/badge.js";
import {
  WeightedIndex,
  calcAddressRanges,
  mergeRanges,
  intersectRanges,
  subtractRanges,
  containsAddress,
  positionsToConstraint,
  complementRanges,
  type CoordConstraint,
} from "weighted-index";

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
    <div class="concept-dim-sep"></div>
    ${buildCrossIndexMigration()}
    <div class="concept-dim-sep"></div>
    ${buildAddressStateGate()}
    <div class="concept-dim-sep"></div>
    ${buildSparseMigrationWarning()}
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
        const vals = Array.from(set ?? []).map((v) => dimBadge(dim as DimKey, v)).join(" ");
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

// ── 5. 크로스 인덱스 마이그레이션 ────────────────────────────────────────────

// Demo indices — self-contained, no external registry dependency
interface CiDimDef { id: string; label: string; entries: string[] }
interface CiIndexDef {
  id: string; label: string;
  dims: CiDimDef[]; wi: WeightedIndex;
}

const CI_ROLE_ENTRIES  = ["admin", "editor", "viewer"];
const CI_ACTION_ENTRIES = ["read", "write", "delete"];
const CI_RESOURCE_ENTRIES = ["posts", "comments", "users"];

const CI_INDICES: CiIndexDef[] = [
  {
    id: "perm", label: "perm (2D: role x action)",
    dims: [
      { id: "role", label: "역할", entries: CI_ROLE_ENTRIES },
      { id: "action", label: "액션", entries: CI_ACTION_ENTRIES },
    ],
    wi: new WeightedIndex([3, 3], ["role", "action"]),
  },
  {
    id: "perm_full", label: "perm_full (3D: role x action x resource)",
    dims: [
      { id: "role", label: "역할", entries: CI_ROLE_ENTRIES },
      { id: "action", label: "액션", entries: CI_ACTION_ENTRIES },
      { id: "resource", label: "리소스", entries: CI_RESOURCE_ENTRIES },
    ],
    wi: new WeightedIndex([3, 3, 3], ["role", "action", "resource"]),
  },
];

function getCiIndex(id: string): CiIndexDef {
  return CI_INDICES.find((idx) => idx.id === id) ?? CI_INDICES[0];
}

function buildCrossIndexMigration(): string {
  const sourceOpts = CI_INDICES.map((idx) =>
    `<option value="${idx.id}">${idx.label}</option>`
  ).join("");
  const targetOpts = CI_INDICES.map((idx, i) =>
    `<option value="${idx.id}"${i === 1 ? " selected" : ""}>${idx.label}</option>`
  ).join("");

  return `
    <h2 class="concept-section-title">크로스 인덱스 마이그레이션</h2>
    <p class="concept-desc">
      서로 다른 인덱스 간에 주소를 변환합니다. 겹치는 차원(dim)은 자동으로 전이(carry-over)되고,
      target에만 있는 새 차원은 사용자가 값을 선택해 보완(complete)합니다.
      반대로, source에만 있는 차원은 자동으로 버려집니다.
    </p>

    <div class="insight-box">
      <span class="insight-icon">🔑</span>
      <span>
        <strong>동작 원리:</strong>
        <code>source.decode → entity IDs → 겹치는 dim carry-over → missing dim 보완 → target.encode</code><br/>
        <code>migrateCrossIndex()</code>는 누락 dim이 있으면 <code>{ complete: false, partial }</code>를 반환하고,
        <code>completeCrossIndex()</code>로 보완합니다.
      </span>
    </div>

    <div class="concept-block">
      <div class="cb-header">크로스 인덱스 데모 <span class="cb-badge">2D ↔ 3D</span></div>
      <div class="cb-body">
        <div class="recalc-form">
          <div class="recalc-row">
            <label class="recalc-label">Source</label>
            <select class="recalc-sel" id="ci-source">${sourceOpts}</select>
          </div>
          <div id="ci-source-dims" class="ci-dim-row"></div>
          <div class="recalc-row" style="margin-top:8px">
            <label class="recalc-label">Target</label>
            <select class="recalc-sel" id="ci-target">${targetOpts}</select>
          </div>
          <div id="ci-missing-dims" class="ci-dim-row"></div>
          <div style="margin-top:10px">
            <button class="recalc-btn" id="ci-run">마이그레이션</button>
          </div>
        </div>
        <div id="ci-result" class="recalc-result"></div>
      </div>
    </div>
  `;
}

// ── 6. 주소 상태 게이트 ─────────────────────────────────────────────────────

function buildAddressStateGate(): string {
  return `
    <h2 class="concept-section-title">주소 상태 게이트</h2>
    <p class="concept-desc">
      각 주소는 <strong>4가지 상태</strong> 중 하나입니다.
      encode(쓰기) 허용 여부와 decode(읽기) 허용 여부의 조합으로 결정됩니다.
      composite 주소의 게이트는 각 dim 게이트의 AND입니다.
    </p>

    <div class="concept-block">
      <div class="cb-header">4-상태 매트릭스</div>
      <div class="cb-body">
        <table class="nd-table">
          <thead>
            <tr><th>상태</th><th>encode</th><th>decode</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="gate-badge gate-active">active</span></td>
              <td class="td-num" style="color:#217346">✓</td>
              <td class="td-num" style="color:#217346">✓</td>
              <td>정상 — 읽기/쓰기 모두 허용</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-inactive">inactive</span></td>
              <td class="td-num" style="color:#922b21">✗</td>
              <td class="td-num" style="color:#217346">✓</td>
              <td>기존 데이터 조회만 — 새 값 추가 불가</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-open">open</span></td>
              <td class="td-num" style="color:#217346">✓</td>
              <td class="td-num" style="color:#922b21">✗</td>
              <td>빈 슬롯 — 값 채울 수 있지만, 아직 값 없음 (shouldVerify = true)</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-reserved">reserved</span></td>
              <td class="td-num" style="color:#922b21">✗</td>
              <td class="td-num" style="color:#922b21">✗</td>
              <td>완전 잠금 — 읽기/쓰기 모두 차단</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">합성 규칙 (AND)</div>
      <div class="cb-body">
        <div class="insight-box" style="margin:0">
          <span class="insight-icon">🔑</span>
          <span>
            <strong>composite 주소의 게이트 = 각 dim 게이트의 AND.</strong><br/>
            어느 dim이라도 encode를 막으면 composite도 encode 차단.<br/>
            어느 dim이라도 decode를 막으면 composite도 decode 차단.<br/>
            예: <span class="gate-badge gate-inactive">inactive</span> dim +
            <span class="gate-badge gate-open">open</span> dim →
            encode ✗ AND decode ✗ →
            <span class="gate-badge gate-reserved">reserved</span>로 승격
          </span>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">
        인터랙티브 그리드 — resource(5) × env(3)
        <span class="cb-badge">15개 주소</span>
      </div>
      <div class="cb-body">
        <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 10px">
          resource 또는 env 포지션의 상태를 변경하면 composite 주소 그리드가 업데이트됩니다.
        </p>
        <div class="gate-controls">
          <div class="gate-control-group">
            <span class="gate-control-label">resource 상태</span>
            <div id="gate-resource-ctrls" class="gate-ctrl-row"></div>
          </div>
          <div class="gate-control-group">
            <span class="gate-control-label">env 상태</span>
            <div id="gate-env-ctrls" class="gate-ctrl-row"></div>
          </div>
        </div>
        <div id="gate-grid" class="gate-grid-wrap"></div>
        <div class="gate-legend">
          <span class="gate-legend-item"><span class="gate-swatch gate-active"></span> active</span>
          <span class="gate-legend-item"><span class="gate-swatch gate-inactive"></span> inactive</span>
          <span class="gate-legend-item"><span class="gate-swatch gate-open"></span> open</span>
          <span class="gate-legend-item"><span class="gate-swatch gate-reserved"></span> reserved</span>
        </div>
        <div id="gate-range-summary" class="gate-range-summary" style="margin-top:14px"></div>
      </div>
    </div>
  `;
}

// ── 7. 희소 마이그레이션 맵 경고 ────────────────────────────────────────────

function buildSparseMigrationWarning(): string {
  return `
    <h2 class="concept-section-title">희소 마이그레이션 맵 경고</h2>
    <p class="concept-desc">
      <code>traceMigration()</code>은 dim snapshot 간 position을 추적할 때,
      <strong>indexMap에 명시되지 않은 위치는 identity(동일 index)로 처리</strong>합니다.
      이는 entry가 같은 위치에 있으면 명시할 필요가 없어 효율적이지만,
      실제로 위치가 바뀐 entry를 맵에 누락하면 <strong>silent data corruption</strong>이 발생합니다.
    </p>

    <div class="concept-block">
      <div class="cb-header">identity fallback 동작</div>
      <div class="cb-body">
        <div class="insight-box" style="margin:0 0 14px">
          <span class="insight-icon">🔑</span>
          <span>
            <code>mig.indexMap[position] ?? position</code> — 맵에 없으면 position을 그대로 반환.<br/>
            이 설계는 변경되지 않은 entry를 일일이 <code>{ 1→1, 4→4, ... }</code>로 쓰지 않아도 되게 합니다.<br/>
            하지만, <strong>실제로 위치가 바뀐 entry를 맵에 누락하면 잘못된 값이 silent하게 반환</strong>됩니다.
          </span>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">마이그레이션 시각화 <span class="cb-badge">v1 → v2</span></div>
      <div class="cb-body">
        <div class="sparse-example">
          <div class="sparse-col">
            <div class="sparse-col-header">v1 entries</div>
            <div class="sparse-slot" data-pos="1"><span class="sparse-pos">1</span><span class="sparse-val">A</span></div>
            <div class="sparse-slot" data-pos="2"><span class="sparse-pos">2</span><span class="sparse-val sparse-val-moved">B</span></div>
            <div class="sparse-slot" data-pos="3"><span class="sparse-pos">3</span><span class="sparse-val sparse-val-moved">C</span></div>
          </div>
          <div class="sparse-arrows">
            <div class="sparse-arrow-row">
              <span class="sparse-arrow-line">→</span>
              <span class="sparse-arrow-note">identity (1→1)</span>
            </div>
            <div class="sparse-arrow-row sparse-arrow-mapped">
              <span class="sparse-arrow-line sparse-arrow-cross">↘</span>
              <span class="sparse-arrow-note">map: 2→3</span>
            </div>
            <div class="sparse-arrow-row sparse-arrow-mapped">
              <span class="sparse-arrow-line sparse-arrow-cross">↗</span>
              <span class="sparse-arrow-note">map: 3→2</span>
            </div>
          </div>
          <div class="sparse-col">
            <div class="sparse-col-header">v2 entries</div>
            <div class="sparse-slot" data-pos="1"><span class="sparse-pos">1</span><span class="sparse-val">A</span></div>
            <div class="sparse-slot" data-pos="2"><span class="sparse-pos">2</span><span class="sparse-val sparse-val-moved">C</span></div>
            <div class="sparse-slot" data-pos="3"><span class="sparse-pos">3</span><span class="sparse-val sparse-val-moved">B</span></div>
            <div class="sparse-slot sparse-slot-new" data-pos="4"><span class="sparse-pos">4</span><span class="sparse-val">D</span> <span class="new-tag">NEW</span></div>
          </div>
        </div>

        <div style="margin-top:16px">
          <table class="nd-table">
            <thead>
              <tr><th>시나리오</th><th>position 2 (B in v1)</th><th>position 3 (C in v1)</th><th>결과</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="gate-badge gate-reserved" style="font-size:0.7rem">불완전한 맵</span> <code>{}</code></td>
                <td class="sparse-cell-danger">pos 2 → pos 2 (C in v2)</td>
                <td class="sparse-cell-danger">pos 3 → pos 3 (B in v2)</td>
                <td style="color:#922b21;font-weight:600">Silent corruption</td>
              </tr>
              <tr>
                <td><span class="gate-badge gate-active" style="font-size:0.7rem">완전한 맵</span> <code>{ 2→3, 3→2 }</code></td>
                <td class="sparse-cell-safe">pos 2 → pos 3 (B in v2)</td>
                <td class="sparse-cell-safe">pos 3 → pos 2 (C in v2)</td>
                <td style="color:#217346;font-weight:600">Correct</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="insight-box" style="margin-top:14px;border-color:#f0b0b0;background:#fff5f5">
          <span class="insight-icon">⚠</span>
          <span>
            <strong>주의:</strong> position 1(A)은 두 스냅샷에서 같은 위치이므로 맵에 명시하지 않아도 됩니다.
            하지만 position 2와 3은 entry가 서로 교체되었으므로 <strong>반드시</strong> <code>{ 2→3, 3→2 }</code>를 명시해야 합니다.
            누락 시 identity fallback에 의해 B→C, C→B로 잘못 매핑됩니다.
          </span>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">인터랙티브 맵 검증기</div>
      <div class="cb-body">
        <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 10px">
          position별 매핑을 토글하여 incomplete map이 어떤 결과를 만드는지 확인합니다.
        </p>
        <div class="sparse-demo-grid">
          <div class="sparse-demo-header">
            <span class="sparse-demo-h-v1">v1</span>
            <span class="sparse-demo-h-arrow"></span>
            <span class="sparse-demo-h-v2">v2 target</span>
            <span class="sparse-demo-h-toggle">맵 포함</span>
            <span class="sparse-demo-h-result">결과</span>
          </div>
          <div id="sparse-demo-rows"></div>
        </div>
        <div id="sparse-demo-summary" style="margin-top:10px"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
//  Demo wiring
// ─────────────────────────────────────────────────────────────────────────

function wireDemo(container: HTMLElement): void {
  const fromSel = container.querySelector<HTMLSelectElement>("#rc-from");
  const toSel   = container.querySelector<HTMLSelectElement>("#rc-to");
  const idInput = container.querySelector<HTMLInputElement>("#rc-id");
  const runBtn  = container.querySelector<HTMLButtonElement>("#rc-run");
  const result  = container.querySelector<HTMLDivElement>("#rc-result");
  if (!fromSel || !toSel || !idInput || !runBtn || !result) return;

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

  // ── Section 5: Cross-index migration wiring ────────────────────────────
  wireCrossIndexDemo(container);

  // ── Section 6: Address state gate wiring ───────────────────────────────
  wireAddressStateGate(container);

  // ── Section 7: Sparse migration warning wiring ─────────────────────────
  wireSparseMigrationDemo(container);
}

// ─────────────────────────────────────────────────────────────────────────
//  Section 5 wiring — Cross-index migration
// ─────────────────────────────────────────────────────────────────────────

function wireCrossIndexDemo(container: HTMLElement): void {
  const sourceSel  = container.querySelector<HTMLSelectElement>("#ci-source");
  const targetSel  = container.querySelector<HTMLSelectElement>("#ci-target");
  const srcDimsDiv = container.querySelector<HTMLDivElement>("#ci-source-dims");
  const missDimsDiv = container.querySelector<HTMLDivElement>("#ci-missing-dims");
  const runBtn     = container.querySelector<HTMLButtonElement>("#ci-run");
  const resultDiv  = container.querySelector<HTMLDivElement>("#ci-result");
  if (!sourceSel || !targetSel || !srcDimsDiv || !missDimsDiv || !runBtn || !resultDiv) return;

  function buildSourceDimSelectors(): void {
    const src = getCiIndex(sourceSel.value);
    srcDimsDiv.innerHTML = src.dims.map((d) => `
      <div style="display:inline-flex;align-items:center;gap:4px;margin:4px 6px 4px 0">
        <label class="recalc-label">${d.label}:</label>
        <select class="recalc-sel ci-src-dim" data-dim="${d.id}">
          ${d.entries.map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
    `).join("");
    updateMissingDims();
  }

  function updateMissingDims(): void {
    const src = getCiIndex(sourceSel.value);
    const tgt = getCiIndex(targetSel.value);
    const srcDimIds = new Set(src.dims.map((d) => d.id));
    const missing = tgt.dims.filter((d) => !srcDimIds.has(d.id));

    if (missing.length === 0) {
      missDimsDiv.innerHTML = '<span style="font-size:0.72rem;color:var(--text-muted);margin:4px 0">누락 dim 없음 — 모든 dim이 source에서 carry-over됩니다.</span>';
    } else {
      missDimsDiv.innerHTML = missing.map((d) => `
        <div style="display:inline-flex;align-items:center;gap:4px;margin:4px 6px 4px 0">
          <label class="recalc-label" style="color:#c05000">${d.label} (누락):</label>
          <select class="recalc-sel ci-miss-dim" data-dim="${d.id}">
            ${d.entries.map((e) => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </div>
      `).join("");
    }
  }

  function run(): void {
    const src = getCiIndex(sourceSel.value);
    const tgt = getCiIndex(targetSel.value);

    // Collect source coords
    const srcDimSels = srcDimsDiv.querySelectorAll<HTMLSelectElement>(".ci-src-dim");
    const sourceEntities: Record<string, string> = {};
    srcDimSels.forEach((sel) => {
      const dim = sel.dataset.dim;
      if (dim) sourceEntities[dim] = sel.value;
    });

    // Encode source
    const srcCoords = src.dims.map((d) => {
      const idx = d.entries.indexOf(sourceEntities[d.id]);
      return idx + 1;
    });
    const srcValue = src.wi.encode(srcCoords);

    // Carry-over
    const srcDimIds = new Set(src.dims.map((d) => d.id));
    const tgtDimIds = new Set(tgt.dims.map((d) => d.id));
    const carryOver: Record<string, string> = {};
    const droppedDims: string[] = [];
    for (const d of src.dims) {
      if (tgtDimIds.has(d.id)) {
        carryOver[d.id] = sourceEntities[d.id];
      } else {
        droppedDims.push(d.id);
      }
    }
    const missingDimIds = tgt.dims.filter((d) => !srcDimIds.has(d.id)).map((d) => d.id);

    // Collect missing dim values
    const missingEntities: Record<string, string> = {};
    const missDimSels = missDimsDiv.querySelectorAll<HTMLSelectElement>(".ci-miss-dim");
    missDimSels.forEach((sel) => {
      const dim = sel.dataset.dim;
      if (dim) missingEntities[dim] = sel.value;
    });

    // Merge all entities for target
    const allEntities = { ...carryOver, ...missingEntities };
    const tgtCoords = tgt.dims.map((d) => {
      const idx = d.entries.indexOf(allEntities[d.id]);
      return idx + 1;
    });
    const tgtValue = tgt.wi.encode(tgtCoords);

    // Build source entity display
    const srcEntityHtml = src.dims.map((d) =>
      `<span class="lib-badge" style="background:#dce6f1;color:#1f497d">${d.id}:${sourceEntities[d.id]}</span>`
    ).join(" ");

    // Build carry-over display
    const carryHtml = Object.entries(carryOver).map(([k, v]) =>
      `<span class="lib-badge" style="background:#e2efda;color:#375623">${k}=${v}</span>`
    ).join(" ");

    const droppedHtml = droppedDims.length > 0
      ? droppedDims.map((d) =>
          `<span class="lib-badge" style="background:#fde9e9;color:#922b21">${d} (drop)</span>`
        ).join(" ")
      : "";

    const missingHtml = missingDimIds.length > 0
      ? missingDimIds.map((d) =>
          `<span class="lib-badge" style="background:#fff2cc;color:#7f6000">${d}=${missingEntities[d]}</span>`
        ).join(" ")
      : "";

    // Build target entity display
    const tgtEntityHtml = tgt.dims.map((d) =>
      `<span class="lib-badge" style="background:#dce6f1;color:#1f497d">${d.id}:${allEntities[d.id]}</span>`
    ).join(" ");

    resultDiv.innerHTML = `
      <div class="recalc-steps">
        <div class="rc-step">
          <span class="rc-step-num">①</span>
          <span class="rc-step-label">Source (${src.id}:v1)</span>
          <span>value <code class="rc-code">${srcValue}</code> → ${srcEntityHtml}</span>
        </div>
        <div class="rc-arrow">↓ decode → entity IDs</div>
        <div class="rc-step">
          <span class="rc-step-num">②</span>
          <span class="rc-step-label">Carry-over</span>
          <span class="rc-coords">
            ${carryHtml}
            ${droppedHtml ? `<span style="margin-left:6px">${droppedHtml}</span>` : ""}
          </span>
        </div>
        ${missingDimIds.length > 0 ? `
        <div class="rc-arrow">↓ missing dim: ${missingDimIds.join(", ")} — 값 선택 필요</div>
        <div class="rc-step">
          <span class="rc-step-num">③</span>
          <span class="rc-step-label">Fill missing</span>
          <span class="rc-coords">${missingHtml}</span>
        </div>
        <div class="rc-arrow">↓ encode → target</div>
        <div class="rc-step">
          <span class="rc-step-num">④</span>
          <span class="rc-step-label">Target (${tgt.id}:v1)</span>
          <span>value <code class="rc-code">${tgtValue}</code> → ${tgtEntityHtml}</span>
        </div>
        ` : `
        <div class="rc-arrow">↓ encode → target (누락 dim 없음, 바로 완성)</div>
        <div class="rc-step">
          <span class="rc-step-num">③</span>
          <span class="rc-step-label">Target (${tgt.id}:v1)</span>
          <span>value <code class="rc-code">${tgtValue}</code> → ${tgtEntityHtml}</span>
        </div>
        `}
      </div>
    `;
  }

  sourceSel.addEventListener("change", buildSourceDimSelectors);
  targetSel.addEventListener("change", updateMissingDims);
  runBtn.addEventListener("click", run);
  buildSourceDimSelectors();
  run();
}

// ─────────────────────────────────────────────────────────────────────────
//  Section 6 wiring — Address state gate
// ─────────────────────────────────────────────────────────────────────────

type GateState = "active" | "inactive" | "open";

function wireAddressStateGate(container: HTMLElement): void {
  const RESOURCE_COUNT = 5;
  const ENV_COUNT = 3;
  const SHAPE: readonly number[] = [RESOURCE_COUNT, ENV_COUNT];
  const CAPACITY = RESOURCE_COUNT * ENV_COUNT;
  const RESOURCE_NAMES = ["posts", "comments", "users", "files", "logs"];
  const ENV_NAMES = ["prod", "staging", "dev"];

  // Per-dim state (active by default)
  const resourceStates: GateState[] = Array(RESOURCE_COUNT).fill("active");
  const envStates: GateState[] = Array(ENV_COUNT).fill("active");

  // Pre-set defaults: resource 4-5 inactive, env 3 open
  resourceStates[3] = "inactive";
  resourceStates[4] = "inactive";
  envStates[2] = "open";

  const resCtrls = container.querySelector<HTMLDivElement>("#gate-resource-ctrls");
  const envCtrls = container.querySelector<HTMLDivElement>("#gate-env-ctrls");
  const gridDiv  = container.querySelector<HTMLDivElement>("#gate-grid");
  const summaryDiv = container.querySelector<HTMLDivElement>("#gate-range-summary");
  if (!resCtrls || !envCtrls || !gridDiv || !summaryDiv) return;

  function buildControls(): void {
    resCtrls.innerHTML = RESOURCE_NAMES.map((name, i) => `
      <div class="gate-ctrl-item">
        <span class="gate-ctrl-name">${name}</span>
        <select class="recalc-sel gate-dim-sel" data-dim="resource" data-idx="${i}">
          <option value="active"${resourceStates[i] === "active" ? " selected" : ""}>active</option>
          <option value="inactive"${resourceStates[i] === "inactive" ? " selected" : ""}>inactive</option>
          <option value="open"${resourceStates[i] === "open" ? " selected" : ""}>open</option>
        </select>
      </div>
    `).join("");

    envCtrls.innerHTML = ENV_NAMES.map((name, i) => `
      <div class="gate-ctrl-item">
        <span class="gate-ctrl-name">${name}</span>
        <select class="recalc-sel gate-dim-sel" data-dim="env" data-idx="${i}">
          <option value="active"${envStates[i] === "active" ? " selected" : ""}>active</option>
          <option value="inactive"${envStates[i] === "inactive" ? " selected" : ""}>inactive</option>
          <option value="open"${envStates[i] === "open" ? " selected" : ""}>open</option>
        </select>
      </div>
    `).join("");

    container.querySelectorAll<HTMLSelectElement>(".gate-dim-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const dim = sel.dataset.dim ?? "";
        const idx = Number(sel.dataset.idx);
        const val = sel.value as GateState;
        if (dim === "resource") resourceStates[idx] = val;
        else envStates[idx] = val;
        renderGrid();
      });
    });
  }

  /** Collect 1-based positions matching a given gate state from a states array. */
  function positionsWithState(states: GateState[], target: GateState): number[] {
    return states.reduce<number[]>((acc, s, i) => {
      if (s === target) acc.push(i + 1); // 1-based coordinate
      return acc;
    }, []);
  }

  /** Build address ranges for positions of a given state in the specified dimension. */
  function rangesForDimState(dimIndex: number, states: GateState[], target: GateState): [number, number][] {
    const positions = positionsWithState(states, target);
    if (positions.length === 0) return [];
    const constraints: CoordConstraint[] = SHAPE.map(() => null);
    constraints[dimIndex] = positionsToConstraint(positions);
    return calcAddressRanges([...SHAPE], constraints);
  }

  function computeRanges(): {
    inactiveRanges: [number, number][];
    openRanges: [number, number][];
    reservedRanges: [number, number][];
    activeRanges: [number, number][];
  } {
    // Inactive ranges: addresses where any dim is "inactive"
    // → union of resource-inactive ranges and env-inactive ranges
    const resInactiveRanges = rangesForDimState(0, resourceStates, "inactive");
    const envInactiveRanges = rangesForDimState(1, envStates, "inactive");
    const allInactiveRanges = mergeRanges([...resInactiveRanges, ...envInactiveRanges]);

    // Open ranges: addresses where any dim is "open"
    const resOpenRanges = rangesForDimState(0, resourceStates, "open");
    const envOpenRanges = rangesForDimState(1, envStates, "open");
    const allOpenRanges = mergeRanges([...resOpenRanges, ...envOpenRanges]);

    // Reserved = inactive AND open (both encode and decode blocked)
    // An address is reserved if it has at least one inactive dim AND at least one open dim
    const reservedRanges = intersectRanges(allInactiveRanges, allOpenRanges);

    // Pure inactive = inactive addresses minus reserved
    const inactiveRanges = subtractRanges(allInactiveRanges, reservedRanges);

    // Pure open = open addresses minus reserved
    const openRanges = subtractRanges(allOpenRanges, reservedRanges);

    // Active = complement of (inactive + open + reserved)
    const allNonActive = mergeRanges([...inactiveRanges, ...openRanges, ...reservedRanges]);
    const activeRanges = complementRanges(CAPACITY, allNonActive);

    return { inactiveRanges, openRanges, reservedRanges, activeRanges };
  }

  function stateForAddress(
    addr: number,
    ranges: ReturnType<typeof computeRanges>,
  ): string {
    if (containsAddress(addr, ranges.reservedRanges)) return "reserved";
    if (containsAddress(addr, ranges.inactiveRanges)) return "inactive";
    if (containsAddress(addr, ranges.openRanges)) return "open";
    return "active";
  }

  function formatRanges(ranges: [number, number][]): string {
    if (ranges.length === 0) return "(없음)";
    return ranges.map(([f, t]) => f === t ? `${f}` : `${f}-${t}`).join(", ");
  }

  function rangeAddressCount(ranges: [number, number][]): number {
    return ranges.reduce((sum, [f, t]) => sum + (t - f + 1), 0);
  }

  function renderGrid(): void {
    const ranges = computeRanges();

    // Header row
    let html = '<table class="gate-table"><thead><tr><th class="gate-corner"></th>';
    for (let e = 0; e < ENV_COUNT; e++) {
      const cls = envStates[e] === "active" ? "" : ` gate-th-${envStates[e]}`;
      html += `<th class="gate-th${cls}">${ENV_NAMES[e]}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (let r = 0; r < RESOURCE_COUNT; r++) {
      const rhCls = resourceStates[r] === "active" ? "" : ` gate-th-${resourceStates[r]}`;
      html += `<tr><td class="gate-rh${rhCls}">${RESOURCE_NAMES[r]}</td>`;
      for (let e = 0; e < ENV_COUNT; e++) {
        const addr = r * ENV_COUNT + e;
        const state = stateForAddress(addr, ranges);
        const verify = state === "open" ? '<span class="gate-verify">verify</span>' : "";
        html += `<td class="gate-cell gate-cell-${state}">
          <span class="gate-addr">${addr}</span>
          <span class="gate-state-label">${state}</span>
          ${verify}
        </td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    gridDiv.innerHTML = html;

    // Range summary panel
    if (summaryDiv) {
      summaryDiv.innerHTML = `
        <div class="plan-ver-range-title" style="margin-bottom:8px">
          range 기반 상태 분석 — calcAddressRanges + 집합 연산
        </div>
        <table class="nd-table" style="margin-bottom:10px">
          <thead>
            <tr><th>상태</th><th>주소 범위</th><th>주소 수</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="gate-badge gate-active">active</span></td>
              <td style="font-family:monospace;font-size:0.72rem">[${formatRanges(ranges.activeRanges)}]</td>
              <td class="td-num">${rangeAddressCount(ranges.activeRanges)}</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-inactive">inactive</span></td>
              <td style="font-family:monospace;font-size:0.72rem">[${formatRanges(ranges.inactiveRanges)}]</td>
              <td class="td-num">${rangeAddressCount(ranges.inactiveRanges)}</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-open">open</span></td>
              <td style="font-family:monospace;font-size:0.72rem">[${formatRanges(ranges.openRanges)}]</td>
              <td class="td-num">${rangeAddressCount(ranges.openRanges)}</td>
            </tr>
            <tr>
              <td><span class="gate-badge gate-reserved">reserved</span></td>
              <td style="font-family:monospace;font-size:0.72rem">[${formatRanges(ranges.reservedRanges)}]</td>
              <td class="td-num">${rangeAddressCount(ranges.reservedRanges)}</td>
            </tr>
            <tr style="font-weight:700;border-top:2px solid var(--border-header)">
              <td>합계</td>
              <td></td>
              <td class="td-num">${CAPACITY}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:0.7rem;color:var(--text-muted);line-height:1.6">
          <code>inactive = union(resInactive, envInactive) \\ reserved</code><br/>
          <code>open = union(resOpen, envOpen) \\ reserved</code><br/>
          <code>reserved = intersect(allInactive, allOpen)</code><br/>
          <code>active = complement(inactive + open + reserved)</code>
        </div>
      `;
    }
  }

  buildControls();
  renderGrid();
}

// ─────────────────────────────────────────────────────────────────────────
//  Section 7 wiring — Sparse migration demo
// ─────────────────────────────────────────────────────────────────────────

function wireSparseMigrationDemo(container: HTMLElement): void {
  const rowsDiv   = container.querySelector<HTMLDivElement>("#sparse-demo-rows");
  const summaryDiv = container.querySelector<HTMLDivElement>("#sparse-demo-summary");
  if (!rowsDiv || !summaryDiv) return;

  // v1: [A, B, C]  →  v2: [A, C, B, D]
  // Correct map: { 2→3, 3→2 }  (B and C swapped)
  const v1Entries = ["A", "B", "C"];
  const v2Entries = ["A", "C", "B", "D"];
  const correctMap: Record<number, number> = { 2: 3, 3: 2 };
  const mapEnabled = [false, true, true]; // pos 1 = identity (no need), pos 2-3 = mapped

  function render(): void {
    rowsDiv.innerHTML = v1Entries.map((entry, i) => {
      const pos = i + 1;
      const targetPos = mapEnabled[i] ? (correctMap[pos] ?? pos) : pos;
      const targetEntry = v2Entries[targetPos - 1];
      const isCorrect = targetEntry === entry;
      const needsMap = correctMap[pos] !== undefined;

      return `
        <div class="sparse-demo-row">
          <span class="sparse-demo-v1">
            <span class="sparse-pos">${pos}</span>
            <span class="sparse-val${needsMap ? " sparse-val-moved" : ""}">${entry}</span>
          </span>
          <span class="sparse-demo-arrow">→</span>
          <span class="sparse-demo-v2">
            <span class="sparse-pos">${targetPos}</span>
            <span class="sparse-val${needsMap ? " sparse-val-moved" : ""}">${targetEntry}</span>
          </span>
          <span class="sparse-demo-toggle">
            ${needsMap
              ? `<label class="sparse-toggle-label">
                  <input type="checkbox" class="sparse-toggle-cb" data-idx="${i}"
                    ${mapEnabled[i] ? "checked" : ""} />
                  ${pos}→${correctMap[pos]}
                </label>`
              : `<span style="font-size:0.7rem;color:var(--text-muted)">identity</span>`
            }
          </span>
          <span class="sparse-demo-result ${isCorrect ? "sparse-cell-safe" : "sparse-cell-danger"}">
            ${isCorrect ? `${entry}→${targetEntry} ✓` : `${entry}→${targetEntry} ✗`}
          </span>
        </div>
      `;
    }).join("");

    // Summary
    const allCorrect = v1Entries.every((entry, i) => {
      const pos = i + 1;
      const targetPos = mapEnabled[i] ? (correctMap[pos] ?? pos) : pos;
      return v2Entries[targetPos - 1] === entry;
    });

    const currentMap: Record<number, number> = {};
    v1Entries.forEach((_, i) => {
      const pos = i + 1;
      if (mapEnabled[i] && correctMap[pos] !== undefined) {
        currentMap[pos] = correctMap[pos];
      }
    });
    const mapStr = Object.keys(currentMap).length > 0
      ? `{ ${Object.entries(currentMap).map(([k, v]) => `${k}→${v}`).join(", ")} }`
      : "{ } (빈 맵)";

    summaryDiv.innerHTML = `
      <div class="insight-box" style="margin:0;${allCorrect ? "" : "border-color:#f0b0b0;background:#fff5f5"}">
        <span class="insight-icon">${allCorrect ? "✅" : "⚠"}</span>
        <span>
          <strong>현재 indexMap:</strong> <code>${mapStr}</code><br/>
          ${allCorrect
            ? "모든 entry가 올바른 position으로 매핑됩니다."
            : '<span style="color:#922b21">일부 entry가 잘못된 position으로 매핑됩니다. 누락된 매핑을 추가하세요.</span>'
          }
        </span>
      </div>
    `;

    // Wire toggle checkboxes
    rowsDiv.querySelectorAll<HTMLInputElement>(".sparse-toggle-cb").forEach((cb) => {
      cb.addEventListener("change", () => {
        const idx = Number(cb.dataset.idx);
        mapEnabled[idx] = cb.checked;
        render();
      });
    });
  }

  render();
}
