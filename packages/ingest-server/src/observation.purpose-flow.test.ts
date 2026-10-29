// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * @purpose P5 변화 관측·흐름 추적 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * SDK가 보낸 좌표 이벤트 → ingest 수집·trace 재구성 → convergence 분석(실제 @qa-sdk/convergence·DKG)
 * → usage snapshot과 observation이 DKG store에 남는다.
 */
import { fileURLToPath } from 'node:url';
import {
  encodePrefix,
  getPrefixEntries,
  latestPrefixVersion,
  type Catalog,
  type TransmissionEnvelope,
} from '@qa-sdk/core';
import type { ObservationNode, UsageData } from '@qa-sdk/convergence';
import { DEMO_DKG_CONFIG } from 'demo-dkg-config';
import { DEMO_CATALOG } from 'demo-snapshot';
import { bootstrapDkg } from 'dkg-enrichment';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConvergenceFunctions } from './lib/convergence-functions.js';
import { ConvergencePipelineRunner, type DkgStorePort } from './lib/convergence-pipeline.js';
import { RecordStreamBroker } from './lib/record-stream-broker.js';
import { createRuntimeStores } from './stores/runtime-stores.js';

const catalog = DEMO_CATALOG as unknown as Catalog;
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const PREFIX = 'service';
const VERSION = latestPrefixVersion(catalog, PREFIX);
const TRACE_ID = 'trc_purpose_observe';

/** DKG store 대역 — 저장된 snapshot·observation을 기록 */
function recordingDkgStore() {
  const saved: { usage: UsageData; observations: readonly ObservationNode[] }[] = [];
  const store: DkgStorePort = {
    saveUsageSnapshotWithObservations(usage, observations) {
      saved.push({ usage, observations });
      return { snapshotId: saved.length, observationsWritten: observations.length };
    },
  };
  return { store, saved };
}

/** SDK(core runtime)가 만든 service 주소 — 차원마다 position을 고른다 */
function sdkAddress(position: number): string {
  const { entries } = getPrefixEntries(catalog, PREFIX, VERSION);
  const positions = Object.fromEntries(
    Object.entries(entries).map(([label, values]) => [
      label,
      Math.min(position, values.length - 1),
    ]),
  );
  return `${PREFIX}:${VERSION}:${encodePrefix(catalog, PREFIX, VERSION, positions)}`;
}

function envelope(index: number, address: string): TransmissionEnvelope {
  return {
    transmission_id: `txm_observe_${index}`,
    sent_at: '2026-10-29T00:00:00.000Z',
    owner: { owner_type: 'workspace', owner_id: 'ws_purpose' },
    source: { service_name: 'web-app', sdk_name: 'qa-sdk-js', sdk_version: '0.1.0' },
    runtime: { platform: 'node' },
    build: { env: 'dev' },
    records: [
      {
        log_id: `log_observe_${index}`,
        timestamp: `2026-10-29T00:00:0${index}.000Z`,
        record_kind: 'log',
        trace_id: TRACE_ID,
        span_id: `spn_${index}`,
        event_key: 'page_view',
        event_version: '001',
        payload_format: 'json',
        payload_encoding: 'raw',
        payload_masking_applied: false,
        payload_masked_fields: [],
        payload: {},
        address_context: { [PREFIX]: address },
      },
    ],
  } as TransmissionEnvelope;
}

describe('P5 변화 관측 — 이벤트 → trace → convergence → DKG', () => {
  it('수집한 좌표 이벤트가 trace로 재구성되고 usage snapshot으로 관측된다', async () => {
    const stores = await createRuntimeStores({
      env: { STORE_DRIVER: 'sqlite', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
      logger: { warn: () => {} },
      migrationsFolder,
    });
    const dkg = recordingDkgStore();
    const graph = bootstrapDkg({ catalog, config: DEMO_DKG_CONFIG });
    const pipeline = new ConvergencePipelineRunner(
      {
        recordStore: stores.recordStore,
        convergenceFns: await loadConvergenceFunctions(),
        graphProvider: () => graph,
        catalogProvider: () => catalog,
        dkgStore: dkg.store,
        logger: pino({ level: 'silent' }),
      },
      { recordThreshold: 1_000 },
    );
    const app = createApp({
      ...stores,
      recordStreamBroker: new RecordStreamBroker(),
      convergencePipeline: pipeline,
      logger: pino({ level: 'silent' }),
    });

    const addresses = [sdkAddress(0), sdkAddress(1), sdkAddress(0)];
    for (const [i, address] of addresses.entries()) {
      const res = await app.request('/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope(i, address)),
      });
      expect(res.status).toBe(202);
    }

    // trace 재구성 — 세 이벤트가 하나의 trace로 묶인다
    const records = (await (await app.request(`/v1/traces/${TRACE_ID}/records`)).json()) as {
      items: unknown[];
    };
    expect(records.items).toHaveLength(addresses.length);

    // convergence — Phase 2 완료 알림을 받은 trace를 분석해 DKG에 남긴다
    const result = await pipeline.flush();
    expect(result).toMatchObject({ recordsProcessed: addresses.length });
    expect(result!.metricsCollected).toBeGreaterThan(0);
    expect(dkg.saved).toHaveLength(1);

    const usage = dkg.saved[0].usage;
    const observedServiceAddresses = usage.addressUsages
      .filter((u) => u.prefix === PREFIX)
      .reduce((sum, u) => sum + u.count, 0);
    expect(observedServiceAddresses).toBe(addresses.length);
  });
});
