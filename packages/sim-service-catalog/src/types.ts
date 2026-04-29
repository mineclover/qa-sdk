import type { ServicePrefix, VersionTag, VersionTagState } from "sim-identifier-grammar";

export type ServiceState = VersionTagState; // retired | stable | candidate

export interface VersionEntry {
  /** version tag — sim-identifier-grammar canonical 표기 (예: "v3", "v4-candidate"). */
  version: string;
  state: ServiceState;
}

export interface CatalogPrefixDefinition {
  /** canonical service prefix 문자열 — sim-identifier-grammar buildServicePrefix 통과. */
  prefix: string;
  versionAxis: { kind: "version"; capacity: number };
  refEntries: VersionEntry[];
}

/** spec 02 §5의 getCurrentTopology 반환. */
export interface Topology {
  prefix: ServicePrefix;
  stable: VersionTag;            // 정확히 1개 — invariant
  candidate: VersionTag | null;  // 0 또는 1개
  retired: VersionTag[];
  /** 호출 측이 관리하는 catalog revision. gateway/controller 부팅 sync용. */
  revision: number;
}

export interface TransitionLog {
  prefix: string;
  from: VersionEntry;
  to: VersionEntry;
  occurredAt: string; // ISO-8601
  revision: number;
}
