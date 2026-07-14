// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 + §7 — SimServiceCatalogPort + PortRegistryPort + target service
// 3종 token 의 단일 진입 모듈. ActionModule + AlertsAuditCatalogController 가 import.

import { Module } from '@nestjs/common';
import { simServiceCatalogProviders } from './catalog.provider.js';
import { portRegistryProvider } from './port-registry.provider.js';
import {
  SIM_SERVICE_CATALOG_TOKEN,
  PORT_REGISTRY_TOKEN,
  SIM_TARGET_SERVICE_TOKEN,
} from './tokens.js';
import { SIM_SERVICE_CATALOG_TOKEN as ALERTS_TOKEN } from '../decision/alerts-audit-catalog.controller.js';
import { env } from '../config/env.js';

@Module({
  providers: [
    ...simServiceCatalogProviders,
    portRegistryProvider,
    {
      provide: SIM_TARGET_SERVICE_TOKEN,
      useValue: env.SIM_CONTROLLER_TARGET_SERVICE,
    },
  ],
  exports: [SIM_SERVICE_CATALOG_TOKEN, ALERTS_TOKEN, PORT_REGISTRY_TOKEN, SIM_TARGET_SERVICE_TOKEN],
})
export class CatalogModule {}
