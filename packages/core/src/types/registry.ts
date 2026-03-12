// ── Service Registry ────────────────────────────────────

export type ServiceStatus = "active" | "deprecated" | "retired";

export interface ServiceEntry {
  service_id: string;
  service_name: string;
  display_name: string;
  description?: string;
  owner_team?: string;
  status: ServiceStatus;
}

// ── Event Registry ──────────────────────────────────────

export type EventRecordKind = "log" | "span" | "both";
export type EventStatus = "active" | "deprecated" | "retired";

export type EventCategory =
  | "user_action"
  | "system_action"
  | "network_action"
  | "data_action"
  | "agent_action"
  | "sdk_action"
  | "error"
  | "state_change";

export type EventLifecycleStage =
  | "interaction"
  | "request"
  | "processing"
  | "result"
  | "side_effect"
  | "completion";

export interface EventEntry {
  event_id: string;
  service_id: string;
  event_key: string;
  event_version: string;
  display_name: string;
  description?: string;
  record_kind: EventRecordKind;
  category?: EventCategory;
  lifecycle_stage?: EventLifecycleStage;
  auto_collectable?: boolean;
  status: EventStatus;
}
