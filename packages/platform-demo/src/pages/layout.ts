// ═══════════════════════════════════════════════════════════════════════════
//  UUID 레이아웃 시뮬레이터 — N차원 인덱스를 UUID PK에 매핑
// ═══════════════════════════════════════════════════════════════════════════

import {
  analyzeLayoutSim,
  dimMaxForBudget,
  dimMaxBig,
  dimMaxApprox,
  productExcluding,
  shapeProduct,
  shapeProductUncapped,
  autoBalancedShape,
  simDecode,
  simEncode,
  simPackUUID,
  formatLargeNumber,
  utilizationBig,
  type LayoutSimAnalysis,
} from "weighted-index";

// ── State ────────────────────────────────────────────────────────────────────

type CalcMode = "number" | "bigint";

interface LayoutState {
  numDims: number;
  prefixChars: number;
  versionChars: number;
  shardChars: number;
  prefixVal: number;
  versionVal: number;
  shardVal: number;
  shape: number[];
  analysis: LayoutSimAnalysis;
  mode: CalcMode;
  // progression
  playing: boolean;
  currentIndex: number;
  speed: number; // ms per step
  timerId: number | null;
  progressionRows: { index: number; coords: number[]; uuid: string }[];
}

function createInitialState(): LayoutState {
  const cfg = { prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 };
  const analysis = analyzeLayoutSim(cfg);
  // Start with small reasonable values, not max
  const shape = new Array(cfg.numDims).fill(10);
  return {
    ...cfg,
    prefixVal: 0xab,
    versionVal: 1,
    shardVal: 0,
    shape,
    analysis,
    mode: "number" as CalcMode,
    playing: false,
    currentIndex: 0,
    speed: 200,
    timerId: null,
    progressionRows: [],
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderLayoutPage(container: HTMLElement): void {
  container.innerHTML = "";
  const st = createInitialState();

  const wrap = document.createElement("div");
  wrap.className = "lay-wrap";

  // ── Header ─────────────────────────────────────────────────────────────
  function fieldMaxVal(chars: number): number {
    return chars > 0 ? 16 ** chars - 1 : 0;
  }
  function hexPreview(chars: number, val: number): string {
    if (chars <= 0) return "—";
    return "0x" + Math.min(val, fieldMaxVal(chars)).toString(16).toUpperCase().padStart(chars, "0");
  }

  // ── Header + inline config (title row) ─────────────────────────────────
  const header = document.createElement("div");
  header.className = "lay-header";
  header.innerHTML = `
    <h2 class="lay-title">UUID 레이아웃 시뮬레이터</h2>
    <div class="lay-hdr-cfg">
      <label class="lay-hc-label">Dims</label>
      <input type="number" class="lay-hc-input" id="lay-num-dims" min="1" max="16" value="${st.numDims}" />
      <span class="lay-hc-sep"></span>
      <label class="lay-hc-label">Prefix</label>
      <input type="range" class="lay-hc-slider" id="lay-prefix-chars" min="0" max="8" value="${st.prefixChars}" />
      <span class="lay-hc-val" id="lay-prefix-chars-val">${st.prefixChars}</span>
      <input type="number" class="lay-hc-input lay-hc-input-val" id="lay-prefix-val" min="0" max="${fieldMaxVal(st.prefixChars)}" value="${st.prefixVal}" ${st.prefixChars === 0 ? "disabled" : ""} />
      <span class="lay-hc-hex" id="lay-prefix-hex">${hexPreview(st.prefixChars, st.prefixVal)}</span>
      <span class="lay-hc-sep"></span>
      <label class="lay-hc-label">Ver</label>
      <input type="range" class="lay-hc-slider" id="lay-version-chars" min="0" max="8" value="${st.versionChars}" />
      <span class="lay-hc-val" id="lay-version-chars-val">${st.versionChars}</span>
      <input type="number" class="lay-hc-input lay-hc-input-val" id="lay-version-val" min="0" max="${fieldMaxVal(st.versionChars)}" value="${st.versionVal}" ${st.versionChars === 0 ? "disabled" : ""} />
      <span class="lay-hc-hex" id="lay-version-hex">${hexPreview(st.versionChars, st.versionVal)}</span>
      <span class="lay-hc-sep"></span>
      <label class="lay-hc-label">Shard</label>
      <input type="range" class="lay-hc-slider" id="lay-shard-chars" min="0" max="8" value="${st.shardChars}" />
      <span class="lay-hc-val" id="lay-shard-chars-val">${st.shardChars}</span>
      <input type="number" class="lay-hc-input lay-hc-input-val" id="lay-shard-val" min="0" max="${fieldMaxVal(st.shardChars)}" value="${st.shardVal}" ${st.shardChars === 0 ? "disabled" : ""} />
      <span class="lay-hc-hex" id="lay-shard-hex">${hexPreview(st.shardChars, st.shardVal)}</span>
      <span class="lay-hc-sep"></span>
      <div class="lay-mode-toggle" id="lay-mode-toggle">
        <button class="lay-mode-btn lay-mode-active" id="lay-mode-number">Number</button>
        <button class="lay-mode-btn" id="lay-mode-bigint">BigInt</button>
      </div>
    </div>
  `;
  wrap.appendChild(header);

  // configSection is no longer used — config is in header now
  const configSection = { innerHTML: "" } as HTMLElement; // stub for compatibility
  // ── UUID structure bar ─────────────────────────────────────────────────
  const structBar = document.createElement("div");
  structBar.className = "lay-struct";
  structBar.id = "lay-struct";

  // ── Analysis box ───────────────────────────────────────────────────────
  const analysisBox = document.createElement("div");
  analysisBox.className = "lay-analysis";
  analysisBox.id = "lay-analysis";

  // ── Main two-column layout (fills screen) ──────────────────────────────
  const main = document.createElement("div");
  main.className = "lay-main";

  // ── LEFT column: config → struct → analysis → sliders → graph ─────────
  const leftCol = document.createElement("div");
  leftCol.className = "lay-main-left";

  leftCol.appendChild(structBar);
  leftCol.appendChild(analysisBox);

  // Sliders
  const sliderSection = document.createElement("div");
  sliderSection.className = "lay-slider-section";
  sliderSection.innerHTML = `<div class="lay-section-title">차원 슬라이더</div>`;
  const sliderContainer = document.createElement("div");
  sliderContainer.className = "lay-sliders";
  sliderContainer.id = "lay-sliders";
  sliderSection.appendChild(sliderContainer);
  const shapeSummary = document.createElement("div");
  shapeSummary.className = "lay-shape-summary";
  shapeSummary.id = "lay-shape-summary";
  sliderSection.appendChild(shapeSummary);
  leftCol.appendChild(sliderSection);

  // Graph (bottom of left)
  const graphSection = document.createElement("div");
  graphSection.className = "lay-graph-section";
  graphSection.innerHTML = `<div class="lay-section-title">차원별 최댓값</div>`;
  const graph = document.createElement("div");
  graph.className = "lay-graph";
  graph.id = "lay-graph";
  graphSection.appendChild(graph);
  leftCol.appendChild(graphSection);

  main.appendChild(leftCol);

  // ── RIGHT column: UUID preview → index progression ────────────────────
  const rightCol = document.createElement("div");
  rightCol.className = "lay-main-right";

  // UUID preview
  const uuidSection = document.createElement("div");
  uuidSection.className = "lay-uuid-section";
  uuidSection.innerHTML = `<div class="lay-section-title">UUID 미리보기</div>`;
  const uuidPreview = document.createElement("div");
  uuidPreview.className = "lay-uuid-preview";
  uuidPreview.id = "lay-uuid-preview";
  uuidSection.appendChild(uuidPreview);
  rightCol.appendChild(uuidSection);

  // Index progression
  const progSection = document.createElement("div");
  progSection.className = "lay-prog-section";
  progSection.innerHTML = `<div class="lay-section-title">인덱스 순차 진행</div>`;
  const progControls = document.createElement("div");
  progControls.className = "lay-prog-controls";
  progControls.innerHTML = `
    <button class="lay-prog-btn" id="lay-prog-play">▶ Play</button>
    <button class="lay-prog-btn" id="lay-prog-pause" disabled>⏸ Pause</button>
    <button class="lay-prog-btn" id="lay-prog-reset">↺ Reset</button>
    <label class="lay-prog-speed-label">속도</label>
    <input type="range" class="lay-prog-speed" id="lay-prog-speed" min="20" max="1000" value="${st.speed}" />
    <span class="lay-prog-speed-val" id="lay-prog-speed-val">${st.speed}ms</span>
    <span class="lay-prog-idx" id="lay-prog-idx">index: 0</span>
  `;
  progSection.appendChild(progControls);
  const progTable = document.createElement("div");
  progTable.className = "lay-prog-table-wrap";
  const progTableInner = document.createElement("div");
  progTableInner.className = "lay-prog-table";
  progTableInner.id = "lay-prog-table";
  progTable.appendChild(progTableInner);
  progSection.appendChild(progTable);
  rightCol.appendChild(progSection);

  main.appendChild(rightCol);

  wrap.appendChild(main);
  container.appendChild(wrap);

  // ── DOM refs ───────────────────────────────────────────────────────────
  const elNumDims = document.getElementById("lay-num-dims") as HTMLInputElement;
  const elPrefixChars = document.getElementById("lay-prefix-chars") as HTMLInputElement;
  const elPrefixCharsVal = document.getElementById("lay-prefix-chars-val")!;
  const elPrefixVal = document.getElementById("lay-prefix-val") as HTMLInputElement;
  const elVersionChars = document.getElementById("lay-version-chars") as HTMLInputElement;
  const elVersionCharsVal = document.getElementById("lay-version-chars-val")!;
  const elVersionVal = document.getElementById("lay-version-val") as HTMLInputElement;
  const elShardChars = document.getElementById("lay-shard-chars") as HTMLInputElement;
  const elShardCharsVal = document.getElementById("lay-shard-chars-val")!;
  const elShardVal = document.getElementById("lay-shard-val") as HTMLInputElement;
  const elPrefixHex = document.getElementById("lay-prefix-hex")!;
  const elVersionHex = document.getElementById("lay-version-hex")!;
  const elShardHex = document.getElementById("lay-shard-hex")!;
  const elStruct = document.getElementById("lay-struct")!;
  const elAnalysis = document.getElementById("lay-analysis")!;
  const elGraph = document.getElementById("lay-graph")!;
  const elSliders = document.getElementById("lay-sliders")!;
  const elShapeSummary = document.getElementById("lay-shape-summary")!;
  const elUuidPreview = document.getElementById("lay-uuid-preview")!;
  const elProgTable = document.getElementById("lay-prog-table")!;
  const elProgPlay = document.getElementById("lay-prog-play") as HTMLButtonElement;
  const elProgPause = document.getElementById("lay-prog-pause") as HTMLButtonElement;
  const elProgReset = document.getElementById("lay-prog-reset") as HTMLButtonElement;
  const elProgSpeed = document.getElementById("lay-prog-speed") as HTMLInputElement;
  const elProgSpeedVal = document.getElementById("lay-prog-speed-val")!;
  const elProgIdx = document.getElementById("lay-prog-idx")!;

  // ── Event handlers ─────────────────────────────────────────────────────

  function reanalyze(): void {
    st.analysis = analyzeLayoutSim({
      prefixChars: st.prefixChars,
      versionChars: st.versionChars,
      shardChars: st.shardChars,
      numDims: st.numDims,
    });
  }

  function rebuildShape(): void {
    // Start with small values (10 per dim) so sliders aren't pinned at max
    st.shape = new Array(st.numDims).fill(10);
    resetProgression();
  }

  function onConfigChange(): void {
    st.numDims = Math.max(1, Math.min(16, +elNumDims.value || 1));
    st.prefixChars = +elPrefixChars.value;
    st.versionChars = +elVersionChars.value;
    st.shardChars = +elShardChars.value;

    // Cap total to leave at least 1 char for index
    const total = st.prefixChars + st.versionChars + st.shardChars;
    if (total >= 32) {
      st.shardChars = Math.max(0, 31 - st.prefixChars - st.versionChars);
      elShardChars.value = String(st.shardChars);
    }

    elPrefixCharsVal.textContent = String(st.prefixChars);
    elVersionCharsVal.textContent = String(st.versionChars);
    elShardCharsVal.textContent = String(st.shardChars);

    // Update value input max, clamp values, toggle disabled
    const pMax = fieldMaxVal(st.prefixChars);
    const vMax = fieldMaxVal(st.versionChars);
    const sMax = fieldMaxVal(st.shardChars);

    elPrefixVal.max = String(pMax);
    elVersionVal.max = String(vMax);
    elShardVal.max = String(sMax);

    elPrefixVal.disabled = st.prefixChars === 0;
    elVersionVal.disabled = st.versionChars === 0;
    elShardVal.disabled = st.shardChars === 0;

    // Clamp values to new max
    if (st.prefixVal > pMax) { st.prefixVal = pMax; elPrefixVal.value = String(pMax); }
    if (st.versionVal > vMax) { st.versionVal = vMax; elVersionVal.value = String(vMax); }
    if (st.shardVal > sMax) { st.shardVal = sMax; elShardVal.value = String(sMax); }
    if (st.prefixChars === 0) { st.prefixVal = 0; elPrefixVal.value = "0"; }
    if (st.versionChars === 0) { st.versionVal = 0; elVersionVal.value = "0"; }
    if (st.shardChars === 0) { st.shardVal = 0; elShardVal.value = "0"; }

    // Update hex previews
    elPrefixHex.textContent = hexPreview(st.prefixChars, st.prefixVal);
    elVersionHex.textContent = hexPreview(st.versionChars, st.versionVal);
    elShardHex.textContent = hexPreview(st.shardChars, st.shardVal);

    reanalyze();
    rebuildShape();
    repaint();
  }

  function onValueChange(): void {
    const pMax = fieldMaxVal(st.prefixChars);
    const vMax = fieldMaxVal(st.versionChars);
    const sMax = fieldMaxVal(st.shardChars);

    st.prefixVal = Math.min(pMax, Math.max(0, +elPrefixVal.value || 0));
    st.versionVal = Math.min(vMax, Math.max(0, +elVersionVal.value || 0));
    st.shardVal = Math.min(sMax, Math.max(0, +elShardVal.value || 0));

    elPrefixHex.textContent = hexPreview(st.prefixChars, st.prefixVal);
    elVersionHex.textContent = hexPreview(st.versionChars, st.versionVal);
    elShardHex.textContent = hexPreview(st.shardChars, st.shardVal);

    repaintUUID();
  }

  elNumDims.addEventListener("change", onConfigChange);
  elPrefixChars.addEventListener("input", onConfigChange);
  elVersionChars.addEventListener("input", onConfigChange);
  elShardChars.addEventListener("input", onConfigChange);
  elPrefixVal.addEventListener("input", onValueChange);
  elVersionVal.addEventListener("input", onValueChange);
  elShardVal.addEventListener("input", onValueChange);

  // ── Mode toggle ─────────────────────────────────────────────────────────
  const elModeNumber = document.getElementById("lay-mode-number") as HTMLButtonElement;
  const elModeBigint = document.getElementById("lay-mode-bigint") as HTMLButtonElement;

  function setMode(mode: CalcMode): void {
    if (st.mode === mode) return;
    st.mode = mode;
    elModeNumber.classList.toggle("lay-mode-active", mode === "number");
    elModeBigint.classList.toggle("lay-mode-active", mode === "bigint");
    // Re-clamp shape values when switching modes
    const budget = st.analysis.indexBudget;
    for (let i = 0; i < st.shape.length; i++) {
      const others = productExcluding(st.shape, i);
      const dmax = mode === "bigint"
        ? dimMaxApprox(budget, others)
        : dimMaxForBudget(budget, others);
      st.shape[i] = Math.max(1, Math.min(st.shape[i], dmax));
    }
    resetProgression();
    repaint();
  }

  elModeNumber.addEventListener("click", () => setMode("number"));
  elModeBigint.addEventListener("click", () => setMode("bigint"));

  // ── Progression controls ───────────────────────────────────────────────

  function resetProgression(): void {
    stopProgression();
    st.currentIndex = 0;
    st.progressionRows = [];
  }

  function stopProgression(): void {
    st.playing = false;
    if (st.timerId !== null) {
      clearInterval(st.timerId);
      st.timerId = null;
    }
    elProgPlay.disabled = false;
    elProgPause.disabled = true;
  }

  function startProgression(): void {
    if (st.playing) return;
    const product = shapeProduct(st.shape);
    if (product <= 0 || st.currentIndex >= product) return;
    st.playing = true;
    elProgPlay.disabled = true;
    elProgPause.disabled = false;

    st.timerId = window.setInterval(() => {
      const product = shapeProduct(st.shape);
      if (st.currentIndex >= product) {
        stopProgression();
        return;
      }
      const coords = simDecode(st.shape, st.currentIndex);
      const uuid = simPackUUID(
        st.prefixChars, st.prefixVal,
        st.versionChars, st.versionVal,
        st.shardChars, st.shardVal,
        st.currentIndex,
      );
      st.progressionRows.push({ index: st.currentIndex, coords, uuid });
      if (st.progressionRows.length > 50) st.progressionRows.shift();
      st.currentIndex++;
      repaintProgression();
    }, st.speed);
  }

  elProgPlay.addEventListener("click", startProgression);
  elProgPause.addEventListener("click", stopProgression);
  elProgReset.addEventListener("click", () => {
    resetProgression();
    repaintProgression();
  });
  elProgSpeed.addEventListener("input", () => {
    st.speed = +elProgSpeed.value;
    elProgSpeedVal.textContent = `${st.speed}ms`;
    if (st.playing) {
      stopProgression();
      startProgression();
    }
  });

  // ── Repaint functions ──────────────────────────────────────────────────

  /** Data-only repaint: updates values that depend on shape, skips DOM rebuild. */
  function repaintData(): void {
    repaintAnalysis();
    repaintGraph();
    repaintShapeSummary();
    repaintUUID();
    repaintProgression();
  }

  /** Full repaint: rebuilds structure + sliders + all data. */
  function repaint(): void {
    repaintStruct();
    buildSliders();
    repaintData();
  }

  function repaintStruct(): void {
    const a = st.analysis;
    const gapChars = a.indexBudget > 0 ? 32 - a.usedChars - a.indexBudget : 0;
    const indexChars = a.indexBudget;

    const segments: { label: string; chars: number; cls: string }[] = [];
    if (st.prefixChars > 0) segments.push({ label: `prefix ${st.prefixChars}ch`, chars: st.prefixChars, cls: "lay-seg-prefix" });
    if (st.versionChars > 0) segments.push({ label: `ver ${st.versionChars}ch`, chars: st.versionChars, cls: "lay-seg-version" });
    if (gapChars > 0) segments.push({ label: `gap ${gapChars}ch`, chars: gapChars, cls: "lay-seg-gap" });
    if (st.shardChars > 0) segments.push({ label: `shard ${st.shardChars}ch`, chars: st.shardChars, cls: "lay-seg-shard" });
    if (indexChars > 0) segments.push({ label: `index ${indexChars}ch`, chars: indexChars, cls: "lay-seg-index" });

    elStruct.innerHTML = `
      <div class="lay-struct-bar">
        ${segments.map(s => `<div class="lay-seg ${s.cls}" style="flex:${s.chars}"><span>${s.label}</span></div>`).join("")}
      </div>
      <div class="lay-struct-ruler">
        ${segments.map(s => `<span style="flex:${s.chars}">${s.chars * 4}bit</span>`).join("")}
      </div>
    `;
  }

  function repaintAnalysis(): void {
    const a = st.analysis;

    let product: number;
    let maxDisplay: string;
    let utilPct: number;

    if (st.mode === "bigint") {
      product = shapeProductUncapped(st.shape);
      maxDisplay = a.maxProductDisplay; // BigInt exact
      utilPct = utilizationBig(product, a.indexBudget);
    } else {
      product = shapeProduct(st.shape);
      // Number mode: show capped max for consistency
      maxDisplay = a.maxProductSafe > 0
        ? a.indexBudget > 13
          ? `${formatLargeNumber(a.maxProductSafe)} (Number 한계)`
          : formatLargeNumber(a.maxProductSafe)
        : "0";
      utilPct = a.maxProductSafe > 0 ? (product / a.maxProductSafe * 100) : 0;
    }

    const utilStr = utilPct < 0.01 && product > 0 ? "< 0.01%" : utilPct.toFixed(2) + "%";

    // Warning for Number mode when budget exceeds JS safe integer range
    const warn = st.mode === "number" && a.indexBudget > 13
      ? `<div class="lay-an-warn">Number 정밀도 한계: 슬라이더 최대 ${formatLargeNumber(Number.MAX_SAFE_INTEGER)}, 실제 용량 ${a.maxProductDisplay}</div>`
      : "";

    elAnalysis.innerHTML = `
      <div class="lay-an-row"><span class="lay-an-key">Index 예산</span><span class="lay-an-val">${a.indexBudget} hex chars (${a.indexBits} bits)</span></div>
      <div class="lay-an-row"><span class="lay-an-key">최대 용량</span><span class="lay-an-val">${maxDisplay}</span></div>
      <div class="lay-an-row"><span class="lay-an-key">균등 배분</span><span class="lay-an-val">${a.uniformMax.toLocaleString()} / dim</span></div>
      <div class="lay-an-row"><span class="lay-an-key">현재 곱</span><span class="lay-an-val">${formatLargeNumber(product)}</span></div>
      <div class="lay-an-row"><span class="lay-an-key">활용률</span><span class="lay-an-val ${utilPct > 100 ? "lay-an-overflow" : ""}">${utilStr}</span></div>
      ${warn}
    `;
  }

  // Per-dim colors for graph bars
  const DIM_COLORS = [
    "#2e75b6", "#27ae60", "#e67e22", "#8e44ad",
    "#c0392b", "#16a085", "#d4ac0d", "#2c3e50",
    "#e74c3c", "#1abc9c", "#f39c12", "#9b59b6",
    "#3498db", "#2ecc71", "#e67e22", "#34495e",
  ];

  /** Log-scale percentage: how much of [1..max] is covered by val. */
  function logPct(val: number, max: number): number {
    if (max <= 1 || val <= 1) return 0;
    return Math.min(100, Math.log(val) / Math.log(max) * 100);
  }

  function repaintGraph(): void {
    const budget = st.analysis.indexBudget;

    // Compute per-dim: approx float max (for log graph), display string
    const dimInfo: { approx: number; display: string }[] = [];
    for (let i = 0; i < st.shape.length; i++) {
      const others = productExcluding(st.shape, i);
      if (st.mode === "bigint") {
        dimInfo.push({
          approx:  dimMaxApprox(budget, others),
          display: dimMaxBig(budget, others),
        });
      } else {
        const capped = dimMaxForBudget(budget, others);
        dimInfo.push({
          approx:  capped, // Number mode: graph uses capped value for consistency
          display: formatLargeNumber(capped),
        });
      }
    }
    const maxOfApprox = Math.max(2, ...dimInfo.map(d => d.approx));

    elGraph.innerHTML = st.shape.map((val, i) => {
      const { approx, display } = dimInfo[i];
      // Log scale using float approximation (works even for 10^34)
      const barPct = logPct(approx, maxOfApprox);
      const fillPct = logPct(val, approx);
      const color = DIM_COLORS[i % DIM_COLORS.length];
      return `
        <div class="lay-bar-row">
          <span class="lay-bar-label"><span class="lay-bar-dot" style="background:${color}"></span>dim ${i}</span>
          <div class="lay-bar-track" title="max: ${display}">
            <div class="lay-bar-max" style="width:${Math.max(barPct, 2)}%">
              <div class="lay-bar-fill" style="width:${fillPct}%;background:${color}"></div>
            </div>
            <span class="lay-bar-pct">${fillPct.toFixed(0)}%</span>
          </div>
          <div class="lay-bar-nums">
            <span class="lay-bar-cur" style="color:${color}">${formatLargeNumber(val)}</span>
            <span class="lay-bar-sep">/</span>
            <span class="lay-bar-mx">${display}</span>
          </div>
        </div>`;
    }).join("");
  }

  // ── Log-scale slider mapping ────────────────────────────────────────────
  //
  // Slider positions 0–1000 map to values 1–dimMax on a log scale.
  // This makes the slider usable for any range (10 to 10^15) and
  // makes inter-dim constraints visually obvious.

  const SLD_RES = 1000;

  function valToSlider(val: number, dmax: number): number {
    if (dmax <= 1) return 0;
    const clamped = Math.max(1, Math.min(val, dmax));
    return Math.round(Math.log(clamped) / Math.log(dmax) * SLD_RES);
  }

  function sliderToVal(pos: number, dmax: number): number {
    if (dmax <= 1) return 1;
    return Math.max(1, Math.round(Math.pow(dmax, pos / SLD_RES)));
  }

  // Persistent slider element refs — avoid DOM recreation during drag
  let sliderRefs: {
    range: HTMLInputElement;
    num: HTMLInputElement;
    maxSpan: HTMLSpanElement;
    dimMax: number; // cached for slider↔value conversion
  }[] = [];
  let activeDim = -1; // dim being dragged, -1 = none

  /** Build slider DOM from scratch (only on dim count change). */
  function buildSliders(): void {
    elSliders.innerHTML = "";
    sliderRefs = [];

    for (let i = 0; i < st.shape.length; i++) {
      const row = document.createElement("div");
      row.className = "lay-sld-row";

      const label = document.createElement("span");
      label.className = "lay-sld-label";
      label.textContent = `dim ${i}`;

      const range = document.createElement("input");
      range.type = "range";
      range.className = "lay-sld-range";
      range.min = "0";
      range.max = String(SLD_RES);

      const num = document.createElement("input");
      num.type = "number";
      num.className = "lay-sld-num";
      num.min = "1";
      num.value = String(st.shape[i]);

      const maxSpan = document.createElement("span");
      maxSpan.className = "lay-sld-max";

      row.append(label, range, num, maxSpan);
      elSliders.appendChild(row);
      sliderRefs.push({ range, num, maxSpan, dimMax: 1 });

      // Events — capture dim index in closure
      const dim = i;
      range.addEventListener("mousedown", () => { activeDim = dim; });
      range.addEventListener("touchstart", () => { activeDim = dim; }, { passive: true });
      range.addEventListener("input", () => {
        const ref = sliderRefs[dim];
        const actual = sliderToVal(+range.value, ref.dimMax);
        updateDim(dim, actual);
      });
      const endDrag = () => { if (activeDim === dim) activeDim = -1; };
      range.addEventListener("mouseup", endDrag);
      range.addEventListener("touchend", endDrag);
      num.addEventListener("change", () => {
        updateDim(dim, Math.max(1, +num.value || 1));
      });
    }

    syncSliders(-1); // initial sync for all
  }

  /**
   * Sync slider attributes in-place.
   * skipDim = the dim being actively dragged (don't touch its range).
   */
  function syncSliders(skipDim: number): void {
    const budget = st.analysis.indexBudget;
    for (let i = 0; i < st.shape.length; i++) {
      const ref = sliderRefs[i];
      if (!ref) continue;

      const others = productExcluding(st.shape, i);

      // Mode-dependent max and display
      const dmax = st.mode === "bigint"
        ? Math.max(1, dimMaxApprox(budget, others))
        : Math.max(1, dimMaxForBudget(budget, others));
      const dmaxDisplay = st.mode === "bigint"
        ? dimMaxBig(budget, others)
        : formatLargeNumber(dmax);
      ref.dimMax = dmax;

      ref.maxSpan.textContent = `/ ${dmaxDisplay}`;
      ref.num.max = String(Math.min(dmax, Number.MAX_SAFE_INTEGER));

      ref.num.value = String(st.shape[i]);
      if (i !== skipDim) {
        ref.range.value = String(valToSlider(st.shape[i], dmax));
      }
    }
  }

  function updateDim(dimIndex: number, newVal: number): void {
    const budget = st.analysis.indexBudget;

    // Mode-dependent clamping
    const others = productExcluding(st.shape, dimIndex);
    const dmax = st.mode === "bigint"
      ? dimMaxApprox(budget, others)   // uncapped float
      : dimMaxForBudget(budget, others); // capped at MAX_SAFE_INTEGER
    st.shape[dimIndex] = Math.max(1, Math.min(newVal, dmax));

    // Update UI in-place — skip the active slider to prevent drag interruption
    syncSliders(activeDim);
    resetProgression();
    repaintData();
  }

  function repaintShapeSummary(): void {
    let product: number;
    let utilPct: number;

    if (st.mode === "bigint") {
      product = shapeProductUncapped(st.shape);
      utilPct = utilizationBig(product, st.analysis.indexBudget);
    } else {
      product = shapeProduct(st.shape);
      const a = st.analysis;
      utilPct = a.maxProductSafe > 0 ? (product / a.maxProductSafe * 100) : 0;
    }

    const utilStr = utilPct < 0.01 && product > 0 ? "< 0.01%" : utilPct.toFixed(2) + "%";
    const overflow = utilPct > 100;

    // Format shape values — use scientific notation for large floats
    const shapeStr = st.shape.map(s =>
      s > 1e9 ? s.toExponential(2) : s.toLocaleString()
    ).join(", ");

    elShapeSummary.innerHTML = `
      <span class="lay-ss-shape">Shape: [${shapeStr}]</span>
      <span class="lay-ss-product">Product: ${formatLargeNumber(product)}</span>
      <span class="lay-ss-util ${overflow ? "lay-an-overflow" : ""}">활용률: ${utilStr}</span>
    `;
  }

  function repaintUUID(): void {
    const product = shapeProduct(st.shape);
    const maxCoords = st.shape.map(s => s);
    const lastIndex = product > 0 ? product - 1 : 0;

    // Current coords = current slider values (clamped to shape)
    const curCoords = st.shape.map(s => Math.min(s, Math.max(1, s)));
    const curIndex = simEncode(st.shape, curCoords);

    const pack = (idx: number) => simPackUUID(
      st.prefixChars, st.prefixVal,
      st.versionChars, st.versionVal,
      st.shardChars, st.shardVal,
      idx,
    );

    const prefixHex = st.prefixChars > 0 ? `0x${st.prefixVal.toString(16).toUpperCase().padStart(st.prefixChars, "0")}` : "—";
    const versionHex = st.versionChars > 0 ? `0x${st.versionVal.toString(16).toUpperCase().padStart(st.versionChars, "0")}` : "—";
    const shardHex = st.shardChars > 0 ? `0x${st.shardVal.toString(16).toUpperCase().padStart(st.shardChars, "0")}` : "—";

    elUuidPreview.innerHTML = `
      <div class="lay-uuid-row">
        <span class="lay-uuid-label">첫 번째</span>
        <code class="lay-uuid-code">${pack(0)}</code>
        <span class="lay-uuid-info">index=0 → [${st.shape.map(() => 1).join(", ")}]</span>
      </div>
      <div class="lay-uuid-row lay-uuid-row-current">
        <span class="lay-uuid-label">현재</span>
        <code class="lay-uuid-code lay-uuid-code-current">${pack(curIndex)}</code>
        <span class="lay-uuid-info">index=${curIndex.toLocaleString()} → [${curCoords.join(", ")}]</span>
      </div>
      <div class="lay-uuid-row">
        <span class="lay-uuid-label">마지막</span>
        <code class="lay-uuid-code">${pack(lastIndex)}</code>
        <span class="lay-uuid-info">index=${lastIndex.toLocaleString()} → [${maxCoords.join(", ")}]</span>
      </div>
      <div class="lay-uuid-meta">
        <span>prefix=${prefixHex}</span>
        <span>version=${versionHex}</span>
        <span>shard=${shardHex}</span>
      </div>
    `;
  }

  function repaintProgression(): void {
    elProgIdx.textContent = `index: ${st.currentIndex}`;

    if (st.progressionRows.length === 0) {
      const dimHeaders = st.shape.map((_, i) => `<th>dim ${i}</th>`).join("");
      elProgTable.innerHTML = `
        <table class="lay-ptbl">
          <thead><tr><th>#</th><th>index</th>${dimHeaders}<th>UUID</th></tr></thead>
          <tbody>
            <tr><td colspan="${st.shape.length + 3}" class="lay-ptbl-empty">Play를 눌러 순차 진행을 시작하세요</td></tr>
          </tbody>
        </table>`;
      return;
    }

    const dimHeaders = st.shape.map((_, i) => `<th>dim ${i}</th>`).join("");
    const rows = st.progressionRows.map((r, ri) => {
      const coordCells = r.coords.map((c, ci) => {
        const prev = ri > 0 ? st.progressionRows[ri - 1].coords[ci] : null;
        const changed = prev !== null && prev !== c;
        return `<td class="${changed ? "lay-ptbl-changed" : ""}">${c}</td>`;
      }).join("");
      return `<tr><td class="lay-ptbl-num">${ri + 1}</td><td class="lay-ptbl-idx">${r.index}</td>${coordCells}<td class="lay-ptbl-uuid">${r.uuid}</td></tr>`;
    }).join("");

    elProgTable.innerHTML = `
      <table class="lay-ptbl">
        <thead><tr><th>#</th><th>index</th>${dimHeaders}<th>UUID</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    // Auto-scroll to bottom
    const tableWrap = elProgTable.parentElement;
    if (tableWrap) tableWrap.scrollTop = tableWrap.scrollHeight;
  }

  // Initial render
  repaint();
}
