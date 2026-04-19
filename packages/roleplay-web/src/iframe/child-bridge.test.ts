// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createChildBridge } from './child-bridge.js';
import type { ContextMessage } from './message-protocol.js';

function makeContextMsg(overrides: Partial<ContextMessage> = {}): ContextMessage {
  return {
    type: 'context',
    traceId: 'trc_001',
    sessionId: 'ses_001',
    scenarioId: 'checkout_v1',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  // parent를 원래대로 복원
  Object.defineProperty(window, 'parent', { get: () => window, configurable: true });
});

describe('ChildBridge — onContext', () => {
  it('올바른 origin의 context 메시지가 오면 핸들러가 호출된다', () => {
    const bridge = createChildBridge('http://viz-web');
    const handler = vi.fn();
    bridge.onContext(handler);

    const msg = makeContextMsg();
    window.dispatchEvent(new MessageEvent('message', { data: msg, origin: 'http://viz-web' }));

    expect(handler).toHaveBeenCalledWith(msg);
    bridge.destroy();
  });

  it('잘못된 origin의 메시지는 무시된다', () => {
    const bridge = createChildBridge('http://viz-web');
    const handler = vi.fn();
    bridge.onContext(handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: makeContextMsg(),
        origin: 'http://evil.com',
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it('context가 아닌 메시지(ready 등)는 핸들러를 호출하지 않는다', () => {
    const bridge = createChildBridge('http://viz-web');
    const handler = vi.fn();
    bridge.onContext(handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ready' },
        origin: 'http://viz-web',
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it('핸들러를 교체(재등록)할 수 있다', () => {
    const bridge = createChildBridge('http://viz-web');
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bridge.onContext(handler1);
    bridge.onContext(handler2); // 교체

    window.dispatchEvent(
      new MessageEvent('message', {
        data: makeContextMsg(),
        origin: 'http://viz-web',
      }),
    );

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
    bridge.destroy();
  });
});

describe('ChildBridge — destroy', () => {
  it('destroy() 후에는 메시지가 와도 핸들러가 호출되지 않는다', () => {
    const bridge = createChildBridge('http://viz-web');
    const handler = vi.fn();
    bridge.onContext(handler);
    bridge.destroy();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: makeContextMsg(),
        origin: 'http://viz-web',
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('ChildBridge — notifyEvent', () => {
  it('iframe 환경에서 parent.postMessage 로 event:emitted 메시지를 전송한다', () => {
    const postMessageMock = vi.fn();
    Object.defineProperty(window, 'parent', {
      get: () => ({ postMessage: postMessageMock }),
      configurable: true,
    });

    const bridge = createChildBridge('http://viz-web');
    bridge.notifyEvent('click');

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event:emitted', eventKey: 'click' }),
      'http://viz-web',
    );
    bridge.destroy();
  });

  it('전송된 메시지에 timestamp가 포함된다', () => {
    const postMessageMock = vi.fn();
    Object.defineProperty(window, 'parent', {
      get: () => ({ postMessage: postMessageMock }),
      configurable: true,
    });

    const bridge = createChildBridge('http://viz-web');
    bridge.notifyEvent('page_view');

    // calls[0] 은 생성 시 전송되는 "ready" 메시지 — event:emitted 메시지를 찾아야 함
    const eventCall = postMessageMock.mock.calls.find(
      ([msg]: [{ type: string }]) => msg.type === 'event:emitted',
    );
    expect(eventCall).toBeDefined();
    const [msg] = eventCall as [{ timestamp: string }];
    expect(typeof msg.timestamp).toBe('string');
    bridge.destroy();
  });
});
