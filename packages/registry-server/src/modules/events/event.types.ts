export interface ServiceEvent {
  event_id: string;
  service_id: string;
  event_key: string;
  event_version: string;
  display_name: string;
  description: string | null;
  record_kind: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface EventVersionSummary {
  event_id: string;
  event_version: string;
  display_name: string;
  record_kind: string;
  status: string;
}

export interface EventVersionList {
  service_name: string;
  event_key: string;
  versions: EventVersionSummary[];
}

export interface EventWithServiceName extends ServiceEvent {
  service_name: string;
}
