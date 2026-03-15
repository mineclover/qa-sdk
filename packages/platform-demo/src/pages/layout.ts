// ═══════════════════════════════════════════════════════════════════════════
//  UUID 레이아웃 시뮬레이터 — N차원 인덱스를 UUID PK에 매핑
// ═══════════════════════════════════════════════════════════════════════════

import {
  analyzeLayoutSim,
  computeLayoutViewModel,
  fieldMaxVal,
  logScalePercent,
  valToSlider,
  sliderToVal,
  shapeProduct,
  simDecode,
  simDecodeBig,
  simEncode,
  simPackUUID,
  simPackUUIDBig,
  formatLargeNumber,
  type LayoutSimAnalysis,
  type LayoutViewModel,
  type LayoutViewMode,
} from "weighted-index";
import { hexPreview } from "weighted-ui";

// ── State ────────────────────────────────────────────────────────────────────

type CalcMode = LayoutViewMode;

interface LayoutState {
  formatChars: number; // 포맷 전체 hex chars (16=int64, 24=objectId, 32=uuid)
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
  currentIndexBig: bigint;
  skipFrames: number; // 0 = 매 프레임, 1 = 1프레임 건너뜀, ...
  maxBatch: number; // 프레임당 처리 상한 (0 = 무제한, 시간 예산만 적용)
  frameBudgetMs: number; // 1프레임 연산 시간 예산 (ms)
  frameCounter: number;
  rafId: number | null;
  lastOpsPerFrame: number;
  lastFrameTime: number;
  progressionRows: { indexStr: string; coords: string[]; uuid: string }[];
}

