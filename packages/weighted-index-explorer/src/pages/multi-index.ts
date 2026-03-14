// ═══════════════════════════════════════════════════════════════════════════
//  다중 인덱스 — 여러 인덱스가 하나의 UUID 주소 공간을 공유하는 시나리오
// ═══════════════════════════════════════════════════════════════════════════

import {
  WeightedIndex,
  PACK_FORMATS,
  createAddressConverter,
  createLayoutProtocol,
  type PackFormat,
} from "weighted-index";
import { renderHexBar } from "../utils/hex-bar.js";

// ── 데이터 모델 ──────────────────────────────────────────────────────────────

interface IndexDef {
  id: string;
  label: string;
  desc: string;
  schemaNum: number;
  dims: { id: string; label: string; entries: string[] }[];
  versions: { id: string; versionNum: number; dimSnapshots: string[][] }[];
}

const INDICES: IndexDef[] = [
  {
    id: "perm",
    label: "권한",
    desc: "역할 × 액션 × 리소스 — RBAC 권한 조합",
    schemaNum: 1,
    dims: [
      { id: "role", label: "역할", entries: ["admin", "editor", "viewer", "guest"] },
      { id: "action", label: "액션", entries: ["read", "write", "delete"] },
      { id: "resource", label: "리소스", entries: ["articles", "comments", "users"] },
    ],
    versions: [
      { id: "v1", versionNum: 1, dimSnapshots: [["admin", "editor", "viewer"], ["read", "write", "delete"], ["articles", "comments", "users"]] },
      { id: "v2", versionNum: 2, dimSnapshots: [["admin", "editor", "viewer", "guest"], ["read", "write", "delete"], ["articles", "comments", "users"]] },
    ],
  },
  {
    id: "content",
    label: "콘텐츠",
    desc: "카테고리 × 언어 — 콘텐츠 분류 체계",
    schemaNum: 2,
    dims: [
      { id: "category", label: "카테고리", entries: ["tech", "art", "science"] },
      { id: "lang", label: "언어", entries: ["ko", "en"] },
    ],
    versions: [
      { id: "v1", versionNum: 1, dimSnapshots: [["tech", "art"], ["ko", "en"]] },
      { id: "v2", versionNum: 2, dimSnapshots: [["tech", "art", "science"], ["ko", "en"]] },
    ],
  },
];

const FORMAT: PackFormat = PACK_FORMATS.uuid;
const SCHEMA_CHARS = 4;
const VERSION_CHARS = 2;

// schema/version 매핑 수집
const SCHEMAS: Record<string, number> = {};
const VERSIONS: Record<string, number> = {};
for (const idx of INDICES) {
  SCHEMAS[idx.id] = idx.schemaNum;
  for (const v of idx.versions) VERSIONS[v.id] = v.versionNum;
}

const converter = createAddressConverter();
converter.register(createLayoutProtocol({
  format: FORMAT,
  schemaChars: SCHEMA_CHARS,
  versionChars: VERSION_CHARS,
  schemas: SCHEMAS,
  versions: VERSIONS,
}));

