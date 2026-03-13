/** Messages sent from viz-web (parent) to roleplay-web (child iframe). */
export interface ContextMessage {
  type: "context";
  traceId: string;
  sessionId: string;
  scenarioId: string;
}

/** Messages sent from roleplay-web (child iframe) to viz-web (parent). */
export interface EventEmittedMessage {
  type: "event:emitted";
  eventKey: string;
  timestamp: string;
}

export type ParentMessage = ContextMessage;
export type ChildMessage = EventEmittedMessage;

export function isChildMessage(data: unknown): data is ChildMessage {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.type === "event:emitted";
}
