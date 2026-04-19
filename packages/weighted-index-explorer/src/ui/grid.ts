// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import {
  buildSliceGrid, type CellData, type DimKey, type SliceSpec, type VersionDef,
} from "../data.js";
import { getDimFill, getDimInk, getDensityFill } from "../utils/colors.js";
import { colLetter } from "weighted-ui";

export type ColorMode = "x" | "y" | "density" | "none";

export interface GridState {
  xDim:        DimKey;
  yDim:        DimKey;
  colorMode:   ColorMode;
  selectedId4: number | null;
  fixed:       Partial<Record<DimKey, number>>;
  vDef:        VersionDef;
}

export type CellHandler = (cell: CellData | null) => void;

// ── Main render ───────────────────────────────────────────────────────────

export function renderGrid(
  container: HTMLElement,
  state: GridState,
  onClick: CellHandler,
  onHover: CellHandler
): void {
  const { xDim, yDim, colorMode, selectedId4, fixed, vDef } = state;
  const xDef = vDef.dims[xDim];
  const yDef = vDef.dims[yDim];

  const spec: SliceSpec = { xDim, yDim, fixed };
  const grid = buildSliceGrid(spec, vDef);

  const maxId = Math.max(...grid.flat().map((c) => c.id4));

  const tbl = document.createElement("table");
  tbl.className = "xl-grid";

  // ── Header row ────────────────────────────────────────────────────────
  const thead = tbl.createTHead();
  const headRow = thead.insertRow();

  const corner = document.createElement("th");
  corner.className = "xl-corner";
  headRow.appendChild(corner);

  for (let xi = 0; xi < xDef.size; xi++) {
    const xVal = String(xDef.values[xi]);
    const th = document.createElement("th");
    th.className = "xl-col-header";
    const fill  = getDimFill(xDim, xVal);
    const ink   = getDimInk(xDim, xVal);
    const isNew = vDef.newDimValues[xDim]?.has(xVal) ?? false;
    th.innerHTML = `
      <span class="col-letter">${colLetter(xi)}</span>
      <span class="col-value${isNew ? " hdr-new" : ""}" style="color:${ink};background:${fill}">${xVal}</span>
      <span class="col-ko" style="color:${ink}">${xDef.koLabel(xVal)}</span>
    `;
    headRow.appendChild(th);
  }

  // ── Body rows ─────────────────────────────────────────────────────────
  const tbody = tbl.createTBody();

  for (let yi = 0; yi < yDef.size; yi++) {
    const yVal   = String(yDef.values[yi]);
    const yFill  = getDimFill(yDim, yVal);
    const yInk   = getDimInk(yDim, yVal);
    const isNewY = vDef.newDimValues[yDim]?.has(yVal) ?? false;

    const tr = tbody.insertRow();

    // Row header
    const rh = document.createElement("th");
    rh.className = "xl-row-header";
    rh.innerHTML = `
      <span class="row-num">${yi + 1}</span>
      <span class="row-value${isNewY ? " hdr-new" : ""}" style="color:${yInk};background:${yFill}">${yVal}</span>
      <span class="row-ko" style="color:${yInk}">${yDef.koLabel(yVal)}</span>
    `;
    tr.appendChild(rh);

    // Data cells
    for (let xi = 0; xi < xDef.size; xi++) {
      const cell = grid[yi][xi];
      const td = document.createElement("td");
      td.className = "xl-cell" + (cell.isNew ? " cell-new" : "");
      if (cell.id4 === selectedId4) td.classList.add("selected");

      const cf = getCellFill(colorMode, xDim, yDim, cell, maxId);
      if (cf) td.style.backgroundColor = cf;

      td.innerHTML = `
        <span class="cell-id-val">${cell.id4}</span>
        <span class="cell-coord-tag">[${cell.xIdx},${cell.yIdx}]</span>
        ${cell.isNew ? '<span class="cell-new-dot" title="이 버전에서 추가된 값"></span>' : ""}
      `;

      td.addEventListener("click",      () => onClick(cell));
      td.addEventListener("mouseenter", () => onHover(cell));
      td.addEventListener("mouseleave", () => onHover(null));

      tr.appendChild(td);
    }
  }

  container.innerHTML = "";
  container.appendChild(tbl);
}

// ── Fill logic ────────────────────────────────────────────────────────────

function getCellFill(
  mode: ColorMode,
  xDim: DimKey,
  yDim: DimKey,
  cell: CellData,
  maxId: number
): string {
  if (mode === "x")       return getDimFill(xDim, cell.xVal);
  if (mode === "y")       return getDimFill(yDim, cell.yVal);
  if (mode === "density") return getDensityFill(cell.id4, maxId);
  return "";
}

// ── Update selection without full re-render ───────────────────────────────

export function updateCellSelection(
  container: HTMLElement,
  prevId4: number | null,
  newId4: number | null
): void {
  const cells = container.querySelectorAll<HTMLElement>(".xl-cell");
  cells.forEach((td) => {
    const span = td.querySelector<HTMLElement>(".cell-id-val");
    if (!span) return;
    const id = Number(span.textContent);
    if (id === prevId4) td.classList.remove("selected");
    if (id === newId4)  td.classList.add("selected");
  });
}

export { colLetter };