function createInitialState(): LayoutState {
  const cfg = { formatChars: 32, prefixChars: 2, versionChars: 1, shardChars: 0, numDims: 4 };
  const analysis = analyzeLayoutSim(cfg);
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
    currentIndexBig: 0n,
    skipFrames: 0,
    maxBatch: 0,
    frameBudgetMs: 12,
    frameCounter: 0,
    rafId: null,
    lastOpsPerFrame: 0,
    lastFrameTime: 0,
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

  // ── Header + inline config (title row) ─────────────────────────────────
  const header = document.createElement("div");
  header.className = "lay-header";
  header.innerHTML = `
    <h2 class="lay-title">레이아웃 시뮬레이터</h2>
    <div class="lay-hdr-cfg">
      <label class="lay-hc-label">Format</label>
      <select class="lay-hc-input" id="lay-format" style="width:auto">
        <option value="16" ${st.formatChars === 16 ? "selected" : ""}>int64 (16ch)</option>
        <option value="24" ${st.formatChars === 24 ? "selected" : ""}>objectId (24ch)</option>
        <option value="32" ${st.formatChars === 32 ? "selected" : ""}>UUID (32ch)</option>
      </select>
      <span class="lay-hc-sep"></span>
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
      <span class="lay-hc-badge" id="lay-index-type"></span>
      <button class="lay-mode-btn lay-copy-btn" id="lay-copy-debug" title="디버그 정보 복사">📋 Copy</button>
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
  sliderSection.innerHTML = `<div class="lay-section-title">차원 슬라이더 <span class="lay-section-badge" id="lay-slider-type"></span></div>`;
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
    <div class="lay-prog-row">
      <button class="lay-prog-btn" id="lay-prog-play">▶ Play</button>
      <button class="lay-prog-btn" id="lay-prog-pause" disabled>⏸ Pause</button>
      <button class="lay-prog-btn" id="lay-prog-reset">↺ Reset</button>
      <label class="lay-prog-speed-label">스킵</label>
      <input type="range" class="lay-prog-speed" id="lay-prog-skip" min="0" max="60" value="${st.skipFrames}" />
      <span class="lay-prog-speed-val" id="lay-prog-skip-val">1/${st.skipFrames + 1}f</span>
      <label class="lay-prog-speed-label">상한</label>
      <input type="range" class="lay-prog-speed" id="lay-prog-batch" min="0" max="7" value="0" />
      <span class="lay-prog-speed-val" id="lay-prog-batch-val">무제한</span>
    </div>
    <div class="lay-prog-row lay-prog-stats">
      <span class="lay-prog-idx" id="lay-prog-idx">index: 0</span>
      <span class="lay-prog-perf" id="lay-prog-perf">—</span>
    </div>
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
  const elFormat = document.getElementById("lay-format") as HTMLSelectElement;
  const elIndexType = document.getElementById("lay-index-type")!;
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
  const elSliderType = document.getElementById("lay-slider-type")!;
  const elShapeSummary = document.getElementById("lay-shape-summary")!;
  const elUuidPreview = document.getElementById("lay-uuid-preview")!;
  const elProgTable = document.getElementById("lay-prog-table")!;
  const elProgPlay = document.getElementById("lay-prog-play") as HTMLButtonElement;
  const elProgPause = document.getElementById("lay-prog-pause") as HTMLButtonElement;
  const elProgReset = document.getElementById("lay-prog-reset") as HTMLButtonElement;
  const elProgSkip = document.getElementById("lay-prog-skip") as HTMLInputElement;
  const elProgSkipVal = document.getElementById("lay-prog-skip-val")!;
  const elProgBatch = document.getElementById("lay-prog-batch") as HTMLInputElement;
  const elProgBatchVal = document.getElementById("lay-prog-batch-val")!;
  const elProgIdx = document.getElementById("lay-prog-idx")!;
  const elProgPerf = document.getElementById("lay-prog-perf")!;

  // ── Event handlers ─────────────────────────────────────────────────────

  function reanalyze(): void {
    st.analysis = analyzeLayoutSim({
      formatChars: st.formatChars,
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
    st.formatChars = +elFormat.value || 32;
    st.numDims = Math.max(1, Math.min(16, +elNumDims.value || 1));
    st.prefixChars = +elPrefixChars.value;
    st.versionChars = +elVersionChars.value;
    st.shardChars = +elShardChars.value;

    // Cap total to leave at least 1 char for index
    const total = st.prefixChars + st.versionChars + st.shardChars;
    if (total >= st.formatChars) {
      st.shardChars = Math.max(0, st.formatChars - 1 - st.prefixChars - st.versionChars);
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

  elFormat.addEventListener("change", onConfigChange);
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

  /** indexType 자동 결정 후 모드/UI 동기화 */
  function syncIndexType(): void {
    const vm = getViewModel();
    // BigInt 필수인데 Number 모드면 자동 전환
    if (vm.indexType === "bigint" && st.mode === "number") {
      st.mode = "bigint";
    }
    // Number 버튼: BigInt 필수이면 비활성
    elModeNumber.disabled = vm.indexType === "bigint";
    elModeNumber.classList.toggle("lay-mode-active", st.mode === "number");
    elModeBigint.classList.toggle("lay-mode-active", st.mode === "bigint");
    // indexType 배지 (헤더 + 슬라이더 섹션)
    const isBig = vm.indexType === "bigint";
    elIndexType.textContent = isBig ? "BigInt 필수" : "Number OK";
    elIndexType.className = `lay-hc-badge ${isBig ? "lay-hc-badge-warn" : "lay-hc-badge-ok"}`;
    elSliderType.textContent = isBig
      ? `[BigInt] dimMax: UUID 전체 용량 기준`
      : `[Number] dimMax: MAX_SAFE_INTEGER 기준`;
    elSliderType.className = `lay-section-badge ${isBig ? "lay-hc-badge-warn" : "lay-hc-badge-ok"}`;
  }

  function setMode(mode: CalcMode): void {
    const vm = getViewModel();
    // BigInt 필수이면 Number 선택 불가
    if (mode === "number" && vm.indexType === "bigint") return;
    if (st.mode === mode) return;
    st.mode = mode;
    // Re-clamp shape values
    const vm2 = getViewModel();
    for (let i = 0; i < st.shape.length; i++) {
      st.shape[i] = Math.max(1, Math.min(st.shape[i], vm2.dims[i].sliderMax));
    }
    resetProgression();
    repaint();
  }

  elModeNumber.addEventListener("click", () => setMode("number"));
  elModeBigint.addEventListener("click", () => setMode("bigint"));

  // ── Debug copy ──────────────────────────────────────────────────────────
  const elCopyDebug = document.getElementById("lay-copy-debug") as HTMLButtonElement;
  elCopyDebug.addEventListener("click", () => {
    const vm = getViewModel();
    const dimLines = vm.dims.map(d =>
      `  dim${d.index}: ${d.value.toLocaleString()} (max: ${d.displayMax})`
    ).join("\n");

    const text = [
      `prefix: ${st.prefixChars}ch (${hexPreview(st.prefixChars, st.prefixVal)})`,
      `ver: ${st.versionChars}ch (${hexPreview(st.versionChars, st.versionVal)})`,
      `shard: ${st.shardChars}ch (${hexPreview(st.shardChars, st.shardVal)})`,
      `mode: ${vm.mode}`,
      `dims: ${st.numDims}, indexBudget: ${vm.indexBudget}ch (${vm.indexBits}bit)`,
      `effectiveMax: ${vm.effectiveMaxDisplay}${vm.isCapped ? ` (UUID: ${vm.uuidCapacityDisplay})` : ""}`,
      dimLines,
      `product: ${vm.productDisplay}`,
      `utilization: ${vm.utilizationDisplay}`,
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      elCopyDebug.textContent = "✓ Copied";
      setTimeout(() => { elCopyDebug.textContent = "📋 Copy"; }, 1500);
    });
  });

  // ── Progression controls ───────────────────────────────────────────────

  // 상한 슬라이더: 0=무제한, 1~7=고정 상한
  const BATCH_CAP_STEPS = [0, 100, 1000, 10_000, 100_000, 500_000, 1_000_000, 10_000_000];
  function batchCapLabel(v: number): string {
    const cap = BATCH_CAP_STEPS[v];
    return cap === 0 ? "무제한" : cap.toLocaleString();
  }

  // 시간 체크 주기 — 매 64회마다 performance.now() 호출 (비트 AND로 빠름)
  const TIME_CHECK_STRIDE = 64;

  function resetProgression(): void {
    stopProgression();
    st.currentIndex = 0;
    st.currentIndexBig = 0n;
    st.frameCounter = 0;
    st.lastOpsPerFrame = 0;
    st.lastFrameTime = 0;
    st.progressionRows = [];
  }

  function stopProgression(): void {
    st.playing = false;
    if (st.rafId !== null) {
      cancelAnimationFrame(st.rafId);
      st.rafId = null;
    }
    elProgPlay.disabled = false;
    elProgPause.disabled = true;
  }

  function progressionTickNumber(): void {
    const product = shapeProduct(st.shape);
    if (st.currentIndex >= product) { stopProgression(); repaintProgression(); return; }

    const remaining = product - st.currentIndex;
    const cap = st.maxBatch > 0 ? Math.min(st.maxBatch, remaining) : remaining;
    const t0 = performance.now();
    let lastCoords: number[] = [];
    let lastUuid = "";
    let count = 0;

    while (count < cap) {
      const idx = st.currentIndex + count;
      lastCoords = simDecode(st.shape, idx);
      lastUuid = simPackUUID(
        st.prefixChars, st.prefixVal,
        st.versionChars, st.versionVal,
        st.shardChars, st.shardVal, idx,
      );
      count++;
      if ((count & (TIME_CHECK_STRIDE - 1)) === 0 && performance.now() - t0 >= st.frameBudgetMs) break;
    }

    st.lastOpsPerFrame = count;
    st.lastFrameTime = performance.now() - t0;
    st.progressionRows.push({
      indexStr: (st.currentIndex + count - 1).toLocaleString(),
      coords: lastCoords.map(c => c.toLocaleString()),
      uuid: lastUuid,
    });
    if (st.progressionRows.length > 50) st.progressionRows.shift();
    st.currentIndex += count;
  }

  function progressionTickBigInt(): void {
    const shapeBig = st.shape.map(BigInt);
    const product = shapeBig.reduce((p, s) => p * s, 1n);
    if (st.currentIndexBig >= product) { stopProgression(); repaintProgression(); return; }

    const remaining = product - st.currentIndexBig;
    const capN = st.maxBatch > 0 ? BigInt(st.maxBatch) : remaining;
    const cap = remaining < capN ? remaining : capN;
    const t0 = performance.now();
    let lastCoords: bigint[] = [];
    let lastUuid = "";
    let count = 0n;

    while (count < cap) {
      const idx = st.currentIndexBig + count;
      lastCoords = simDecodeBig(shapeBig, idx);
      lastUuid = simPackUUIDBig(
        st.prefixChars, st.prefixVal,
        st.versionChars, st.versionVal,
        st.shardChars, st.shardVal, idx,
      );
      count++;
      if ((Number(count) & (TIME_CHECK_STRIDE - 1)) === 0 && performance.now() - t0 >= st.frameBudgetMs) break;
    }

    st.lastOpsPerFrame = Number(count);
    st.lastFrameTime = performance.now() - t0;
    st.progressionRows.push({
      indexStr: (st.currentIndexBig + count - 1n).toLocaleString(),
      coords: lastCoords.map(c => c.toLocaleString()),
      uuid: lastUuid,
    });
    if (st.progressionRows.length > 50) st.progressionRows.shift();
    st.currentIndexBig += count;
  }

  function progressionTick(): void {
    if (!st.playing) return;

    if (st.frameCounter === 0) {
      if (st.mode === "bigint") progressionTickBigInt();
      else progressionTickNumber();
      repaintProgression();
    }

    st.frameCounter = (st.frameCounter + 1) % (st.skipFrames + 1);
    st.rafId = requestAnimationFrame(progressionTick);
  }

  function startProgression(): void {
    if (st.playing) return;
    if (st.mode === "bigint") {
      const product = st.shape.map(BigInt).reduce((p, s) => p * s, 1n);
      if (product <= 0n || st.currentIndexBig >= product) return;
    } else {
      const product = shapeProduct(st.shape);
      if (product <= 0 || st.currentIndex >= product) return;
    }
    st.playing = true;
    st.frameCounter = 0;
    elProgPlay.disabled = true;
    elProgPause.disabled = false;
    st.rafId = requestAnimationFrame(progressionTick);
  }

  elProgPlay.addEventListener("click", startProgression);
  elProgPause.addEventListener("click", stopProgression);
  elProgReset.addEventListener("click", () => {
    resetProgression();
    repaintProgression();
  });
  elProgSkip.addEventListener("input", () => {
    st.skipFrames = +elProgSkip.value;
    st.frameCounter = 0;
    elProgSkipVal.textContent = `1/${st.skipFrames + 1}f`;
  });
  elProgBatch.addEventListener("input", () => {
    st.maxBatch = BATCH_CAP_STEPS[+elProgBatch.value] ?? 0;
    elProgBatchVal.textContent = batchCapLabel(+elProgBatch.value);
  });

  // ── Repaint functions ──────────────────────────────────────────────────

  /** Data-only repaint: updates values that depend on shape. */
  function repaintData(): void {
    repaintStruct(); // fill ratio 갱신
    repaintAnalysis();
    repaintGraph();
    repaintShapeSummary();
    repaintUUID();
    repaintProgression();
  }

  /** Full repaint: rebuilds structure + sliders + all data. */
  function repaint(): void {
    syncIndexType();
    repaintStruct();
    buildSliders();
    repaintData();
  }

  function repaintStruct(): void {
    const vm = getViewModel();
    const a = st.analysis;
    const gapChars = a.indexBudget > 0 ? a.totalChars - a.usedChars - a.indexBudget : 0;
    const fillPct = Math.round(vm.indexFillRatio * 100);

    // 비트 단위로 세그먼트 구성
    type Seg = { label: string; bits: number; cls: string; fill?: number };
    const segments: Seg[] = [];
    if (st.prefixChars > 0) segments.push({ label: `prefix ${st.prefixChars}ch`, bits: st.prefixChars * 4, cls: "lay-seg-prefix" });
    if (st.versionChars > 0) segments.push({ label: `ver ${st.versionChars}ch`, bits: st.versionChars * 4, cls: "lay-seg-version" });
    if (gapChars > 0) segments.push({ label: `gap ${gapChars}ch`, bits: gapChars * 4, cls: "lay-seg-gap" });
    if (st.shardChars > 0) segments.push({ label: `shard ${st.shardChars}ch`, bits: st.shardChars * 4, cls: "lay-seg-shard" });

    // index 영역: Number 갭 분리 + fill 오버레이
    const typeTag = vm.indexType === "bigint" ? "BigInt" : "Number";
    if (vm.numberGapBits > 0) {
      segments.push({ label: `Number 갭 ${vm.numberGapBits}bit`, bits: vm.numberGapBits, cls: "lay-seg-numgap" });
      segments.push({ label: `index ${vm.numberReachBits}bit [${typeTag}]`, bits: vm.numberReachBits, cls: "lay-seg-index", fill: fillPct });
    } else if (a.indexBudget > 0) {
      segments.push({ label: `index ${a.indexBudget}ch [${typeTag}]`, bits: a.indexBudget * 4, cls: "lay-seg-index", fill: fillPct });
    }

    elStruct.innerHTML = `
      <div class="lay-struct-bar">
        ${segments.map(s => {
          if (s.fill != null) {
            return `<div class="lay-seg ${s.cls}" style="flex:${s.bits}">
              <div class="lay-seg-fill" style="width:${s.fill}%"></div>
              <span class="lay-seg-text">${s.label}</span>
              <span class="lay-seg-pct">${s.fill}%</span>
            </div>`;
          }
          return `<div class="lay-seg ${s.cls}" style="flex:${s.bits}"><span>${s.label}</span></div>`;
        }).join("")}
      </div>
      <div class="lay-struct-ruler">
        ${segments.map(s => `<span style="flex:${s.bits}">${s.bits}bit</span>`).join("")}
      </div>
    `;
  }

  function getViewModel(): LayoutViewModel {
    return computeLayoutViewModel(st.analysis, st.shape, st.mode);
  }

  function repaintAnalysis(): void {
    const vm = getViewModel();
    const a = st.analysis;

    const noteRow = vm.capacityNote
      ? `<div class="lay-an-row lay-an-warn"><span class="lay-an-key">참고</span><span class="lay-an-val">${vm.capacityNote}</span></div>`
      : "";

    const gapRows = vm.numberGapBits > 0
      ? `<div class="lay-an-row"><span class="lay-an-key">Index 전체</span><span class="lay-an-val">${vm.indexBits} bits → ${vm.uuidCapacityDisplay}</span></div>
         <div class="lay-an-row lay-an-warn"><span class="lay-an-key">Number 갭</span><span class="lay-an-val">${vm.numberGapBits} bits 미도달 (${vm.numberReachBits} / ${vm.indexBits} bits 사용)</span></div>`
      : "";

    elAnalysis.innerHTML = `
      <div class="lay-an-row"><span class="lay-an-key">Index 예산</span><span class="lay-an-val">${vm.indexBudget} hex chars (${vm.indexBits} bits)</span></div>
      <div class="lay-an-row"><span class="lay-an-key">인덱스 타입</span><span class="lay-an-val">${vm.indexType === "bigint" ? "BigInt 필수" : "Number"}</span></div>
      <div class="lay-an-row"><span class="lay-an-key">유효 용량</span><span class="lay-an-val">${vm.effectiveMaxDisplay}</span></div>
      ${gapRows}
      <div class="lay-an-row"><span class="lay-an-key">균등 배분</span><span class="lay-an-val">${a.uniformMax.toLocaleString()} / dim</span></div>
      <div class="lay-an-row"><span class="lay-an-key">현재 곱</span><span class="lay-an-val">${vm.productDisplay}</span></div>
      <div class="lay-an-row"><span class="lay-an-key">활용률</span><span class="lay-an-val ${vm.overflow ? "lay-an-overflow" : ""}">${vm.utilizationDisplay}</span></div>
    `;
  }

  // Per-dim colors for graph bars
  const DIM_COLORS = [
    "#2e75b6", "#27ae60", "#e67e22", "#8e44ad",
    "#c0392b", "#16a085", "#d4ac0d", "#2c3e50",
    "#e74c3c", "#1abc9c", "#f39c12", "#9b59b6",
    "#3498db", "#2ecc71", "#e67e22", "#34495e",
  ];

  const logPct = logScalePercent;

  function repaintGraph(): void {
    const vm = getViewModel();
    const maxOfSlider = Math.max(2, ...vm.dims.map(d => d.sliderMax));

    elGraph.innerHTML = vm.dims.map((d, i) => {
      const barPct = logPct(d.sliderMax, maxOfSlider);
      const fillPct = logPct(d.value, d.sliderMax);
      const color = DIM_COLORS[i % DIM_COLORS.length];
      return `
        <div class="lay-bar-row">
          <span class="lay-bar-label"><span class="lay-bar-dot" style="background:${color}"></span>dim ${i}</span>
          <div class="lay-bar-track" title="max: ${d.displayMax}">
            <div class="lay-bar-max" style="width:${Math.max(barPct, 2)}%">
              <div class="lay-bar-fill" style="width:${fillPct}%;background:${color}"></div>
            </div>
            <span class="lay-bar-pct">${fillPct.toFixed(0)}%</span>
          </div>
          <div class="lay-bar-nums">
            <span class="lay-bar-cur" style="color:${color}">${formatLargeNumber(d.value)}</span>
            <span class="lay-bar-sep">/</span>
            <span class="lay-bar-mx">${d.displayMax}</span>
          </div>
        </div>`;
    }).join("");
  }

  // ── Slider mapping (log-scale, resolution=1000) ────────────────────────

  const SLD_RES = 1000;

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
    // ViewModel 내부에서 clampShape가 적용됨 → dim.value가 clamp된 값
    const vm = getViewModel();

    // clamp된 값을 state에 반영
    for (let i = 0; i < st.shape.length; i++) {
      st.shape[i] = vm.dims[i].value;
    }

    for (let i = 0; i < st.shape.length; i++) {
      const ref = sliderRefs[i];
      if (!ref) continue;

      const d = vm.dims[i];
      ref.dimMax = d.sliderMax;
      ref.maxSpan.textContent = `/ ${d.displayMax}`;
      ref.num.max = String(Math.min(d.sliderMax, Number.MAX_SAFE_INTEGER));

      ref.num.value = String(st.shape[i]);
      if (i !== skipDim) {
        ref.range.value = String(valToSlider(st.shape[i], d.sliderMax));
      }
    }
  }

  function updateDim(dimIndex: number, newVal: number): void {
    const vm = getViewModel();
    const dmax = vm.dims[dimIndex].sliderMax;
    st.shape[dimIndex] = Math.max(1, Math.min(newVal, dmax));

    // Update UI in-place — skip the active slider to prevent drag interruption
    syncSliders(activeDim);
    resetProgression();
    repaintData();
  }

  function repaintShapeSummary(): void {
    const vm = getViewModel();

    const shapeStr = st.shape.map(s =>
      s > 1e9 ? s.toExponential(2) : s.toLocaleString()
    ).join(", ");

    elShapeSummary.innerHTML = `
      <span class="lay-ss-shape">Shape: [${shapeStr}]</span>
      <span class="lay-ss-product">Product: ${vm.productDisplay}</span>
      <span class="lay-ss-util ${vm.overflow ? "lay-an-overflow" : ""}">활용률: ${vm.utilizationDisplay}</span>
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
    const idxDisplay = st.mode === "bigint"
      ? st.currentIndexBig.toLocaleString()
      : st.currentIndex.toLocaleString();
    elProgIdx.textContent = `index: ${idxDisplay}`;

    // 성능 표시: 읽기 쉬운 형태
    if (st.lastOpsPerFrame > 0 && st.lastFrameTime > 0) {
      const opsPerSec = st.lastOpsPerFrame / (st.lastFrameTime / 1000);
      const perSecStr = opsPerSec >= 1e6
        ? `${(opsPerSec / 1e6).toFixed(1)}M개/초`
        : opsPerSec >= 1e3
          ? `${(opsPerSec / 1e3).toFixed(1)}K개/초`
          : `${Math.round(opsPerSec)}개/초`;
      elProgPerf.textContent =
        `${st.lastFrameTime.toFixed(1)}ms에 ${st.lastOpsPerFrame.toLocaleString()}개 처리 (${perSecStr})`;
    } else {
      elProgPerf.textContent = "—";
    }

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
      return `<tr><td class="lay-ptbl-num">${ri + 1}</td><td class="lay-ptbl-idx">${r.indexStr}</td>${coordCells}<td class="lay-ptbl-uuid">${r.uuid}</td></tr>`;
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
