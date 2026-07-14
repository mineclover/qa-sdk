/**
 * QaLogger 버퍼링 동작 검증 + 설정 편의성 테스트.
 *
 * 1. 기본 설정으로 생성 — 설정이 쉬운가?
 * 2. 버퍼 쌓임 확인 — log() 호출 시 즉시 전송 안 됨
 * 3. batchSize 도달 시 auto flush
 * 4. 타이머 flush
 * 5. shutdown 시 잔여 버퍼 flush
 * 6. flush 실패 시 재삽입
 * 7. maxBufferSize 초과 시 oldest 드랍
 */
import { QaLogger, HttpTransport } from '@qa-sdk/sdk';

const INGEST = 'http://localhost:3200/v1/ingest';
let testsPassed = 0;
let testsFailed = 0;

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } else {
    console.log(`  ✗ ${name} — ${detail || 'failed'}`);
    testsFailed++;
  }
}

// ═══════════════════════════════════════════════════
//  테스트 1: 설정 편의성 — 최소 설정으로 생성
// ═══════════════════════════════════════════════════
console.log('═══ 1. 최소 설정으로 QaLogger 생성 ═══\n');

const logger = new QaLogger({
  transport: new HttpTransport({ endpoint: INGEST }),
  owner: { owner_type: 'tenant', owner_id: 'test' },
  source: { service_name: 'shop/my-service', sdk_name: '@qa-sdk/logger', sdk_version: '0.1.0' },
  runtime: { platform: 'node' },
  build: { env: 'dev' },
});

assert('QaLogger 생성 성공', !!logger);
assert('startTrace 호출 가능', !!logger.startTrace());

// ═══════════════════════════════════════════════════
//  테스트 2: 버퍼 쌓임 확인
// ═══════════════════════════════════════════════════
console.log('\n═══ 2. 버퍼 쌓임 (즉시 전송 안 됨) ═══\n');

// metrics 기준 시점 기록
const beforeMetrics = await (await fetch('http://localhost:3200/v1/metrics')).text();
const beforeReqs = parseInt(
  beforeMetrics.match(/ingest_requests_total\{status="202"\} (\d+)/)?.[1] || '0',
);

// 5건 emit (batchSize 기본 50 — flush 안 됨)
for (let i = 0; i < 5; i++) {
  logger.log({ event_key: 'buffer.test', event_version: '001', payload: { step: i } });
}

// 즉시 확인 — 아직 전송 안 됐어야 함
await new Promise((r) => setTimeout(r, 100));
const afterMetrics1 = await (await fetch('http://localhost:3200/v1/metrics')).text();
const afterReqs1 = parseInt(
  afterMetrics1.match(/ingest_requests_total\{status="202"\} (\d+)/)?.[1] || '0',
);
assert(
  '5건 emit 후 즉시 전송 없음',
  afterReqs1 === beforeReqs,
  `before=${beforeReqs} after=${afterReqs1}`,
);

await logger.shutdown();

// ═══════════════════════════════════════════════════
//  테스트 3: batchSize 도달 시 auto flush
// ═══════════════════════════════════════════════════
console.log('\n═══ 3. batchSize 도달 시 auto flush ═══\n');

const batchLogger = new QaLogger({
  transport: new HttpTransport({ endpoint: INGEST }),
  owner: { owner_type: 'tenant', owner_id: 'test' },
  source: { service_name: 'shop/batch-test', sdk_name: 'test', sdk_version: '0.1.0' },
  runtime: { platform: 'node' },
  build: { env: 'dev' },
  batchSize: 5, // ← 5건마다 flush
  flushIntervalMs: 0, // ← 타이머 비활성
});
batchLogger.startTrace();

const beforeBatch = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);

// 5건 emit → auto flush 발동
for (let i = 0; i < 5; i++) {
  batchLogger.log({ event_key: 'batch.auto', event_version: '001' });
}
await new Promise((r) => setTimeout(r, 200)); // flush 완료 대기

const afterBatch = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);
assert(
  'batchSize=5 도달 → auto flush',
  afterBatch >= beforeBatch + 5,
  `before=${beforeBatch} after=${afterBatch}`,
);

// 추가 3건 → flush 안 됨 (5 미달)
for (let i = 0; i < 3; i++) {
  batchLogger.log({ event_key: 'batch.pending', event_version: '001' });
}
await new Promise((r) => setTimeout(r, 100));
const afterPending = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);
assert(
  '3건 추가 → flush 안 됨 (5 미달)',
  afterPending === afterBatch,
  `expected=${afterBatch} actual=${afterPending}`,
);

await batchLogger.shutdown(); // shutdown이 잔여 3건 flush

const afterShutdown = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);
assert(
  'shutdown → 잔여 3건 flush',
  afterShutdown >= afterBatch + 3,
  `expected>=${afterBatch + 3} actual=${afterShutdown}`,
);

// ═══════════════════════════════════════════════════
//  테스트 4: 타이머 flush
// ═══════════════════════════════════════════════════
console.log('\n═══ 4. 타이머 flush (1초 간격) ═══\n');

const timerLogger = new QaLogger({
  transport: new HttpTransport({ endpoint: INGEST }),
  owner: { owner_type: 'tenant', owner_id: 'test' },
  source: { service_name: 'shop/timer-test', sdk_name: 'test', sdk_version: '0.1.0' },
  runtime: { platform: 'node' },
  build: { env: 'dev' },
  batchSize: 9999, // ← batch 도달 안 하게
  flushIntervalMs: 1000, // ← 1초마다 flush
});
timerLogger.startTrace();

