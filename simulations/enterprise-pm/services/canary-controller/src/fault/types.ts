// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md §3
//
// fault-injector 4종 — 시나리오 #10/#11/#13/#14가 controller fail-closed 분기를
// 의도적으로 트리거하기 위한 주입 표면. 각 fault는 enable/disable/reset을 노출하며,
// controller 본 사이클은 fault 상태를 읽지 않고 정상 측정 경로(audit-recorder-store,
// pg, dbPool gauge)에 직접 주입된 데이터를 통해 verdict를 산출한다.

export type FaultKind =
  | "schema-break"      // 시나리오 #10
  | "audit-anomaly"     // 시나리오 #11
  | "replication-lag"   // 시나리오 #14
  | "db-pool-pressure"; // 시나리오 #13

export interface Fault {
  enable(params: unknown): Promise<void>;
  disable(target?: unknown): Promise<void>;
  reset(): Promise<void>;
}
