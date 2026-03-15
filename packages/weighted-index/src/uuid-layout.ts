/**
 * uuid-layout.ts — Pack/unpack named fields into a fixed 128-bit UUID shape.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  left fields → [gap: zero-fill] ← right fields                    │
 * │  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  (32 hex chars, 8-4-4-4-12) │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Each field occupies a fixed range of hex chars (nibble-aligned).
 * Left fields are packed from char 0 rightward.
 * Right fields are packed from char 31 leftward.
 * The gap between left and right is zero-filled.
 *
 * Use this when you need a UUID-shaped container that embeds multiple
 * structured values (prefix, version, index, …) at human-readable positions.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface UUIDSlot {
  name:  string;
  chars: number; // number of hex chars (1 char = 4 bits)
}

export interface UUIDLayoutDef {
  left:  UUIDSlot[];
  right: UUIDSlot[];
}

export interface UUIDLayout {
  readonly totalLeft:  number;
  readonly totalRight: number;
  readonly left:  ReadonlyArray<UUIDSlot & { start: number }>;
  readonly right: ReadonlyArray<UUIDSlot & { start: number }>;
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Define a UUID layout schema.
 *
 * @example
 * const schema = createUUIDLayout({
 *   left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
 *   right: [{ name: "index",  chars: 6 }],
 * });
 */
export function createUUIDLayout(def: UUIDLayoutDef): UUIDLayout {
  const totalLeft  = def.left.reduce((s, f) => s + f.chars, 0);
  const totalRight = def.right.reduce((s, f) => s + f.chars, 0);

  if (totalLeft + totalRight > 32) {
    throw new RangeError(
      `UUIDLayout: left (${totalLeft}) + right (${totalRight}) = ${totalLeft + totalRight} chars, exceeds 32`
    );
  }

  // Left fields: packed from char 0 rightward
  const left: Array<UUIDSlot & { start: number }> = [];
  let pos = 0;
  for (const slot of def.left) {
    left.push({ ...slot, start: pos });
    pos += slot.chars;
  }

  // Right fields: packed from char 31 leftward.
  // The last element in the definition array is placed at the rightmost edge,
  // and earlier elements are placed further left.
  //
  // Example: right = [{ name: "shard", chars: 2 }, { name: "index", chars: 6 }]
  //   "index" (last) occupies chars 26-31 (rightmost)
  //   "shard" (first) occupies chars 24-25 (next inward)
  const right: Array<UUIDSlot & { start: number }> = [];
  let rpos = 32;
  for (const slot of def.right) {
    rpos -= slot.chars;
    right.push({ ...slot, start: rpos });
  }

  return { totalLeft, totalRight, left, right };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

/**
 * Minimum hex chars needed to represent values 0 .. maxValue.
 *
 * @example
 * charsForMax(15)   // 1  ("f")
 * charsForMax(255)  // 2  ("ff")
 * charsForMax(639)  // 3  ("27f")
 */
export function charsForMax(maxValue: number): number {
  if (maxValue <= 0) return 1;
  return maxValue.toString(16).length;
}

/** Constraint for a single field in the layout planner. */
export interface LayoutFieldSpec {
  name:      string;
  maxValue?: number;  // auto-compute chars via charsForMax
  chars?:    number;  // explicit override (takes precedence)
}

/** Resolved field in a layout plan. */
export interface PlannedField {
  name:     string;
  chars:    number;
  maxValue: number;
  side:     "left" | "right";
}

/** Result of planLayout(). */
export interface LayoutPlan {
  fields:     PlannedField[];
  totalChars: number;
  fitsUUID:   boolean;     // totalChars ≤ 32
  gap:        number;      // 32 - totalChars (≥ 0 if fitsUUID)
  layout?:    UUIDLayout;  // ready-to-use layout (only when fitsUUID)
}

function resolveField(spec: LayoutFieldSpec, side: "left" | "right"): PlannedField {
  const chars    = spec.chars ?? charsForMax(spec.maxValue ?? 0);
  const maxValue = spec.maxValue ?? (16 ** chars - 1);
  return { name: spec.name, chars, maxValue, side };
}

/**
 * Compute optimal field allocations from constraints and check capacity.
 *
 * Pass shape as `{ name: "index", maxValue: product(shape) - 1 }` in `right`
 * to size the index field from a WeightedIndex shape.
 *
 * @example
 * const plan = planLayout({
 *   left:  [{ name: "prefix", chars: 4 }, { name: "version", maxValue: 15 }],
 *   right: [{ name: "index",  maxValue: 639 }],
 * });
 * plan.totalChars  // 8  (4 + 1 + 3)
 * plan.fitsUUID    // true
 * plan.gap         // 24
 * plan.layout      // ready-to-use UUIDLayout
 */
export function planLayout(opts: {
  left:  LayoutFieldSpec[];
  right: LayoutFieldSpec[];
}): LayoutPlan {
  const leftFields  = opts.left.map(s => resolveField(s, "left"));
  const rightFields = opts.right.map(s => resolveField(s, "right"));
  const allFields   = [...leftFields, ...rightFields];
  const totalChars  = allFields.reduce((s, f) => s + f.chars, 0);
  const fitsUUID    = totalChars <= 32;
  const gap         = Math.max(0, 32 - totalChars);

  let layout: UUIDLayout | undefined;
  if (fitsUUID) {
    layout = createUUIDLayout({
      left:  leftFields.map(f => ({ name: f.name, chars: f.chars })),
      right: rightFields.map(f => ({ name: f.name, chars: f.chars })),
    });
  }

  return { fields: allFields, totalChars, fitsUUID, gap, layout };
}

// ── Pack ─────────────────────────────────────────────────────────────────────

function formatUUID(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Pack field values into a UUID string according to the layout.
 *
 * @example
 * packUUID(schema, { prefix: 0xABCD, version: 1, index: 42 })
 * // → "abcd0100-0000-0000-0000-00000000002a"
 */
export function packUUID(layout: UUIDLayout, values: Record<string, number>): string {
  const chars = new Array(32).fill("0");

  for (const slot of layout.left) {
    writeSlot(chars, slot.start, slot.chars, values[slot.name] ?? 0);
  }
  for (const slot of layout.right) {
    writeSlot(chars, slot.start, slot.chars, values[slot.name] ?? 0);
  }

  return formatUUID(chars.join(""));
}

function writeSlot(chars: string[], start: number, width: number, value: number): void {
  const hex = value.toString(16).padStart(width, "0");
  for (let i = 0; i < width; i++) {
    chars[start + i] = hex[i];
  }
}

// ── Unpack ───────────────────────────────────────────────────────────────────

/**
 * Extract field values from a UUID string according to the layout.
 *
 * @example
 * unpackUUID(schema, "abcd0100-0000-0000-0000-00000000002a")
 * // → { prefix: 0xABCD, version: 1, index: 42 }
 */
export function unpackUUID(layout: UUIDLayout, uuid: string): Record<string, number> {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  const result: Record<string, number> = {};

  for (const slot of layout.left) {
    result[slot.name] = parseInt(hex.slice(slot.start, slot.start + slot.chars), 16);
  }
  for (const slot of layout.right) {
    result[slot.name] = parseInt(hex.slice(slot.start, slot.start + slot.chars), 16);
  }

  return result;
}