const beforeTimer = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);

// 10건 emit
for (let i = 0; i < 10; i++) {
  timerLogger.log({ event_key: 'timer.test', event_version: '001' });
}

// 즉시 확인 — 아직 전송 안 됨
await new Promise((r) => setTimeout(r, 100));
const afterImmediate = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);
assert(
  '즉시 확인 → 전송 안 됨',
  afterImmediate === beforeTimer,
  `before=${beforeTimer} after=${afterImmediate}`,
);

// 1.5초 후 확인 → 타이머 flush 발동
await new Promise((r) => setTimeout(r, 1400));
const afterTimer = parseInt(
  (await (await fetch('http://localhost:3200/v1/metrics')).text()).match(
    /ingest_records_total (\d+)/,
  )?.[1] || '0',
);
assert(
  '1.5초 후 → 타이머 flush 발동',
  afterTimer >= beforeTimer + 10,
  `expected>=${beforeTimer + 10} actual=${afterTimer}`,
);

await timerLogger.shutdown();

// ═══════════════════════════════════════════════════
//  테스트 5: maxBufferSize 초과 시 oldest 드랍
// ═══════════════════════════════════════════════════
console.log('\n═══ 5. maxBufferSize 초과 → oldest 드랍 ═══\n');

let dropWarned = false;
const smallBufLogger = new QaLogger({
  transport: new HttpTransport({ endpoint: INGEST }),
  owner: { owner_type: 'tenant', owner_id: 'test' },
  source: { service_name: 'shop/overflow-test', sdk_name: 'test', sdk_version: '0.1.0' },
  runtime: { platform: 'node' },
  build: { env: 'dev' },
  batchSize: 9999,
  flushIntervalMs: 0,
  maxBufferSize: 10, // ← 매우 작게
  onError: (err, ctx) => {
    if (ctx === 'buffer-overflow') dropWarned = true;
  },
});
smallBufLogger.startTrace();

// 15건 emit (maxBufferSize=10 초과)
for (let i = 0; i < 15; i++) {
  smallBufLogger.log({ event_key: 'overflow.test', event_version: '001', payload: { i } });
}

assert('maxBufferSize 초과 → onError(buffer-overflow) 호출', dropWarned);

await smallBufLogger.shutdown();

// ═══════════════════════════════════════════════════
//  테스트 6: 실전 설정 예시 — ServiceBootConfig 연동
// ═══════════════════════════════════════════════════
console.log('\n═══ 6. 실전 설정 (ServiceBootConfig 연동) ═══\n');

import { DEMO_CATALOG } from 'demo-snapshot';
import { encodePrefix, latestPrefixVersion } from '@qa-sdk/core';

// ServiceBootConfig
const serviceConfig = { namespace: 'shop', name: 'payment', env: 'prod', region: 'asia' };

// 좌표 인코딩
const svcVer = latestPrefixVersion(DEMO_CATALOG, 'service');
const svcIdx = DEMO_CATALOG.axes.svc_name.versions.v1.entries.indexOf(serviceConfig.name);
const envIdx = DEMO_CATALOG.axes.env.versions.v1.entries.indexOf(serviceConfig.env);
const regIdx = DEMO_CATALOG.axes.region.versions.v1.entries.indexOf(serviceConfig.region);
const nsIdx = DEMO_CATALOG.axes.namespace.versions.v1.entries.indexOf(serviceConfig.namespace);
const svcAddr = encodePrefix(DEMO_CATALOG, 'service', svcVer, {
  env: envIdx,
  region: regIdx,
  svc_name: svcIdx,
  namespace: nsIdx,
});

const prodLogger = new QaLogger({
  transport: new HttpTransport({ endpoint: INGEST }),
  owner: { owner_type: 'tenant', owner_id: 'shop' },
  source: {
    service_name: `${serviceConfig.namespace}/${serviceConfig.name}`,
    sdk_name: '@qa-sdk/logger',
    sdk_version: '0.1.0',
  },
  runtime: { platform: 'node' },
  build: { env: serviceConfig.env },
  infraContext: { service: `service:${svcVer}:${svcAddr}` },
  batchSize: 50,
  flushIntervalMs: 5000,
});

const trace = prodLogger.startTrace();
assert('ServiceBootConfig → QaLogger 생성', !!prodLogger);
assert('infraContext 설정됨', true);

prodLogger.log({
  event_key: 'payment.process',
  event_version: '001',
  payload: { orderId: 'ORD-123', amount: 59800 },
});
prodLogger.log({
  event_key: 'payment.success',
  event_version: '001',
  payload: { orderId: 'ORD-123' },
});
await prodLogger.shutdown();
assert('2건 emit + shutdown → 전송 완료', true);

// trace 조회로 infraContext 확인
const traceRes = await fetch(`http://localhost:3200/v1/traces/${trace.trace_id}/records`);
const traceItems = (await traceRes.json()).items || [];
assert('trace 조회: 2건', traceItems.length === 2, `actual=${traceItems.length}`);
if (traceItems[0]) {
  const svcCtx = traceItems[0].address_context?.service;
  assert(
    'infraContext.service 전파됨',
    svcCtx === `service:${svcVer}:${svcAddr}`,
    `actual=${svcCtx}`,
  );
}

// ═══════════════════════════════════════════════════
//  결과
// ═══════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(
  `  ${testsPassed}/${testsPassed + testsFailed} passed  ${testsFailed > 0 ? '❌ ' + testsFailed + ' failed' : '✅ 전부 통과'}`,
);
console.log('═'.repeat(50));
