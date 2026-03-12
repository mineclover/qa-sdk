// ── Event Category ──────────────────────────────────────

export type EventCategory =
  | "navigation"
  | "interaction"
  | "form"
  | "session"
  | "network"
  | "execution"
  | "outcome"
  | "quality";

// ── Channel ────────────────────────────────────────────

export type Channel =
  | "browser"
  | "mobile"
  | "backend"
  | "sdk"
  | "agent"
  | "common"
  | "qa";

// ── Core Event Definition ──────────────────────────────

export interface CoreEventDef {
  event_key: string;
  event_version: string;
  mode: "core";
  category: EventCategory;
  channel: Channel[];
  display_name: string;
  description: string;
  auto_collectable: boolean;
}

// ── Payload Field Guide ────────────────────────────────

export type PayloadFieldType = "string" | "number" | "boolean" | "string[]";

export interface PayloadFieldDef {
  name: string;
  required: boolean;
  type: PayloadFieldType;
  description: string;
}

export interface PayloadFieldGuide {
  event_key: string;
  fields: PayloadFieldDef[];
}
