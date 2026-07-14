import { describe, expect, it } from 'vitest';
import { descriptorsToTree } from '../src/compose.js';
import type { CommandDescriptor } from '../src/types.js';

describe('descriptorsToTree', () => {
  it('flat and nested descriptors를 tree로 변환한다', () => {
    const descriptors: CommandDescriptor[] = [
      {
        id: 'service.list',
        path: ['list'],
        usage: 'qa-sdk service list',
        handlerKey: 'service.list',
      },
      {
        id: 'service.app.list',
        path: ['app', 'list'],
        usage: 'qa-sdk service app list',
        handlerKey: 'service.app.list',
      },
      {
        id: 'service.app.show',
        path: ['app', 'show'],
        usage: 'qa-sdk service app show <id>',
        handlerKey: 'service.app.show',
      },
    ];

    const tree = descriptorsToTree(descriptors);
    expect(tree).toEqual([
      {
        segment: 'list',
        usage: 'qa-sdk service list',
        handlerKey: 'service.list',
      },
      {
        segment: 'app',
        children: [
          {
            segment: 'list',
            usage: 'qa-sdk service app list',
            handlerKey: 'service.app.list',
          },
          {
            segment: 'show',
            usage: 'qa-sdk service app show <id>',
            handlerKey: 'service.app.show',
          },
        ],
      },
    ]);
  });

  it('path가 빈 descriptor는 무시한다', () => {
    const result = descriptorsToTree([
      { id: 'empty', path: [], handlerKey: 'empty', usage: 'empty' },
      { id: 'valid', path: ['valid'], handlerKey: 'valid', usage: 'valid cmd' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].segment).toBe('valid');
  });

  it('same path leaf에 metadata를 병합한다', () => {
    const descriptors: CommandDescriptor[] = [
      {
        id: 'review.request',
        path: ['request'],
        usage: 'qa-sdk review request',
      },
      {
        id: 'review.request.help',
        path: ['request'],
        continuation: ['[--title <text>]'],
        handlerKey: 'review.request',
      },
    ];

    const tree = descriptorsToTree(descriptors);
    expect(tree).toEqual([
      {
        segment: 'request',
        usage: 'qa-sdk review request',
        continuation: ['[--title <text>]'],
        handlerKey: 'review.request',
      },
    ]);
  });
});
