/**
 * hex-bar.ts — Hex layout bar visualization component.
 *
 * Renders a visual bar of hex character cells with field-based coloring
 * (prefix, version, gap, index) and optional dash-formatted string.
 *
 * Reusable for any PackFormat / shape combination.
 */

import { formatHex, type PackFormat } from "weighted-index";

type FieldType = "prefix" | "version" | "shard" | "gap" | "index";

const FIELD_LABELS: Record<FieldType, string> = {
  prefix: "prefix", version: "ver", shard: "shard", gap: "gap", index: "index",
};

export function renderHexBar(
  label: string,
  capacity: number,
  prefixChars: number,
  verDigits: number,
  indexChars: number,
  values: { prefix: number; version: number; index: number; shard?: number },
  fmt?: PackFormat,
  shardChars?: number,
): string {
  const sc = shardChars ?? 0;
  const totalNeeded = prefixChars + verDigits + sc + indexChars;
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
  const shardHex  = sc > 0 ? (values.shard ?? 0).toString(16).padStart(sc, "0") : "";
  const indexHex  = values.index.toString(16).padStart(indexChars, "0");
  const gapHex    = "0".repeat(gap);
  const fullHex   = prefixHex + verHex + shardHex + gapHex + indexHex;

  // Formatted string (with dashes if format has groups)
  const formatted = fmt ? formatHex(fmt, fullHex) : fullHex;

  // Field type per position
  const fields: FieldType[] = [];
  for (let i = 0; i < prefixChars; i++) fields.push("prefix");
  for (let i = 0; i < verDigits; i++)   fields.push("version");
  for (let i = 0; i < sc; i++)          fields.push("shard");
  for (let i = 0; i < gap; i++)         fields.push("gap");
  for (let i = 0; i < indexChars; i++)  fields.push("index");

  // Cells
  const cells = fields.map((f, i) => {
    const isFieldStart = i > 0 && fields[i] !== fields[i - 1];
    const cls = `hex-cell hex-cell-${f}${isFieldStart ? " hex-cell-sep" : ""}`;
    return `<span class="${cls}">${fullHex[i]}</span>`;
  }).join("");

  // Field labels — 실제 셀 픽셀 너비로 라벨 너비 계산
  // hex-bar: gap=1px, hex-cell: width=18px, hex-cell-sep: margin-left=3px
  // 각 세그먼트의 실제 너비: N * 18 + (N-1) * 1 = 19N - 1
  // 세그먼트 경계(sep): +3px (첫 세그먼트 제외)
  const CELL_W = 18, CELL_GAP = 1, SEP = 3;
  const segPx = (n: number) => n * CELL_W + (n - 1) * CELL_GAP;

  const segments: { field: FieldType; chars: number }[] = [];
  if (prefixChars > 0) segments.push({ field: "prefix",  chars: prefixChars });
  if (verDigits > 0)   segments.push({ field: "version", chars: verDigits });
  if (sc > 0)          segments.push({ field: "shard",   chars: sc });
  if (gap > 0)         segments.push({ field: "gap",     chars: gap });
  if (indexChars > 0)  segments.push({ field: "index",   chars: indexChars });

  const labels = segments.map((s, idx) => {
    const w = segPx(s.chars);
    const ml = idx > 0 ? SEP : 0;
    return `<span class="hex-label hex-label-${s.field}" style="width:${w}px;flex:none;min-width:0;${ml > 0 ? `margin-left:${ml}px;` : ""}">${FIELD_LABELS[s.field]} (${s.chars})</span>`;
  }).join("");

  // Show formatted string if it has dashes
  const fmtLine = formatted !== fullHex
    ? `<div style="font-family:monospace;font-size:0.68rem;color:var(--text-muted);margin-top:3px">${formatted}</div>`
    : "";

  return `
    <div class="hex-layout">
      <div class="hex-layout-head">
        <span class="hex-layout-name">${label}</span>
        <span class="hex-layout-cap">${capacity} chars</span>
        <span class="hex-layout-status hex-status-ok">${gap > 0 ? `gap ${gap}` : "꽉 참"}</span>
      </div>
      <div class="hex-bar">${cells}</div>
      <div class="hex-labels">${labels}</div>
      ${fmtLine}
    </div>
  `;
}
