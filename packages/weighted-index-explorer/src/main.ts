import {
  ALL_DIMS, getVersion,
  type CellData, type DimKey,
} from "./data.js";
import { renderGrid, updateCellSelection, type ColorMode, type GridState } from "./grid.js";
import { renderDetail } from "./detail.js";
import { renderConceptAll } from "./concept.js";
import { renderList } from "./list.js";
import { renderPhilosophy } from "./philosophy.js";
import { renderAddress } from "./address.js";
import { renderVersion } from "./version.js";
import { renderFilter } from "./filter.js";
import { renderObfuscatePage } from "./obfuscate-page.js";

// ═══════════════════════════════════════════════════════════════════════════
//  App state
// ═══════════════════════════════════════════════════════════════════════════

type SheetId  = "explorer" | "concept" | "philosophy" | "address" | "version" | "filter" | "obfuscate";
type ViewMode = "grid" | "list";

interface AppState {
  sheet:        SheetId;
  viewMode:     ViewMode;
  xDim:         DimKey;
  yDim:         DimKey;
  colorMode:    ColorMode;
  fixed:        Record<DimKey, number>;
  selectedCell: CellData | null;
  version:      string;
}

const state: AppState = {
  sheet:        "explorer",
  viewMode:     "grid",
  xDim:         "resource",
  yDim:         "action",
  colorMode:    "density",
  fixed:        { resource: 1, action: 1, role: 1, env: 1 },
  selectedCell: null,
  version:      "v1",
};

// Per-dimension representative colors for axis bar buttons
const DIM_COLORS: Record<DimKey, { fill: string; ink: string }> = {
  resource: { fill: "#dce6f1", ink: "#1f497d" },
  action:   { fill: "#e2efda", ink: "#375623" },
  role:     { fill: "#fff2cc", ink: "#7f6000" },
  env:      { fill: "#fde9e9", ink: "#922b21" },
};

// ═══════════════════════════════════════════════════════════════════════════
//  DOM refs
// ═══════════════════════════════════════════════════════════════════════════

const gridContainer = document.getElementById("grid-container")!;
const spPlaceholder = document.getElementById("sp-placeholder")!;
const spContent     = document.getElementById("sp-content")!;
const nameBox       = document.getElementById("name-box")!;
const fbFormula     = document.getElementById("fb-formula")!;
const dimSidebar    = document.getElementById("dim-sidebar")!;
const ribbonTools   = document.getElementById("ribbon-tools")!;
const statusSel     = document.getElementById("status-sel")!;
const sheetGridBody = document.getElementById("sheet-grid-body")!;
const listContainer = document.getElementById("list-container")!;
const axisBar       = document.getElementById("axis-bar")!;
const xAxisBtns     = document.getElementById("x-axis-btns")!;
const yAxisBtns     = document.getElementById("y-axis-btns")!;

// ═══════════════════════════════════════════════════════════════════════════
//  Sheet navigation
// ═══════════════════════════════════════════════════════════════════════════

function switchSheet(id: SheetId): void {
  state.sheet = id;

  document.querySelectorAll(".sheet").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`sheet-${id}`)?.classList.remove("hidden");

  document.querySelectorAll(".rtab, .stab").forEach((el) => {
    (el as HTMLElement).classList.toggle("active", (el as HTMLElement).dataset.sheet === id);
  });

  const isExplorer = id === "explorer";
  ribbonTools.style.display = isExplorer ? "" : "none";
  axisBar.style.display = isExplorer && state.viewMode === "grid" ? "" : "none";

  if (id === "concept") {
    const el = document.getElementById("concept-all")!;
    if (!el.dataset.rendered) { renderConceptAll(el); el.dataset.rendered = "1"; }
  }
  if (id === "philosophy") {
    const el = document.getElementById("concept-philosophy")!;
    if (!el.dataset.rendered) { renderPhilosophy(el); el.dataset.rendered = "1"; }
  }
  if (id === "address") {
    const el = document.getElementById("concept-address")!;
    if (!el.dataset.rendered) { renderAddress(el); el.dataset.rendered = "1"; }
  }
  if (id === "version") {
    const el = document.getElementById("concept-version")!;
    if (!el.dataset.rendered) { renderVersion(el); el.dataset.rendered = "1"; }
  }
  if (id === "filter") {
    const el = document.getElementById("concept-filter")!;
    if (!el.dataset.rendered) { renderFilter(el); el.dataset.rendered = "1"; }
  }
  if (id === "obfuscate") {
    const el = document.getElementById("concept-obfuscate")!;
    if (!el.dataset.rendered) { renderObfuscatePage(el); el.dataset.rendered = "1"; }
  }

  if (!isExplorer) {
    nameBox.textContent = "—";
    fbFormula.textContent = "id = Σᵢ (xᵢ − 1) × Wᵢ";
  } else {
    updateFormulaBar(state.selectedCell);
  }
}

