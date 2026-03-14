// ═══════════════════════════════════════════════════════════════════════════
//  레이아웃 플래너 — 제약 조건 기반 pack 설계
// ═══════════════════════════════════════════════════════════════════════════

import {
  charsForMax, planLayout, packUUID,
  PACK_FORMAT_LIST, fitShape,
  type PackFormat,
} from "weighted-index";

// ── Types ─────────────────────────────────────────────────────────────────

interface ShapeDim {
  name: string;
  size: number;
}

// ── Entry point ───────────────────────────────────────────────────────────

export function renderLayoutPlanner(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">
    ${renderIntro()}
    ${renderPlanner()}
  </div>`;
  setupPlannerInteractivity(container);
}

// ── 1. 소개 ──────────────────────────────────────────────────────────────

function renderIntro(): string {
  return `
    <h2 class="concept-section-title">레이아웃 플래너 — 제약 조건 기반 pack 설계</h2>
    <p class="concept-desc">
      차원 shape, prefix 길이, 버전 자릿수를 입력하면
      각 필드에 필요한 <strong>hex 자릿수를 자동 계산</strong>하고,
      다양한 ID 포맷에 들어가는지 비교하거나 <strong>최소 pack 크기</strong>를 탐색합니다.
    </p>
    <div class="xl-formula-block" style="gap:24px;flex-wrap:wrap">
      <div>
        <span class="xlf-label">hex 자릿수 공식</span>
        <span class="xlf-expr">charsForMax(maxValue) = maxValue.toString(16).length</span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">n자리 최댓값</span>
        <span class="xlf-expr">16<sup>n</sup> − 1</span>
      </div>
    </div>
  `;
}

// ── 2. 인터랙티브 플래너 ────────────────────────────────────────────────

function renderPlanner(): string {
  return `
    <div class="concept-block">
      <div class="cb-header">플래너</div>
      <div class="cb-body">

        <!-- shape 입력 (개별 차원) -->
        <div class="plan-section">
          <div class="plan-section-header">
            <span class="obf-label" style="margin:0">shape</span>
            <span class="obf-param-hint" id="plan-size-hint">size = 640</span>
          </div>
          <div id="plan-shape-list"></div>
          <button id="plan-shape-add" class="plan-add-btn" type="button">+ 차원 추가</button>
        </div>

        <!-- prefix -->
        <div class="obf-input-row">
          <span class="obf-label">prefix</span>
          <input type="number" id="plan-prefix-chars" class="addr-dec-input" min="0" max="16" value="4" style="width:55px" />
          <span class="obf-param-hint">hex 자릿수 (고정)</span>
        </div>

        <!-- version (자릿수 단위 입력) -->
        <div class="plan-section">
          <div class="obf-input-row" style="border-bottom:none;padding-bottom:4px">
            <span class="obf-label">version 자릿수</span>
            <input type="number" id="plan-ver-digits" class="addr-dec-input" min="1" max="16" value="1" style="width:55px" />
            <span class="obf-param-hint" id="plan-ver-hint">max 15 (0xf)</span>
          </div>
          <div id="plan-ver-range"></div>
        </div>

        <!-- 설정 복사 -->
        <div class="plan-config-bar" id="plan-config-bar">
          <code class="plan-config-text" id="plan-config-text"></code>
          <button class="plan-config-copy" id="plan-config-copy" type="button" title="복사">Copy</button>
        </div>

        <!-- 결과 -->
        <div id="plan-result" style="margin-top:14px"></div>
      </div>
    </div>

    <!-- 확장 전략 -->
    <div class="concept-block" style="margin-top:18px">
      <div class="cb-header">확장 전략 — 최적 자릿수 할당</div>
      <div class="cb-body" id="plan-expansion"></div>
    </div>
  `;
}

// ── Interactivity ───────────────────────────────────────────────────────

function setupPlannerInteractivity(container: HTMLElement): void {
  const shapeList     = container.querySelector<HTMLElement>("#plan-shape-list")!;
  const shapeAddBtn   = container.querySelector<HTMLButtonElement>("#plan-shape-add")!;
  const prefixCharsIn = container.querySelector<HTMLInputElement>("#plan-prefix-chars")!;
  const verDigitsIn   = container.querySelector<HTMLInputElement>("#plan-ver-digits")!;
  const sizeHint      = container.querySelector<HTMLElement>("#plan-size-hint")!;
  const verHint       = container.querySelector<HTMLElement>("#plan-ver-hint")!;
  const verRangeEl    = container.querySelector<HTMLElement>("#plan-ver-range")!;
  const resultEl      = container.querySelector<HTMLElement>("#plan-result")!;
  const expansionEl   = container.querySelector<HTMLElement>("#plan-expansion")!;

  const configText = container.querySelector<HTMLElement>("#plan-config-text")!;
  const configCopy = container.querySelector<HTMLButtonElement>("#plan-config-copy")!;

  if (!shapeList || !shapeAddBtn || !prefixCharsIn || !verDigitsIn || !resultEl) return;

  const dims: ShapeDim[] = [
    { name: "resource", size: 8 },
    { name: "action",   size: 4 },
    { name: "role",     size: 5 },
    { name: "env",      size: 4 },
  ];

  function renderShapeDims(): void {
    shapeList.innerHTML = "";
    dims.forEach((dim, i) => {
      const row = document.createElement("div");
      row.className = "plan-dim-row";

      row.innerHTML = `
        <span class="plan-dim-idx">dim${i + 1}</span>
        <input type="text" class="plan-dim-name addr-dec-input" value="${dim.name}" placeholder="이름" />
        <input type="number" class="plan-dim-size addr-dec-input" min="1" max="99999" value="${dim.size}" />
        <button class="plan-dim-remove" type="button" title="제거">×</button>
      `;

      const nameInput = row.querySelector<HTMLInputElement>(".plan-dim-name")!;
      const sizeInput = row.querySelector<HTMLInputElement>(".plan-dim-size")!;
      const removeBtn = row.querySelector<HTMLButtonElement>(".plan-dim-remove")!;

      nameInput.addEventListener("input", () => { dims[i].name = nameInput.value; });

      sizeInput.addEventListener("input", () => {
        dims[i].size = Math.max(1, parseInt(sizeInput.value, 10) || 1);
        update();
      });

      removeBtn.addEventListener("click", () => {
        if (dims.length <= 1) return;
        dims.splice(i, 1);
        renderShapeDims();
        update();
      });

      shapeList.appendChild(row);
    });
  }

  shapeAddBtn.addEventListener("click", () => {
    dims.push({ name: `dim${dims.length + 1}`, size: 2 });
    renderShapeDims();
    update();
  });

  function update(): void {
    const shapeParts = dims.map(d => d.size);
    const size = shapeParts.length > 0 ? shapeParts.reduce((a, b) => a * b, 1) : 0;
    const prefixChars = Math.max(0, Math.min(16, Number(prefixCharsIn.value) || 0));
    const verDigits   = Math.max(1, Math.min(16, Number(verDigitsIn.value) || 1));
    const verMax      = parseInt("f".repeat(verDigits), 16);

    sizeHint.textContent = size > 0
      ? `size = ${size.toLocaleString()} · shape [${shapeParts.join(", ")}]`
      : "shape 입력 필요";

    verHint.textContent = `max ${verMax.toLocaleString()} (0x${"f".repeat(verDigits)})`;

    // Config string — 각 필드를 태그로 구분 표시
    const shapeStr = dims.map(d => `${d.name}:${d.size}`).join(",");
    const configStr = `shape=${shapeStr} prefix=${prefixChars} ver=${verDigits}`;
    if (configText) {
      configText.innerHTML =
        `<span class="pcfg-tag pcfg-shape">shape</span><span class="pcfg-val">${shapeStr}</span>` +
        `<span class="pcfg-tag pcfg-prefix">prefix</span><span class="pcfg-val">${prefixChars}</span>` +
        `<span class="pcfg-tag pcfg-ver">ver</span><span class="pcfg-val">${verDigits}</span>`;
      configText.dataset.raw = configStr;
    }

    renderVersionRange(verRangeEl, verDigits, prefixChars, size);
    if (expansionEl) renderExpansionStrategy(expansionEl, verDigits, prefixChars, size);

    if (size <= 0) {
      resultEl.innerHTML = `<span class="obf-param-hint">유효한 shape을 입력하세요</span>`;
      return;
    }

    const indexMax = size - 1;
    const plan = planLayout({
      left:  [
        { name: "prefix",  chars: prefixChars },
        { name: "version", chars: verDigits },
      ],
      right: [{ name: "index", maxValue: indexMax }],
    });

    const indexChars = plan.fields.find(f => f.name === "index")!.chars;
    const totalChars = plan.totalChars;

    // ── 포맷 비교 테이블 ────────────────────────────────────────
    const formatRows = PACK_FORMAT_LIST.map(fmt => {
      const fits = totalChars <= fmt.chars;
      const gap  = fmt.chars - totalChars;
      const statusColor = fits ? "var(--xl-green)" : "var(--status-fail, #dc2626)";
      const statusIcon  = fits ? "✓" : "✗";
      const statusText  = fits ? `${gap}자리 여유` : `${Math.abs(gap)}자리 부족`;
      return `
        <tr>
          <td><strong>${fmt.name}</strong></td>
          <td class="td-num">${fmt.chars}</td>
          <td class="td-num">${fmt.bits}</td>
          <td style="font-size:0.68rem;color:var(--text-muted)">${fmt.label}</td>
          <td style="color:${statusColor};font-weight:600">${statusIcon} ${statusText}</td>
        </tr>
      `;
    }).join("");

    // ── 포맷별 최적 shape 추천 ─────────────────────────────────
    const hasOverflow = PACK_FORMAT_LIST.some(f => totalChars > f.chars);
    let fitHtml = "";
    if (hasOverflow) {
      const fitRows = PACK_FORMAT_LIST.map(fmt => {
        const idxBudget = fmt.chars - prefixChars - verDigits;
        if (idxBudget <= 0) {
          return `
            <tr>
              <td><strong>${fmt.name}</strong></td>
              <td colspan="4" style="color:var(--status-fail,#dc2626);font-size:0.7rem">index 예산 없음 (prefix+ver가 ${fmt.chars}자 초과)</td>
            </tr>
          `;
        }
        const maxSize = Math.pow(16, idxBudget);
        const fitResult = fitShape({ shape: dims.map(d => d.size), maxProduct: maxSize });
        if (!fitResult) {
          const alreadyFits = size <= maxSize;
          return `
            <tr>
              <td><strong>${fmt.name}</strong></td>
              <td class="td-num">${idxBudget}</td>
              <td class="td-num">${(maxSize - 1).toLocaleString()}</td>
              <td>${alreadyFits
                ? `<span style="color:var(--xl-green)">조정 불필요 (현재 적합)</span>`
                : `<span style="color:var(--status-fail,#dc2626)">축소 불가</span>`}</td>
              <td></td>
            </tr>
          `;
        }
        const fitted = fitResult.shape.map((s, i) => ({ name: dims[i].name, size: s }));
        const fittedSize = fitResult.product;
        const usage = (fitResult.utilization * 100).toFixed(1);
        const shapeStr = fitted.map(d => `${d.name}:${d.size}`).join(", ");
        const fittedJson = JSON.stringify(fitted.map(d => ({ n: d.name, s: d.size })));
        return `
          <tr>
            <td><strong>${fmt.name}</strong></td>
            <td class="td-num">${idxBudget}</td>
            <td class="td-num">${(maxSize - 1).toLocaleString()}</td>
            <td>
              <code style="font-size:0.68rem">[${shapeStr}]</code>
              <span class="obf-param-hint" style="margin-left:6px">size ${fittedSize.toLocaleString()} · ${usage}%</span>
            </td>
            <td><button class="plan-fit-apply" type="button" data-fit='${fittedJson}'>적용</button></td>
          </tr>
        `;
      }).join("");

      fitHtml = `
        <div class="plan-ver-range-title" style="margin-bottom:6px;margin-top:14px">포맷별 최적 shape 추천</div>
        <table class="nd-table" style="margin-bottom:14px">
          <thead>
            <tr><th>포맷</th><th>index 예산</th><th>max index</th><th>추천 shape</th><th></th></tr>
          </thead>
          <tbody>${fitRows}</tbody>
        </table>
      `;
    }

    // ── 포맷별 hex 레이아웃 시각화 ──────────────────────────────
    const exValues = { prefix: 1, version: 1, index: 42 };

    // 최소 pack
    let layoutsHtml = renderHexBar(
      "Minimum", totalChars, prefixChars, verDigits, indexChars, exValues,
    );

    // 각 포맷
    for (const fmt of PACK_FORMAT_LIST) {
      layoutsHtml += renderHexBar(
        `${fmt.name} (${fmt.bits}bit)`, fmt.chars,
        prefixChars, verDigits, indexChars, exValues,
      );
    }

    // UUID 포맷 string (packUUID 사용)
    let uuidStr = "";
    if (plan.layout) {
      uuidStr = packUUID(plan.layout, exValues);
    }

    resultEl.innerHTML = `
      <table class="nd-table" style="margin-bottom:12px">
        <thead><tr><th>필드</th><th>위치</th><th>hex 자릿수</th><th>최댓값</th><th>비트</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>prefix</strong></td>
            <td>← left</td>
            <td>${prefixChars}</td>
            <td>0x${"f".repeat(prefixChars || 1)}</td>
            <td>${prefixChars * 4}</td>
          </tr>
          <tr>
            <td><strong>version</strong></td>
            <td>← left</td>
            <td>${verDigits}</td>
            <td>${verMax.toLocaleString()} (0x${"f".repeat(verDigits)})</td>
            <td>${verDigits * 4}</td>
          </tr>
          <tr>
            <td><strong>index</strong></td>
            <td>right →</td>
            <td>${indexChars}</td>
            <td>${indexMax.toLocaleString()} (0x${indexMax.toString(16)})</td>
            <td>${indexChars * 4}</td>
          </tr>
          <tr style="font-weight:700;border-top:2px solid var(--border-header)">
            <td>합계</td>
            <td></td>
            <td>${totalChars}</td>
            <td></td>
            <td>${totalChars * 4}</td>
          </tr>
        </tbody>
      </table>

      <div class="plan-ver-range-title" style="margin-bottom:6px">포맷별 적합성 비교 (필요 ${totalChars} hex chars)</div>
      <table class="nd-table" style="margin-bottom:14px">
        <thead>
          <tr><th>포맷</th><th>hex chars</th><th>bits</th><th>비고</th><th>적합성</th></tr>
        </thead>
        <tbody>${formatRows}</tbody>
      </table>

      ${fitHtml}

      <div class="plan-ver-range-title" style="margin-bottom:8px">
        포맷별 레이아웃 시각화 — prefix=1, version=1, index=42
      </div>
      <div class="hex-layouts">${layoutsHtml}</div>

      ${uuidStr ? `
        <div class="hex-layout-uuid-str">
          <span class="plan-ver-range-title">UUID 포맷 문자열</span>
          <code>${uuidStr}</code>
        </div>
      ` : ""}
    `;
  }

  prefixCharsIn.addEventListener("input", update);
  verDigitsIn.addEventListener("input", update);

  // 적용 버튼 이벤트 위임
  resultEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".plan-fit-apply");
    if (!btn?.dataset.fit) return;
    const fitted: { n: string; s: number }[] = JSON.parse(btn.dataset.fit);
    dims.length = 0;
    for (const f of fitted) dims.push({ name: f.n, size: f.s });
    renderShapeDims();
    update();
  });

  if (configCopy) {
    configCopy.addEventListener("click", () => {
      const text = configText?.dataset.raw ?? configText?.textContent ?? "";
      navigator.clipboard.writeText(text).then(() => {
        configCopy.textContent = "Copied!";
        setTimeout(() => { configCopy.textContent = "Copy"; }, 1200);
      });
    });
  }

  renderShapeDims();
  update();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Hex layout bar component
// ═══════════════════════════════════════════════════════════════════════════

function renderHexBar(
  label: string,
  capacity: number,
  prefixChars: number,
  verDigits: number,
  indexChars: number,
  values: { prefix: number; version: number; index: number },
): string {
  const totalNeeded = prefixChars + verDigits + indexChars;
  const fits = totalNeeded <= capacity;

  if (!fits) {
    return `
      <div class="hex-layout hex-layout-overflow">
        <div class="hex-layout-head">
          <span class="hex-layout-name">${label}</span>
          <span class="hex-layout-cap">${capacity} chars</span>
          <span class="hex-layout-status hex-status-fail">${totalNeeded - capacity}자리 부족</span>
        </div>
      </div>
    `;
  }

  const gap = capacity - totalNeeded;

  // Build hex string
  const prefixHex = values.prefix.toString(16).padStart(prefixChars, "0");
  const verHex    = values.version.toString(16).padStart(verDigits, "0");
  const indexHex  = values.index.toString(16).padStart(indexChars, "0");
  const gapHex    = "0".repeat(gap);
  const fullHex   = prefixHex + verHex + gapHex + indexHex;

  // Field type per position
  type F = "prefix" | "version" | "gap" | "index";
  const fields: F[] = [];
  for (let i = 0; i < prefixChars; i++) fields.push("prefix");
  for (let i = 0; i < verDigits; i++)   fields.push("version");
  for (let i = 0; i < gap; i++)         fields.push("gap");
  for (let i = 0; i < indexChars; i++)  fields.push("index");

  // Cells
  const cells = fields.map((f, i) => {
    // Mark boundary between fields
    const isFieldStart = i > 0 && fields[i] !== fields[i - 1];
    const cls = `hex-cell hex-cell-${f}${isFieldStart ? " hex-cell-sep" : ""}`;
    return `<span class="${cls}">${fullHex[i]}</span>`;
  }).join("");

  // Field labels (below the bar)
  const segments: { field: F; chars: number }[] = [];
  if (prefixChars > 0) segments.push({ field: "prefix",  chars: prefixChars });
  if (verDigits > 0)   segments.push({ field: "version", chars: verDigits });
  if (gap > 0)         segments.push({ field: "gap",     chars: gap });
  if (indexChars > 0)  segments.push({ field: "index",   chars: indexChars });

  const FIELD_LABELS: Record<F, string> = {
    prefix: "prefix", version: "ver", gap: "gap", index: "index",
  };

  const labels = segments.map(s =>
    `<span class="hex-label hex-label-${s.field}" style="flex:${s.chars}">${FIELD_LABELS[s.field]} (${s.chars})</span>`
  ).join("");

  return `
    <div class="hex-layout">
      <div class="hex-layout-head">
        <span class="hex-layout-name">${label}</span>
        <span class="hex-layout-cap">${capacity} chars</span>
        <span class="hex-layout-status hex-status-ok">${gap > 0 ? `gap ${gap}` : "꽉 참"}</span>
      </div>
      <div class="hex-bar">${cells}</div>
      <div class="hex-labels">${labels}</div>
    </div>
  `;
}

// ── Version range table ──────────────────────────────────────────────────

function renderVersionRange(
  el: HTMLElement,
  currentDigits: number,
  prefixChars: number,
  shapeSize: number,
): void {
  const indexMax = Math.max(0, shapeSize - 1);
  const indexChars = indexMax > 0 ? charsForMax(indexMax) : 1;

  const maxDigits = Math.max(6, currentDigits + 2);
  const rows: string[] = [];

  for (let digits = 1; digits <= maxDigits; digits++) {
    const rangeMax = parseInt("f".repeat(digits), 16);
    const rangeMin = digits === 1 ? 0 : parseInt("f".repeat(digits - 1), 16) + 1;
    const totalChars = prefixChars + digits + indexChars;
    const isCurrent = digits === currentDigits;

    const fmtIcons = PACK_FORMAT_LIST.slice(0, 3).map(fmt => {
      const fits = totalChars <= fmt.chars;
      return `<span style="color:${fits ? "var(--xl-green)" : "var(--status-fail,#dc2626)"}" title="${fmt.name} (${fmt.chars})">${fits ? "✓" : "✗"}</span>`;
    }).join(" ");

    rows.push(`
      <tr class="${isCurrent ? "plan-ver-current" : ""}">
        <td>${digits}자리</td>
        <td class="td-num">${rangeMin.toLocaleString()} ~ ${rangeMax.toLocaleString()}</td>
        <td><code>0x${"f".repeat(digits)}</code></td>
        <td class="td-num">${totalChars}</td>
        <td>${fmtIcons}</td>
      </tr>
    `);
  }

  el.innerHTML = `
    <div class="plan-ver-range-wrap">
      <div class="plan-ver-range-title">자릿수별 버전 범위 (현재 ${currentDigits}자리)</div>
      <table class="nd-table plan-ver-range-table">
        <thead>
          <tr>
            <th>ver 자릿수</th>
            <th>버저닝 가능 범위</th>
            <th>hex 최댓값</th>
            <th>총 chars</th>
            <th title="64-bit / 96-bit / UUID">64 96 UUID</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

// ── Expansion strategy ──────────────────────────────────────────────────

function renderExpansionStrategy(
  el: HTMLElement,
  verDigits: number,
  prefixChars: number,
  shapeSize: number,
): void {
  const verMax    = parseInt("f".repeat(verDigits), 16);
  const indexMax  = Math.max(0, shapeSize - 1);
  const indexChars = indexMax > 0 ? charsForMax(indexMax) : 1;
  const fixedChars = prefixChars + indexChars;

  const maxRows = Math.max(6, verDigits + 3);
  const unitRows: string[] = [];

  for (let n = 1; n <= maxRows; n++) {
    const stdCap  = Math.pow(16, n);
    const wgtCap  = stdCap * n;
    const wgtNeed = charsForMax(wgtCap - 1);
    const totalStd = fixedChars + n;
    const totalWgt = fixedChars + wgtNeed;
    const isCurrent = n === verDigits;
    const extraDigits = wgtNeed - n;

    const fmtStd = PACK_FORMAT_LIST.slice(0, 3).map(fmt =>
      `<span style="color:${totalStd <= fmt.chars ? "var(--xl-green)" : "var(--status-fail,#dc2626)"}">${totalStd <= fmt.chars ? "✓" : "✗"}</span>`
    ).join(" ");
    const fmtWgt = PACK_FORMAT_LIST.slice(0, 3).map(fmt =>
      `<span style="color:${totalWgt <= fmt.chars ? "var(--xl-green)" : "var(--status-fail,#dc2626)"}">${totalWgt <= fmt.chars ? "✓" : "✗"}</span>`
    ).join(" ");

    unitRows.push(`
      <tr class="${isCurrent ? "plan-ver-current" : ""}">
        <td>${n}</td>
        <td class="td-num">${(stdCap - 1).toLocaleString()}</td>
        <td class="td-num">${stdCap.toLocaleString()}</td>
        <td class="td-num" style="font-weight:700">${wgtCap.toLocaleString()}</td>
        <td class="td-num">${wgtNeed}${extraDigits > 0 ? ` <span style="color:var(--xl-green);font-size:0.65rem">(+${extraDigits})</span>` : ""}</td>
        <td>${fmtStd}</td>
        <td>${fmtWgt}</td>
      </tr>
    `);
  }

  const weightedNeed = verMax * verDigits;
  const recDigits    = charsForMax(weightedNeed);
  const recMax       = parseInt("f".repeat(recDigits), 16);
  const curMax       = verMax;
  const gainRatio    = recMax / Math.max(curMax, 1);
  const digitCost    = recDigits - verDigits;

  const recTotal     = fixedChars + recDigits;
  const curTotal     = fixedChars + verDigits;
  const recFitsUUID  = recTotal <= 32;

  const hasRecommendation = recDigits > verDigits && recFitsUUID;

  const recHtml = hasRecommendation ? `
    <div class="plan-rec">
      <div class="plan-rec-header">
        <span class="plan-rec-icon">&#9733;</span>
        <span>권장: version을 <strong>${recDigits}자리</strong>로 할당 (현재 ${verDigits}자리)</span>
      </div>
      <div class="plan-rec-body">
        <div class="plan-rec-row">
          <span class="plan-rec-label">산출 근거</span>
          <code>verMax(${verMax}) × 자릿수(${verDigits}) = ${weightedNeed.toLocaleString()} → charsForMax = ${recDigits}자리</code>
        </div>
        <div class="plan-rec-row">
          <span class="plan-rec-label">용량 변화</span>
          <span>max ${curMax.toLocaleString()} → <strong>${recMax.toLocaleString()}</strong> (${gainRatio.toFixed(1)}x)</span>
        </div>
        <div class="plan-rec-row">
          <span class="plan-rec-label">비용</span>
          <span>+${digitCost}자리 · 총 ${recTotal}chars (UUID ${recFitsUUID ? `여유 ${32 - recTotal}` : "초과"})</span>
        </div>
      </div>
    </div>
  ` : recDigits <= verDigits ? `
    <div class="plan-rec plan-rec-ok">
      <div class="plan-rec-header">
        <span class="plan-rec-icon">&#10003;</span>
        <span>현재 ${verDigits}자리 할당이 적정 (가중 목표 ${weightedNeed.toLocaleString()} ≤ max ${curMax.toLocaleString()})</span>
      </div>
    </div>
  ` : `
    <div class="plan-rec plan-rec-warn">
      <div class="plan-rec-header">
        <span class="plan-rec-icon">!</span>
        <span>가중 확장 ${recDigits}자리 권장이나 UUID(32) 초과 — 총 ${recTotal}chars 필요</span>
      </div>
    </div>
  `;

  el.innerHTML = `
    <p class="concept-desc" style="margin-top:0">
      hex 기반 시스템에서 각 자릿수는 <strong>16배</strong>씩 용량이 증가합니다.
      단순히 <code>16<sup>n</sup></code>으로 확장하면 자릿수 변경(=레이아웃 변경)이 잦아지는데,
      <strong>현재 자릿수(n)를 가중치로 곱한 확장 단위 <code>16<sup>n</sup> × n</code></strong>을
      기준으로 삼으면, 한 번의 자릿수 확장으로 더 넓은 범위를 커버해 <em>버전 업 횟수를 줄일</em> 수 있습니다.
    </p>

    <div class="xl-formula-block" style="gap:20px;flex-wrap:wrap;margin-bottom:16px">
      <div>
        <span class="xlf-label">기본 확장 단위</span>
        <span class="xlf-expr">16<sup>n</sup></span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">가중 확장 단위</span>
        <span class="xlf-expr">16<sup>n</sup> × n</span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">권장 자릿수</span>
        <span class="xlf-expr">charsForMax(verMax × n)</span>
      </div>
    </div>

    <table class="nd-table" style="margin-bottom:14px">
      <thead>
        <tr>
          <th>n</th>
          <th>기본 max<br/><code>16<sup>n</sup>−1</code></th>
          <th>기본 단위<br/><code>16<sup>n</sup></code></th>
          <th>가중 단위<br/><code>16<sup>n</sup>×n</code></th>
          <th>가중 수용<br/>자릿수</th>
          <th title="64-bit / 96-bit / UUID">기본<br/>64 96 UUID</th>
          <th title="64-bit / 96-bit / UUID">가중<br/>64 96 UUID</th>
        </tr>
      </thead>
      <tbody>${unitRows.join("")}</tbody>
    </table>

    <div class="plan-ver-range-title" style="margin-bottom:8px">
      확장 시나리오 — 현재 ver ${verDigits}자리 (max ${verMax.toLocaleString()}) · 총 ${curTotal} chars
    </div>

    ${recHtml}

    <div class="insight-box" style="margin-top:14px">
      <span class="insight-icon" style="font-size:1rem">&#9881;</span>
      <span style="font-size:0.75rem">
        <strong>적용 예시:</strong>
        ver 2자리(max 255)에서 가중 확장
        <code>255 × 2 = 510 → charsForMax(510) = 3자리</code>로 미리 할당하면,
        max 4,095까지 여유가 생겨 <strong>자릿수 변경 없이 4,095개 버전</strong>을 수용합니다.
        비용은 +1자리(4비트)뿐이므로 레이아웃 안정성 대비 효율적입니다.
      </span>
    </div>
  `;
}
