// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { EventRecord } from '@qa-sdk/core';

import type { ObservationNode } from 'dkg';
import { DkgSqliteStore } from './dkg-sqlite-store.js';

const tempDirs: string[] = [];

function createStore(): DkgSqliteStore {
  const dir = mkdtempSync(join(tmpdir(), 'dkg-store-'));
  tempDirs.push(dir);
  return new DkgSqliteStore(join(dir, 'state.sqlite'), 'test');
}

function makeRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    log_id: 'log-1',
    timestamp: '2026-04-05T00:00:00.000Z',
    record_kind: 'log',
    trace_id: 'trace-1',
    span_id: 'span-1',
    event_key: 'cli.spec.lifecycle',
    event_version: '1',
    payload_format: 'json',
    payload_encoding: 'raw',
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { command: 'dkg spec transition' },
    qa_session_id: 'cli-test',
    ...overrides,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('DkgSqliteStore CLI audit events', () => {
  it('EventRecord 기반 CLI audit log를 저장하고 조회한다', () => {
    const store = createStore();
    const id = store.saveCliAuditEvent({
      eventPrefix: 'spec_event',
      command: 'dkg spec transition',
      targetId: 'spec-1',
      targetKind: 'spec',
      lifecycleFrom: 'draft',
      lifecycleTo: 'active',
      record: makeRecord({
        address_context: { spec_event: 'spec_event:v1:42' },
        payload: { specType: 'feat', lifecycleState: 'active', targetId: 'spec-1' },
      }),
    });

    expect(id).toBeGreaterThan(0);

    const events = store.listRecentCliAuditEvents(10, {
      eventPrefix: 'spec_event',
      targetId: 'spec-1',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventPrefix: 'spec_event',
      command: 'dkg spec transition',
      targetId: 'spec-1',
      targetKind: 'spec',
      lifecycleFrom: 'draft',
      lifecycleTo: 'active',
    });
    expect(events[0]?.record.address_context).toEqual({ spec_event: 'spec_event:v1:42' });
  });

  it('stats에 auditEvents 수를 포함한다', () => {
    const store = createStore();

    store.saveCliAuditEvent({
      eventPrefix: 'cli_event',
      command: 'dkg version',
      targetId: 'service:v1',
      targetKind: 'version',
      lifecycleTo: 'activate',
      record: makeRecord({
        event_key: 'cli.dkg.version',
        payload: { action: 'activate', prefix: 'service', versionId: 'v1' },
      }),
    });

    expect(store.stats().auditEvents).toBe(1);
  });
});

describe('DkgSqliteStore flow evidence', () => {
  it('raw address_context와 trace/session 범위를 snapshot과 분리해 저장·조회한다', () => {
    const store = createStore();
    const result = store.saveFlowEvidence({
      runId: 'convergence-run-1',
      observedAt: '2026-07-31T12:00:00.000Z',
      snapshotId: 7,
      records: [
        {
          timestamp: '2026-07-31T11:59:00.000Z',
          logId: 'log-1',
          traceId: 'trace-1',
          sessionId: 'session-1',
          eventKey: 'checkout.page',
          addressContext: {
            page_view: 'page_view:v1:1',
            endpoint: 'endpoint:v1:2',
          },
        },
        {
          timestamp: '2026-07-31T11:59:01.000Z',
          traceId: 'trace-2',
          sessionId: 'session-2',
          addressContext: { order_event: 'order_event:v1:3' },
        },
      ],
    });

    expect(result).toEqual({ recordsWritten: 2 });
    expect(store.listRecentFlowEvidence(10, { runId: 'convergence-run-1' })).toEqual([
      expect.objectContaining({
        runId: 'convergence-run-1',
        snapshotId: 7,
        traceId: 'trace-2',
        sessionId: 'session-2',
        addressContext: { order_event: 'order_event:v1:3' },
      }),
      expect.objectContaining({
        runId: 'convergence-run-1',
        snapshotId: 7,
        logId: 'log-1',
        traceId: 'trace-1',
        sessionId: 'session-1',
        addressContext: {
          page_view: 'page_view:v1:1',
          endpoint: 'endpoint:v1:2',
        },
      }),
    ]);
  });
});

describe('DkgSqliteStore observation provenance', () => {
  const base: ObservationNode = {
    kind: 'observation',
    id: 'OBS-METRIC-metric-headroom-axis_x',
    date: '2026-10-28',
    source: 'metric',
    subjects: ['axis_x'],
    finding: '[critical] 축 여유 공간: axis_x headroom=0',
  };

  it('provenance가 saveNodes → loadGraph round-trip에서 보존된다', () => {
    const store = createStore();
    const withProvenance: ObservationNode = {
      ...base,
      provenance: {
        producer: 'convergence/metric-registry',
        producerVersion: '0.1.0',
        algorithmVersion: 'metric-registry/1',
        inputDigest: 'sha256:input',
        catalogDigest: 'sha256:catalog',
      },
    };
    store.saveNodes([withProvenance], [], 'auto');

    const loaded = store.loadGraph().getNode(withProvenance.id) as ObservationNode | undefined;
    expect(loaded?.provenance).toEqual(withProvenance.provenance);
    store.close();
  });

  it('provenance 없는 기존 형태 observation도 오류 없이 로드된다', () => {
    const store = createStore();
    store.saveNodes([base], [], 'auto');

    const loaded = store.loadGraph().getNode(base.id) as ObservationNode | undefined;
    expect(loaded).toEqual(base);
    expect(loaded?.provenance).toBeUndefined();
    store.close();
  });

  it('saveUsageSnapshotWithObservations 경로도 provenance를 보존한다', () => {
    const store = createStore();
    const obs: ObservationNode = {
      ...base,
      provenance: { producer: 'convergence/metric-registry', producerVersion: '0.1.0' },
    };
    store.saveUsageSnapshotWithObservations(
      {
        entryUsages: [],
        addressUsages: [],
        coOccurrences: [],
        totalRecords: 0,
        collectionPeriod: { from: '2026-10-28T00:00:00.000Z', to: '2026-10-28T00:00:00.000Z' },
        versionUsages: [],
      },
      [obs],
    );

    const loaded = store.loadGraph().getNode(obs.id) as ObservationNode | undefined;
    expect(loaded?.provenance).toEqual(obs.provenance);
    store.close();
  });
});
