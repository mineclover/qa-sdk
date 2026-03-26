import { Controller, Get, Post, Inject, Param, Query, Body, NotFoundException } from "@nestjs/common";
import { ConsumptionService } from "./consumption.service.js";

@Controller("consumption")
export class ConsumptionController {
  constructor(@Inject(ConsumptionService) private readonly consumption: ConsumptionService) {}

  @Post(":prefixId")
  record(
    @Param("prefixId") prefixId: string,
    @Body() body: {
      prefixVersion: string;
      totalSpace: number;
      observedAddresses: number;
      dimStats: Record<string, unknown>;
    },
  ) {
    return this.consumption.record(prefixId, body);
  }

  @Get(":prefixId")
  latest(@Param("prefixId") prefixId: string) {
    const snapshot = this.consumption.latest(prefixId);
    if (!snapshot) throw new NotFoundException(`${prefixId} 소비율 데이터 없음`);
    return snapshot;
  }

  @Get(":prefixId/history")
  history(@Param("prefixId") prefixId: string, @Query("limit") limit?: string) {
    const snapshots = this.consumption.history(prefixId, limit ? Number(limit) : undefined);
    return { prefixId, snapshots, total: snapshots.length };
  }
}
