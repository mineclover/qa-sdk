// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/**
 * Report admin 명령 DTO — 결과는 read shape 로 반환한다.
 *
 * Read-model 슬라이스이지만 Report 자체의 카탈로그 항목 (정의/소유자) 은
 * 본 서비스가 source-of-truth 이므로 admin write 를 허용한다. 이벤트 emit
 * 없음 (outbox 미사용).
 */
export interface CreateReportCommand {
  readonly name: string;
  readonly queryDefinition: string;
  readonly createdBy: string;
}

export interface UpdateReportCommand {
  readonly id: string;
  readonly name?: string;
  readonly queryDefinition?: string;
  readonly createdBy?: string;
}

export interface DeleteReportCommand {
  readonly id: string;
}
