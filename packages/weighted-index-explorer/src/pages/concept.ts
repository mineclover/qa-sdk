import {
  RESOURCES, ACTIONS, ROLES, ENVS, WI4, WEIGHTS4,
  RESOURCE_KO, ACTION_KO,
} from "../data.js";
import {
  RESOURCE_FILL, RESOURCE_INK,
  ACTION_FILL, ACTION_INK,
  ROLE_FILL, ROLE_INK,
  ENV_FILL, ENV_INK,
} from "../utils/colors.js";
import { WeightedIndex } from "weighted-index";
import { colLetter } from "weighted-ui";

// ── Page router ───────────────────────────────────────────────────────────

export type ConceptPage = "dim1" | "dim2" | "dim3" | "dim4";

export function renderConcept(container: HTMLElement, page: ConceptPage): void {
  const html = {
    dim1: renderDim1,
    dim2: renderDim2,
    dim3: renderDim3,
    dim4: renderDim4,
  }[page]();

  container.innerHTML = `<div class="concept-wrap">${html}</div>`;
}

/** 개념 탭 — 차원 1~4 단일 스크롤 페이지 */
export function renderConceptAll(container: HTMLElement): void {
  const sep = `<div class="concept-dim-sep"></div>`;
  const html = renderDim1() + sep + renderDim2() + sep + renderDim3() + sep + renderDim4();
  container.innerHTML = `<div class="concept-wrap">${html}</div>`;
}

// ═════════════════════════════════════════════════════════════════════════
//  차원 1 — resource (8개)
// ═════════════════════════════════════════════════════════════════════════

