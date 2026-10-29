import assert from 'node:assert/strict';
import { parseEnv } from '../config/env.ts';
import { GATEWAY_SERVICES } from '../lib/route-table.ts';

const defaults = parseEnv({});
assert.equal(defaults.AUTH_MODE, 'bypass');
assert.equal(defaults.PORT, 8787);
assert.equal(defaults.GATEWAY_ENV, 'dev');
assert.equal(defaults.REGISTRY_URL, GATEWAY_SERVICES.registry.defaultUrl);
assert.equal(defaults.JWKS_URL, undefined);

const configured = parseEnv({
  AUTH_MODE: 'jwt',
  PORT: '9000',
  GATEWAY_ENV: 'prod',
  GATE_URL: 'http://gate.internal:3400',
  JWKS_URL: '   ',
});
assert.equal(configured.AUTH_MODE, 'jwt');
assert.equal(configured.PORT, 9000);
assert.equal(configured.GATEWAY_ENV, 'prod');
assert.equal((configured as Record<string, unknown>)['GATE_URL'], 'http://gate.internal:3400');
assert.equal(configured.JWKS_URL, undefined, '빈 문자열은 미설정');

// 서비스 URL 키는 route-table 정본에서 파생된다
for (const target of Object.values(GATEWAY_SERVICES)) {
  assert.throws(() => parseEnv({ [target.urlEnv]: 'not-a-url' }), `${target.urlEnv} 형식 검증`);
}
// 오타·미지원 인증 모드는 부팅 시 거부 (조용히 bypass로 동작하지 않는다)
assert.throws(() => parseEnv({ AUTH_MODE: 'apikey' }));
assert.throws(() => parseEnv({ GATEWAY_ENV: 'production' }));

console.log('gateway env: 통과');
