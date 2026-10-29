import assert from 'node:assert/strict';
import {
  GATEWAY_ROUTES,
  GATEWAY_SERVICES,
  matchRoute,
  matchesPrefix,
  targetPath,
} from '../lib/route-table.ts';

/** 게이트웨이 경로 → [서비스, 서비스가 실제로 받는 경로]. 서비스 쪽 라우트 정의와 같아야 한다 */
const CASES: Array<[string, string, string]> = [
  // gate-service routes/gate.ts — `/gate/check`
  ['/gate/check', 'gate', '/gate/check'],
  ['/gate/state/order/v1', 'gate', '/gate/state/order/v1'],
  // decode-service routes/decode.ts — `/decode`, `/decode/batch`
  ['/decode', 'decode', '/decode'],
  ['/decode/batch', 'decode', '/decode/batch'],
  // query-service — 루트 라우트(`/resolve`)는 /query 별칭, `/state`는 그대로
  ['/query/resolve', 'query', '/resolve'],
  ['/state', 'query', '/state'],
  ['/state/ctx/res/history', 'query', '/state/ctx/res/history'],
  // registry-service — `@Get('metrics')`, `catalogs/:id/snapshots/latest`, `health/generation`
  ['/metrics', 'registry', '/metrics'],
  ['/catalogs/demo/snapshots/latest', 'registry', '/catalogs/demo/snapshots/latest'],
  ['/health/generation', 'registry', '/health/generation'],
  ['/api/services/gateway', 'registry', '/api/services/gateway'],
  // ingest-server — 공개 API는 모두 /v1
  ['/v1/ingest', 'ingest', '/v1/ingest'],
  ['/v1/insights/summary', 'ingest', '/v1/insights/summary'],
  ['/v1/labels', 'ingest', '/v1/labels'],
  ['/v1/key-observations/summary', 'ingest', '/v1/key-observations/summary'],
  // definition-service — 컨트롤러 경로 + 별칭
  ['/docs/abc', 'definition', '/docs/abc'],
  ['/definitions/docs/abc', 'definition', '/docs/abc'],
  ['/def/sync', 'definition', '/sync'],
  // decision-service — 별칭
  ['/decisions/instances', 'decision', '/instances'],
];

for (const [path, service, expected] of CASES) {
  const route = matchRoute(GATEWAY_ROUTES, path);
  assert.ok(route, `${path}: 라우트 없음`);
  assert.equal(route.service, service, `${path}: 서비스`);
  assert.equal(targetPath(route, path), expected, `${path}: 전달 경로`);
}

// 세그먼트 경계 — `/decode`가 `/decode-map`을, `/def`가 `/definitions`를 가로채지 않는다
assert.equal(matchesPrefix('/decode-map/order/v1', '/decode'), false);
assert.equal(matchRoute(GATEWAY_ROUTES, '/decode-map/order/v1'), undefined);
assert.equal(matchRoute(GATEWAY_ROUTES, '/definitions/docs')?.prefix, '/definitions');
assert.equal(matchRoute(GATEWAY_ROUTES, '/unknown'), undefined);

// registry 동적 라우트(끝에 `/`가 붙은 접두사)도 같은 규칙
const dynamic = [{ prefix: '/gate/', strip: false }];
const dynamicRoute = matchRoute(dynamic, '/gate/check');
assert.ok(dynamicRoute);
assert.equal(targetPath(dynamicRoute, '/gate/check'), '/gate/check');
assert.equal(targetPath({ prefix: '/query/', strip: true }, '/query/resolve'), '/resolve');

// 모든 라우트의 서비스가 대상 정의를 가진다
for (const route of GATEWAY_ROUTES) {
  assert.ok(GATEWAY_SERVICES[route.service], `${route.prefix}: 서비스 대상 없음`);
}

console.log(`route-table: ${CASES.length} case 통과`);
