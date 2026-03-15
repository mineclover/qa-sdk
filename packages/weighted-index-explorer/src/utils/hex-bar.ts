/**
 * hex-bar.ts — Adapter: explorer's positional API → weighted-ui's HexField[] API.
 */
import { renderHexBar as renderHexBarBase, type HexField } from "weighted-ui";
import { formatHex, type PackFormat } from "weighted-index";

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
  const gap = Math.max(0, capacity - totalNeeded);

  const fields: HexField[] = [];
  if (prefixChars > 0) fields.push({ type: "prefix",  chars: prefixChars, value: values.prefix });
  if (verDigits > 0)   fields.push({ type: "version", chars: verDigits,   value: values.version });
  if (sc > 0)          fields.push({ type: "shard",   chars: sc,          value: values.shard ?? 0 });
  if (gap > 0)         fields.push({ type: "gap",     chars: gap,         value: 0 });
  if (indexChars > 0)  fields.push({ type: "index",   chars: indexChars,  value: values.index });

  const formatFn = fmt ? (hex: string) => formatHex(fmt, hex) : undefined;
  return renderHexBarBase(label, capacity, fields, { formatFn });
}
