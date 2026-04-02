// ── Event Category ──────────────────────────────────────

export type EventCategory =
  | "navigation"
  | "interaction"
  | "form"
  | "session"
  | "network"
  | "execution"
  | "outcome"
  | "quality"
  | "infrastructure";

// ── Channel ────────────────────────────────────────────

export type Channel =
  | "browser"
  | "mobile"
  | "backend"
  | "sdk"
  | "agent"
  | "common"
  | "qa";

// ── Graph Hint ─────────────────────────────────────────

export type GraphRole = "entry" | "transition" | "terminal" | "observation";

export interface GraphHint {
  role: GraphRole;
  goal_eligible: boolean;
  loopable: boolean;
}

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
  graph_hint: GraphHint;
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

// ── Transition Definition ──────────────────────────

/** 선언적 비즈니스 트랜잭션 — 이벤트들의 원자 경계 그룹 */
export interface TransitionDef {
  /** 전이 식별자 — PipeTransitionScope.transitionId와 일치 */
  transitionId: string;
  /** 이 transition에 소속된 event_key 목록 */
  events: string[];
  /** 설명 */
  description?: string;
}
