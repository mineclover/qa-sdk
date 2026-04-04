import {
  collectLayout,
  measureLayout,
  classifyLayout,
  renderToSVG,
  checkConformance,
} from "rlsc";
import type {
  RLSCDocument,
  LayoutPattern,
  CanvasRenderOptions,
} from "rlsc";

declare global {
  interface Window {
    toggleOverlay: () => void;
    runCollection: () => void;
    copyContext: () => void;
    clearSelection: () => void;
    renderSVG: () => void;
    runConformance: () => void;
  }
}

// ═══════════════════════════════════════════════════════
//  인라인 수집 타입 (Tree/Layers/Context/인터랙션용 내부 포맷)
// ═══════════════════════════════════════════════════════

interface InlineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface InlineNode {
  id: string;
  tag: string;
  cls: string[];
  role?: string;
  rect: InlineRect;
  z: number;
  depth: number;
  display: string;
  position: string;
  visible: boolean;
  text?: string;
  addr?: string;
  children: InlineNode[];
  _el: Element;
}

interface InlineLayer {
  z: number;
  role: string;
  nodes: InlineNode[];
  area: number;
}

interface InlineDoc {
  root: InlineNode;
  nodes: InlineNode[];
  layers: InlineLayer[];
  relations: Array<{ type: string; src: string; tgt: string }>;
  pageW: number;
  pageH: number;
  url: string;
  ts: string;
}

// ═══════════════════════════════════════════════════════
//  상태
// ═══════════════════════════════════════════════════════

const SKIP = new Set(["script", "style", "noscript", "link", "meta", "head", "br", "wbr"]);
const ROLES: Record<string, string> = {
  header: "banner", footer: "contentinfo", main: "main", nav: "navigation",
  aside: "complementary", section: "region", article: "article", form: "form",
  button: "button", a: "link", img: "img", ul: "list", ol: "list", li: "listitem",
  table: "table", dialog: "dialog",
};

let counter = 0;
let doc: InlineDoc | null = null;
let nodeMap: Map<string, InlineNode> | null = null;
let selectedId: string | null = null;
let overlayOn = false;
let rlscDoc: RLSCDocument | null = null;

// ═══════════════════════════════════════════════════════
//  인라인 수집
// ═══════════════════════════════════════════════════════

function makeId(el: Element): string {
  if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
  const t = el.tagName.toLowerCase();
  const cls = el.classList[0] ? `.${el.classList[0]}` : "";
  return `${t}${cls}__${++counter}`;
}

function collect(
  el: Element,
  depth: number,
  origin: { ox: number; oy: number; sy: number },
): InlineNode | null {
  const t = el.tagName.toLowerCase();
  if (SKIP.has(t) || depth > 20) return null;
  const b = el.getBoundingClientRect();
  const rect: InlineRect = {
    x: Math.round(b.left - origin.ox),
    y: Math.round(b.top - origin.oy + origin.sy),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
  if (rect.w < 2 && rect.h < 2) return null;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return null;

  const children: InlineNode[] = [];
  for (const ch of el.children) {
    const n = collect(ch, depth + 1, origin);
    if (n) children.push(n);
  }

  let txt = "";
  for (const ch of el.childNodes) {
    if (ch.nodeType === Node.TEXT_NODE) txt += ch.textContent?.trim() ?? "";
  }
  const text = txt.trim().slice(0, 60) || undefined;

  const z = parseInt(cs.zIndex, 10);
  return {
    id: makeId(el), tag: t,
    cls: Array.from(el.classList),
    role: el.getAttribute("role") ?? ROLES[t] ?? undefined,
    rect, z: isNaN(z) ? 0 : z, depth,
    display: cs.display, position: cs.position,
    visible: rect.w > 0 && rect.h > 0,
    text,
    addr: el.getAttribute("data-qa-address") ?? undefined,
    children, _el: el,
  };
}

function flatten(n: InlineNode): InlineNode[] {
  const r: InlineNode[] = [n];
  for (const c of n.children) r.push(...flatten(c));
  return r;
}

// ─── 레이어 분류 ──────────────────────────────────────

function classifyZ(z: number): string {
  if (z < 0) return "background";
  if (z < 10) return "content";
  if (z < 100) return "sticky";
  if (z < 1000) return "overlay";
  if (z < 10000) return "modal";
  return "tooltip";
}

function buildLayers(nodes: InlineNode[]): InlineLayer[] {
  const m = new Map<number, InlineNode[]>();
  for (const n of nodes) {
    if (!n.visible) continue;
    if (!m.has(n.z)) m.set(n.z, []);
    m.get(n.z)!.push(n);
  }
  return [...m.entries()]
    .map(([z, ns]) => ({
      z, role: classifyZ(z), nodes: ns,
      area: ns.reduce((s, n) => s + n.rect.w * n.rect.h, 0),
    }))
    .sort((a, b) => a.z - b.z);
}

// ─── 관계 탐지 ────────────────────────────────────────

function containsRect(o: InlineRect, i: InlineRect): boolean {
  return i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;
}

function detectInlineRelations(nodes: InlineNode[]) {
  const rels: Array<{ type: string; src: string; tgt: string }> = [];
  const vis = nodes.filter((n) => n.visible);
  for (let i = 0; i < vis.length; i++) {
    for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i]!, b = vis[j]!;
      if (a.depth < b.depth && containsRect(a.rect, b.rect)) {
        rels.push({ type: "contains", src: a.id, tgt: b.id });
      } else if (b.depth < a.depth && containsRect(b.rect, a.rect)) {
        rels.push({ type: "contains", src: b.id, tgt: a.id });
      }
    }
  }
  for (const n of nodes) {
    const vc = n.children.filter((c) => c.visible);
    for (let i = 0; i < vc.length - 1; i++) {
      rels.push({ type: "flow", src: vc[i]!.id, tgt: vc[i + 1]!.id });
    }
  }
  return rels;
}

