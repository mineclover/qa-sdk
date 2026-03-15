/**
 * encode-html.ts — HTML rendering for encode / decode formula steps.
 *
 * Pure visualization layer: converts calculated values into HTML strings.
 * For underlying calculations (calcWeights, partialQueryBase, describeRangeFormula)
 * use the engine: import from "weighted-index".
 *
 * Returns HTML strings for use inside a <table class="formula-tbl"> wrapper.
 */

import { subscript } from "weighted-ui";

// ── Encode steps ──────────────────────────────────────────────────────────

/**
 * Returns 4 <tr> rows: formula → substitution → calculation → result
 */
export function encodeRowsHtml(
  coords:  number[],
  weights: number[],
  id:      number,
): string {
  const fmtFml = coords.map((_, i) => `(x${subscript(i + 1)}−1)×${weights[i]}`).join(" + ");
  const fmtSub = coords.map((x, i) => `(${x}−1)×${weights[i]}`).join(" + ");
  const fmtCal = coords.map((x, i) => String((x - 1) * weights[i])).join(" + ");

  return `
    <tr>
      <td class="ftbl-step">공식</td>
      <td class="ftbl-expr">id = ${fmtFml}</td>
    </tr>
    <tr>
      <td class="ftbl-step">대입</td>
      <td class="ftbl-expr">= ${fmtSub}</td>
    </tr>
    <tr>
      <td class="ftbl-step">계산</td>
      <td class="ftbl-expr">= ${fmtCal}</td>
    </tr>
    <tr>
      <td class="ftbl-step">결과</td>
      <td class="ftbl-result">id = <span class="id-big">${id}</span></td>
    </tr>
  `;
}

// ── Decode steps ──────────────────────────────────────────────────────────

/**
 * Returns <tr> rows: formula → per-dimension computation
 */
export function decodeRowsHtml(
  id:      number,
  weights: number[],
  shape:   readonly number[],
  decoded: number[],
): string {
  const perDim = decoded.map((xi, i) =>
    `x${subscript(i + 1)} = ⌊${id}/${weights[i]}⌋ mod ${shape[i]} + 1 = <strong>${xi}</strong>`
  ).join("<br/>");

  return `
    <tr>
      <td class="ftbl-step">공식</td>
      <td class="ftbl-expr">xᵢ = ⌊id / Wᵢ⌋ mod Nᵢ + 1</td>
    </tr>
    <tr>
      <td class="ftbl-step">대입</td>
      <td class="ftbl-expr">${perDim}</td>
    </tr>
  `;
}

// ── Bit-position check formula ─────────────────────────────────────────────

export function bitCheckHtml(id: number): string {
  return `<code class="lib-code">bitmask[${id} &gt;&gt; 3] &amp; (1 &lt;&lt; (${id} &amp; 7))</code>`;
}

