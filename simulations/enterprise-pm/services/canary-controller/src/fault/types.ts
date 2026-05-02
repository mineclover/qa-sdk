// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md §3
// spec: docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md §8
//
// fault-injector 6종 — 4 기존 (시나리오 #10/#11/#13/#14) + 2 신규 (시나리오 16/17).
// 각 fault 는 enable/disable/reset 을 노출하며, controller 본 사이클은 fault 상태를
// 읽지 않고 정상 측정 경로 (audit-recorder-store, pg, dbPool gauge, pub/sub proxy,
// verdict wrap) 에 직접 주입된 데이터를 통해 verdict 를 산출한다.

/** spec §8 — FAULT_KINDS const tuple. 신규 항목 추가는 본 배열 + FaultModule 매핑만. */
export const FAULT_KINDS = [
  "schema-break", // 시나리오 #10
  "audit-anomaly", // 시나리오 #11
  "replication-lag", // 시나리오 #14
  "db-pool-pressure", // 시나리오 #13
  "pubsub-invalidate-drop", // 시나리오 #16 (bitmap-cache-version-fallback)
  "perf-warn", // 시나리오 #17 (pass-priority-canary-blocks-scale)
] as const;

export type FaultKind = (typeof FAULT_KINDS)[number];

export interface Fault {
  enable(params: unknown): Promise<void>;
  disable(target?: unknown): Promise<void>;
  reset(): Promise<void>;
}