// ─── 마크업 인코딩 ────────────────────────────────────

function encode(n: InlineNode, indent: number): string {
  const pad = "  ".repeat(indent);
  const p: string[] = [];
  let sel = n.tag;
  if (n.id.includes("#")) sel = n.id.split("__")[0]!;
  else if (n.cls.length) sel += "." + n.cls[0];
  p.push(`[${sel}]`);
  p.push(`@(${n.rect.x},${n.rect.y}) ${n.rect.w}×${n.rect.h}`);
  if (n.z !== 0) p.push(`z:${n.z}`);
  if (n.role) p.push(`role:${n.role}`);
  if (n.display !== "block" && n.display !== "inline") p.push(`display:${n.display}`);
  if (n.text) p.push(`"${n.text}"`);
  if (n.addr) p.push(`addr:${n.addr}`);
  let r = pad + p.join(" ");
  for (const c of n.children) r += "\n" + encode(c, indent + 1);
  return r;
}

// ═══════════════════════════════════════════════════════
//  수집 실행
// ═══════════════════════════════════════════════════════

function runCollection(): void {
  counter = 0;
  const root = document.getElementById("sample-layout");
  const canvas = document.getElementById("canvas");
  if (!root || !canvas) return;

  const prevScroll = canvas.scrollTop;
  canvas.scrollTop = 0;

  const br = root.getBoundingClientRect();
  const origin = { ox: br.left, oy: br.top, sy: 0 };
  const pageW = canvas.clientWidth;
  const pageH = root.scrollHeight;

  const rootNode = collect(root, 0, origin);
  canvas.scrollTop = prevScroll;

  if (!rootNode) {
    const st = document.getElementById("status-text");
    if (st) st.textContent = "Error";
    return;
  }

  const allNodes = flatten(rootNode);
  const layers = buildLayers(allNodes);
  const relations = detectInlineRelations(allNodes);

  doc = { root: rootNode, nodes: allNodes, layers, relations, pageW, pageH, url: location.href, ts: new Date().toISOString() };
  nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  selectedId = null;
  clearSelection();

  // 패키지 collectLayout
  try {
    rlscDoc = collectLayout(root, { minSize: 2, maxDepth: 20 });
  } catch (e) {
    console.error("[rlsc] collectLayout 실패:", e);
    rlscDoc = null;
  }

  renderTree();
  renderLayers();
  renderContext();
  try { renderMetrics(); } catch (e) { console.error("[rlsc] renderMetrics:", e); setPanel("panel-metrics", `renderMetrics 오류: ${escHtml(String(e))}`); }
  try { renderPattern(); } catch (e) { console.error("[rlsc] renderPattern:", e); setPanel("panel-pattern", `renderPattern 오류: ${escHtml(String(e))}`); }
  try { renderSVG(); } catch (e) { console.error("[rlsc] renderSVG:", e); }
  if (overlayOn) drawBboxOverlay();

  setupInteraction();

  const si = document.getElementById("stat-info");
  const sd = document.getElementById("status-dot");
  const stxt = document.getElementById("status-text");
  if (si) si.textContent = `${allNodes.length} nodes · ${layers.length} layers · ${pageW}×${pageH}px`;
  if (sd) sd.style.background = "var(--green)";
  if (stxt) stxt.textContent = "Collected";
}

