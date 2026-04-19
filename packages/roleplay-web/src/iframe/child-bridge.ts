// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import { now } from '@qa-sdk/core';
import type { ContextMessage, EventEmittedMessage, ReadyMessage } from './message-protocol.js';
import { isContextMessage } from './message-protocol.js';

export interface ChildBridge {
  notifyEvent(eventKey: string): void;
  onContext(handler: (ctx: ContextMessage) => void): void;
  destroy(): void;
}

export function createChildBridge(vizOrigin: string): ChildBridge {
  let contextHandler: ((ctx: ContextMessage) => void) | null = null;

  function handleMessage(event: MessageEvent): void {
    if (event.origin !== vizOrigin) return;
    if (isContextMessage(event.data)) {
      contextHandler?.(event.data);
    }
  }

  window.addEventListener('message', handleMessage);

  // Signal readiness to viz-web so it can send context immediately
  if (window.parent !== window) {
    const readyMsg: ReadyMessage = { type: 'ready' };
    window.parent.postMessage(readyMsg, vizOrigin);
  }

  return {
    notifyEvent(eventKey: string): void {
      const message: EventEmittedMessage = {
        type: 'event:emitted',
        eventKey,
        timestamp: now(),
      };
      if (window.parent !== window) {
        window.parent.postMessage(message, vizOrigin);
      }
    },

    onContext(handler: (ctx: ContextMessage) => void): void {
      contextHandler = handler;
    },

    destroy(): void {
      window.removeEventListener('message', handleMessage);
      contextHandler = null;
    },
  };
}
