import {
  buildCatalogSnapshot,
  prefixLayoutKey,
  toSnapshotWire,
  type CatalogSnapshot,
  type TransmissionEnvelope,
} from '@qa-sdk/core';
import { describe, expect, it } from 'vitest';
import { gateCatalog } from './__fixtures__/snapshot-catalog.js';
import { createSnapshotGate } from './snapshot-gate.js';

async function snapshotOf(entries: string[], capacity = 4, version = 1, id = 'shop') {
  return (
    await buildCatalogSnapshot(gateCatalog(entries, capacity, id), {
      snapshotVersion: version,
      parentDigest: null,
    })
  ).snapshot;
}

function envelope(
  wire?: TransmissionEnvelope['catalog_snapshot'],
  address = 'svc:v1:1',
): TransmissionEnvelope {
  return {
    transmission_id: 't',
    sent_at: '2026-10-29T00:00:00.000Z',
    owner: { owner_type: 'tenant', owner_id: 'o' },
    source: { service_name: 's', sdk_name: 'sdk', sdk_version: '1' },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    ...(wire ? { catalog_snapshot: wire } : {}),
    records: [
      {
        log_id: 'l',
        timestamp: '2026-10-29T00:00:00.000Z',
        record_kind: 'log',
        trace_id: 'tr',
        span_id: 'sp',
        event_key: 'e',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        address_context: { svc: address },
      },
    ],
  } as TransmissionEnvelope;
}

function gateFor(target: CatalogSnapshot | undefined, published: CatalogSnapshot[] = []) {
  return createSnapshotGate({
    mode: 'enforce',
    loadTarget: async () => target,
    loadSnapshot: async (_id, digest) => published.find((s) => s.digest === digest),
  });
}

describe('snapshot gate', () => {
  it('catalog_snapshot이 없으면 missing (구버전 SDK)', async () => {
    expect(await gateFor(await snapshotOf(['dev', 'prod'])).check(envelope())).toEqual({
      status: 'missing',
    });
  });

  it('target과 같은 digest면 ok', async () => {
    const target = await snapshotOf(['dev', 'prod']);
    expect(await gateFor(target).check(envelope(toSnapshotWire(target)))).toEqual({
      status: 'ok',
      digest: target.digest,
      checkedLayouts: 1,
    });
  });

  it('생성 snapshot → target이 append-only면 ok', async () => {
    const producer = await snapshotOf(['dev', 'prod']);
    const target = await snapshotOf(['dev', 'prod', 'qa'], 4, 2);
    expect(
      await gateFor(target, [producer]).check(envelope(toSnapshotWire(producer))),
    ).toMatchObject({
      status: 'ok',
    });
  });

  it.each([
    [
      'catalog가 다르면 CatalogMismatch',
      async () => {
        const target = await snapshotOf(['dev', 'prod']);
        return {
          target,
          wire: { ...toSnapshotWire(target), catalog_id: 'other' },
          code: 'CatalogMismatch',
        };
      },
    ],
    [
      '지원하지 않는 codec이면 UnsupportedCodecVersion',
      async () => {
        const target = await snapshotOf(['dev', 'prod']);
        return {
          target,
          wire: { ...toSnapshotWire(target), codec_version: 'legacy-v9' },
          code: 'UnsupportedCodecVersion',
        };
      },
    ],
    [
      '발행되지 않은 digest면 UnknownCatalogSnapshot',
      async () => {
        const target = await snapshotOf(['dev', 'prod']);
        return {
          target,
          wire: { ...toSnapshotWire(target), digest: `sha256:${'0'.repeat(64)}` },
          code: 'UnknownCatalogSnapshot',
        };
      },
    ],
  ] as const)('%s', async (_name, arrange) => {
    const { target, wire, code } = await arrange();
    expect(await gateFor(target).check(envelope(wire))).toMatchObject({
      status: 'violation',
      code,
    });
  });

  it('주소가 layout 주소 공간을 벗어나면 AddressOutOfRange', async () => {
    const target = await snapshotOf(['dev', 'prod']);
    const totalSpace = Number(target.layouts[prefixLayoutKey('svc', 'v1')].totalSpace);
    const gate = gateFor(target);
    const wire = toSnapshotWire(target);
    expect(await gate.check(envelope(wire, `svc:v1:${totalSpace - 1}`))).toMatchObject({
      status: 'ok',
    });
    expect(await gate.check(envelope(wire, `svc:v1:${totalSpace}`))).toMatchObject({
      status: 'violation',
      code: 'AddressOutOfRange',
    });
  });

  it('생성 snapshot과 target이 breaking이면 MigrationRequired', async () => {
    const producer = await snapshotOf(['dev', 'prod']);
    const target = await snapshotOf(['dev', 'prod'], 8, 2);
    expect(
      await gateFor(target, [producer]).check(envelope(toSnapshotWire(producer))),
    ).toMatchObject({
      status: 'violation',
      code: 'MigrationRequired',
    });
  });

  it('registry 조회가 실패하면 degraded (fail-open)', async () => {
    const target = await snapshotOf(['dev', 'prod']);
    const gate = createSnapshotGate({
      mode: 'enforce',
      loadTarget: async () => {
        throw new Error('registry down');
      },
      loadSnapshot: async () => undefined,
    });
    expect(await gate.check(envelope(toSnapshotWire(target)))).toEqual({
      status: 'degraded',
      reason: 'registry down',
    });
  });

  it('target snapshot이 없으면 degraded', async () => {
    const wire = toSnapshotWire(await snapshotOf(['dev', 'prod']));
    expect(await gateFor(undefined).check(envelope(wire))).toMatchObject({ status: 'degraded' });
  });

  it('좌표 주소가 없는 envelope은 해석할 것이 없으므로 ok (0 layout)', async () => {
    const target = await snapshotOf(['dev', 'prod']);
    const env = envelope(toSnapshotWire(target));
    env.records[0].address_context = undefined;
    expect(await gateFor(target).check(env)).toMatchObject({ status: 'ok', checkedLayouts: 0 });
  });
});
