/**
 * hex-bar.ts — Hex layout bar visualization component.
 *
 * Renders a visual bar of hex character cells with field-based coloring.
 * Generalized from explorer hex-bar.ts — no PackFormat/formatHex dependency.
 */

export type FieldType = "prefix" | "version" | "shard" | "gap" | "index";

export interface HexField {
  type: FieldType;
  chars: number;
  value?: number;
}

const FIELD_LABELS: Record<FieldType, string> = {
  prefix: "prefix",
  version: "ver",
  shard: "shard",
  gap: "gap",
  index: "index",
};

export function renderHexBar(
  label: string,
  capacity: number,
  fields: HexField[],
  options?: {
    showLabels?: boolean;
    formatFn?: (hex: string) => string;
  },
): string {
  const showLabels = options?.showLabels ?? true;

  const totalNeeded = fields.reduce((s, f) => s + f.chars, 0);
  const fits = totalNeeded <= capacity;
  const overflowField = fields.find((f) => ((f.value ?? 0).toString(16).length > f.chars));

  if (!fits || overflowField) {
    const overflowText = overflowField
      ? `${FIELD_LABELS[overflowField.type]} 값 overflow (${(overflowField.value ?? 0).toString(16).length}>${overflowField.chars})`
      : `${totalNeeded - capacity}자리 부족`;
    return `
      <div class="hex-layout hex-layout-overflow">
        <div class="hex-layout-head">
          <span class="hex-layout-name">${label}</span>
          <span class="hex-layout-cap">${capacity} chars</span>
          <span class="hex-layout-status hex-status-fail">${overflowText}</span>
        </div>
      </div>
    `;
  }

  // Build hex string from fields
  const hexParts = fields.map((f) =>
    (f.value ?? 0).toString(16).padStart(f.chars, "0"),
  );
  const fullHex = hexParts.join("");

  // Formatted string
  const formatted = options?.formatFn ? options.formatFn(fullHex) : fullHex;

  // Field type per position
  const fieldTypes: FieldType[] = [];
  for (const f of fields) {
    for (let i = 0; i < f.chars; i++) fieldTypes.push(f.type);
  }

  // Cells
  const cells = fieldTypes
    .map((ft, i) => {
      const isFieldStart = i > 0 && fieldTypes[i] !== fieldTypes[i - 1];
      const cls = `hex-cell hex-cell-${ft}${isFieldStart ? " hex-cell-sep" : ""}`;
      return `<span class="${cls}">${fullHex[i]}</span>`;
    })
    .join("");

  // Field labels
  let labelsHtml = "";
  if (showLabels) {
    const CELL_W = 18, CELL_GAP = 1, SEP = 3;
    const segPx = (n: number) => n * CELL_W + (n - 1) * CELL_GAP;

    const segments = fields.filter((f) => f.chars > 0);
    labelsHtml = `<div class="hex-labels">${segments
      .map((s, idx) => {
        const w = segPx(s.chars);
        const ml = idx > 0 ? SEP : 0;
        return `<span class="hex-label hex-label-${s.type}" style="width:${w}px;flex:none;min-width:0;${ml > 0 ? `margin-left:${ml}px;` : ""}">${FIELD_LABELS[s.type]} (${s.chars})</span>`;
      })
      .join("")}</div>`;
  }

  // Show formatted string if different from raw
  const fmtLine =
    formatted !== fullHex
      ? `<div style="font-family:monospace;font-size:0.68rem;color:var(--text-muted);margin-top:3px">${formatted}</div>`
      : "";

  const gap = capacity - totalNeeded;
  return `
    <div class="hex-layout">
      <div class="hex-layout-head">
        <span class="hex-layout-name">${label}</span>
        <span class="hex-layout-cap">${capacity} chars</span>
        <span class="hex-layout-status hex-status-ok">${gap > 0 ? `gap ${gap}` : "꽉 참"}</span>
      </div>
      <div class="hex-bar">${cells}</div>
      ${labelsHtml}
      ${fmtLine}
    </div>
  `;
}
