// ── SchemaSnapshot ─────────────────────────────────
// registry-service의 SchemaSnapshot과 동일한 구조.

export interface Axis {
  id: string;
  entries: string[];
  capacity: number;
}

export type SnapshotSupply =
  | { type: "axis"; capacity: number }
  | { type: "envelope" }
  | { type: "context" }
  | { type: "implicit" }

export interface Composite {
  id: string;
  dims: string[];
  owner: string;
  snapshotSupply?: SnapshotSupply;
}

export interface SchemaSnapshot {
  id: string;
  axes: Axis[];
  composites: Composite[];
}
