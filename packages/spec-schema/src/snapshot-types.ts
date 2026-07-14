/** @def.boundary apm-codegen-system */

/**
 * SchemaSnapshot — APM 스키마의 전체 상태 스냅샷.
 *
 * registry-service의 SchemaSnapshot과 동일한 구조를 가지며,
 * 코드 생성(codegen) 및 스냅샷 IO의 기본 입력으로 사용된다.
 */

export interface Axis {
  id: string;
  entries: string[];
  capacity: number;
}

export type SnapshotSupply =
  | { type: 'axis'; capacity: number }
  | { type: 'envelope' }
  | { type: 'context' }
  | { type: 'implicit' };

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