// ═══════════════════════════════════════════════════════
//  렌더링 — Tree / Layers / Context
// ═══════════════════════════════════════════════════════

function renderTree(): void {
  const panel = document.getElementById("panel-tree");
  if (!panel || !doc) return;
  const header = `RLSC/1.0\npage: ${doc.pageW}×${doc.pageH}\nurl: ${doc.url}\n---`;

  const lines: string[] = [];
  function walk(n: InlineNode, indent: number): void {
    const pad = "  ".repeat(indent);
    const p: string[] = [];
    let sel = n.tag;
    if (n.id.includes("#")) sel = n.id.split("__")[0]!;
    else if (n.cls.length) sel += "." + n.cls[0];
    p.push(`<span class="mk-tag">[${sel}]</span>`);
    p.push(`<span class="mk-rect">@(${n.rect.x},${n.rect.y}) ${n.rect.w}×${n.rect.h}</span>`);
    if (n.z !== 0) p.push(`<span class="mk-z">z:${n.z}</span>`);
    if (n.role) p.push(`<span class="mk-role">role:${n.role}</span>`);
    if (n.display !== "block" && n.display !== "inline") p.push(`display:${n.display}`);
    if (n.text) p.push(`<span class="mk-text">"${escHtml(n.text)}"</span>`);
    if (n.addr) p.push(`<span class="mk-addr">addr:${n.addr}</span>`);
    lines.push(`<div class="tree-row" data-nid="${n.id}">${pad}${p.join(" ")}</div>`);
    for (const c of n.children) walk(c, indent + 1);
  }
  walk(doc.root, 0);

  panel.innerHTML = `<div style="padding:12px;white-space:pre;word-break:break-all"><div class="mk-section">${escHtml(header)}</div>\n${lines.join("\n")}</div>`;
  panel.querySelectorAll<HTMLElement>(".tree-row").forEach((row) => {
    row.addEventListener("click", () => selectNode(row.dataset["nid"] ?? ""));
  });
}

function renderLayers(): void {
  const panel = document.getElementById("panel-layers");
  if (!panel || !doc) return;
  const colors: Record<string, string> = {
    background: "var(--text-muted)", content: "var(--green)", sticky: "var(--yellow)",
    overlay: "var(--orange)", modal: "var(--red)", tooltip: "var(--purple)",
  };
  let html = "";
  for (const l of doc.layers) {
    const col = colors[l.role] ?? "var(--text-secondary)";
    html += `<div class="layer-card" style="border-left:3px solid ${col}">`;
    html += `<div style="display:flex;justify-content:space-between;margin-bottom:4px">`;
    html += `<span style="color:${col};font-weight:600">z:${l.z} ${l.role}</span>`;
    html += `<span style="color:var(--text-muted)">${l.nodes.length} nodes · ${formatArea(l.area)}</span>`;
    html += `</div><div style="display:flex;flex-wrap:wrap;gap:4px">`;
    for (const n of l.nodes.slice(0, 20)) {
      const sel = n.id.split("__")[0];
      html += `<span class="badge" style="cursor:pointer;font-size:10px" data-nid="${n.id}" title="${n.rect.w}×${n.rect.h} @(${n.rect.x},${n.rect.y})">${sel}</span>`;
    }
    if (l.nodes.length > 20) html += `<span class="badge">+${l.nodes.length - 20}</span>`;
    html += `</div></div>`;
  }
  panel.innerHTML = html;
  panel.querySelectorAll<HTMLElement>("[data-nid]").forEach((el) => {
    el.addEventListener("click", () => selectNode(el.dataset["nid"] ?? ""));
  });
}

