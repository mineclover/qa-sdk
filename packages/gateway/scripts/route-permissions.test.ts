import assert from 'node:assert/strict';
import { checkPermission, getRoutePermission } from '../lib/route-permissions.ts';

function encodeBits(...indices: number[]): string {
  const max = Math.max(...indices, 0);
  const bytes = Buffer.alloc(Math.floor(max / 8) + 1);
  for (const index of indices) {
    bytes[Math.floor(index / 8)] |= 1 << (index % 8);
  }
  return bytes.toString('base64');
}

assert.equal(getRoutePermission('/health'), null);
assert.equal(getRoutePermission('/debug/healthz'), null);
assert.equal(getRoutePermission('/unknown'), null);

assert.deepEqual(getRoutePermission('/v1/ingest/events'), {
  domain: 'infra',
  feature: 'ingest_write',
});
assert.deepEqual(getRoutePermission('/v1/admin/replay'), {
  domain: 'infra',
  feature: 'ingest_admin',
});
assert.deepEqual(getRoutePermission('/v1/sessions/session-1'), {
  domain: 'infra',
  feature: 'ingest_read',
});
assert.deepEqual(getRoutePermission('/api/services'), {
  domain: 'infra',
  feature: 'registry_read',
});
assert.deepEqual(getRoutePermission('/metrics'), {
  domain: 'infra',
  feature: 'monitoring_read',
});
assert.deepEqual(getRoutePermission('/decode/address'), {
  domain: 'infra',
  feature: 'decode_read',
});

assert.equal(checkPermission({ infra: encodeBits(1) }, 'infra', 'ingest_write'), true);
assert.equal(checkPermission({ infra: encodeBits(1) }, 'infra', 'ingest_admin'), true);
assert.equal(checkPermission({ infra: encodeBits(1) }, 'infra', 'registry_read'), false);
assert.equal(checkPermission({ infra: encodeBits(0) }, 'infra', 'future_feature'), true);
assert.equal(checkPermission({}, 'infra', 'ingest_read'), false);
assert.equal(checkPermission({ infra: encodeBits(0) }, 'infra', 'monitoring_read'), false);

console.log('gateway route permissions smoke passed');