document.querySelectorAll(".rtab, .stab").forEach((el) => {
  el.addEventListener("click", () => {
    const id = (el as HTMLElement).dataset.sheet as SheetId;
    if (id) switchSheet(id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  View mode (grid / list)
// ═══════════════════════════════════════════════════════════════════════════

function switchView(mode: ViewMode): void {
  state.viewMode = mode;

  const isGrid = mode === "grid";
  sheetGridBody.style.display = isGrid ? "" : "none";
  listContainer.classList.toggle("hidden", isGrid);
  axisBar.style.display = isGrid && state.sheet === "explorer" ? "" : "none";

  ribbonTools.querySelectorAll<HTMLElement>(".grid-only").forEach((el) => {
    el.style.display = isGrid ? "" : "none";
  });

  document.querySelectorAll<HTMLButtonElement>(".tvt-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === mode);
  });

  if (!isGrid && !listContainer.dataset.rendered) {
    renderList(listContainer, getVersion(state.version));
    listContainer.dataset.rendered = "1";
  }
}

document.querySelectorAll<HTMLButtonElement>(".tvt-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.view as ViewMode;
    if (mode && mode !== state.viewMode) switchView(mode);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Version selector
// ═══════════════════════════════════════════════════════════════════════════

function changeVersion(v: string): void {
  if (v === state.version) return;
  state.version      = v;
  state.selectedCell = null;
  listContainer.dataset.rendered = "";  // invalidate list cache

  repaintGrid();
  updateDetailPanel(null);
  updateFormulaBar(null);
  updateStatusBar();

  document.querySelectorAll<HTMLButtonElement>(".ver-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ver === v);
  });
}

document.querySelectorAll<HTMLButtonElement>(".ver-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.ver;
    if (v) changeVersion(v);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Axis selector bar — X/Y dimension toggle buttons
// ═══════════════════════════════════════════════════════════════════════════

function buildAxisBar(): void {
  const vDef = getVersion(state.version);
  for (const axis of ["x", "y"] as const) {
    const container  = axis === "x" ? xAxisBtns : yAxisBtns;
    const currentDim = axis === "x" ? state.xDim : state.yDim;
    const otherDim   = axis === "x" ? state.yDim : state.xDim;
    container.innerHTML = "";

    for (const dim of ALL_DIMS) {
      const def      = vDef.dims[dim];
      const isActive = dim === currentDim;
      const isOther  = dim === otherDim;
      const { fill, ink } = DIM_COLORS[dim];

      const btn = document.createElement("button");
      btn.className = "axis-btn" +
        (isActive ? " axis-btn-active" : "") +
        (isOther  ? " axis-btn-other"  : "");
      btn.dataset.dim  = dim;
      btn.dataset.axis = axis;

      if (isActive) {
        btn.style.background      = fill;
        btn.style.borderLeftColor = ink;
        btn.style.color           = ink;
      }

      btn.innerHTML = `
        <span class="axis-btn-name">${dim}</span>
        <span class="axis-btn-ko">${def.label} · ${def.size}</span>
      `;

      if (!isOther) {
        btn.addEventListener("click", () => {
          if (axis === "x") state.xDim = dim;
          else              state.yDim = dim;
          state.selectedCell = null;
          repaintGrid();
          updateDetailPanel(null);
          updateFormulaBar(null);
        });
      }

      container.appendChild(btn);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dimension sidebar — fixed (non-axis) dims only
// ═══════════════════════════════════════════════════════════════════════════

function buildDimSidebar(): void {
  const vDef = getVersion(state.version);
  dimSidebar.innerHTML = "";

  const fixedDims = ALL_DIMS.filter((d) => d !== state.xDim && d !== state.yDim);

  for (const dim of fixedDims) {
    const def = vDef.dims[dim];

    const header = document.createElement("div");
    header.className = "sb-header";
    header.innerHTML = `<span class="sb-header-name">${def.label.toUpperCase()}</span>`;
    dimSidebar.appendChild(header);

    const list = document.createElement("div");
    list.className = "sb-list";

    def.values.forEach((val, i) => {
      const valStr   = String(val);
      const idx1     = i + 1;
      const isActive = state.fixed[dim] === idx1;
      const isNew    = vDef.newDimValues[dim]?.has(valStr) ?? false;

      const { fill, ink } = DIM_COLORS[dim];

      const item = document.createElement("div");
      item.className = "sb-item" + (isActive ? " sb-active" : "") + (isNew ? " sb-item-new" : "");
      if (isActive) {
        item.style.background      = fill;
        item.style.borderLeftColor = ink;
      }

      item.innerHTML = `
        <span class="sb-val">${valStr}${isNew ? ' <span class="sb-new-tag">N</span>' : ""}</span>
        <span class="sb-ko">${def.koLabel(valStr)}</span>
      `;

      item.addEventListener("click", () => {
        state.fixed[dim] = idx1;
        state.selectedCell = null;
        repaintGrid();
        updateDetailPanel(null);
        updateFormulaBar(null);
      });

      list.appendChild(item);
    });

    dimSidebar.appendChild(list);

    const sep = document.createElement("div");
    sep.className = "sb-sep";
    dimSidebar.appendChild(sep);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Grid render
// ═══════════════════════════════════════════════════════════════════════════

function getGridState(): GridState {
  return {
    xDim:        state.xDim,
    yDim:        state.yDim,
    colorMode:   state.colorMode,
    selectedId4: state.selectedCell?.id4 ?? null,
    fixed:       state.fixed,
    vDef:        getVersion(state.version),
  };
}

function repaintGrid(): void {
  renderGrid(gridContainer, getGridState(), handleCellClick, handleCellHover);
  buildDimSidebar();
  buildAxisBar();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Status bar
// ═══════════════════════════════════════════════════════════════════════════

function updateStatusBar(): void {
  const vDef    = getVersion(state.version);
  const shapeEl = document.getElementById("status-shape");
  const slotsEl = document.getElementById("status-slots");
  if (shapeEl) shapeEl.textContent = `${vDef.v} · shape [${vDef.shape.join(", ")}]`;
  if (slotsEl) slotsEl.textContent = `${vDef.size.toLocaleString()}개 슬롯`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Formula bar
// ═══════════════════════════════════════════════════════════════════════════

function updateFormulaBar(cell: CellData | null): void {
  const vDef = getVersion(state.version);
  const [W1, W2, W3, W4] = vDef.weights;

  if (!cell) {
    nameBox.textContent  = "—";
    fbFormula.textContent =
      `encode([x₁, x₂, x₃, x₄]) = (x₁−1)×${W1} + (x₂−1)×${W2} + (x₃−1)×${W3} + (x₄−1)`;
    return;
  }

  const xDef   = vDef.dims[state.xDim];
  const colIdx = Array.from(xDef.values).indexOf(cell.xVal);
  nameBox.textContent = `${String.fromCharCode(65 + colIdx)}${cell.yIdx}`;

  const [r, a, ro, e] = cell.coords4;
  fbFormula.textContent =
    `encode([${r}, ${a}, ${ro}, ${e}]) = (${r}−1)×${W1} + (${a}−1)×${W2} + (${ro}−1)×${W3} + (${e}−1) = ${cell.id4}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Detail panel
// ═══════════════════════════════════════════════════════════════════════════

function updateDetailPanel(cell: CellData | null): void {
  if (cell) {
    spPlaceholder.classList.add("hidden");
    spContent.classList.remove("hidden");
    renderDetail(spContent, cell, state.xDim, state.yDim, getVersion(state.version));
    statusSel.textContent = `id=${cell.id4} · [${cell.coords4.join(",")}]`;
  } else if (!state.selectedCell) {
    spContent.classList.add("hidden");
    spPlaceholder.classList.remove("hidden");
    statusSel.textContent = "선택 없음";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Cell interaction handlers
// ═══════════════════════════════════════════════════════════════════════════

function handleCellClick(cell: CellData | null): void {
  if (!cell) return;

  if (state.selectedCell?.id4 === cell.id4) {
    const prev = state.selectedCell;
    state.selectedCell = null;
    updateCellSelection(gridContainer, prev.id4, null);
    updateDetailPanel(null);
    updateFormulaBar(null);
  } else {
    const prev = state.selectedCell?.id4 ?? null;
    state.selectedCell = cell;
    updateCellSelection(gridContainer, prev, cell.id4);
    updateDetailPanel(cell);
    updateFormulaBar(cell);
  }
}

function handleCellHover(cell: CellData | null): void {
  if (cell) {
    updateFormulaBar(cell);
    if (!state.selectedCell) updateDetailPanel(cell);
  } else {
    updateFormulaBar(state.selectedCell);
    if (!state.selectedCell) updateDetailPanel(null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Color mode inline buttons
// ═══════════════════════════════════════════════════════════════════════════

document.querySelectorAll<HTMLButtonElement>(".tcb-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode as ColorMode;
    if (!mode) return;
    state.colorMode = mode;
    document.querySelectorAll<HTMLButtonElement>(".tcb-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    repaintGrid();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════════════

repaintGrid();
updateFormulaBar(null);
updateStatusBar();
