/**
 * badge.ts — HTML badge / chip generation utilities
 *
 * All functions return HTML strings safe for innerHTML assignment.
 * They depend only on colors.ts and data.ts (type imports only).
 */

import { getDimFill, getDimInk } from "../colors.js";
import type { DimKey } from "../data.js";

// ── Inline colored span for a single dimension value ──────────────────────

export function dimBadge(dim: DimKey, val: string): string {
  const fill = getDimFill(dim, val);
  const ink  = getDimInk(dim, val);
  return `<span class="lib-badge" style="background:${fill};color:${ink}">${val}</span>`;
}

// ── Coord chip (large — used in detail panel) ─────────────────────────────

export function coordChip(
  dim: DimKey,
  val: string,
  idx: number,
  ko: string,
  dimLabel: string,
  isNew = false,
): string {
  const fill = getDimFill(dim, val);
  const ink  = getDimInk(dim, val);
  return `
    <div class="coord-chip${isNew ? " coord-chip-new" : ""}" style="--c:${ink}">
      <span class="cc-label">${dimLabel}</span>
      <span class="cc-val" style="background:${fill};color:${ink}">${val}</span>
      <span class="cc-ko">${ko}${isNew ? " <span class='new-tag'>NEW</span>" : ""}</span>
      <span class="cc-idx">x = ${idx}</span>
    </div>
  `;
}

// ── Versioned permission ID <code> ────────────────────────────────────────

export function permIdCode(ver: string, id: number): string {
  return `<code class="perm-id">perm:${ver}:${id}</code>`;
}

// ── Compact version-tag inside a formula result ───────────────────────────

export function permVersionSpan(ver: string, id: number): string {
  return `<code class="perm-version-id">perm:${ver}:${id}</code>`;
}

// ── Small NEW badge ────────────────────────────────────────────────────────

export function newTag(): string {
  return `<span class="new-tag">NEW</span>`;
}
