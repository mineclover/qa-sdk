/** convergence MetricValue/MetricStatus와 구조 호환 — kernel tier 격리용 */

export type MetricStatus = "ok" | "warning" | "critical";

export interface MetricValue {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly status: MetricStatus;
  readonly detail?: string;
  readonly target?: string;
  readonly measuredAt?: string;
}

export interface AddressContextRecord {
  readonly address_context: Record<string, string>;
  readonly timestamp: string;
  readonly log_id?: string;
  readonly trace_id?: string;
  readonly session_id?: string;
  readonly event_key?: string;
  readonly actor_id?: string;
  readonly user_id?: string;
}
