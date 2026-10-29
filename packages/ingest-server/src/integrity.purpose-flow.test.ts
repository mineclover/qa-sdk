// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * @purpose P3 정합성 관리 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * 선언(catalog·CatalogSnapshot)과 실제(SDK가 보낸 envelope)의 차이를 ingest가 감지한다.
 * - 구버전 SDK(문맥 없음)는 수락한다
 * - catalog에 없는 prefix의 key는 수락하되 key 관측에 미등록으로 남긴다 (warn)
 * - 판본 layout을 벗어난 주소는 enforce에서 거부한다
 */
import { fileURLToPath } from 'node:url';
import {
  buildCatalogSnapshot,
  encodePrefix,
  getPrefixEntries,
  latestPrefixVersion,
  prefixLayoutKey,
  toSnapshotWire,
  type Catalog,
  type CatalogSnapshot,
  type TransmissionEnvelope,
} from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { buildAddressHealthIndex } from './lib/enrich-address-context.js';
import { RecordStreamBroker } from './lib/record-stream-broker.js';
import { createSnapshotGate, type SnapshotGateMode } from './lib/snapshot-gate.js';
import { createRuntimeStores } from './stores/runtime-stores.js';

const catalog = DEMO_CATALOG as unknown as Catalog;
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const PREFIX = 'service';
const VERSION = latestPrefixVersion(catalog, PREFIX);

async function ingestApp(mode: Exclude<SnapshotGateMode, 'off'>, target: CatalogSnapshot) {
  const stores = await createRuntimeStores({
    env: { STORE_DRIVER: 'sqlite', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
    logger: { warn: () => {} },
    migrationsFolder,
  });
  const health = buildAddressHealthIndex(catalog);
  const app = createApp({
    ...stores,
    recordStreamBroker: new RecordStreamBroker(),
    knownPrefixes: health.knownPrefixes,
    latestVersions: health.latestVersions,
    snapshotGate: createSnapshotGate({
      mode,
      loadTarget: async () => target,
      loadSnapshot: async (_id, digest) => (digest === target.digest ? target : undefined),
    }),
    logger: pino({ level: 'silent' }),
  });
  return app;
}

function envelope(
  addressContext: Record<string, string>,
  catalogSnapshot?: TransmissionEnvelope['catalog_snapshot'],
): TransmissionEnvelope {
  return {
    transmission_id: `txm_${Object.values(addressContext).join('_')}`,
    sent_at: '2026-10-29T00:00:00.000Z',
    owner: { owner_type: 'workspace', owner_id: 'ws_purpose' },
    source: { service_name: 'web-app', sdk_name: 'qa-sdk-js', sdk_version: '0.1.0' },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    ...(catalogSnapshot ? { catalog_snapshot: catalogSnapshot } : {}),
    records: [
      {
        log_id: `log_${Object.values(addressContext).join('_')}`,
        timestamp: '2026-10-29T00:00:00.000Z',
        record_kind: 'log',
        trace_id: 'trc_purpose',
        span_id: 'spn_purpose',
        event_key: 'page_view',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: {},
        address_context: addressContext,
      },
    ],
  } as TransmissionEnvelope;
}

async function send(app: ReturnType<typeof createApp>, body: TransmissionEnvelope) {
  return app.request('/v1/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** SDK(core runtime)가 만든 유효한 service 주소 */
function validAddress(): string {
  const { entries } = getPrefixEntries(catalog, PREFIX, VERSION);
  const positions = Object.fromEntries(Object.keys(entries).map((label) => [label, 0]));
  return `${PREFIX}:${VERSION}:${encodePrefix(catalog, PREFIX, VERSION, positions)}`;
}

describe('P3 정합성 관리 — 선언과 실제의 차이 감지', () => {
  it('구버전 SDK를 수락하고, catalog에 없는 prefix key는 미등록으로 관측한다 (warn)', async () => {
    const target = (await buildCatalogSnapshot(catalog, { snapshotVersion: 1, parentDigest: null }))
      .snapshot;
    const app = await ingestApp('warn', target);

    expect((await send(app, envelope({ [PREFIX]: validAddress() }))).status).toBe(202);
    expect(
      (await send(app, envelope({ ghost_prefix: 'ghost_prefix:v1:3' }, toSnapshotWire(target))))
        .status,
    ).toBe(202);

    const unregistered = (await (
      await app.request('/v1/key-observations/unregistered')
    ).json()) as {
      items: { packedKey: string }[];
    };
    expect(unregistered.items.map((o) => o.packedKey)).toEqual(['ghost_prefix:v1:3']);

    const { summary } = (await (await app.request('/v1/key-observations/summary')).json()) as {
      summary: { registeredKeys: number; unregisteredKeys: number };
    };
    expect(summary).toMatchObject({ registeredKeys: 1, unregisteredKeys: 1 });
  });

  it('판본 layout을 벗어난 주소는 enforce에서 AddressOutOfRange로 거부한다', async () => {
    const target = (await buildCatalogSnapshot(catalog, { snapshotVersion: 1, parentDigest: null }))
      .snapshot;
    const app = await ingestApp('enforce', target);
    const totalSpace = Number(target.layouts[prefixLayoutKey(PREFIX, VERSION)].totalSpace);

    expect(
      (await send(app, envelope({ [PREFIX]: validAddress() }, toSnapshotWire(target)))).status,
    ).toBe(202);
    const rejected = await send(
      app,
      envelope({ [PREFIX]: `${PREFIX}:${VERSION}:${totalSpace}` }, toSnapshotWire(target)),
    );
    expect(rejected.status).toBe(422);
    expect(JSON.stringify(await rejected.json())).toContain('AddressOutOfRange');
  });
});
