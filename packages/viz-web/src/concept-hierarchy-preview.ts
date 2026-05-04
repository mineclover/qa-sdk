// @def.boundary viz-system-root
// @def.doc viz-system-root

import {
  buildConceptHierarchyGrid,
  type ConceptGridCell,
  type ConceptGridBoundary,
  type ConceptGridColumn,
  type ConceptGridLink,
  type ConceptGridRow,
} from "viz-core/concept-grid";

declare const d3: any;

const grid = buildConceptHierarchyGrid();
const columnIndex = new Map(grid.columns.map((column: ConceptGridColumn, index: number) => [column.id, index] as const));
const rowIndex = new Map(grid.rows.map((row: ConceptGridRow, index: number) => [row.id, index] as const));

const CELL_BASE_W = 220;
const CELL_BASE_H = 92;
const COL_GAP = 54;
const ROW_GAP = 44;
const PAD = { top: 86, right: 48, bottom: 48, left: 132 };

const width = PAD.left + PAD.right + grid.columns.length * CELL_BASE_W + (grid.columns.length - 1) * COL_GAP;
const height = PAD.top + PAD.bottom + grid.rows.length * CELL_BASE_H + (grid.rows.length - 1) * ROW_GAP;

const linkColor: Record<string, string> = {
  derives: "#4f46e5",
  constrains: "#ef4444",
  verifies: "#0f766e",
  bridges: "#ea580c",
};

const root = d3.select("#concept-grid");
const svg = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
const tooltip = d3.select("#tooltip");

renderGuides();
renderBoundaries();
renderLinks();
renderCells();
renderLegend();
renderSummary();

function renderGuides() {
  grid.columns.forEach((column: ConceptGridColumn, col: number) => {
    const x = cellX(col);
    svg.append("text")
      .attr("x", x + CELL_BASE_W / 2)
      .attr("y", 34)
      .attr("class", "column-label")
      .text(column.label);

    svg.append("text")
      .attr("x", x + CELL_BASE_W / 2)
      .attr("y", 54)
      .attr("class", "column-summary")
      .text(column.summary);
  });

  grid.rows.forEach((row: ConceptGridRow, idx: number) => {
    const y = cellY(idx) + CELL_BASE_H / 2;
    svg.append("text")
      .attr("x", 18)
      .attr("y", y - 6)
      .attr("class", "row-label")
      .text(row.label);

    svg.append("text")
      .attr("x", 18)
      .attr("y", y + 14)
      .attr("class", "row-summary")
      .text(row.summary);

    svg.append("line")
      .attr("x1", PAD.left - 18)
      .attr("x2", width - PAD.right + 12)
      .attr("y1", cellY(idx) - ROW_GAP / 2)
      .attr("y2", cellY(idx) - ROW_GAP / 2)
      .attr("class", "row-guide");
  });
}

function renderBoundaries() {
  const layer = svg.append("g").attr("class", "boundaries");

  grid.boundaries.forEach((boundary: ConceptGridBoundary) => {
    const cols = boundary.columnIds.map((id: string) => columnIndex.get(id)!).toSorted((a: number, b: number) => a - b);
    const rows = boundary.rowIds.map((id: string) => rowIndex.get(id)!).toSorted((a: number, b: number) => a - b);
    const x = cellX(cols[0]) - 18;
    const y = cellY(rows[0]) - 22;
    const w = cellX(cols[cols.length - 1]) + CELL_BASE_W - x + 18;
    const h = cellY(rows[rows.length - 1]) + CELL_BASE_H - y + 22;

    layer.append("rect")
      .attr("x", x)
      .attr("y", y)
      .attr("width", w)
      .attr("height", h)
      .attr("rx", 18)
      .attr("class", "boundary-box");

    layer.append("text")
      .attr("x", x + 14)
      .attr("y", y + 22)
      .attr("class", "boundary-label")
      .text(boundary.label);

    layer.append("text")
      .attr("x", x + 14)
      .attr("y", y + 40)
      .attr("class", "boundary-summary")
      .text(boundary.summary);
  });
}

