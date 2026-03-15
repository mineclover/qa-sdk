import type { DimKey } from "../data.js";

// ── Resource — blue spectrum (8 values) ───────────────────────────────────

export const RESOURCE_FILL: Record<string, string> = {
  document:     "#dce6f1",
  api:          "#d5e8f5",
  database:     "#cfe2f3",
  file_storage: "#c9dcf0",
  report:       "#d0e8dc",
  admin_panel:  "#f2e0e0",
  config:       "#e8e8e0",
  audit_log:    "#e8e0f0",
};

export const RESOURCE_INK: Record<string, string> = {
  document:     "#1f497d",
  api:          "#174f73",
  database:     "#0d4a6f",
  file_storage: "#14426b",
  report:       "#1e5c3a",
  admin_panel:  "#7b2020",
  config:       "#5c5c20",
  audit_log:    "#493073",
};

// ── Action ────────────────────────────────────────────────────────────────

export const ACTION_FILL: Record<string, string> = {
  read:   "#e2efda",
  write:  "#fff2cc",
  delete: "#fde9e9",
  manage: "#e8e0f0",
};

export const ACTION_INK: Record<string, string> = {
  read:   "#375623",
  write:  "#7f6000",
  delete: "#922b21",
  manage: "#493073",
};

// ── Role ──────────────────────────────────────────────────────────────────

export const ROLE_FILL: Record<string, string> = {
  guest:       "#f2f2f2",
  viewer:      "#dce6f1",
  editor:      "#e2efda",
  admin:       "#fff2cc",
  super_admin: "#fce4d6",
};

export const ROLE_INK: Record<string, string> = {
  guest:       "#767676",
  viewer:      "#1f497d",
  editor:      "#375623",
  admin:       "#7f6000",
  super_admin: "#843c0c",
};

// ── Environment ───────────────────────────────────────────────────────────

export const ENV_FILL: Record<string, string> = {
  production:  "#fde9e9",
  staging:     "#fff2cc",
  development: "#e2efda",
  testing:     "#dce6f1",
};

export const ENV_INK: Record<string, string> = {
  production:  "#922b21",
  staging:     "#7f6000",
  development: "#375623",
  testing:     "#1f497d",
};

// ── Dot colors (more saturated for visibility) ────────────────────────────

export const ACTION_DOT: Record<string, string> = {
  read:   "#70ad47",
  write:  "#ffc000",
  delete: "#ff0000",
  manage: "#7030a0",
};

// ── Unified accessors ─────────────────────────────────────────────────────

export function getDimFill(dim: DimKey, value: string): string {
  if (dim === "resource") return RESOURCE_FILL[value] ?? "#f2f2f2";
  if (dim === "action")   return ACTION_FILL[value]   ?? "#f2f2f2";
  if (dim === "role")     return ROLE_FILL[value]     ?? "#f2f2f2";
  if (dim === "env")      return ENV_FILL[value]      ?? "#f2f2f2";
  return "#f2f2f2";
}

export function getDimInk(dim: DimKey, value: string): string {
  if (dim === "resource") return RESOURCE_INK[value] ?? "#595959";
  if (dim === "action")   return ACTION_INK[value]   ?? "#595959";
  if (dim === "role")     return ROLE_INK[value]     ?? "#595959";
  if (dim === "env")      return ENV_INK[value]      ?? "#595959";
  return "#595959";
}

// Density: white → Excel yellow → Excel green
export function getDensityFill(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "";
  const t = count / maxCount;
  if (t < 0.5) {
    const s = t * 2;
    return `rgb(255, ${Math.round(255 - 13 * s)}, ${Math.round(255 - 51 * s)})`;
  } else {
    const s = (t - 0.5) * 2;
    return `rgb(${Math.round(255 - 29 * s)}, ${Math.round(242 - 3 * s)}, ${Math.round(204 + 14 * s)})`;
  }
}

