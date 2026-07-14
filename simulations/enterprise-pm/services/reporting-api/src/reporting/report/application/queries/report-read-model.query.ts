// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { ReportReadModel, ReportSummaryReadModel } from '../../domain/report.types.js';

/** Read 전용 query port (CQRS — Primary DB 직접 read 금지, Read Model 우선). */
export abstract class ReportReadModelQuery {
  /** id 단건 조회. 미존재 시 null. */
  abstract findDetail(id: string): Promise<ReportReadModel | null>;
  /** 전체 목록 조회 (요약). */
  abstract listAll(): Promise<ReportSummaryReadModel[]>;
}
