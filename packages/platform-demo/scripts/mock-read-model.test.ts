import assert from 'node:assert/strict';
import {
  DEMO_ENVS,
  DEMO_EVT_SVC_VALUES,
  DEMO_EVENT_CAP,
  DEMO_INITIATORS,
  DEMO_NSS,
  DEMO_PERM_SVC_VALUES,
  DEMO_REGIONS,
  DEMO_SVC_SHAPE,
  DEMO_SVCS,
  demoEncodeSvc,
  demoEventsFor,
  demoRoleStride,
  demoRolesFor,
} from 'demo-snapshot';
import { EVENT_INITIATOR_CAP, eventStride } from '../src/event-address.js';
import { fetchMockEvtCells } from '../src/mock-event-api.js';
import { fetchMockFeatures, fetchMockGrantTable } from '../src/mock-casbin-api.js';
import { fetchMockPermCells } from '../src/mock-permission-api.js';
import { fetchMockScenario } from '../src/mock-scenario-api.js';
import { fetchMockServiceCells, fetchMockServiceDecode } from '../src/mock-service-api.js';

const versions = ['v1', 'v2', 'v3', 'v4'] as const;
const paymentShop = demoEncodeSvc([3, 1, 4, 1]);

for (const ver of versions) {
  const serviceCells = await fetchMockServiceCells({
    xDim: 'env',
    yDim: 'svc_name',
    fixed: { env: 1, region: 1, svc_name: 1, namespace: 1 },
  });
  assert.equal(serviceCells.cells.length, DEMO_ENVS.length * DEMO_SVCS.length);
  const service = await fetchMockServiceDecode(paymentShop);
  assert.deepEqual(
    {
      env: service.env,
      region: service.region,
      svc_name: service.svc_name,
      namespace: service.namespace,
    },
    { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'shop' },
  );

  const permission = await fetchMockPermCells(ver);
  assert.equal(permission.cells.length, DEMO_PERM_SVC_VALUES.length * demoRolesFor(ver).length);
  assert.equal(permission.roleStride, demoRoleStride(ver));
  assert.equal(permission.maxValue, DEMO_PERM_SVC_VALUES.length * demoRoleStride(ver) - 1);

  const event = await fetchMockEvtCells('web', ver);
  assert.equal(event.cells.length, DEMO_EVT_SVC_VALUES.length * demoEventsFor(ver).length);
  assert.equal(event.svcStride, eventStride(ver));
  assert.equal(event.maxValue, DEMO_EVT_SVC_VALUES.length * eventStride(ver) - 1);
  assert.equal(event.cells[0]?.value, 0);
  assert.equal(event.cells[1]?.value, EVENT_INITIATOR_CAP);
  assert.equal(event.initiator, DEMO_INITIATORS[0]);

  const features = await fetchMockFeatures(ver);
  const grants = await fetchMockGrantTable(ver);
  assert.equal(features.roles.length, demoRolesFor(ver).length);
  assert.equal(grants.rows.length, features.features.length * features.roles.length);

  for (const role of demoRolesFor(ver)) {
    const scenario = await fetchMockScenario(role, ver);
    assert.equal(scenario.role, role);
    assert.equal(scenario.features.length, features.features.length);
    assert.equal(scenario.request.addressContext.service, scenario.request.service.address);
    assert.equal(scenario.request.addressContext.permission, scenario.request.permission.address);
    assert.equal(scenario.request.addressContext.event, scenario.request.event?.address ?? null);
  }

  assert.equal(DEMO_SVC_SHAPE.length, 4);
  assert.equal(DEMO_REGIONS.length, 2);
  assert.equal(DEMO_NSS.length, 2);
  assert.equal(DEMO_EVENT_CAP[ver] * EVENT_INITIATOR_CAP, eventStride(ver));
}

console.log('platform-demo bundled read-model smoke passed');
