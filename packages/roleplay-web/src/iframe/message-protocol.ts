// ── viz-web -> roleplay-web ──────────────────────────────

export interface ContextMessage {
  type: "context";
  traceId: string;
  sessionId: string;
  scenarioId: string;
}

// ── roleplay-web -> viz-web ─────────────────────────────

export interface EventEmittedMessage {
  type: "event:emitted";
  eventKey: string;
  timestamp: string;
}

export type ParentMessage = ContextMessage;
export type ChildMessage = EventEmittedMessage;

// ── Type Guards ─────────────────────────────────────────

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

export function isContextMessage(data: unknown): data is ContextMessage {
  return (
    isObject(data) &&
    data.type === "context" &&
    typeof data.traceId === "string" &&
    typeof data.sessionId === "string" &&
    typeof data.scenarioId === "string"
  );
}

export function isEventEmittedMessage(
  data: unknown,
): data is EventEmittedMessage {
  return (
    isObject(data) &&
    data.type === "event:emitted" &&
    typeof data.eventKey === "string" &&
    typeof data.timestamp === "string"
  );
}
