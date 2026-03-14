// ═══════════════════════════════════════════════════════════════════════════
//  주소 체계 레퍼런스 — 데이터 스토리지 주소 시스템 예제
// ═══════════════════════════════════════════════════════════════════════════

import { WeightedIndex } from "weighted-index";

// ── Storage address schema ────────────────────────────────────────────────

const SCHEMA = {
  tenant: {
    size: 50,
    label: "테넌트",
    desc: "서비스 구독 조직",
    examples: ["acme-corp", "startup-x", "enterprise-y"],
  },
  schema: {
    size: 10,
    label: "스키마",
    desc: "데이터베이스 스키마/네임스페이스",
    examples: ["users", "events", "billing", "analytics"],
  },
  table: {
    size: 30,
    label: "테이블",
    desc: "테이블 또는 컬렉션",
    examples: ["sessions", "records", "metrics", "logs"],
  },
  shard: {
    size: 8,
    label: "샤드",
    desc: "수평 파티션 (샤드)",
    examples: ["shard-0", "shard-1", "shard-2"],
  },
} as const;

type AddrDim = keyof typeof SCHEMA;
const ADDR_DIMS: AddrDim[] = ["tenant", "schema", "table", "shard"];

const ADDR_WI = new WeightedIndex(
  ADDR_DIMS.map((d) => SCHEMA[d].size),
  ADDR_DIMS
);

// ADDR_WI.size = 50 × 10 × 30 × 8 = 120,000
// weights     = [2400, 240, 8, 1]

const ADDR_WEIGHTS = ADDR_WI.shape.map((_, i, arr) =>
  arr.slice(i + 1).reduce((p, n) => p * n, 1)
);

// ── Entry point ───────────────────────────────────────────────────────────

