// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
} from "@qa-sdk/sim-domain-slice-kit";

import { REPORTING_REPOSITORY } from "../reporting-db.module.js";
import type { ReportingRepository } from "../shared/port.js";

import { ReportAdminPort } from "./application/ports/report-admin.port.js";
import { ReportReadModelQuery } from "./application/queries/report-read-model.query.js";
import { RepositoryReportAdminAdapter } from "./infrastructure/persistence/report.repository-adapter.js";
import { RepositoryReportReadModel } from "./infrastructure/read-model/report.read-model.js";
import { createReportLogger } from "./infrastructure/logging/report.logger.js";
import { ReportController } from "./presentation/http/report.controller.js";

/**
 * Report 슬라이스 — read-model 위상.
 *
 * Layer reduction:
 * - domain/        : minimal (id types + read shapes + exceptions only)
 * - application/queries/ : ReportReadModelQuery (heavy)
 * - application/commands/: CreateReportCommand etc (admin only)
 * - application/ports/   : ReportAdminPort (write surface, transactional 아님)
 * - application/use-cases/: NONE (읽기 슬라이스, transaction port 회피)
 * - infrastructure/persistence/ : RepositoryReportAdminAdapter (read-only repo wrap)
 * - infrastructure/read-model/  : RepositoryReportReadModel (heavy)
 * - infrastructure/logging/     : createReportLogger
 * - infrastructure/transaction/ : NONE
 * - infrastructure/outbox/      : NONE
 * - presentation/http/          : ReportController (GET + admin POST/PUT/DELETE)
 * - presentation/bff/           : NONE
 * - metadata/openmetadata.seed.json : cache_keys 명시
 */

const readModelProvider: Provider = {
  provide: ReportReadModelQuery,
  useFactory: (repo: ReportingRepository) => new RepositoryReportReadModel(repo),
  inject: [REPORTING_REPOSITORY],
};

const adminProvider: Provider = {
  provide: ReportAdminPort,
  useFactory: (repo: ReportingRepository) => new RepositoryReportAdminAdapter(repo),
  inject: [REPORTING_REPOSITORY],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createReportLogger(),
};

@Module({
  providers: [readModelProvider, adminProvider, loggerProvider],
  controllers: [ReportController],
  exports: [ReportReadModelQuery, ReportAdminPort],
})
export class ReportSliceModule {}
