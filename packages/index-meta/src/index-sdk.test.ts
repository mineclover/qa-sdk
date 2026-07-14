// @def.boundary index-meta-system
// @def.doc index-meta-system

import { describe, expect, it } from 'vitest';
import { createIndexSDK } from './index-sdk.js';
import { MetaCodec } from './meta-codec.js';
import { ValidationError } from './errors.js';
import type { MetaRegistryInput } from './types.js';

const UPDATED_AT = '2026-01-01T00:00:00.000Z';

function baseInput(): MetaRegistryInput {
  return {
    dims: {
      role: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['_', 'admin', 'editor'], capacity: 5 },
          v2: {
            entries: ['_', 'admin', 'editor', 'viewer'],
            capacity: 5,
            entryFlags: {
              3: { status: 'inactive', reason: 'deprecated', updatedAt: UPDATED_AT },
            },
          },
        },
      },
      action: {
        kind: { type: 'string_enum' },
        snapshots: {
          v1: { entries: ['read', 'write'] },
        },
      },
    },
    indices: {
      perm: {
        dims: ['role', 'action'],
        versions: {
          v1: { snapshots: { role: 'v1', action: 'v1' } },
          v2: { snapshots: { role: 'v2', action: 'v1' } },
        },
      },
    },
  };
}

describe('IndexSDK lifecycle scenarios', () => {
  it('creates a version-pinned client for constants, encode, decode, and ranges', () => {
    const sdk = createIndexSDK(baseInput());
    const client = sdk.client('perm', 'v1');

    expect(client.constants('role')).toEqual({
      admin: 'admin',
      editor: 'editor',
    });

    const encoded = client.encode({ role: 'admin', action: 'read' });
    expect(encoded).toEqual({ indexId: 'perm', versionId: 'v1', value: 2 });
    expect(client.decode(encoded)).toEqual({ role: 'admin', action: 'read' });
    expect(client.encode({ role: 'admin', action: 'read' })).toEqual(encoded);
    expect(client.matchRanges({ role: 'admin', action: null })).toEqual([[2, 3]]);

    const reserved = client.encode({ role: '_', action: 'write' });
    expect(client.decode(reserved)).toEqual({ role: '_', action: 'write' });
  });

  it('separates client entry views from full capacity views', () => {
    const sdk = createIndexSDK(baseInput());
    const client = sdk.client('perm', 'v1');

    expect(client.entries('role')).toEqual(['_', 'admin', 'editor']);
    expect(client.dimCapacity('role')).toEqual({ total: 3, capacity: 5, headroom: 2 });
    expect(client.dimFullView('role')).toEqual({
      dimId: 'role',
      snapshotId: 'v1',
      total: 3,
      capacity: 5,
      headroom: 2,
      positions: [
        { position: 1, value: '_', kind: 'reserved' },
        { position: 2, value: 'admin', kind: 'normal' },
        { position: 3, value: 'editor', kind: 'normal' },
        { position: 4, value: null, kind: 'empty' },
        { position: 5, value: null, kind: 'empty' },
      ],
    });
  });

  it('keeps inactive entries decodable while excluding them from constants', () => {
    const sdk = createIndexSDK(baseInput());
    const client = sdk.client('perm', 'v2');

    expect(client.constants('role')).toEqual({
      admin: 'admin',
      viewer: 'viewer',
    });
    expect(client.entries('role')).toEqual(['_', 'admin', 'editor', 'viewer']);

    const inactivePayload = client.encode({ role: 'editor', action: 'write' });
    expect(client.decode(inactivePayload)).toEqual({
      role: 'editor',
      action: 'write',
    });
    expect(client.dimFullView('role').positions[2]).toEqual({
      position: 3,
      value: 'editor',
      kind: 'normal',
    });
  });

  it('applies custom reservedTokens to constants and fullView classification', () => {
    const input = baseInput();
    input.dims.role.snapshots.v1.entries = ['_', '__reserved__', 'admin'];
    const sdk = createIndexSDK(input, {
      reservedTokens: new Set(['__reserved__']),
    });
    const client = sdk.client('perm', 'v1');

    expect(client.constants('role')).toEqual({
      _: '_',
      admin: 'admin',
    });
    expect(client.dimFullView('role').positions.slice(0, 3)).toEqual([
      { position: 1, value: '_', kind: 'normal' },
      { position: 2, value: '__reserved__', kind: 'reserved' },
      { position: 3, value: 'admin', kind: 'normal' },
    ]);
  });

  it('requires a regenerated SDK instance to observe schema snapshot changes', () => {
    const input = baseInput();
    const oldSdk = createIndexSDK(input);
    const oldClient = oldSdk.client('perm', 'v1');

    input.dims.role.snapshots.v1.entries.push('guest');

    const newSdk = createIndexSDK(input);
    const newClient = newSdk.client('perm', 'v1');

    expect(oldClient.entries('role')).toEqual(['_', 'admin', 'editor']);
    expect(oldClient.dimCapacity('role')).toEqual({ total: 3, capacity: 5, headroom: 2 });
    expect(newClient.entries('role')).toEqual(['_', 'admin', 'editor', 'guest']);
    expect(newClient.dimCapacity('role')).toEqual({ total: 4, capacity: 5, headroom: 1 });
  });

  it('shares VersionedValue and DecodeMap across service boundaries', () => {
    const input = baseInput();
    const frontend = createIndexSDK(input).client('perm', 'v1');
    const backend = createIndexSDK(input).client('perm', 'v1');

    const payload = frontend.encode({ role: 'admin', action: 'read' });
    expect(backend.decode(payload)).toEqual({ role: 'admin', action: 'read' });

    const analyticsCodec = new MetaCodec(frontend.toDecodeMap());
    expect(analyticsCodec.decode(payload)).toEqual({ role: 'admin', action: 'read' });

    const v2Payload = createIndexSDK(input)
      .client('perm', 'v2')
      .encode({ role: 'viewer', action: 'read' });
    expect(() => backend.decode(v2Payload)).toThrow(ValidationError);
  });

  it('can assemble CLI-like read models from SDK APIs', () => {
    const sdk = createIndexSDK(baseInput());
    const client = sdk.client('perm', 'v1');

    const info = {
      indexId: client.indexId,
      versionId: client.versionId,
      shape: [...client.shape],
      size: client.size,
    };
    const constants = client.constants('role');
    const capacity = client.dimCapacity('role');
    const fullView = client.dimFullView('role');

    expect(info).toEqual({
      indexId: 'perm',
      versionId: 'v1',
      shape: [5, 2],
      size: 10,
    });
    expect(constants).toEqual({ admin: 'admin', editor: 'editor' });
    expect(capacity.headroom).toBe(2);
    expect(fullView.positions.map((p) => p.kind)).toEqual([
      'reserved',
      'normal',
      'normal',
      'empty',
      'empty',
    ]);
  });
});