export function renderAddress(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">
    ${renderIntro()}
    ${renderSchema()}
    ${renderEncoder()}
    ${renderDecoder()}
    ${renderComparison()}
    ${renderDecompress()}
  </div>`;
  setupInteractivity(container);
}

// ── 1. Introduction ───────────────────────────────────────────────────────

function renderIntro(): string {
  const size = ADDR_WI.size.toLocaleString();
  const dims = ADDR_DIMS.map((d) => `${d}(${SCHEMA[d].size})`).join(" × ");
  return `
    <h2 class="concept-section-title">주소 체계 레퍼런스 — 데이터 스토리지</h2>
    <p class="concept-desc">
      다중 테넌트 데이터 플랫폼에서 모든 스토리지 위치는
      <strong>${dims}</strong> 4차원 좌표로 유일하게 결정됩니다.
      이 좌표를 가중진법으로 인코딩하면 <strong>${size}개의 고유 주소</strong>를
      정수 하나로 표현할 수 있습니다.
    </p>
    <div class="xl-formula-block" style="gap:14px;flex-wrap:wrap">
      <div>
        <span class="xlf-label">주소 공간</span>
        <span class="xlf-expr">${dims} = <strong>${size}</strong></span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">가중치</span>
        <span class="xlf-expr">[${ADDR_WEIGHTS.join(", ")}]</span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">버전</span>
        <span class="xlf-expr">v1 (스키마 변경 시 버전 업)</span>
      </div>
    </div>
  `;
}

// ── 2. Schema ─────────────────────────────────────────────────────────────

function renderSchema(): string {
  const rows = ADDR_DIMS.map((dim, i) => {
    const def = SCHEMA[dim];
    const w   = ADDR_WEIGHTS[i];
    return `<tr>
      <td style="font-weight:600;color:var(--xl-green)">${i + 1}</td>
      <td><code>${dim}</code></td>
      <td class="td-num">${def.size}</td>
      <td class="td-num" style="color:var(--xl-blue)">${w.toLocaleString()}</td>
      <td>${def.label}</td>
      <td style="font-size:0.72rem;color:var(--text-muted)">${def.desc}</td>
      <td style="font-size:0.7rem;color:var(--text-dim)">${def.examples.map((e) => `<code>${e}</code>`).join(", ")}</td>
    </tr>`;
  }).join("");

  const totalRow = `<tr class="td-total">
    <td colspan="2" style="font-weight:700;text-align:right;padding-right:12px">전체 주소 공간</td>
    <td class="td-num">${ADDR_WI.shape.join(" × ")}</td>
    <td class="td-num">${ADDR_WI.size.toLocaleString()}</td>
    <td colspan="3" style="font-size:0.72rem;color:var(--xl-green);font-weight:700">
      0 ~ ${(ADDR_WI.size - 1).toLocaleString()} 정수로 표현
    </td>
  </tr>`;

  return `
    <div class="concept-block">
      <div class="cb-header">스키마 정의 — 4차원 스토리지 좌표</div>
      <div class="cb-body">
        <div class="ev-tbl-wrap">
          <table class="ev-tbl">
            <thead><tr>
              <th>#</th><th>차원</th><th>N</th><th>가중치</th>
              <th>이름</th><th>설명</th><th>예시</th>
            </tr></thead>
            <tbody>${rows}${totalRow}</tbody>
          </table>
        </div>
        <div class="addr-code-block">
          <div class="addr-code-label">TypeScript 스키마 정의</div>
          <pre class="buf-code">const STORAGE_INDEX = new WeightedIndex(
  [50, 10, 30, 8],                           // N: tenant, schema, table, shard
  ["tenant", "schema", "table", "shard"]
);
// size    = 120,000  (주소 공간 크기)
// weights = [2400, 240, 8, 1]  (각 차원의 가중치)</pre>
        </div>
      </div>
    </div>
  `;
}

// ── 3. Interactive Encoder ────────────────────────────────────────────────

function renderEncoder(): string {
  const sliders = ADDR_DIMS.map((dim, i) => {
    const def = SCHEMA[dim];
    const w   = ADDR_WEIGHTS[i];
    return `
      <div class="addr-enc-row">
        <div class="addr-enc-dim">
          <span class="addr-enc-dimname">${dim}</span>
          <span class="addr-enc-dimko">${def.label}</span>
        </div>
        <input type="range" class="buf-slider addr-slider"
          id="enc-${dim}" min="1" max="${def.size}" value="1"
          data-dim="${dim}" data-weight="${w}" data-size="${def.size}" data-idx="${i}" />
        <span class="addr-enc-val" id="enc-val-${dim}">1</span>
        <span class="addr-enc-formula" id="enc-f-${dim}">
          (1−1)×${w.toLocaleString()} = 0
        </span>
      </div>
    `;
  }).join("");

  return `
    <div class="concept-block">
      <div class="cb-header">
        인코더 — 좌표 → 주소 ID
        <span class="cb-badge">addr:v1:<span id="enc-result">0</span></span>
      </div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:12px">
          각 차원의 값(1-based)을 선택하면 주소 ID가 실시간으로 계산됩니다.
        </p>
        <div class="addr-enc-grid">${sliders}</div>
        <div class="addr-enc-total">
          <span class="addr-enc-total-label">encode</span>
          <span id="enc-formula-full" class="addr-enc-total-formula">
            (1−1)×2400 + (1−1)×240 + (1−1)×8 + (1−1) = 0
          </span>
          <span class="addr-enc-total-eq">=</span>
          <span class="addr-enc-total-id" id="enc-total-id">0</span>
        </div>
      </div>
    </div>
  `;
}

// ── 4. Interactive Decoder ────────────────────────────────────────────────

function renderDecoder(): string {
  const maxId = ADDR_WI.size - 1;
  return `
    <div class="concept-block">
      <div class="cb-header">디코더 — 주소 ID → 좌표</div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:12px">
          주소 ID를 입력하면 4차원 좌표로 역산합니다.
          스키마(N 목록)만 있으면 언제든 역산할 수 있습니다.
        </p>
        <div class="addr-dec-input-row">
          <span class="addr-dec-prefix">addr:v1:</span>
          <input type="number" id="dec-input" class="addr-dec-input"
            min="0" max="${maxId}" value="12564" placeholder="0 ~ ${maxId.toLocaleString()}" />
          <span class="addr-dec-range">( 0 ~ ${maxId.toLocaleString()} )</span>
        </div>
        <div id="dec-result" class="addr-dec-result"></div>
      </div>
    </div>
  `;
}

// ── 5. Comparison ─────────────────────────────────────────────────────────

function renderComparison(): string {
  const methods = [
    {
      name: "UUID v4",
      storage: "16 bytes",
      readable: "아니오",
      reversible: "불가",
      structured: "아니오",
      version: "해당 없음",
      example: "550e8400-e29b-41d4-a716-446655440000",
    },
    {
      name: "복합 키",
      storage: "가변 (문자열)",
      readable: "예",
      reversible: "파싱 필요",
      structured: "예",
      version: "스키마 변경 시 마이그레이션",
      example: "tenant:5/schema:3/table:12/shard:4",
    },
    {
      name: "가중진법 주소",
      storage: "4~8 bytes (정수)",
      readable: "스키마 있으면 예",
      reversible: "O(d) 산술",
      structured: "예",
      version: "버전 공존 (구버전 계속 유효)",
      example: "addr:v1:12564",
    },
  ];

  const rows = methods.map(({ name, storage, readable, reversible, structured, version, example }) => `
    <tr>
      <td style="font-weight:700">${name}</td>
      <td class="td-num">${storage}</td>
      <td>${readable}</td>
      <td>${reversible}</td>
      <td>${structured}</td>
      <td style="font-size:0.7rem">${version}</td>
      <td><code style="font-size:0.68rem">${example}</code></td>
    </tr>
  `).join("");

  return `
    <div class="concept-block">
      <div class="cb-header">식별자 방식 비교</div>
      <div class="cb-body">
        <div class="ev-tbl-wrap">
          <table class="ev-tbl">
            <thead><tr>
              <th>방식</th><th>저장 크기</th><th>사람이 읽기</th>
              <th>역산</th><th>구조적</th><th>버전 관리</th><th>예시</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── 6. Decompression chain ────────────────────────────────────────────────

function renderDecompress(): string {
  const exampleId = 12564;
  const coords    = ADDR_WI.decode(exampleId);

  const steps = ADDR_DIMS.map((dim, i) => {
    const w  = ADDR_WEIGHTS[i];
    const ni = SCHEMA[dim].size;
    const xi = coords[i];
    return `
      <tr>
        <td class="ftbl-step">${dim}</td>
        <td class="ftbl-expr">
          ⌊${exampleId} ÷ ${w.toLocaleString()}⌋ mod ${ni} + 1
        </td>
        <td class="ftbl-result">
          <strong>${xi}</strong>
          <span style="font-size:0.68rem;color:var(--text-muted);margin-left:6px">
            (${SCHEMA[dim].label} #${xi})
          </span>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="concept-block">
      <div class="cb-header">압축 해제 체인 — 스키마만 있으면 역산 가능</div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:12px">
          <code>addr:v1:${exampleId}</code>을 받은 시스템은
          스키마(N 목록)만 보유하면 아래 산술 연산으로
          즉시 4차원 좌표를 복원합니다.
          외부 조회나 테이블 없이 O(d) 연산으로 완료됩니다.
        </p>
        <table class="formula-tbl" style="margin-bottom:14px">
          <tbody>${steps}</tbody>
        </table>
        <div class="addr-decoded-chips">
          ${ADDR_DIMS.map((dim, i) => `
            <div class="addr-chip">
              <span class="addr-chip-dim">${dim}</span>
              <span class="addr-chip-val">#${coords[i]}</span>
              <span class="addr-chip-ko">${SCHEMA[dim].label}</span>
            </div>
          `).join("")}
        </div>
        <div class="addr-code-block" style="margin-top:14px">
          <div class="addr-code-label">런타임 역산 코드</div>
          <pre class="buf-code">// 스키마(N 목록)만 있으면 어디서든 역산 가능
const addr = { prefix: "addr", v: "v1", id: ${exampleId} };

const coords = STORAGE_INDEX.decode(addr.id);
// → [${coords.join(", ")}]  (tenant, schema, table, shard — 1-based)

const record = STORAGE_INDEX.decodeToRecord(addr.id);
// → { tenant: ${coords[0]}, schema: ${coords[1]}, table: ${coords[2]}, shard: ${coords[3]} }

// 재인코딩 (역방향)
const restored = STORAGE_INDEX.encode([${coords.join(", ")}]);
// → ${exampleId}  ✅ 동일한 주소</pre>
        </div>
        <div class="insight-box">
          <span class="insight-icon">🗂️</span>
          <span>
            <strong>스키마가 곧 압축 해제 키입니다.</strong>
            시스템이 스키마 목록 하나만 공유하면,
            어떤 서비스도 주소를 주고받으면서 좌표를 즉시 복원할 수 있습니다.
            네트워크 경계를 넘어 전달되는 주소는 <em>최소 크기 정수</em>이지만
            수신 측에서는 완전한 맥락을 가진 좌표로 팽창됩니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── Interactivity setup ───────────────────────────────────────────────────

function setupInteractivity(container: HTMLElement): void {
  setupEncoder(container);
  setupDecoder(container);
}

function setupEncoder(container: HTMLElement): void {
  const sliders = container.querySelectorAll<HTMLInputElement>(".addr-slider");

  function recalc(): void {
    const coords: number[] = [];
    let total = 0;
    const parts: string[] = [];

    sliders.forEach((sl) => {
      const dim  = sl.dataset.dim as AddrDim;
      const w    = Number(sl.dataset.weight);
      const v    = Number(sl.value);
      coords.push(v);
      total += (v - 1) * w;
      parts.push(`(${v}−1)×${w.toLocaleString()}`);

      const valEl  = container.querySelector(`#enc-val-${dim}`)!;
      const fmlEl  = container.querySelector(`#enc-f-${dim}`)!;
      valEl.textContent = String(v);
      fmlEl.textContent = `(${v}−1)×${w.toLocaleString()} = ${((v - 1) * w).toLocaleString()}`;
    });

    container.querySelector("#enc-result")!.textContent = String(total);
    container.querySelector("#enc-total-id")!.textContent = String(total);
    container.querySelector("#enc-formula-full")!.textContent =
      parts.join(" + ") + ` = ${total.toLocaleString()}`;
  }

  sliders.forEach((sl) => sl.addEventListener("input", recalc));
  recalc();
}