// 인덱스별 WeightedIndex 캐시
function getWI(idx: IndexDef, versionIdx: number): WeightedIndex {
  const shape = idx.versions[versionIdx].dimSnapshots.map((e) => e.length);
  return new WeightedIndex(shape, idx.dims.map((d) => d.id));
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function renderMultiIndex(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">
    ${renderIntro()}
    ${renderRegistryOverview()}
    ${renderUUIDDemo()}
    ${renderCrossRouting()}
    ${renderDecodeMapSection()}
  </div>`;
  setupInteractivity(container);
}

// ── 1. 소개 ──────────────────────────────────────────────────────────────────

function renderIntro(): string {
  return `
    <h2 class="concept-section-title">다중 인덱스 — UUID 주소 공간 공유</h2>
    <p class="concept-desc">
      여러 인덱스(권한, 콘텐츠 등)가 <strong>하나의 UUID 주소 체계</strong>를 공유합니다.
      UUID의 schema 필드가 어떤 인덱스인지, version 필드가 어떤 버전인지를 식별하므로
      서로 다른 인덱스의 PK가 절대 충돌하지 않습니다.
    </p>
    <div class="xl-formula-block" style="gap:14px;flex-wrap:wrap">
      <div>
        <span class="xlf-label">UUID 레이아웃</span>
        <span class="xlf-expr">[schema ${SCHEMA_CHARS}hex | version ${VERSION_CHARS}hex | gap | index]</span>
      </div>
      <div>
        <span class="xlf-label">등록된 인덱스</span>
        <span class="xlf-expr">${INDICES.map((i) => `${i.id}(${i.schemaNum})`).join(", ")}</span>
      </div>
    </div>`;
}

// ── 2. 레지스트리 개요 ──────────────────────────────────────────────────────

function renderRegistryOverview(): string {
  const cards = INDICES.map((idx) => {
    const dimsHtml = idx.dims.map((d) =>
      `<tr><td style="font-weight:600">${d.label}</td><td>${d.entries.join(", ")}</td><td class="td-num">${d.entries.length}</td></tr>`
    ).join("");

    const versHtml = idx.versions.map((v) => {
      const shape = v.dimSnapshots.map((e) => e.length);
      const size = shape.reduce((a, b) => a * b, 1);
      return `<tr><td><code>${v.id}</code></td><td>[${shape.join(", ")}]</td><td class="td-num">${size}</td></tr>`;
    }).join("");

    return `
      <div class="concept-block">
        <div class="cb-header">
          <span style="font-size:1.1em">${idx.label}</span>
          <span class="cb-badge">schema = ${idx.schemaNum}</span>
          <span class="cb-badge">${idx.id}</span>
        </div>
        <div class="cb-body">
          <p style="color:var(--text-muted);margin:0 0 8px">${idx.desc}</p>
          <table class="nd-table" style="margin-bottom:10px">
            <thead><tr><th>차원</th><th>항목</th><th>크기</th></tr></thead>
            <tbody>${dimsHtml}</tbody>
          </table>
          <table class="nd-table">
            <thead><tr><th>버전</th><th>shape</th><th>size</th></tr></thead>
            <tbody>${versHtml}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="concept-dim-sep"></div>
    <h3 style="margin:12px 0 8px;font-size:1em;color:var(--xl-green)">레지스트리 개요</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px">
      ${cards}
    </div>`;
}

// ── 3. UUID PK 생성 데모 ─────────────────────────────────────────────────────

function renderUUIDDemo(): string {
  const indexOptions = INDICES.map((idx) =>
    `<option value="${idx.id}">${idx.label} (${idx.id})</option>`
  ).join("");

  return `
    <div class="concept-dim-sep"></div>
    <h3 style="margin:12px 0 8px;font-size:1em;color:var(--xl-green)">UUID PK 생성</h3>
    <div class="concept-block">
      <div class="cb-header">인덱스 선택 → 차원 값 선택 → UUID 생성</div>
      <div class="cb-body">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <label style="font-weight:600">인덱스:</label>
          <select id="mi-index-sel" class="recalc-sel">${indexOptions}</select>
          <label style="font-weight:600">버전:</label>
          <select id="mi-version-sel" class="recalc-sel"></select>
        </div>
        <div id="mi-dim-selectors" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"></div>
        <div id="mi-uuid-result"></div>
      </div>
    </div>`;
}

// ── 4. 크로스 인덱스 라우팅 ─────────────────────────────────────────────────

function renderCrossRouting(): string {
  // 미리 각 인덱스의 첫 UUID를 생성해 예시로 보여줌
  const examples = INDICES.map((idx) => {
    const v = idx.versions[0];
    const wi = getWI(idx, 0);
    const coords = v.dimSnapshots.map(() => 1);
    const value = wi.encodeUnsafe(coords);
    const uuid = converter.serialize(
      { schema: idx.id, version: v.id, index: value }, "layout:uuid"
    );
    return { idx, uuid };
  });

  return `
    <div class="concept-dim-sep"></div>
    <h3 style="margin:12px 0 8px;font-size:1em;color:var(--xl-green)">크로스 인덱스 라우팅</h3>
    <p class="concept-desc">
      UUID를 입력하면 schema 필드를 읽어 어떤 인덱스인지 자동 판별하고 entity ID를 복원합니다.
    </p>
    <div class="concept-block">
      <div class="cb-header">UUID → 인덱스 자동 감지 → entity ID</div>
      <div class="cb-body">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <input id="mi-route-input" class="addr-dec-input" style="flex:1;font-family:monospace;font-size:0.85em"
            placeholder="UUID를 붙여넣기..." value="${examples[0].uuid}" />
          <button id="mi-route-btn" class="plan-add-btn">분석</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
          ${examples.map((e) =>
            `<button class="mi-example-btn plan-add-btn" data-uuid="${e.uuid}" style="font-size:0.75em">${e.idx.label} 예시</button>`
          ).join("")}
        </div>
        <div id="mi-route-result"></div>
      </div>
    </div>`;
}

// ── 5. DecodeMap 번들 ────────────────────────────────────────────────────────

function renderDecodeMapSection(): string {
  const tabs = INDICES.map((idx, i) =>
    `<button class="mi-dm-tab plan-add-btn${i === 0 ? " active" : ""}" data-idx="${idx.id}">${idx.label}</button>`
  ).join("");

  return `
    <div class="concept-dim-sep"></div>
    <h3 style="margin:12px 0 8px;font-size:1em;color:var(--xl-green)">DecodeMap 번들</h3>
    <p class="concept-desc">
      외부 시스템(DB, 프론트엔드)에 전송하는 최소 디코딩 데이터입니다.
      이 번들만 있으면 MetaRegistry 없이 value → entity ID를 복원할 수 있습니다.
    </p>
    <div class="concept-block">
      <div class="cb-header">
        <span>인덱스별 DecodeMap</span>
        <div style="display:flex;gap:4px;margin-left:auto">${tabs}</div>
      </div>
      <div class="cb-body" id="mi-dm-body"></div>
    </div>`;
}

function buildDecodeMapHtml(idx: IndexDef, vIdx: number): string {
  const v = idx.versions[vIdx];
  const shape = v.dimSnapshots.map((e) => e.length);
  const size = shape.reduce((a, b) => a * b, 1);
  const weights = shape.map((_, i) => shape.slice(i + 1).reduce((a, b) => a * b, 1));

  const dimsRows = idx.dims.map((d, i) =>
    `<tr>
      <td style="font-weight:600">${d.id}</td>
      <td>${v.dimSnapshots[i].map((e) => `<code>${e}</code>`).join(", ")}</td>
      <td class="td-num">${shape[i]}</td>
      <td class="td-num">${weights[i]}</td>
    </tr>`
  ).join("");

  return `
    <div style="margin-bottom:8px">
      <span style="font-weight:600">${idx.id}:${v.id}</span>
      <span style="color:var(--text-muted);margin-left:8px">shape [${shape.join(", ")}] · size ${size}</span>
    </div>
    <table class="nd-table" style="margin-bottom:12px">
      <thead><tr><th>dim</th><th>entries</th><th>size</th><th>weight</th></tr></thead>
      <tbody>${dimsRows}</tbody>
    </table>
    <div class="insight-box" style="margin-bottom:8px">
      외부 디코딩: <code>coord[i] = floor(remaining / weight[i]) + 1</code>, <code>remaining %= weight[i]</code><br/>
      → <code>entity = entries[coord - 1]</code>
    </div>
    <details style="margin-top:4px">
      <summary style="cursor:pointer;color:var(--xl-blue);font-size:0.85em">JSON 번들 보기</summary>
      <pre class="concept-code" style="font-size:0.75em;max-height:200px;overflow:auto">${JSON.stringify({
        indexId: idx.id, versionId: v.id, shape, size,
        dims: idx.dims.map((d, i) => ({ dimId: d.id, entries: v.dimSnapshots[i] })),
      }, null, 2)}</pre>
    </details>`;
}

// ── Interactivity ────────────────────────────────────────────────────────────

function setupInteractivity(container: HTMLElement): void {
  setupUUIDDemo(container);
  setupRouting(container);
  setupDecodeMapTabs(container);
}

function setupUUIDDemo(container: HTMLElement): void {
  const indexSel = container.querySelector<HTMLSelectElement>("#mi-index-sel")!;
  const versionSel = container.querySelector<HTMLSelectElement>("#mi-version-sel")!;
  const dimContainer = container.querySelector<HTMLDivElement>("#mi-dim-selectors")!;
  const resultDiv = container.querySelector<HTMLDivElement>("#mi-uuid-result")!;

  function getIdx(): IndexDef { return INDICES.find((i) => i.id === indexSel.value)!; }

  function updateVersions(): void {
    const idx = getIdx();
    versionSel.innerHTML = idx.versions.map((v) =>
      `<option value="${v.id}">${v.id}</option>`
    ).join("");
    updateDimSelectors();
  }

  function updateDimSelectors(): void {
    const idx = getIdx();
    const vIdx = idx.versions.findIndex((v) => v.id === versionSel.value);
    const snap = idx.versions[Math.max(0, vIdx)].dimSnapshots;
    dimContainer.innerHTML = idx.dims.map((d, i) => `
      <div>
        <label style="font-weight:500;font-size:0.85em">${d.label}:</label>
        <select class="recalc-sel mi-dim-val" data-dim="${i}">
          ${snap[i].map((e) => `<option value="${e}">${e}</option>`).join("")}
        </select>
      </div>
    `).join("");
    dimContainer.querySelectorAll(".mi-dim-val").forEach((sel) =>
      sel.addEventListener("change", recalc)
    );
    recalc();
  }

  function recalc(): void {
    const idx = getIdx();
    const vIdx = Math.max(0, idx.versions.findIndex((v) => v.id === versionSel.value));
    const v = idx.versions[vIdx];
    const wi = getWI(idx, vIdx);

    const dimSels = dimContainer.querySelectorAll<HTMLSelectElement>(".mi-dim-val");
    const coords = Array.from(dimSels).map((sel, i) => {
      const entries = v.dimSnapshots[i];
      return entries.indexOf(sel.value) + 1;
    });

    const value = wi.encodeUnsafe(coords);
    const addr = { schema: idx.id, version: v.id, index: value };
    const uuid = converter.serialize(addr, "layout:uuid");
    const colon = `${idx.id}:${v.id}:${value}`;

    const hexBar = renderHexBar(
      `${idx.id}:${v.id}:${value}`,
      FORMAT.chars,
      SCHEMA_CHARS,
      VERSION_CHARS,
      FORMAT.chars - SCHEMA_CHARS - VERSION_CHARS,
      { prefix: idx.schemaNum, version: v.versionNum, index: value },
      FORMAT,
    );

    resultDiv.innerHTML = `
      <div style="margin-bottom:8px">
        <span style="font-weight:600;color:var(--xl-green)">UUID:</span>
        <code style="font-size:0.9em;margin-left:6px">${uuid}</code>
      </div>
      <div style="margin-bottom:10px">
        <span style="color:var(--text-muted)">colon:</span>
        <code style="margin-left:6px">${colon}</code>
        <span style="color:var(--text-muted);margin-left:12px">value:</span>
        <code style="margin-left:6px">${value}</code>
      </div>
      ${hexBar}`;
  }

  indexSel.addEventListener("change", updateVersions);
  versionSel.addEventListener("change", updateDimSelectors);
  updateVersions();
}

function setupRouting(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>("#mi-route-input")!;
  const btn = container.querySelector<HTMLButtonElement>("#mi-route-btn")!;
  const resultDiv = container.querySelector<HTMLDivElement>("#mi-route-result")!;

  function analyze(): void {
    const raw = input.value.trim();
    if (!raw) { resultDiv.innerHTML = ""; return; }

    try {
      const addr = converter.parse(raw);
      const idx = INDICES.find((i) => i.id === addr.schema);
      if (!idx) {
        resultDiv.innerHTML = `<div class="insight-box" style="color:#c00">알 수 없는 schema: "${addr.schema}"</div>`;
        return;
      }

      const v = idx.versions.find((ver) => ver.id === addr.version);
      if (!v) {
        resultDiv.innerHTML = `<div class="insight-box" style="color:#c00">알 수 없는 version: "${addr.version}" (index: ${idx.id})</div>`;
        return;
      }

      const vIdx = idx.versions.indexOf(v);
      const wi = getWI(idx, vIdx);
      const coords = wi.decode(addr.index);

      const entityRows = idx.dims.map((d, i) =>
        `<tr><td style="font-weight:600">${d.label}</td><td><code>${v.dimSnapshots[i][coords[i] - 1]}</code></td><td class="td-num">coord ${coords[i]}</td></tr>`
      ).join("");

      const hexBar = renderHexBar(
        `${idx.id}:${v.id}:${addr.index}`,
        FORMAT.chars,
        SCHEMA_CHARS,
        VERSION_CHARS,
        FORMAT.chars - SCHEMA_CHARS - VERSION_CHARS,
        { prefix: idx.schemaNum, version: v.versionNum, index: addr.index },
        FORMAT,
      );

      resultDiv.innerHTML = `
        <div style="margin-bottom:8px">
          <span class="cb-badge" style="font-size:0.85em">${idx.label}</span>
          <span class="cb-badge" style="font-size:0.85em">${idx.id}:${v.id}</span>
          <span style="color:var(--text-muted);margin-left:8px">value = ${addr.index}</span>
        </div>
        ${hexBar}
        <table class="nd-table" style="margin-top:10px">
          <thead><tr><th>차원</th><th>entity</th><th>좌표</th></tr></thead>
          <tbody>${entityRows}</tbody>
        </table>`;
    } catch (e) {
      resultDiv.innerHTML = `<div class="insight-box" style="color:#c00">파싱 실패: ${e instanceof Error ? e.message : String(e)}</div>`;
    }
  }

  btn.addEventListener("click", analyze);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") analyze(); });
  container.querySelectorAll(".mi-example-btn").forEach((el) => {
    el.addEventListener("click", () => {
      input.value = (el as HTMLElement).dataset.uuid ?? "";
      analyze();
    });
  });

  // 초기 분석
  analyze();
}

function setupDecodeMapTabs(container: HTMLElement): void {
  const body = container.querySelector<HTMLDivElement>("#mi-dm-body")!;
  const tabs = container.querySelectorAll<HTMLButtonElement>(".mi-dm-tab");

  function showIdx(idxId: string): void {
    const idx = INDICES.find((i) => i.id === idxId)!;
    body.innerHTML = buildDecodeMapHtml(idx, 0);
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.idx === idxId));
  }

  tabs.forEach((t) => t.addEventListener("click", () => showIdx(t.dataset.idx!)));
  showIdx(INDICES[0].id);
}
