// @def.boundary experience-layer-group
// @def.doc experience-layer-group

export interface ResolvedRunSpec {
  scenario_id: string;
  template: string;
  variables: Record<string, unknown>;
  events: EventMapping[];
}

export interface EventMapping {
  selector: string;
  dom_event: string;
  qa_event_key: string;
  payload_map?: Record<string, string>;
}