function renderContext(): void {
  const panel = document.getElementById("panel-context");
  if (!panel || !doc) return;
  const vis = doc.nodes.filter((n) => n.visible);
  const vpArea = doc.pageW * doc.pageH;
  const top5 = [...vis].sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h).slice(0, 5);
  const roleCounts: Record<string, number> = {};
  for (const n of vis) {
    const r = n.role ?? "none";
    roleCounts[r] = (roleCounts[r] ?? 0) + 1;
  }

  const treeText = encode(doc.root, 0);
  const layerText = doc.layers.map((l) =>
    `  z:${String(l.z).padStart(5)}  ${l.role.padEnd(12)} [${l.nodes.slice(0, 5).map((n) => n.id.split("__")[0]).join(", ")}${l.nodes.length > 5 ? ` +${l.nodes.length - 5}` : ""}]`,
  ).join("\n");

  const prompt = `# R.L.S.C. 레이아웃 분석

## 페이지
- URL: ${doc.url}
- 좌표계: ${doc.pageW}×${doc.pageH}px (전체 문서)
- 가시 요소: ${vis.length}개
- 레이어: ${doc.layers.length}개

## 주요 영역 (면적 순)
${top5.map((n) => `- ${n.id.split("__")[0]}${n.role ? ` (${n.role})` : ""}: @(${n.rect.x},${n.rect.y}) ${n.rect.w}×${n.rect.h} (${((n.rect.w * n.rect.h) / vpArea * 100).toFixed(1)}%)`).join("\n")}

## 역할 분포
${Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([r, c]) => `${r}: ${c}`).join(", ")}

## 구조 (R.L.S.C. 마크업)
\`\`\`
${treeText}
\`\`\`

## 레이어 스택
\`\`\`
${layerText}
\`\`\``;

  panel.innerHTML = `<div style="padding:12px"><div style="margin-bottom:8px"><strong style="color:var(--accent)">LLM Context</strong></div><button class="btn" style="margin-bottom:12px" onclick="copyContext()">Copy to Clipboard</button><pre id="ctx-output" style="color:var(--text-secondary);font-size:10px;line-height:1.5;white-space:pre-wrap;word-break:break-all">${escHtml(prompt)}</pre></div>`;
}

// ═══════════════════════════════════════════════════════
//  렌더링 — Metrics / Pattern / SVG / Conformance
// ═══════════════════════════════════════════════════════

function renderMetrics(): void {
  const panel = document.getElementById("panel-metrics");
  if (!panel) return;
  if (!rlscDoc) { panel.innerHTML = `<span style="color:var(--text-muted);padding:12px;display:block">패키지 수집 실패</span>`; return; }

  const metrics = measureLayout(rlscDoc);

  function row(k: string, v: string | number): string {
    return metricsRow(k, escHtml(String(v)));
  }

  const vp = rlscDoc.viewport;
  const { balance: bal, gridPattern: grid, columnSystem: cs, proximityGroups: prox, aspectRatioDistribution: ar } = metrics;

  let html = `<div style="padding:12px">`;
  html += metricsSection("뷰포트", row("크기", `${vp.width}×${vp.height} px`));
  html += metricsSection("균형 (balance)", row("x ratio", bal.x.toFixed(3)) + row("y ratio", bal.y.toFixed(3)));
  html += metricsSection("흐름 (flow)", row("dominantFlow", metrics.dominantFlow) + row("goldenRatioScore", metrics.goldenRatioScore.toFixed(3)));

  html += grid
    ? metricsSection("그리드 패턴", row("cols", grid.cols) + row("rows", grid.rows))
    : metricsSection("그리드 패턴", `<div class="metrics-row"><span class="metrics-key" style="color:var(--text-muted)">없음</span></div>`);

  if (cs) {
    html += metricsSection("컬럼 시스템",
      row("cols", cs.cols) + row("gutterPx", cs.gutterPx) +
      (cs.marginPx !== undefined ? row("marginPx", cs.marginPx) : "") +
      (cs.rowGapPx !== undefined ? row("rowGapPx", cs.rowGapPx) : ""),
    );
  }

  const sv = metrics.spacingValues;
  html += metricsSection("간격 (spacing)",
    row("base", metrics.spacingBase ?? "—") +
    row(`values (${sv.length})`, [...sv].slice(0, 8).join(", ") + (sv.length > 8 ? " ..." : "")),
  );

  html += metricsSection(`근접성 그룹 (${prox.length})`,
    [...prox].slice(0, 5).map((g, i) =>
      row(`group ${i + 1}`, `${g.nodeIds.length} nodes · centroid (${g.centroid.x.toFixed(0)},${g.centroid.y.toFixed(0)})`),
    ).join("") + (prox.length > 5 ? row("...", `+${prox.length - 5} more`) : ""),
  );

  html += metricsSection("종횡비 분포 (상위 5)",
    [...ar].slice(0, 5).map((a, i) => row(`#${i + 1}`, `${a.ratio.toFixed(3)} · ${a.count}건`)).join(""),
  );

  html += `</div>`;
  panel.innerHTML = html;
}

