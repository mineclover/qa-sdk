import { describe, it, expect } from 'vitest';
import { resolveCommand, resolveCliTreeCommand } from '../src/resolve.js';
import type { CliCommandNode } from '../src/types.js';

const tree: CliCommandNode[] = [
  { segment: 'deploy', description: '배포', handlerKey: 'deploy' },
  {
    segment: 'config',
    children: [
      { segment: 'show', handlerKey: 'config.show' },
      { segment: 'use', handlerKey: 'config.use' },
      { segment: 'set', handlerKey: 'config.set' },
    ],
  },
  { segment: 'status', handler: async () => {} },
];

describe('resolveCommand', () => {
  it('1단계 명령 매칭', () => {
    const r = resolveCommand(['deploy', 'nginx', 'dev'], tree);
    expect(r?.commandName).toBe('deploy');
    expect(r?.rest).toEqual(['nginx', 'dev']);
    expect(r?.node.handlerKey).toBe('deploy');
  });

  it('2단계 명령 매칭', () => {
    const r = resolveCommand(['config', 'show'], tree);
    expect(r?.commandName).toBe('config show');
    expect(r?.rest).toEqual([]);
  });

  it('handler 직접 바인딩 매칭', () => {
    const r = resolveCommand(['status', 'dev'], tree);
    expect(r?.commandName).toBe('status');
    expect(r?.node.handler).toBeDefined();
  });

  it('자식만 있는 노드로 resolve하면 해당 노드를 반환한다', () => {
    const r = resolveCommand(['config'], tree);
    expect(r).not.toBeNull();
    expect(r?.commandName).toBe('config');
    expect(r?.node.children).toBeDefined();
    expect(r?.node.children!.length).toBe(3);
  });

  it('미매칭 → null', () => {
    expect(resolveCommand(['unknown'], tree)).toBeNull();
  });

  it('rootSegments 지원 (기존 호환)', () => {
    const r = resolveCliTreeCommand(['service', 'deploy', 'x'], ['service'], tree);
    expect(r?.commandName).toBe('service deploy');
  });
});