function setupDecoder(container: HTMLElement): void {
  const input  = container.querySelector<HTMLInputElement>("#dec-input")!;
  const result = container.querySelector<HTMLElement>("#dec-result")!;

  function decode(): void {
    const raw = Number(input.value);
    if (!Number.isInteger(raw) || raw < 0 || raw >= ADDR_WI.size) {
      result.innerHTML = `<span class="addr-dec-error">유효 범위: 0 ~ ${(ADDR_WI.size - 1).toLocaleString()}</span>`;
      return;
    }

    const coords = ADDR_WI.decode(raw);
    const chips  = ADDR_DIMS.map((dim, i) => `
      <div class="addr-chip">
        <span class="addr-chip-dim">${dim}</span>
        <span class="addr-chip-val">#${coords[i]}</span>
        <span class="addr-chip-ko">${SCHEMA[dim].label}</span>
      </div>
    `).join("");

    const formula = ADDR_DIMS.map((dim, i) => {
      const w  = ADDR_WEIGHTS[i];
      const ni = SCHEMA[dim].size;
      return `⌊${raw}/${w.toLocaleString()}⌋ mod ${ni}+1 = <strong>${coords[i]}</strong>`;
    }).join(" · ");

    result.innerHTML = `
      <div class="addr-decoded-chips" style="margin-bottom:10px">${chips}</div>
      <div class="addr-dec-formula">${formula}</div>
    `;
  }

  input.addEventListener("input", decode);
  decode();
}