function renderPattern(): void {
  const panel = document.getElementById("panel-pattern");
  if (!panel) return;
  if (!rlscDoc) { panel.innerHTML = `<span style="color:var(--text-muted);padding:12px;display:block">패키지 수집 실패</span>`; return; }

  const metrics = measureLayout(rlscDoc);
  const pattern = classifyLayout(metrics);

  type PatternFieldValue = NonNullable<LayoutPattern[keyof LayoutPattern]>;
  type PatternEntry = [string, PatternFieldValue];

  function row(k: string, v: PatternFieldValue): string {
    return metricsRow(k, escHtml(JSON.stringify(v)));
  }

  function definedEntries(entries: [string, PatternFieldValue | undefined][]): PatternEntry[] {
    return entries.filter((e): e is PatternEntry => e[1] !== undefined);
  }

  const pageFields = definedEntries([
    ["gridPattern", pattern.gridPattern],
    ["flowDirection", pattern.flowDirection],
    ["goldenRatio", pattern.goldenRatio],
    ["balanceRatio", pattern.balanceRatio],
  ]);

  const structFields = definedEntries([
    ["gridSystem", pattern.gridSystem],
    ["spacing", pattern.spacing],
    ["gestalt", pattern.gestalt],
    ["proportions", pattern.proportions],
  ]);

  let html = `<div style="padding:12px">`;
  html += `<div style="margin-bottom:12px"><div class="metrics-title">패턴 분류 결과</div><pre style="color:var(--text-secondary);font-size:10px;line-height:1.5;white-space:pre-wrap;background:var(--bg-tertiary);padding:8px;border-radius:4px;overflow:auto">${escHtml(JSON.stringify(pattern, null, 2))}</pre></div>`;
  if (pageFields.length > 0) html += metricsSection("페이지 수준", pageFields.map(([k, v]) => row(k, v)).join(""));
  if (structFields.length > 0) html += metricsSection("구조 단위 수준", structFields.map(([k, v]) => row(k, v)).join(""));
  if (pageFields.length === 0 && structFields.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:11px">패턴 분류 불가 — 레이아웃 데이터 부족</div>`;
  }
  html += `</div>`;
  panel.innerHTML = html;
}

function renderSVG(): void {
  if (!rlscDoc) return;
  const container = document.getElementById("svg-container");
  if (!container) return;

  const colorEl = document.getElementById("svg-opt-color") as HTMLSelectElement | null;
  const colorBy = (colorEl?.value ?? "role") as CanvasRenderOptions["colorBy"];
  const showGrid = (document.getElementById("svg-opt-grid") as HTMLInputElement | null)?.checked ?? true;
  const showBalance = (document.getElementById("svg-opt-balance") as HTMLInputElement | null)?.checked ?? true;
  const showFlow = (document.getElementById("svg-opt-flow") as HTMLInputElement | null)?.checked ?? false;
  const showGroups = (document.getElementById("svg-opt-groups") as HTMLInputElement | null)?.checked ?? false;

  const metricsForGroups = showGroups ? measureLayout(rlscDoc) : undefined;

  const svg = renderToSVG(rlscDoc, {
    colorBy,
    showGrid,
    showBalance,
    showFlow,
    showGroups,
    opacity: 0.65,
    ...(metricsForGroups ? { metrics: metricsForGroups } : {}),
  });
  container.innerHTML = svg;
}

