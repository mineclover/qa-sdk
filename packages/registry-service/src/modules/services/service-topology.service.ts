// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppError } from '@qa-sdk/core';
import { DefinitionClient } from '@qa-sdk/definition-client';
import { runDefinitionClientCall } from '../../lib/definition-client-fail-open.js';
import { createLogger } from '../../lib/logger.js';
import type { ConfigStore } from '../../stores/config-store.js';
import type { ServiceEndpointStore } from '../../stores/service-endpoint-store.js';
import type { ServiceRecord } from './service.types.js';

export const SERVICE_CONFIG_STORE = 'SERVICE_CONFIG_STORE';
export const SERVICE_ENDPOINT_STORE = 'SERVICE_ENDPOINT_STORE';

const CONFIG_TYPE = 'services';
const TOPOLOGY_DOC_ID = 'registry-services-api-spec';
const logger = createLogger('registry-service');

type ServiceListPayload = {
  services?: unknown;
};

@Injectable()
export class ServiceTopologyService {
  constructor(
    @Inject(SERVICE_CONFIG_STORE) private readonly configStore: ConfigStore,
    @Optional()
    @Inject(SERVICE_ENDPOINT_STORE)
    private readonly endpointStore?: ServiceEndpointStore,
    @Optional() @Inject(DefinitionClient) private readonly definitionClient?: DefinitionClient,
  ) {}

  static fromStores(deps: {
    configStore: ConfigStore;
    endpointStore?: ServiceEndpointStore;
    definitionClient?: DefinitionClient;
  }) {
    return new ServiceTopologyService(deps.configStore, deps.endpointStore, deps.definitionClient);
  }

  async list(catalogId: string) {
    const record = await this.configStore.get(catalogId, CONFIG_TYPE);
    if (!record) {
      return [];
    }

    return this.parseServices(record.data) ?? [];
  }

  async get(catalogId: string, serviceId: string) {
    const services = await this.requireServices(catalogId);
    const found = services.find((service) => service.serviceId === serviceId);
    if (!found) {
      throw new AppError('NOT_FOUND', `Service '${serviceId}' not found`, 404);
    }

    return found;
  }

  async replaceAll(catalogId: string, input: unknown) {
    const body = this.asListPayload(input);
    if (!Array.isArray(body.services)) {
      throw new AppError('INVALID_INPUT', 'services 배열 필수', 400);
    }

    await this.configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(body.services));
    await this.logAffectedTests('replaceAll', catalogId, { count: body.services.length });
    return {
      ok: true,
      count: body.services.length,
    };
  }

  async upsert(catalogId: string, input: unknown) {
    const body = this.asRecord(input) as Partial<ServiceRecord>;
    if (!body.serviceId || !body.name) {
      throw new AppError('INVALID_INPUT', 'serviceId, name 필수', 400);
    }

    const services = await this.list(catalogId);
    const next = [...services];
    const index = next.findIndex((service) => service.serviceId === body.serviceId);
    const record = body as ServiceRecord;
    if (index >= 0) {
      next[index] = record;
    } else {
      next.push(record);
    }

    await this.configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(next));
    await this.logAffectedTests('upsert', catalogId, { serviceId: body.serviceId });
    return {
      ok: true,
      serviceId: body.serviceId,
      action: index >= 0 ? 'updated' : 'created',
    };
  }

  async remove(catalogId: string, serviceId: string) {
    const services = await this.requireServices(catalogId);
    const filtered = services.filter((service) => service.serviceId !== serviceId);
    if (filtered.length === services.length) {
      throw new AppError('NOT_FOUND', `Service '${serviceId}' not found`, 404);
    }

    await this.configStore.set(catalogId, CONFIG_TYPE, JSON.stringify(filtered));
    await this.logAffectedTests('remove', catalogId, { serviceId });
    return {
      ok: true,
      serviceId,
    };
  }

  async listSvcOwners(catalogId: string) {
    const services = await this.list(catalogId);
    const owners: Record<string, string> = {};
    for (const service of services) {
      for (const prefixId of service.ownedPrefixes) {
        owners[prefixId] = service.serviceId;
      }
    }

    return owners;
  }

  async listUrls(
    catalogId: string,
    query: {
      envName: string;
      namespace: string;
      region: string;
    },
  ) {
    const urls: Record<string, string> = {};

    if (this.endpointStore) {
      const endpoints = await this.endpointStore.list(catalogId);
      for (const endpoint of endpoints) {
        if (
          endpoint.env === query.envName &&
          endpoint.namespace === query.namespace &&
          endpoint.region === query.region
        ) {
          urls[endpoint.svcName] = endpoint.url;
        }
      }
    }

    const services = await this.list(catalogId);
    for (const service of services) {
      if (urls[service.serviceId]) {
        continue;
      }

      const envUrl = service.urls ? service.urls[query.envName] : undefined;
      const url = envUrl ?? service.url;
      if (url) {
        urls[service.serviceId] = url;
      }
    }

    return urls;
  }

  async getGateway(
    catalogId: string,
    query: {
      envName: string;
      namespace: string;
      region: string;
    },
  ) {
    const endpointUrls: Record<string, string> = {};
    if (this.endpointStore) {
      const endpoints = await this.endpointStore.list(catalogId);
      for (const endpoint of endpoints) {
        if (
          endpoint.env === query.envName &&
          endpoint.namespace === query.namespace &&
          endpoint.region === query.region
        ) {
          endpointUrls[endpoint.svcName] = endpoint.url;
        }
      }
    }

    const services = await this.list(catalogId);
    return {
      routes: services
        .filter(
          (service): service is typeof service & { gatewayPath: string } => !!service.gatewayPath,
        )
        .map((service) => ({
          path: service.gatewayPath,
          serviceId: service.serviceId,
          url:
            endpointUrls[service.serviceId] ?? service.urls?.[query.envName] ?? service.url ?? '',
          tier: service.tier ?? 'backend',
          strip: service.stripPrefix ?? false,
        })),
      env: query.envName,
    };
  }

  private async requireServices(catalogId: string) {
    const record = await this.configStore.get(catalogId, CONFIG_TYPE);
    if (!record) {
      throw new AppError('NOT_FOUND', 'Services not found', 404);
    }

    return this.parseServices(record.data) ?? [];
  }

  private parseServices(data: string): ServiceRecord[] | null {
    try {
      return JSON.parse(data) as ServiceRecord[];
    } catch {
      return null;
    }
  }

  private asListPayload(input: unknown): ServiceListPayload {
    return this.asRecord(input) as ServiceListPayload;
  }

  private asRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object') {
      return {};
    }

    return input as Record<string, unknown>;
  }

  private async logAffectedTests(
    action: 'replaceAll' | 'upsert' | 'remove',
    catalogId: string,
    detail: Record<string, unknown>,
  ) {
    const result = await runDefinitionClientCall(`getAffectedTests(${TOPOLOGY_DOC_ID})`, async () =>
      this.definitionClient?.getAffectedTests(TOPOLOGY_DOC_ID),
    );

    logger.info(
      {
        catalogId,
        action,
        docId: TOPOLOGY_DOC_ID,
        affectedTests: result?.totalTests ?? 0,
        ...detail,
      },
      'service topology changed',
    );
  }
}
