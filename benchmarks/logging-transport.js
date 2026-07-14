/**
 * 로깅 Transport 벤치마크 — 실제 운영 시나리오 기반.
 *
 * 시나리오: 쇼핑몰 웹 서비스가 사용자 세션당 10~20건 이벤트를
 * QaMonitor/QaLogger로 수집 서버에 전송.
 *
 * 실행: node benchmarks/logging-transport.js
 * 필요: ingest-server (localhost:3200)
 */
import { DEMO_CATALOG } from 'demo-snapshot';
import { encodePrefix, latestPrefixVersion } from '@qa-sdk/core';

const INGEST = process.env.INGEST_URL || 'http://localhost:3200';
const svcVer = latestPrefixVersion(DEMO_CATALOG, 'service');
const svcAddr = encodePrefix(DEMO_CATALOG, 'service', svcVer, {
  env: 0,
  region: 0,
  svc_name: 0,
  namespace: 0,
});

function makeRecord(id, eventKey) {
  return {
    log_id: id,
    trace_id: 'bench-trace',
    span_id: 's1',
    timestamp: new Date().toISOString(),
    record_kind: 'log',
    event_key: eventKey,
    event_version: '001',
    payload_format: 'json',
    payload_encoding: 'raw',
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { page: 'home', userId: 'u123', ts: Date.now() },
    address_context: { service: `service:${svcVer}:${svcAddr}`, page_view: 'page_view:v2:0' },
  };
}

function makeEnvelope(id, records) {
  return {
    transmission_id: id,
    sent_at: new Date().toISOString(),
    owner: { owner_type: 'tenant', owner_id: 'bench' },
    source: {
      service_name: 'shop/shopping-web',
      sdk_name: '@qa-sdk/browser-sdk',
      sdk_version: '0.1.0',
    },
    runtime: { platform: 'browser', device_ref: 'Chrome/130' },
    build: { env: 'dev' },
    records,
  };
}

function encodeQAPB(obj) {
  const payload = new TextEncoder().encode(JSON.stringify(obj));
  const frame = new Uint8Array(8 + payload.length);
  frame[0] = 0x51;
  frame[1] = 0x41;
  frame[2] = 0x50;
  frame[3] = 0x42;
  new DataView(frame.buffer).setUint32(4, payload.length, false);
  frame.set(payload, 8);
  return frame;
}

// ── 실제 시나리오 이벤트 (세션 1개 = 12건) ──
const SESSION_EVENTS = [
  'auth.login',
  'page.home',
  'page.products',
  'page.product_detail',
  'cart.add',
  'cart.view',
  'checkout.start',
  'checkout.address',
  'checkout.payment',
  'payment.process',
  'payment.success',
  'auth.logout',
];

async function runBench(name, sendFn, sessions = 100) {
  // warmup
  for (let i = 0; i < 3; i++) await sendFn(`warm-${i}`);

  const start = performance.now();
  let totalBytes = 0;
  const batch = [];
  for (let i = 0; i < sessions; i++) {
    batch.push(
      sendFn(`s${i}`).then((b) => {
        totalBytes += b;
      }),
    );
    if (batch.length >= 20) {
      await Promise.all(batch);
      batch.length = 0;
    }
  }
  if (batch.length) await Promise.all(batch);

  const elapsed = performance.now() - start;
  const totalRecords = sessions * SESSION_EVENTS.length;
  return {
    name,
    sessions,
    totalRecords,
    elapsed: Math.round(elapsed),
    sessionsPerSec: Math.round(sessions / (elapsed / 1000)),
    recordsPerSec: Math.round(totalRecords / (elapsed / 1000)),
    avgLatency: (elapsed / sessions).toFixed(1),
    totalKB: Math.round(totalBytes / 1024),
    kbPerSec: (totalBytes / 1024 / (elapsed / 1000)).toFixed(0),
  };
}

console.log('═══ 로깅 Transport 벤치마크 (실제 시나리오) ═══');
console.log(`    세션당 ${SESSION_EVENTS.length}건 이벤트 × 100 세션 = 1,200건\n`);

const results = [];

// 1. JSON — 세션당 1번 전송 (12건 batch)
results.push(
  await runBench('JSON batch (12 rec/req)', async (id) => {
    const records = SESSION_EVENTS.map((ek, i) => makeRecord(`${id}-${i}`, ek));
    const body = JSON.stringify(makeEnvelope(id, records));
    await fetch(`${INGEST}/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return body.length;
  }),
);

// 2. JSON — 이벤트마다 개별 전송 (1건씩)
results.push(
  await runBench(
    'JSON single (1 rec/req)',
    async (id) => {
      let total = 0;
      for (let i = 0; i < SESSION_EVENTS.length; i++) {
        const body = JSON.stringify(
          makeEnvelope(`${id}-${i}`, [makeRecord(`${id}-${i}`, SESSION_EVENTS[i])]),
        );
        await fetch(`${INGEST}/v1/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        total += body.length;
      }
      return total;
    },
    30,
  ),
); // 개별 전송은 느리므로 30세션

// 3. QAPB Protobuf — batch
results.push(
  await runBench('QAPB batch (12 rec/req)', async (id) => {
    const records = SESSION_EVENTS.map((ek, i) => makeRecord(`${id}-${i}`, ek));
    const body = encodeQAPB(makeEnvelope(id, records));
    await fetch(`${INGEST}/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-protobuf' },
      body,
    });
    return body.length;
  }),
);

// 4. QAPB Protobuf — single
results.push(
  await runBench(
    'QAPB single (1 rec/req)',
    async (id) => {
      let total = 0;
      for (let i = 0; i < SESSION_EVENTS.length; i++) {
        const body = encodeQAPB(
          makeEnvelope(`${id}-${i}`, [makeRecord(`${id}-${i}`, SESSION_EVENTS[i])]),
        );
        await fetch(`${INGEST}/v1/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-protobuf' },
          body,
        });
        total += body.length;
      }
      return total;
    },
    30,
  ),
);

// 출력
console.log('  Transport                     sess/s   rec/s   ms/sess   KB/s   total KB\n');
for (const r of results) {
  console.log(
    `  ${r.name.padEnd(30)} ${String(r.sessionsPerSec).padStart(6)}   ${String(r.recordsPerSec).padStart(6)}   ${r.avgLatency.padStart(7)}   ${r.kbPerSec.padStart(5)}   ${String(r.totalKB).padStart(6)}`,
  );
}

// 추천
const best = results.reduce((a, b) => (a.recordsPerSec > b.recordsPerSec ? a : b));
console.log(`\n  ★ 최적: ${best.name} (${best.recordsPerSec.toLocaleString()} rec/s)\n`);

console.log('═══ 완료 ═══');
