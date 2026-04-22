// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { MetricService } from "./metric.service.js";

const createSchema = z.object({
  metricKey: z.string().min(1),
  date: z.string().min(1),
  value: z.number().finite(),
  dimensions: z.string().min(1),
});

@Controller()
export class MetricController {
  constructor(private readonly svc: MetricService) {}

  @Post("metrics")
  async record(@Body() body: unknown) {
    return this.svc.record(createSchema.parse(body));
  }

  @Get("metrics")
  async list(
    @Query("metricKey") metricKey: string,
    @Query("fromDate") fromDate: string,
    @Query("toDate") toDate: string,
  ) {
    return this.svc.listByKey(metricKey, fromDate, toDate);
  }

  @Get("metrics/keys")
  async listKeys() {
    return this.svc.listKeys();
  }
}
