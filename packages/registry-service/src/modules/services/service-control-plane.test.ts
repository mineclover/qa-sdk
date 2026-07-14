// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from 'vitest';
import type { ServiceRecord } from './service.types.js';
import {
  createComponentVersionRef,
  createDeploymentAddress,
  createDeploymentBinding,
  createManifestAssemblyRequest,
  createRuntimeServiceAddress,
  createServiceAddressAggregate,
  splitServiceRecord,
  toServiceExposureSpec,
} from './service-control-plane.js';

const sampleRecord: ServiceRecord = {
  serviceId: 'gateway',
  name: 'Gateway',
  tier: 'system',
  team: 'platform',
  gatewayPath: '/api/',
  stripPrefix: true,
  ownedPrefixes: ['endpoint'],
  consumedPrefixes: ['service', 'rbac'],
  applicationId: 'platform',
  attributes: {
    criticality: 'high',
    concerns: ['security', 'observability'],
  },
  url: 'http://localhost:8787',
};

describe('service control plane helpers', () => {
  it('ServiceRecord를 child component로 분해한다', () => {
    const result = splitServiceRecord(sampleRecord, { namespace: 'shop' });

    expect(result.unit).toEqual({
      serviceId: 'gateway',
      namespace: 'shop',
      name: 'Gateway',
      tier: 'system',
      team: 'platform',
      applicationId: 'platform',
      attributes: {
        criticality: 'high',
        concerns: ['security', 'observability'],
      },
    });
    expect(result.ownership).toEqual({
      serviceId: 'gateway',
      ownedPrefixes: ['endpoint'],
      consumedPrefixes: ['service', 'rbac'],
    });
    expect(result.exposure).toEqual({
      serviceId: 'gateway',
      gatewayPath: '/api/',
      stripPrefix: true,
    });
  });

  it('노출 정책이 없으면 exposure를 만들지 않는다', () => {
    expect(
      toServiceExposureSpec({
        serviceId: 'decode-service',
        name: 'Decode',
        ownedPrefixes: [],
      }),
    ).toBeUndefined();
  });

  it('runtime/deployment projection을 만든다', () => {
    const split = splitServiceRecord(sampleRecord, { namespace: 'shop' });
    const runtime = createRuntimeServiceAddress(split.unit, {
      env: 'prod',
      region: 'asia',
    });
    const address = createDeploymentAddress(split.unit, {
      provider: 'pulumi',
      project: 'core',
      stack: 'prod',
      resourceKey: 'api',
      env: 'prod',
      region: 'asia',
    });
    const binding = createDeploymentBinding(address, {
      deploymentVersion: 'dep-v1',
      observedAt: '2026-04-04T00:00:00.000Z',
      urn: 'urn:pulumi:prod::core::api',
      url: 'https://api.qa-sdk.io',
      outputs: { healthUrl: 'https://api.qa-sdk.io/health' },
    });

    expect(runtime).toEqual({
      serviceId: 'gateway',
      namespace: 'shop',
      name: 'Gateway',
      env: 'prod',
      region: 'asia',
    });
    expect(address.runtime).toEqual(runtime);
    expect(binding).toEqual({
      deploymentVersion: 'dep-v1',
      address,
      observedAt: '2026-04-04T00:00:00.000Z',
      urn: 'urn:pulumi:prod::core::api',
      url: 'https://api.qa-sdk.io',
      outputs: { healthUrl: 'https://api.qa-sdk.io/health' },
    });
  });

  it('component version ref와 assembly request를 복제 가능한 값으로 만든다', () => {
    const ref = createComponentVersionRef('service-unit', 'gateway', 'su-v1');
    const prefixes = { endpoint: 'v2' };
    const request = createManifestAssemblyRequest({
      serviceId: 'gateway',
      runtimeAddressVersion: 'ra-v1',
      serviceUnitVersion: 'su-v1',
      ownershipVersion: 'own-v1',
      exposureVersion: 'exp-v1',
      deploymentVersion: 'dep-v1',
      manifestVersion: 'm-v1',
      prefixes,
      changelog: 'initial release',
    });

    expect(ref).toEqual({
      kind: 'service-unit',
      serviceId: 'gateway',
      version: 'su-v1',
    });
    expect(request).toEqual({
      serviceId: 'gateway',
      runtimeAddressVersion: 'ra-v1',
      serviceUnitVersion: 'su-v1',
      ownershipVersion: 'own-v1',
      exposureVersion: 'exp-v1',
      deploymentVersion: 'dep-v1',
      manifestVersion: 'm-v1',
      prefixes: { endpoint: 'v2' },
      changelog: 'initial release',
    });
    expect(request.prefixes).not.toBe(prefixes);
  });

  it('aggregate를 child component와 배포 projection으로 조립한다', () => {
    const aggregate = createServiceAddressAggregate({
      record: sampleRecord,
      namespace: 'shop',
      runtimeTargets: [{ env: 'prod', region: 'asia' }],
      deployments: [
        {
          target: {
            provider: 'pulumi',
            project: 'core',
            stack: 'prod',
            resourceKey: 'api',
            env: 'prod',
            region: 'asia',
          },
          binding: {
            deploymentVersion: 'dep-v1',
            observedAt: '2026-04-04T00:00:00.000Z',
            url: 'https://api.qa-sdk.io',
          },
        },
      ],
      releases: [{ serviceId: 'gateway', manifestVersion: 'm-v1' }],
    });

    expect(aggregate.unit.namespace).toBe('shop');
    expect(aggregate.runtimeAddresses).toHaveLength(1);
    expect(aggregate.deployments[0]?.address.provider).toBe('pulumi');
    expect(aggregate.releases).toEqual([{ serviceId: 'gateway', manifestVersion: 'm-v1' }]);
  });
});
