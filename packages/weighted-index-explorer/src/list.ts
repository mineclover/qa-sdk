// ═══════════════════════════════════════════════════════════════════════════
//  전체 목록 뷰 — ID 0 ~ N flat table (version-aware)
// ═══════════════════════════════════════════════════════════════════════════

import { type CellData, type DimKey, type VersionDef } from "./data.js";
import { getDimFill, getDimInk } from "./colors.js";

function buildAllCells(vDef: VersionDef): CellData[] {
  const total = vDef.size;
  const dims  = vDef.dims;
  const cells: CellData[] = [];

  for (let id = 0; id < total; id++) {
    const coords = vDef.wi.decode(id) as [number, number, number, number];
    const [r, a, ro, e] = coords;
    const xVal  = String(dims.resource.values[r  - 1]);
    const yVal  = String(dims.action.values[a    - 1]);
    const roVal = String(dims.role.values[ro     - 1]);
    const eVal  = String(dims.env.values[e       - 1]);

    const isNew = (vDef.newDimValues.resource?.has(xVal)  ?? false) ||
                  (vDef.newDimValues.action?.has(yVal)    ?? false) ||
                  (vDef.newDimValues.role?.has(roVal)     ?? false) ||
                  (vDef.newDimValues.env?.has(eVal)       ?? false);

    cells.push({
      id4:     id,
      xIdx:    r,
      yIdx:    a,
      xVal,
      yVal,
      coords4: [r, a, ro, e],
      isNew,
    });
  }

  return cells;
}

function chip(dim: DimKey, val: string, ko: string, isNew: boolean): string {
  const bg  = getDimFill(dim, val);
  const ink = getDimInk(dim, val);
  const newMark = isNew ? '<span class="lv-new-mark">NEW</span>' : "";
  return `<span class="lv-chip${isNew ? " lv-chip-new" : ""}" style="background:${bg};color:${ink}">${val}${newMark}<span class="lv-chip-ko">${ko}</span></span>`;
}

export function renderList(container: HTMLElement, vDef: VersionDef): void {
  const cells = buildAllCells(vDef);
  const dims  = vDef.dims;

  const rows = cells.map(({ id4, coords4, isNew }) => {
    const [r, a, ro, e] = coords4;
    const rVal  = String(dims.resource.values[r  - 1]);
    const aVal  = String(dims.action.values[a    - 1]);
    const roVal = String(dims.role.values[ro     - 1]);
    const eVal  = String(dims.env.values[e       - 1]);

    return `<tr class="lv-row${isNew ? " lv-row-new" : ""}">
      <td class="lv-id">${id4}</td>
      <td class="lv-coords">[${r},${a},${ro},${e}]</td>
      <td class="lv-cell-dim">${chip("resource", rVal, dims.resource.koLabel(rVal), vDef.newDimValues.resource?.has(rVal) ?? false)}</td>
      <td class="lv-cell-dim">${chip("action",   aVal, dims.action.koLabel(aVal),   vDef.newDimValues.action?.has(aVal)   ?? false)}</td>
      <td class="lv-cell-dim">${chip("role",     roVal, dims.role.koLabel(roVal),   vDef.newDimValues.role?.has(roVal)    ?? false)}</td>
      <td class="lv-cell-dim">${chip("env",      eVal, dims.env.koLabel(eVal),      vDef.newDimValues.env?.has(eVal)      ?? false)}</td>
    </tr>`;
  }).join("");

  const newCount = cells.filter((c) => c.isNew).length;
  const newNote  = newCount > 0
    ? `<span class="lv-toolbar-new">${newCount}개 신규 슬롯 (★)</span>`
    : "";

  container.innerHTML = `
    <div class="lv-toolbar">
      <span class="lv-toolbar-title">전체 슬롯 목록</span>
      <span class="lv-toolbar-badge">${vDef.v} · ID 0 – ${cells.length - 1} · ${cells.length}개</span>
      <span class="lv-toolbar-hint">shape [${vDef.shape.join(", ")}] · 가중치 [${vDef.weights.join(", ")}]</span>
      ${newNote}
    </div>
    <div class="lv-wrap">
      <table class="lv-table">
        <thead>
          <tr>
            <th class="lv-th-id">ID</th>
            <th class="lv-th-coords">[r, a, ro, e]</th>
            <th>resource</th>
            <th>action</th>
            <th>role</th>
            <th>env</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