function runConformance(): void {
  const resultEl = document.getElementById("conformance-result");
  if (!resultEl) return;
  if (!rlscDoc) { resultEl.innerHTML = `<span style="color:var(--text-muted)">먼저 Collect를 실행하세요</span>`; return; }

  const raw = (document.getElementById("conformance-intent") as HTMLTextAreaElement | null)?.value?.trim() ?? "";
  if (!raw) { resultEl.innerHTML = `<span style="color:var(--text-muted)">인텐트 JSON을 입력하세요</span>`; return; }

  let intent: LayoutPattern;
  try { intent = JSON.parse(raw) as LayoutPattern; }
  catch (e) { resultEl.innerHTML = `<span style="color:var(--red)">JSON 파싱 오류: ${escHtml(String(e))}</span>`; return; }

  const result = checkConformance(rlscDoc, intent);
  const pct = Math.round(result.score * 100);
  const scoreColor = result.score >= 0.8 ? "var(--green)" : result.score >= 0.5 ? "var(--yellow)" : "var(--red)";

  let html = `<div>`;
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:600">Conformance Score</span><span style="font-size:20px;font-weight:700;color:${scoreColor}">${pct}%</span></div>`;
  html += `<div class="score-bar"><div class="score-fill" style="width:${pct}%;background:${scoreColor}"></div></div>`;

  if (result.violations.length === 0) {
    html += `<div style="color:var(--green);font-size:11px;margin-bottom:8px">위반 없음 — 모든 선언 필드 충족</div>`;
  } else {
    html += `<div class="metrics-title" style="margin-bottom:6px">${result.violations.length}건 위반</div>`;
    for (const v of result.violations) {
      const cls = v.severity === "error" ? "violation-error" : "violation-warning";
      const col = v.severity === "error" ? "var(--red)" : "var(--yellow)";
      html += `<div class="violation-item ${cls}"><div style="display:flex;gap:6px;margin-bottom:2px"><span style="color:${col};font-weight:600;font-size:10px">${v.severity.toUpperCase()}</span><span style="color:var(--accent);font-size:10px">${escHtml(v.rule)}</span></div><div style="color:var(--text-secondary);font-size:10px">${escHtml(v.description)}</div></div>`;
    }
  }

  html += `<div style="margin-top:10px"><div class="metrics-title" style="margin-bottom:4px">인식된 패턴</div><pre style="color:var(--text-secondary);font-size:9px;line-height:1.4;white-space:pre-wrap;background:var(--bg-tertiary);padding:6px;border-radius:3px;overflow:auto">${escHtml(JSON.stringify(result.recognized, null, 2))}</pre></div></div>`;

  resultEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  인터랙션
// ═══════════════════════════════════════════════════════

function setupInteraction(): void {
  const hhl = document.getElementById("hover-hl");
  const hlbl = document.getElementById("hover-hl-label");
  if (!doc || !hhl || !hlbl) return;

  for (const n of doc.nodes) {
    if (!n._el) continue;
    n._el.addEventListener("mouseenter", (e) => {
      e.stopPropagation();
      positionOverlay(hhl, n.rect);
      hlbl.textContent = `${n.id.split("__")[0]} @(${n.rect.x},${n.rect.y}) ${n.rect.w}×${n.rect.h} z:${n.z}`;
      hhl.classList.add("visible");
    });
    n._el.addEventListener("mouseleave", () => hhl.classList.remove("visible"));
    n._el.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); selectNode(n.id); });
  }
}

