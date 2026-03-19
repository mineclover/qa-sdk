// ── SchemaSnapshot ─────────────────────────────────
// registry-service의 SchemaSnapshot과 동일한 구조.
// CLI는 독립 실행되므로 로컬 타입 정의.

export interface Axis {
  id: string;
  entries: string[];
  capacity: number;
}

// ── Snapshot Supply ────────────────────────────────
// 배포 시점의 entry set(snapshot)을 어떻게 추적하는지를 composite별로 선택.

export type SnapshotSupply =
  | { type: "axis"; capacity: number }   // index 안에 schema_version 축으로 인코딩
  | { type: "envelope" }                 // TransmissionEnvelope.entry_snapshot에 태깅
  | { type: "context" }                  // address_context에 별도 키로
  | { type: "implicit" }                 // 추적 안 함, 항상 최신

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