function renderDim1(): string {
  const cells = RESOURCES.map((res, i) => {
    const fill = RESOURCE_FILL[res] ?? "#f2f2f2";
    const ink  = RESOURCE_INK[res]  ?? "#595959";
    return `
      <div class="c1d-cell" style="border-top-color:${ink}">
        <div class="c1d-idx" style="color:${ink}">${colLetter(i)}</div>
        <div class="c1d-id">${i}</div>
        <div class="c1d-name" style="background:${fill};color:${ink}">${res}</div>
        <div class="c1d-ko">${RESOURCE_KO[res]}</div>
      </div>
    `;
  }).join("");

  return `
    <h2 class="concept-section-title">차원 1 — 리소스 (resource)</h2>
    <p class="concept-desc">
      8가지 리소스 유형 각각에 0부터 7까지 고유한 정수 인덱스를 부여합니다.
      <code>shape = [8]</code>, 인덱스 범위 <code>0 ~ 7</code>.
    </p>

    <div class="xl-formula-block">
      <span class="xlf-label">공식</span>
      <span class="xlf-expr">encode([x₁]) = x₁ − 1</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-expr">decode(id) → x₁ = id + 1</span>
    </div>

    <div class="concept-block">
      <div class="cb-header">
        리소스 유형 인덱스 매핑
        <span class="cb-badge">size = 8</span>
      </div>
      <div class="cb-body">
        <div class="c1d-row">${cells}</div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">인코딩 / 디코딩 예시</div>
      <div class="cb-body">
        <table class="ev-tbl" style="max-width:480px">
          <thead><tr>
            <th>resource</th><th>한국어</th><th>x₁</th><th>encode(x₁)</th><th>decode(id)</th>
          </tr></thead>
          <tbody>${RESOURCES.map((res, i) => `
            <tr>
              <td class="td-key">${res}</td>
              <td>${RESOURCE_KO[res]}</td>
              <td class="td-num">${i + 1}</td>
              <td class="td-num td-id2">${i}</td>
              <td class="td-num">${i + 1}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </div>

    <div class="insight-box">
      <span class="insight-icon">💡</span>
      <span>
        1차원에서는 단순히 <strong>0-based 인덱싱</strong>입니다.
        8개의 리소스 → 8개의 정수 [0, 7].
        아직은 복잡하지 않습니다. 다음 차원에서 조합이 시작됩니다.
      </span>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════
//  차원 2 — resource × action (8×4 = 32)
// ═════════════════════════════════════════════════════════════════════════

function renderDim2(): string {
  const wi2 = new WeightedIndex([8, 4], ["resource", "action"]);

  // Build 8×4 grid HTML
  const colHeaders = ACTIONS.map((act, xi) => {
    const fill = ACTION_FILL[act] ?? "#f2f2f2";
    const ink  = ACTION_INK[act]  ?? "#595959";
    return `<th class="mini-grid-tbl-th">
      <span class="col-letter">${colLetter(xi)}</span>
      <span style="display:block;background:${fill};color:${ink};padding:0 4px;border-radius:2px;font-weight:600">${act}</span>
      <span style="display:block;font-size:0.62rem;color:${ink};font-weight:400">${ACTION_KO[act]}</span>
    </th>`;
  }).join("");

  const rows = RESOURCES.map((res, ri) => {
    const rFill = RESOURCE_FILL[res] ?? "#f2f2f2";
    const rInk  = RESOURCE_INK[res]  ?? "#595959";
    const cells = ACTIONS.map((act, ai) => {
      const id = wi2.encode([ri + 1, ai + 1]);
      const aFill = ACTION_FILL[act] ?? "#f2f2f2";
      return `<td style="background:${aFill};text-align:center;font-weight:700;font-size:0.9rem">${id}</td>`;
    }).join("");
    return `<tr>
      <th class="mgt-rh">
        <span class="row-num">${ri + 1}</span>
        <span style="display:block;background:${rFill};color:${rInk};padding:0 3px;border-radius:2px;font-size:0.65rem;font-weight:700">${res}</span>
      </th>
      ${cells}
    </tr>`;
  }).join("");

  return `
    <h2 class="concept-section-title">차원 2 — 리소스 × 액션 (resource × action)</h2>
    <p class="concept-desc">
      2번째 차원(action)을 추가하면 8×4 = <strong>32개의 조합</strong>이 생깁니다.
      각 (resource, action) 쌍은 <strong>유일한 정수 하나</strong>로 매핑됩니다.
      <code>shape = [8, 4]</code>, 인덱스 범위 <code>0 ~ 31</code>.
    </p>

    <div class="xl-formula-block">
      <span class="xlf-label">공식</span>
      <span class="xlf-expr">id = (x₁ − 1) × N₂ + (x₂ − 1)</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-note">N₂ = 4 (액션 수)</span>
    </div>
    <div class="xl-formula-block">
      <span class="xlf-label">가중치</span>
      <span class="xlf-expr">W₁ = N₂ = 4</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-expr">W₂ = 1</span>
    </div>

    <div class="concept-block">
      <div class="cb-header">
        2D 인코딩 테이블 (행 = resource, 열 = action)
        <span class="cb-badge">32개 슬롯</span>
      </div>
      <div class="cb-body">
        <div class="mini-grid-outer">
          <table class="mini-grid-tbl">
            <thead><tr><th class="mini-grid-tbl-th"></th>${colHeaders}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="mini-note">셀 안의 숫자 = encode([resource_idx, action_idx]). 예: document(1) × write(2) = (1−1)×4 + (2−1) = 1</p>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">예시 — decode(14)</div>
      <div class="cb-body">
        <table class="formula-tbl" style="max-width:420px">
          <tr><td class="ftbl-step">id</td><td class="ftbl-expr">14</td></tr>
          <tr><td class="ftbl-step">x₁</td><td class="ftbl-expr">⌊14 / 4⌋ mod 8 + 1 = 3 mod 8 + 1 = <strong>4</strong> → ${RESOURCES[3]}</td></tr>
          <tr><td class="ftbl-step">x₂</td><td class="ftbl-expr">14 mod 4 + 1 = 2 + 1 = <strong>3</strong> → ${ACTIONS[2]}</td></tr>
          <tr><td class="ftbl-step">결과</td><td class="ftbl-result"><span style="background:${RESOURCE_FILL[RESOURCES[3]]};color:${RESOURCE_INK[RESOURCES[3]]};padding:0 5px;border-radius:2px">${RESOURCES[3]}</span> × <span style="background:${ACTION_FILL[ACTIONS[2]]};color:${ACTION_INK[ACTIONS[2]]};padding:0 5px;border-radius:2px">${ACTIONS[2]}</span></td></tr>
        </table>
      </div>
    </div>

    <div class="insight-box">
      <span class="insight-icon">💡</span>
      <span>
        2D 인코딩은 <strong>"2차원 배열을 1차원으로 펼치는 것"</strong>과 같습니다.
        행(resource) × 열(action) 구조를 순서대로 번호를 매깁니다.
        <code>resource=1, action=1</code>이면 행 0, 열 0이므로 인덱스 <strong>0</strong>.
        <code>resource=1, action=4</code>이면 행 0, 열 3이므로 인덱스 <strong>3</strong>.
      </span>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════
//  차원 3 — resource × action × role (8×4×5 = 160)
// ═════════════════════════════════════════════════════════════════════════

function renderDim3(): string {
  const wi3 = new WeightedIndex([8, 4, 5], ["resource", "action", "role"]);

  // Show 5 "slices" - one per role - each showing a mini 2×3 grid (first 2 resources × first 3 actions)
  const slices = ROLES.map((role, ri) => {
    const rFill = ROLE_FILL[role] ?? "#f2f2f2";
    const rInk  = ROLE_INK[role]  ?? "#595959";

    const colH = ACTIONS.slice(0, 3).map((act, _ai) => {
      const fill = ACTION_FILL[act] ?? "#f2f2f2";
      const ink  = ACTION_INK[act]  ?? "#595959";
      return `<th style="background:${fill};color:${ink};padding:3px 6px;font-size:0.65rem;min-width:52px">${act}</th>`;
    }).join("");

    const rows = RESOURCES.slice(0, 4).map((res, resi) => {
      const cells = ACTIONS.slice(0, 3).map((act, ai) => {
        const id = wi3.encode([resi + 1, ai + 1, ri + 1]);
        const aFill = ACTION_FILL[act] ?? "#f2f2f2";
        return `<td style="background:${aFill};text-align:center;font-weight:700;font-size:0.78rem">${id}</td>`;
      }).join("");
      const resFill = RESOURCE_FILL[res] ?? "#f2f2f2";
      const resInk  = RESOURCE_INK[res]  ?? "#595959";
      return `<tr>
        <th style="background:${resFill};color:${resInk};font-size:0.62rem;padding:2px 5px;text-align:right;border-right:1px solid #b0b0b0">${res}</th>
        ${cells}
      </tr>`;
    }).join("");

    const baseId = wi3.encode([1, 1, ri + 1]);
    const maxId  = wi3.encode([8, 4, ri + 1]);

    return `
      <div class="layer-box">
        <div class="layer-head">
          <span>레이어 ${ri + 1}: <span style="background:${rFill};color:${rInk};padding:0 5px;border-radius:2px;font-weight:600">${role}</span> (x₃=${ri + 1})</span>
          <span class="layer-range">id 범위: ${baseId} ~ ${maxId}</span>
        </div>
        <div class="cb-body" style="padding:8px">
          <div class="mini-grid-outer">
            <table class="mini-grid-tbl" style="font-size:0.72rem">
              <thead><tr><th style="min-width:72px;background:#e9e9e9;border:1px solid #b0b0b0"></th>${colH}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p class="mini-note">처음 4개 resource × 3개 action 미리보기</p>
        </div>
      </div>
    `;
  }).join('<div class="layer-arrow">↓ +32 (다음 role로 넘어감)</div>');

  return `
    <h2 class="concept-section-title">차원 3 — 리소스 × 액션 × 역할 (resource × action × role)</h2>
    <p class="concept-desc">
      3번째 차원(role)을 추가하면 2D 그리드가 <strong>5겹으로 쌓입니다</strong>.
      8×4×5 = <strong>160개의 조합</strong>.
      <code>shape = [8, 4, 5]</code>, 인덱스 범위 <code>0 ~ 159</code>.
    </p>

    <div class="xl-formula-block">
      <span class="xlf-label">공식</span>
      <span class="xlf-expr">id = (x₁−1)×20 + (x₂−1)×5 + (x₃−1)</span>
    </div>
    <div class="xl-formula-block">
      <span class="xlf-label">가중치</span>
      <span class="xlf-expr">W₁ = N₂×N₃ = 4×5 = 20</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-expr">W₂ = N₃ = 5</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-expr">W₃ = 1</span>
    </div>

    <div class="concept-block">
      <div class="cb-header">
        5개의 2D 레이어 (각 레이어 = 특정 역할의 모든 resource×action 조합)
        <span class="cb-badge">160개 슬롯</span>
      </div>
      <div class="cb-body">
        <div class="layer-demo">${slices}</div>
      </div>
    </div>

    <div class="insight-box">
      <span class="insight-icon">💡</span>
      <span>
        3D 인덱스는 <strong>"2D 그리드 책자"</strong>로 상상하세요.
        역할마다 한 페이지씩 총 5페이지. 각 페이지는 동일한 8×4 그리드.
        "3페이지(editor)의 2행(api) 3열(delete)" → id = 2×20 + 1×5 + 2 = <strong>47</strong>.
        id 47을 받으면 역방향으로 페이지=3, 행=2, 열=3을 즉시 복원할 수 있습니다.
      </span>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════
//  차원 4 — resource × action × role × env (8×4×5×4 = 640)
// ═════════════════════════════════════════════════════════════════════════

function renderDim4(): string {
  const [W1, W2, W3, W4] = WEIGHTS4;

  // Weight table
  const weightRows = [
    ["1", "resource", "8",  String(W1)],
    ["2", "action",   "4",  String(W2)],
    ["3", "role",     "5",  String(W3)],
    ["4", "env",      "4",  String(W4)],
  ].map(([i, dim, n, w]) => `
    <tr>
      <td class="td-num">${i}</td>
      <td><code>${dim}</code></td>
      <td class="td-num td-n">${n}</td>
      <td class="td-num td-w">${w}</td>
    </tr>
  `).join("");

  // Sample encode/decode examples
  const examples = [
    { coords: [1, 1, 1, 1], label: "guest가 production에서 document read" },
    { coords: [1, 1, 5, 1], label: "super_admin이 production에서 document read" },
    { coords: [6, 4, 4, 1], label: "admin이 production에서 admin_panel manage" },
    { coords: [8, 1, 5, 1], label: "super_admin이 production에서 audit_log read" },
    { coords: [3, 2, 3, 3], label: "editor가 development에서 database write" },
  ].map(({ coords, label }) => {
    const [r, a, ro, e] = coords;
    const id = WI4.encode(coords as [number,number,number,number]);
    const rName  = RESOURCES[r-1];
    const aName  = ACTIONS[a-1];
    const roName = ROLES[ro-1];
    const eName  = ENVS[e-1];
    return `
      <tr>
        <td><code style="font-size:0.68rem">[${coords.join(", ")}]</code></td>
        <td class="td-num td-id2">${id}</td>
        <td style="font-size:0.7rem">
          <span style="background:${RESOURCE_FILL[rName]};color:${RESOURCE_INK[rName]};padding:0 3px;border-radius:2px">${rName}</span>
          <span style="background:${ACTION_FILL[aName]};color:${ACTION_INK[aName]};padding:0 3px;border-radius:2px">${aName}</span>
          <span style="background:${ROLE_FILL[roName]};color:${ROLE_INK[roName]};padding:0 3px;border-radius:2px">${roName}</span>
          <span style="background:${ENV_FILL[eName]};color:${ENV_INK[eName]};padding:0 3px;border-radius:2px">${eName}</span>
        </td>
        <td style="font-size:0.7rem;color:#767676">${label}</td>
      </tr>
    `;
  }).join("");

  // Bitset explanation
  return `
    <h2 class="concept-section-title">차원 4 — 완전한 권한 시스템 (resource × action × role × env)</h2>
    <p class="concept-desc">
      4개 차원이 결합되면 8×4×5×4 = <strong>640개의 권한 조합</strong>을 표현합니다.
      모든 (리소스, 액션, 역할, 환경) 튜플은 <strong>0 ~ 639</strong> 사이의 정수 하나로
      1:1 대응됩니다. 이 번호를 배열 인덱스로 사용하면 O(1) 권한 조회가 가능합니다.
    </p>

    <div class="xl-formula-block">
      <span class="xlf-label">공식</span>
      <span class="xlf-expr">id = (x₁−1)×${W1} + (x₂−1)×${W2} + (x₃−1)×${W3} + (x₄−1)</span>
    </div>
    <div class="xl-formula-block">
      <span class="xlf-label">일반식</span>
      <span class="xlf-expr">id = Σᵢ₌₁⁴ (xᵢ − 1) × Wᵢ</span>
      <span class="xlf-sep">·</span>
      <span class="xlf-note">Wᵢ = Π_{j>i} Nⱼ</span>
    </div>

    <div class="concept-block">
      <div class="cb-header">
        차원별 가중치 (Weights)
        <span class="cb-badge">shape = [8, 4, 5, 4] · size = 640</span>
      </div>
      <div class="cb-body">
        <table class="nd-table">
          <thead><tr>
            <th>차원 i</th><th>레이블</th><th>크기 Nᵢ</th><th>가중치 Wᵢ</th>
          </tr></thead>
          <tbody>
            ${weightRows}
            <tr class="td-total">
              <td colspan="2" style="font-weight:700">전체 조합 (product)</td>
              <td class="td-num td-n" style="font-weight:700">8×4×5×4</td>
              <td class="td-num td-w" style="font-weight:700">640</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">인코딩 예시</div>
      <div class="cb-body">
        <div class="ev-tbl-wrap">
          <table class="ev-tbl">
            <thead><tr>
              <th>좌표 [x₁,x₂,x₃,x₄]</th><th>id</th><th>값</th><th>권한 설명</th>
            </tr></thead>
            <tbody>${examples}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">전단사성 (Bijection) 보장</div>
      <div class="cb-body">
        <table class="nd-table">
          <thead><tr><th>성질</th><th>의미</th><th>보장 방법</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>단사 (Injective)</strong></td>
              <td>서로 다른 좌표 → 서로 다른 정수</td>
              <td>가중치 구조에 의해 수학적으로 보장</td>
            </tr>
            <tr>
              <td><strong>전사 (Surjective)</strong></td>
              <td>[0, 639] 범위의 모든 정수가 유효한 좌표에 대응</td>
              <td>1-based 인덱스와 shape 범위 제약으로 보장</td>
            </tr>
            <tr>
              <td><strong>전단사 (Bijection)</strong></td>
              <td>완전한 1:1 대응 — 충돌 없음, 빈틈 없음</td>
              <td>640개 id ↔ 640개 권한 튜플</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">실용 활용 — 비트 배열 권한 조회</div>
      <div class="cb-body">
        <div class="xl-formula-block" style="flex-direction:column;align-items:flex-start;gap:4px">
          <span class="xlf-label" style="margin-bottom:2px">예시 코드 (의사 코드)</span>
          <pre style="font-size:0.73rem;color:#1a1a1a;line-height:1.6;margin:0">// 640비트(80바이트) 배열로 모든 권한 저장
const permissions = new Uint8Array(Math.ceil(640 / 8));

// 권한 부여: editor가 development에서 database write 허용
const id = encode([3, 2, 3, 3]); // → 92
permissions[id >> 3] |= (1 << (id & 7));

// 권한 확인: O(1)
function hasPermission(resource, action, role, env): boolean {
  const id = encode([resource, action, role, env]);
  return !!(permissions[id >> 3] & (1 << (id & 7)));
}</pre>
        </div>
        <div class="insight-box" style="margin-top:0">
          <span class="insight-icon">⚡</span>
          <span>
            640개의 권한 조합을 <strong>단 80바이트</strong>로 저장하고,
            어떤 (리소스, 액션, 역할, 환경) 조합이든 <strong>O(1) 비트 연산</strong>으로 조회합니다.
            문자열 비교나 해시맵 없이 순수한 산술 연산만으로 권한 체계 전체를 표현합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────

