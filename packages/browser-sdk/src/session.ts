/** @def.boundary browser-lifecycle-system */
import { newQaSessionId, newTraceId } from '@qa-sdk/core';
import type { MonitorSession } from './types.js';

const DEFAULT_KEY = 'qa_monitor';

/**
 * sessionStorage에서 기존 세션을 복원하거나 새로 생성한다.
 * 탭을 닫으면 세션이 만료되어 다음 방문 시 새 세션이 시작된다.
 */
export function getOrCreateSession(storageKey = DEFAULT_KEY): MonitorSession {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MonitorSession>;
      if (parsed.sessionId && parsed.traceId) {
        return { sessionId: parsed.sessionId, traceId: parsed.traceId };
      }
    }
  } catch {
    // parse 실패 시 새로 생성
  }

  const session: MonitorSession = {
    sessionId: newQaSessionId(),
    traceId: newTraceId(),
  };

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // quota 초과 등 무시
  }

  return session;
}

export function clearSession(storageKey = DEFAULT_KEY): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