function selectNode(id: string): void {
  if (!doc || !id || !nodeMap) return;
  const n = nodeMap.get(id);
  if (!n) return;
  selectedId = id;

  const sh = document.getElementById("select-hl");
  if (sh) {
    positionOverlay(sh, n.rect);
    const lbl = document.getElementById("select-hl-label");
    if (lbl) lbl.textContent = `${n.id.split("__")[0]} · ${n.rect.w}×${n.rect.h} · z:${n.z}`;
    sh.classList.add("visible");
  }

  document.querySelectorAll(".tree-row.selected").forEach((r) => r.classList.remove("selected"));
  const row = document.querySelector<HTMLElement>(`.tree-row[data-nid="${id}"]`);
  if (row) { row.classList.add("selected"); row.scrollIntoView({ block: "center", behavior: "smooth" }); }

  const bar = document.getElementById("selection-bar");
  if (bar) {
    const area = n.rect.w * n.rect.h;
    const pct = (area / (doc.pageW * doc.pageH) * 100).toFixed(1);
    bar.innerHTML = `<div style="display:flex;align-items:center;gap:12px"><span style="color:var(--green);font-weight:600">${n.id.split("__")[0]}</span><span class="mk-rect">@(${n.rect.x},${n.rect.y}) ${n.rect.w}×${n.rect.h}</span><span class="mk-z">z:${n.z}</span>${n.role ? `<span class="mk-role">role:${n.role}</span>` : ""}<span style="color:var(--text-muted)">${pct}% · depth:${n.depth}</span>${n.addr ? `<span class="mk-addr">addr:${n.addr}</span>` : ""}<button class="btn" style="margin-left:auto;font-size:10px;padding:2px 8px" onclick="clearSelection()">Clear</button></div>`;
    bar.classList.add("visible");
  }

  const stxt = document.getElementById("status-text");
  if (stxt) stxt.textContent = `${n.id.split("__")[0]} — ${n.rect.w}×${n.rect.h} z:${n.z}`;
}

function clearSelection(): void {
  selectedId = null;
  document.getElementById("select-hl")?.classList.remove("visible");
  document.getElementById("selection-bar")?.classList.remove("visible");
  document.querySelectorAll(".tree-row.selected").forEach((r) => r.classList.remove("selected"));
}

function positionOverlay(el: HTMLElement, rect: InlineRect): void {
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.w}px`;
  el.style.height = `${rect.h}px`;
}

function toggleOverlay(): void {
  overlayOn = !overlayOn;
  document.getElementById("btn-overlay")?.classList.toggle("active", overlayOn);
  if (overlayOn && doc) drawBboxOverlay();
  else clearBboxOverlay();
}

function drawBboxOverlay(): void {
  const container = document.getElementById("bbox-container");
  if (!container || !doc) return;
  container.innerHTML = "";
  for (const n of doc.nodes) {
    if (!n.visible || n.rect.w < 8) continue;
    const div = document.createElement("div");
    div.className = "bbox-overlay visible";
    div.style.cssText = `left:${n.rect.x}px;top:${n.rect.y}px;width:${n.rect.w}px;height:${n.rect.h}px;border-color:${hslFromId(n.id)}88`;
    container.appendChild(div);
  }
}

function clearBboxOverlay(): void {
  const c = document.getElementById("bbox-container");
  if (c) c.innerHTML = "";
}

function copyContext(): void {
  const el = document.getElementById("ctx-output");
  if (el) {
    void navigator.clipboard.writeText(el.textContent ?? "").then(() => {
      const stxt = document.getElementById("status-text");
      if (stxt) stxt.textContent = "Copied!";
    });
  }
}

// ─── 유틸 ─────────────────────────────────────────────

function hslFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${h % 360},55%,55%)`;
}

function formatArea(px: number): string {
  if (px > 1e6) return `${(px / 1e6).toFixed(1)}M px²`;
  if (px > 1e3) return `${(px / 1e3).toFixed(0)}K px²`;
  return `${px} px²`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function metricsRow(k: string, v: string): string {
  return `<div class="metrics-row"><span class="metrics-key">${k}</span><span class="metrics-val">${v}</span></div>`;
}

function metricsSection(title: string, content: string): string {
  return `<div class="metrics-section"><div class="metrics-title">${title}</div>${content}</div>`;
}

function setPanel(id: string, msg: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<span style="color:var(--red);padding:12px;display:block">${msg}</span>`;
}

// ─── 탭 + 초기화 ─────────────────────────────────────

document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(`panel-${t.dataset["tab"]}`)?.classList.add("active");
  });
});

window.addEventListener("load", () => setTimeout(runCollection, 200));
let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(runCollection, 300); });

// onclick 속성에서 접근 가능하도록 전역 노출
window["toggleOverlay"] = toggleOverlay;
window["runCollection"] = runCollection;
window["copyContext"] = copyContext;
window["clearSelection"] = clearSelection;
window["renderSVG"] = renderSVG;
window["runConformance"] = runConformance;
