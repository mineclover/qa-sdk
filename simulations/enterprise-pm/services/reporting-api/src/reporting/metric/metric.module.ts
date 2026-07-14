// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import { SLICE_LOGGER_PORT, type LoggerPort } from '@qa-sdk/sim-domain-slice-kit';

import { REPORTING_REPOSITORY } from '../reporting-db.module.js';
import type { ReportingRepository } from '../shared/port.js';

import { MetricAdminPort } from './application/ports/metric-admin.port.js';
import { MetricReadModelQuery } from './application/queries/metric-read-model.query.js';
import { RepositoryMetricAdminAdapter } from './infrastructure/persistence/metric.repository-adapter.js';
import { RepositoryMetricReadModel } from './infrastructure/read-model/metric.read-model.js';
import { createMetricLogger } from './infrastructure/logging/metric.logger.js';
import { MetricController } from './presentation/http/metric.controller.js';

/**
 * Metric 슬라이스 — read-model 위상.
 *
 * Layer reduction:
 * - domain/        : minimal (id types + read shapes + exceptions only)
 * - application/queries/ : MetricReadModelQuery (heavy — findOne / listByKey / listKeys)
 * - application/commands/: RecordMetricCommand (admin)
 * - application/ports/   : MetricAdminPort (write surface, transactional 아님)
 * - application/use-cases/: NONE (읽기 슬라이스, transaction port 회피)
 * - infrastructure/persistence/ : RepositoryMetricAdminAdapter (read-only repo wrap)
 * - infrastructure/read-model/  : RepositoryMetricReadModel (heavy)
 * - infrastructure/logging/     : createMetricLogger
 * - infrastructure/transaction/ : NONE
 * - infrastructure/outbox/      : NONE
 * - presentation/http/          : MetricController (GET + admin POST)
 * - presentation/bff/           : NONE
 * - metadata/openmetadata.seed.json : cache_keys 명시
 */

const readModelProvider: Provider = {
  provide: MetricReadModelQuery,
  useFactory: (repo: ReportingRepository) => new RepositoryMetricReadModel(repo),
  inject: [REPORTING_REPOSITORY],
};

const adminProvider: Provider = {
  provide: MetricAdminPort,
  useFactory: (repo: ReportingRepository) => new RepositoryMetricAdminAdapter(repo),
  inject: [REPORTING_REPOSITORY],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createMetricLogger(),
};

@Module({
  providers: [readModelProvider, adminProvider, loggerProvider],
  controllers: [MetricController],
  exports: [MetricReadModelQuery, MetricAdminPort],
})
export class MetricSliceModule {}
