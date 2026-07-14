// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import { Module, type DynamicModule, type FactoryProvider, type Provider } from '@nestjs/common';
import { SLICE_LOGGER_PORT, type LoggerPort } from '@qa-sdk/sim-domain-slice-kit';

import { DensityReadModelQuery } from './application/queries/density-read-model.query.js';
import { KeyObservationQueryPort } from './application/ports/key-observation.query.port.js';
import { PrefixCatalogQueryPort } from './application/ports/prefix-catalog.query.port.js';
import {
  MarginalDensityReadModelAdapter,
  type MarginalDensityThresholds,
} from './infrastructure/read-model/density.read-model.js';
import { createDensityLogger } from './infrastructure/logging/density.logger.js';
import { DensityController } from './presentation/http/density.controller.js';

/**
 * Density 슬라이스 — read-model 위상 (cross-domain).
 *
 * Layer reduction:
 * - domain/        : minimal (id types + read shapes + exceptions only)
 * - application/queries/ : DensityReadModelQuery (compute)
 * - application/commands/: NONE (pure read-model, source-of-truth 외부)
 * - application/ports/   : KeyObservationQueryPort + PrefixCatalogQueryPort
 *                          (cross-domain query ports, write surface 없음)
 * - application/use-cases/: NONE (읽기 슬라이스, transaction port 회피)
 * - infrastructure/persistence/ : NONE (primary store 외부)
 * - infrastructure/read-model/  : MarginalDensityReadModelAdapter (heavy aggregation)
 *                                + KeyObservationQueryPort 어댑터 (pg/sqlite/memory)
 *                                + SimPrefixCatalogQueryPort 어댑터
 * - infrastructure/logging/     : createDensityLogger
 * - infrastructure/transaction/ : NONE
 * - infrastructure/outbox/      : NONE
 * - presentation/http/          : DensityController (GET-only)
 * - presentation/bff/           : NONE
 * - metadata/openmetadata.seed.json : cache_keys 명시
 *
 * Dynamic registration (.register({useFactory})) — KeyObservation/PrefixCatalog
 * 두 cross-domain port 의 어댑터 선택을 호출자가 결정하도록 한다 (PG/sqlite/memory).
 */

export interface DensitySliceDeps {
  readonly observations: KeyObservationQueryPort;
  readonly catalog: PrefixCatalogQueryPort;
  readonly thresholds: MarginalDensityThresholds;
}

export interface DensitySliceModuleOptions {
  /** Cross-domain dependencies — 호출자가 dialect-aware 로 어댑터를 만들어 주입. */
  useFactory: (...deps: unknown[]) => Promise<DensitySliceDeps> | DensitySliceDeps;
  /** factory 가 주입받을 Nest 토큰 목록. */
  inject?: FactoryProvider['inject'];
}

const DENSITY_SLICE_DEPS = Symbol.for('sim-reporting-api/density/DensitySliceDeps');

@Module({})
export class DensitySliceModule {
  static register(opts: DensitySliceModuleOptions): DynamicModule {
    const depsProvider: FactoryProvider = {
      provide: DENSITY_SLICE_DEPS,
      useFactory: opts.useFactory,
      inject: opts.inject,
    };

    const observationsProvider: Provider = {
      provide: KeyObservationQueryPort,
      useFactory: (deps: DensitySliceDeps) => deps.observations,
      inject: [DENSITY_SLICE_DEPS],
    };

    const catalogProvider: Provider = {
      provide: PrefixCatalogQueryPort,
      useFactory: (deps: DensitySliceDeps) => deps.catalog,
      inject: [DENSITY_SLICE_DEPS],
    };

    const loggerProvider: Provider = {
      provide: SLICE_LOGGER_PORT,
      useFactory: (): LoggerPort => createDensityLogger(),
    };

    const readModelProvider: Provider = {
      provide: DensityReadModelQuery,
      useFactory: (
        observations: KeyObservationQueryPort,
        catalog: PrefixCatalogQueryPort,
        deps: DensitySliceDeps,
        logger: LoggerPort,
      ) => new MarginalDensityReadModelAdapter(observations, catalog, deps.thresholds, logger),
      inject: [
        KeyObservationQueryPort,
        PrefixCatalogQueryPort,
        DENSITY_SLICE_DEPS,
        SLICE_LOGGER_PORT,
      ],
    };

    return {
      module: DensitySliceModule,
      providers: [
        depsProvider,
        observationsProvider,
        catalogProvider,
        loggerProvider,
        readModelProvider,
      ],
      controllers: [DensityController],
      exports: [DensityReadModelQuery, KeyObservationQueryPort, PrefixCatalogQueryPort],
    };
  }
}
