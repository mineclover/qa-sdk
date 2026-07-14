// @def.boundary viz-system-root
// @def.doc viz-system-root

/** Messages sent from viz-web (parent) to roleplay-web (child iframe). */
export interface ContextMessage {
  type: 'context';
  traceId: string;
  sessionId: string;
  scenarioId: string;
}

/** Messages sent from roleplay-web (child iframe) to viz-web (parent). */
export interface EventEmittedMessage {
  type: 'event:emitted';
  eventKey: string;
  timestamp: string;
}

/** roleplay-web signals it is ready and requests context from viz-web. */
export interface ReadyMessage {
  type: 'ready';
}

export type ParentMessage = ContextMessage;
export type ChildMessage = EventEmittedMessage | ReadyMessage;

export function isChildMessage(data: unknown): data is ChildMessage {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.type === 'event:emitted' || obj.type === 'ready';
}
