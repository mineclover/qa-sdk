// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { ReportId } from './report.ids.js';

/**
 * Read-side Report DTO — 본 슬라이스는 read-model 슬라이스이므로 entity 가
 * 아닌 read shape 만 정의한다. 작성/수정 명령의 결과 또한 동일 shape 으로
 * 표현한다 (id, name, queryDefinition, createdBy, timestamps).
 */
export interface ReportReadModel {
  readonly id: ReportId;
  readonly name: string;
  readonly queryDefinition: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Report 요약 read shape — list 응답용 (현재는 detail 과 동일). */
export type ReportSummaryReadModel = ReportReadModel;
