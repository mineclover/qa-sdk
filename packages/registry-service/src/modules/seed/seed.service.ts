// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DefinitionClient } from '@qa-sdk/definition-client';
import { env } from '../../config/env.js';
import {
  seedDemoCatalog,
  seedDefinitionCatalog,
  seedConfigs,
  seedEndpoints,
  seedEventSchemas,
} from '../../core/index.js';
import { runDefinitionClientCall } from '../../lib/definition-client-fail-open.js';
import { createLogger } from '../../lib/logger.js';
import type { AxisProfileStore } from '../../stores/axis-profile-store.js';
import type { CatalogStore } from '../../stores/catalog-store.js';
import type { ConfigStore } from '../../stores/config-store.js';
import type { EventSchemaStore } from '../../stores/event-schema-store.js';
import type { ServiceEndpointStore } from '../../stores/service-endpoint-store.js';
import { AXIS_STORE } from '../axes/axis.service.js';
import { CATALOG_STORE, CONFIG_STORE } from '../catalog/catalog.service.js';
import { EVENT_SCHEMA_STORE } from '../events/event-schema.service.js';
import { SERVICE_ENDPOINT_STORE } from '../services/service-topology.service.js';

const logger = createLogger('registry-service');

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @Inject(CATALOG_STORE) private readonly catalogStore: CatalogStore,
    @Inject(CONFIG_STORE) private readonly configStore: ConfigStore,
    @Inject(SERVICE_ENDPOINT_STORE) private readonly endpointStore: ServiceEndpointStore,
    @Inject(EVENT_SCHEMA_STORE) private readonly eventSchemaStore: EventSchemaStore,
    @Inject(AXIS_STORE) private readonly axisStore: AxisProfileStore,
    @Inject(DefinitionClient) private readonly definitionClient: DefinitionClient,
  ) {}

  async onModuleInit() {
    await seedDemoCatalog(this.catalogStore, this.axisStore, logger);
    await seedDefinitionCatalog(this.catalogStore, this.axisStore, logger);
    await seedConfigs(this.configStore, logger);
    await seedEndpoints(this.endpointStore, logger);
    await seedEventSchemas(this.eventSchemaStore, this.configStore, logger);

    const [catalogs, axes, configs, endpoints, eventSchemas] = await Promise.all([
      this.catalogStore.list(),
      this.axisStore.list('demo'),
      this.configStore.list('demo'),
      this.endpointStore.list('demo'),
      this.eventSchemaStore.list('demo'),
    ]);

    logger.info(
      {
        catalogs: catalogs.length,
        axes: axes.length,
        configs: configs.length,
        endpoints: endpoints.length,
        eventSchemas: eventSchemas.length,
      },
      'registry seed complete',
    );

    if (!env.DEFINITION_SYNC_ON_SEED) {
      logger.info('definition-service sync skipped — owned by definition-service startup');
      return;
    }

    const syncResult = await runDefinitionClientCall(
      'triggerSync()',
      async () => this.definitionClient.triggerSync(),
      { timeoutMs: 5_000 },
    );

    if (syncResult) {
      logger.info(
        {
          synced: syncResult.synced,
          created: syncResult.created,
          unchanged: syncResult.unchanged,
          errors: syncResult.errors.length,
        },
        'definition-service sync triggered after registry seed',
      );
    }
  }
}
