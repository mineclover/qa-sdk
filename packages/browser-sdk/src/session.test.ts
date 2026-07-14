import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateSession, clearSession } from './session.js';

describe('getOrCreateSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('creates session with valid sessionId and traceId', () => {
    const s = getOrCreateSession();
    expect(s.sessionId).toBeTruthy();
    expect(s.traceId).toBeTruthy();
  });

  it('returns the same session on repeated calls (restore from storage)', () => {
    const s1 = getOrCreateSession();
    const s2 = getOrCreateSession();
    expect(s2.sessionId).toBe(s1.sessionId);
    expect(s2.traceId).toBe(s1.traceId);
  });

  it('persists session to sessionStorage under the default key', () => {
    const s = getOrCreateSession();
    const raw = sessionStorage.getItem('qa_monitor');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.sessionId).toBe(s.sessionId);
    expect(parsed.traceId).toBe(s.traceId);
  });

  it('uses custom storageKey when provided', () => {
    getOrCreateSession('custom_key');
    expect(sessionStorage.getItem('custom_key')).not.toBeNull();
    expect(sessionStorage.getItem('qa_monitor')).toBeNull();
  });

  it('creates new session after clearSession', () => {
    const s1 = getOrCreateSession();
    clearSession();
    const s2 = getOrCreateSession();
    expect(s2.sessionId).not.toBe(s1.sessionId);
    expect(s2.traceId).not.toBe(s1.traceId);
  });

  it('recovers gracefully from corrupted storage', () => {
    sessionStorage.setItem('qa_monitor', 'not-valid-json{{{');
    const s = getOrCreateSession();
    expect(s.sessionId).toBeTruthy();
    expect(s.traceId).toBeTruthy();
  });

  it('creates new session when stored object is missing traceId', () => {
    sessionStorage.setItem('qa_monitor', JSON.stringify({ sessionId: 'ssn_only' }));
    const s = getOrCreateSession();
    expect(s.sessionId).not.toBe('ssn_only');
  });

  it('creates new session when stored object is missing sessionId', () => {
    sessionStorage.setItem('qa_monitor', JSON.stringify({ traceId: 'trc_only' }));
    const s = getOrCreateSession();
    expect(s.traceId).not.toBe('trc_only');
  });
});

describe('clearSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('removes session from storage', () => {
    getOrCreateSession();
    clearSession();
    expect(sessionStorage.getItem('qa_monitor')).toBeNull();
  });

  it('removes session under custom key', () => {
    getOrCreateSession('my_key');
    clearSession('my_key');
    expect(sessionStorage.getItem('my_key')).toBeNull();
  });

  it('does not throw when no session exists', () => {
    expect(() => clearSession()).not.toThrow();
  });
});
