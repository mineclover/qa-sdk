// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { type CellData, type DimKey, type VersionDef } from '../data.js';
import { coordChip, dimBadge, permVersionSpan } from '../utils/badge.js';
import { encodeRowsHtml, decodeRowsHtml } from '../utils/encode-html.js';

// ── Side panel: full 4D encode / decode steps ─────────────────────────────

export function renderDetail(
  container: HTMLElement,
  cell: CellData,
  xDim: DimKey,
  yDim: DimKey,
  vDef: VersionDef,
): void {
  const [r, a, ro, e] = cell.coords4;
  const id = cell.id4;
  const dims = vDef.dims;

  const rLabel = String(dims.resource.values[r - 1]);
  const aLabel = String(dims.action.values[a - 1]);
  const roLabel = String(dims.role.values[ro - 1]);
  const eLabel = String(dims.env.values[e - 1]);

  // ── 1. 좌표 ──────────────────────────────────────────────────────────

  const coordSection = `
    <div class="sp-section">
      <div class="sp-sec-header">선택된 4D 좌표</div>
      <div class="sp-sec-body">
        <div class="coord-row">
          ${coordChip('resource', rLabel, r, dims.resource.koLabel(rLabel), dims.resource.label, vDef.newDimValues.resource?.has(rLabel) ?? false)}
          ${coordChip('action', aLabel, a, dims.action.koLabel(aLabel), dims.action.label, vDef.newDimValues.action?.has(aLabel) ?? false)}
          ${coordChip('role', roLabel, ro, dims.role.koLabel(roLabel), dims.role.label, vDef.newDimValues.role?.has(roLabel) ?? false)}
          ${coordChip('env', eLabel, e, dims.env.koLabel(eLabel), dims.env.label, vDef.newDimValues.env?.has(eLabel) ?? false)}
        </div>
      </div>
    </div>
  `;

  // ── 2. 인코딩 ─────────────────────────────────────────────────────────

  const encSection = `
    <div class="sp-section">
      <div class="sp-sec-header">인코딩 (encode) — ${vDef.v}</div>
      <div class="sp-sec-body">
        <table class="formula-tbl">
          ${encodeRowsHtml(cell.coords4 as number[], vDef.weights as number[], id)}
          <tr>
            <td class="ftbl-step">버전 ID</td>
            <td class="ftbl-result">${permVersionSpan(vDef.v, id)}</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  // ── 3. 디코딩 ─────────────────────────────────────────────────────────

  const decoded = vDef.wi.decode(id) as number[];
  const decSection = `
    <div class="sp-section">
      <div class="sp-sec-header">디코딩 (decode)</div>
      <div class="sp-sec-body">
        <table class="formula-tbl">
          ${decodeRowsHtml(id, vDef.weights as number[], vDef.shape, decoded)}
          <tr>
            <td class="ftbl-step">결과</td>
            <td class="ftbl-result">
              ${dimBadge('resource', rLabel)} ${dimBadge('action', aLabel)}<br/>
              ${dimBadge('role', roLabel)} ${dimBadge('env', eLabel)}
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  // ── 4. 권한 의미 ──────────────────────────────────────────────────────

  const meanSection = `
    <div class="sp-section">
      <div class="sp-sec-header">권한 의미</div>
      <div class="sp-sec-body">
        <div class="perm-desc">
          ${dimBadge('role', roLabel)}
          <span class="perm-sep">가</span>
          ${dimBadge('env', eLabel)}
          <span class="perm-sep">환경의</span>
          ${dimBadge('resource', rLabel)}
          <span class="perm-sep">에 대해</span>
          ${dimBadge('action', aLabel)}
          <span class="perm-sep">작업 수행</span>
        </div>
        <div class="perm-id-note">
          버전 ID: <code class="perm-id">perm:${vDef.v}:${id}</code>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = coordSection + encSection + decSection + meanSection;
}
