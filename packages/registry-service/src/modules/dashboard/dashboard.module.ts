// @def.boundary registry-system
// @def.doc registry-system

import { Global, Module } from '@nestjs/common';
import { createLogger } from '../../lib/logger.js';
import { DEV_DKG_PROVIDER } from '../catalog/catalog.change-notifier.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ResolveModule } from '../resolve/resolve.module.js';
import { ResolveService } from '../resolve/resolve.service.js';
import { ServiceModule } from '../services/service.module.js';
import { ServiceComponentService } from '../services/service-component.service.js';
import { buildDevDashboardProvider } from './dev-dashboard.provider.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DevDashboardGateway } from './dev-dashboard.gateway.js';
import { DiagramController } from './diagram.controller.js';
import { DiagramService } from './diagram.service.js';

const logger = createLogger('registry-service');

@Global()
@Module({
  imports: [CatalogModule, ServiceModule, ResolveModule],
  controllers: [DiagramController, DashboardController],
  providers: [
    {
      provide: DEV_DKG_PROVIDER,
      useFactory: async () => buildDevDashboardProvider({ logger }),
    },
    {
      provide: DashboardService,
      useFactory: (
        provider: unknown,
        catalogService: CatalogService,
        componentService: ServiceComponentService,
        resolveService: ResolveService,
      ) =>
        DashboardService.fromDeps({
          provider: provider as import('../../lib/dev-dkg-provider.js').DevDkgProvider | undefined,
          listCatalogs: async () =>
            (await catalogService.list()).map((catalog) => ({
              id: catalog.id,
              name: catalog.name,
            })),
          getAssemblyCandidates: (catalogId, serviceId) =>
            componentService.getAssemblyCandidates(catalogId, serviceId),
          getServiceWarnings: (serviceId, query) =>
            resolveService.getServiceReleaseWarnings(serviceId, query),
          getCleanupPlan: (serviceId, query) =>
            resolveService.getServiceCleanupPlan(serviceId, query),
        }),
      inject: [DEV_DKG_PROVIDER, CatalogService, ServiceComponentService, ResolveService],
    },
    {
      provide: DiagramService,
      useFactory: (provider: unknown) =>
        DiagramService.fromDeps({
          provider: provider as import('../../lib/dev-dkg-provider.js').DevDkgProvider | undefined,
        }),
      inject: [DEV_DKG_PROVIDER],
    },
    DevDashboardGateway,
  ],
  exports: [DEV_DKG_PROVIDER, DashboardService, DiagramService],
})
export class DashboardModule {}
