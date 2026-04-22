// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ReportingDbModule } from "./reporting/reporting-db.module.js";
import { ReportModule } from "./reporting/report/report.module.js";
import { MetricModule } from "./reporting/metric/metric.module.js";

@Module({
  imports: [
    HealthModule,
    ReportingDbModule.forRoot(),
    ReportModule,
    MetricModule,
  ],
})
export class AppModule {}
