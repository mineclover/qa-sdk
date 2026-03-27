import { Module } from "@nestjs/common";
import type { SqlDriver } from "index-meta";
import { DATABASE } from "../../database.module.js";
import { SqlConfigStore } from "../../stores/sql-config-store.js";
import { SqlServiceEndpointStore } from "../../stores/sql-service-endpoint-store.js";
import { ApplicationController } from "./application.controller.js";
import { ApplicationService } from "./application.service.js";
import { EndpointController } from "./endpoint.controller.js";
import { EndpointService } from "./endpoint.service.js";
import { ServiceController } from "./service.controller.js";
import { ServiceHealthController } from "./service-health.controller.js";
import { SERVICE_HEALTH_BINDINGS, ServiceHealthService } from "./service-health.service.js";
import {
  SERVICE_CONFIG_STORE,
  SERVICE_ENDPOINT_STORE,
  ServiceTopologyService,
} from "./service-topology.service.js";

@Module({
  controllers: [
    ServiceController,
    EndpointController,
    ApplicationController,
    ServiceHealthController,
  ],
  providers: [
    {
      provide: SERVICE_CONFIG_STORE,
      useFactory: (db: SqlDriver) => new SqlConfigStore(db),
      inject: [DATABASE],
    },
    {
      provide: SERVICE_ENDPOINT_STORE,
      useFactory: (db: SqlDriver) => new SqlServiceEndpointStore(db),
      inject: [DATABASE],
    },
    {
      provide: SERVICE_HEALTH_BINDINGS,
      useValue: undefined,
    },
    ServiceTopologyService,
    EndpointService,
    ApplicationService,
    ServiceHealthService,
  ],
  exports: [
    ServiceTopologyService,
    EndpointService,
    ApplicationService,
    ServiceHealthService,
    SERVICE_CONFIG_STORE,
    SERVICE_ENDPOINT_STORE,
    SERVICE_HEALTH_BINDINGS,
  ],
})
export class ServiceModule {}