function renderLinks() {
  const layer = svg.append("g").attr("class", "links");
  const marker = svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 7)
    .attr("markerHeight", 7)
    .attr("orient", "auto-start-reverse");

  marker.append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "#64748b");

  grid.links.forEach((link: ConceptGridLink) => {
    const source = getCell(link.sourceId);
    const target = getCell(link.targetId);
    const sourceX = cellX(columnIndex.get(source.columnId)!) + CELL_BASE_W / 2;
    const sourceY = cellY(rowIndex.get(source.rowId)!) + CELL_BASE_H / 2;
    const targetX = cellX(columnIndex.get(target.columnId)!) + CELL_BASE_W / 2;
    const targetY = cellY(rowIndex.get(target.rowId)!) + CELL_BASE_H / 2;
    const midX = (sourceX + targetX) / 2;
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

    layer.append("path")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", linkColor[link.kind])
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", link.kind === "bridges" ? "6 4" : null)
      .attr("marker-end", "url(#arrow)");
  });
}

function renderCells() {
  const layer = svg.append("g").attr("class", "cells");

  grid.cells.forEach((cell: ConceptGridCell) => {
    const col = columnIndex.get(cell.columnId)!;
    const row = rowIndex.get(cell.rowId)!;
    const scale = grid.rows[row]!.unitScale;
    const w = CELL_BASE_W * scale;
    const h = CELL_BASE_H * scale;
    const x = cellX(col) + (CELL_BASE_W - w) / 2;
    const y = cellY(row) + (CELL_BASE_H - h) / 2;

    const group = layer.append("g")
      .attr("transform", `translate(${x}, ${y})`)
      .attr("class", "cell")
      .on("mouseenter", () => showTooltip(cell, x + w + 12, y + 20))
      .on("mouseleave", hideTooltip);

    group.append("rect")
      .attr("width", w)
      .attr("height", h)
      .attr("rx", 14)
      .attr("class", "cell-box");

    group.append("text")
      .attr("x", 14)
      .attr("y", 24)
      .attr("class", "cell-title")
      .text(cell.label);

    wrapText(group, cell.summary, 14, 42, w - 28, 16, "cell-summary");

    if (cell.docId) {
      group.append("text")
        .attr("x", 14)
        .attr("y", h - 12)
        .attr("class", "cell-doc")
        .text(cell.docId);
    }
  });
}

function renderLegend() {
  const legend = d3.select("#legend");
  legend.html("");
  Object.entries(linkColor).forEach(([key, color]) => {
    const item = legend.append("div").attr("class", "legend-item");
    item.append("span").attr("class", "legend-line").style("background", color);
    item.append("span").text(key);
  });
}

function renderSummary() {
  const summary = d3.select("#summary");
  summary.html(`
    <div class="stat"><strong>${grid.columns.length}</strong><span>columns</span></div>
    <div class="stat"><strong>${grid.rows.length}</strong><span>levels</span></div>
    <div class="stat"><strong>${grid.cells.length}</strong><span>concept cells</span></div>
    <div class="stat"><strong>${grid.boundaries.length}</strong><span>boundaries</span></div>
  `);
}

function cellX(col: number): number {
  return PAD.left + col * (CELL_BASE_W + COL_GAP);
}

function cellY(row: number): number {
  return PAD.top + row * (CELL_BASE_H + ROW_GAP);
}

function getCell(id: string): ConceptGridCell {
  const cell = grid.cells.find((item: ConceptGridCell) => item.id === id);
  if (!cell) throw new Error(`unknown cell: ${id}`);
  return cell;
}

function showTooltip(cell: ConceptGridCell, x: number, y: number) {
  tooltip
    .style("opacity", "1")
    .style("left", `${x}px`)
    .style("top", `${y}px`)
    .html(`
      <div class="tooltip-title">${cell.label}</div>
      <div class="tooltip-body">${cell.summary}</div>
      ${cell.docId ? `<div class="tooltip-doc">${cell.docId}</div>` : ""}
      ${cell.tags?.length ? `<div class="tooltip-tags">${cell.tags.join(" · ")}</div>` : ""}
    `);
}

function hideTooltip() {
  tooltip.style("opacity", "0");
}

function wrapText(
  group: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  className: string,
) {
  const words = text.split(/\s+/);
  let line = "";
  let lineNo = 0;
  let tspan = group.append("text").attr("x", x).attr("y", y).attr("class", className).append("tspan");

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    tspan.text(candidate);
    if ((tspan.node() as SVGTextContentElement).getComputedTextLength() > maxWidth && line) {
      tspan.text(line);
      line = word;
      lineNo += 1;
      tspan = group.select(`text.${className}`).append("tspan")
        .attr("x", x)
        .attr("dy", lineHeight)
        .text(word);
    } else {
      line = candidate;
    }
  }
}
