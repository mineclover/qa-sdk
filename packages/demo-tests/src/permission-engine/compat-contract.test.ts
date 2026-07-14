// @def.boundary validation-layer-group
// @def.doc validation-layer-group

import { describe, expect, it } from 'vitest';
import { AddressProtocolManager, MetaCodec, type DecodeMap } from 'index-meta';
import { PermissionCodec, type CodecDims } from 'permission-engine';
import { PrefixCodec, createBinder, createLabelRegistry } from 'weighted-index';

const DIMS: CodecDims = {
  services: ['shop/payment', 'cms/auth'],
  types: ['api', 'page'],
  resources: ['admin/teams', 'billing/invoices', 'dashboard'],
  actions: ['GET', 'POST'],
};

const SHAPE = [DIMS.services.length, DIMS.types.length, DIMS.resources.length, DIMS.actions.length];

const DECODE_MAP: DecodeMap = {
  indexId: 'perm',
  versionId: 'v1',
  shape: [...SHAPE],
  size: SHAPE.reduce((product, size) => product * size, 1),
  dims: [
    {
      dimId: 'service',
      snapshotId: 'v1',
      kind: { type: 'string_enum' },
      entries: [...DIMS.services],
    },
    {
      dimId: 'type',
      snapshotId: 'v1',
      kind: { type: 'string_enum' },
      entries: [...DIMS.types],
    },
    {
      dimId: 'resource',
      snapshotId: 'v1',
      kind: { type: 'string_enum' },
      entries: [...DIMS.resources],
    },
    {
      dimId: 'action',
      snapshotId: 'v1',
      kind: { type: 'string_enum' },
      entries: [...DIMS.actions],
    },
  ],
};

function createPrefixCodec(): PrefixCodec {
  const labels = createLabelRegistry({
    service: [{ version: 'v1', ids: [...DIMS.services] }],
    type: [{ version: 'v1', ids: [...DIMS.types] }],
    resource: [{ version: 'v1', ids: [...DIMS.resources] }],
    action: [{ version: 'v1', ids: [...DIMS.actions] }],
  });

  return new PrefixCodec(labels, {
    perm: {
      labels: ['service', 'type', 'resource', 'action'],
      versions: [
        {
          version: 'v1',
          labelVersions: {
            service: 'v1',
            type: 'v1',
            resource: 'v1',
            action: 'v1',
          },
        },
      ],
    },
  });
}

describe('permission-engine compatibility contract', () => {
  it('PermissionCodec, PrefixCodec, and MetaCodec encode the same address space', () => {
    const permissionCodec = new PermissionCodec('v1', DIMS);
    const prefixCodec = createPrefixCodec();
    const metaCodec = new MetaCodec(DECODE_MAP);

    for (const service of DIMS.services) {
      for (const type of DIMS.types) {
        for (const resource of DIMS.resources) {
          for (const action of DIMS.actions) {
            const expected = permissionCodec.encodeRaw(service, type, resource, action);

            expect(
              prefixCodec.encodeFromIds('perm', {
                service,
                type,
                resource,
                action,
              }).id,
            ).toBe(expected);

            expect(
              metaCodec.encode({
                service,
                type,
                resource,
                action,
              }).value,
            ).toBe(expected);
          }
        }
      }
    }
  });

  it('decode results stay aligned across the future merge boundary', () => {
    const permissionCodec = new PermissionCodec('v1', DIMS);
    const prefixCodec = createPrefixCodec();
    const metaCodec = new MetaCodec(DECODE_MAP);

    for (let address = 0; address < permissionCodec.size; address++) {
      const decoded = permissionCodec.decode(address);
      const expected = {
        service: decoded.service,
        type: decoded.type,
        resource: decoded.resource,
        action: decoded.action,
      };

      expect(metaCodec.decodeValue(address)).toEqual(expected);
      expect(prefixCodec.decodeToIds({ prefix: 'perm', v: 'v1', id: address })).toEqual(expected);
    }
  });

  it('partial binding via createBinder stays compatible with PermissionCodec', () => {
    const permissionCodec = new PermissionCodec('v1', DIMS);
    const prefixCodec = createPrefixCodec();
    const binder = createBinder(prefixCodec, 'perm', {
      service: 'shop/payment',
    });

    expect(binder.free).toEqual(['type', 'resource', 'action']);

    for (const type of DIMS.types) {
      for (const resource of DIMS.resources) {
        for (const action of DIMS.actions) {
          expect(
            binder.resolveId({
              type,
              resource,
              action,
            }),
          ).toBe(permissionCodec.encodeRaw('shop/payment', type, resource, action));
        }
      }
    }
  });

  it('colon serialization stays interchangeable with AddressProtocolManager', () => {
    const permissionCodec = new PermissionCodec('v1', DIMS);
    const addressManager = new AddressProtocolManager();

    const address = permissionCodec.encodeRaw('cms/auth', 'page', 'billing/invoices', 'POST');

    const serialized = permissionCodec.serialize(address);
    expect(serialized).toBe(`perm:v1:${address}`);
    expect(
      addressManager.serialize({
        indexId: 'perm',
        versionId: 'v1',
        value: address,
      }),
    ).toBe(serialized);
    expect(addressManager.parse(serialized)).toEqual({
      indexId: 'perm',
      versionId: 'v1',
      value: address,
    });
  });
});
