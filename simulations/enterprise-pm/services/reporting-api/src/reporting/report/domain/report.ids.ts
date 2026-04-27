// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/** Report 식별자 — read-model 슬라이스의 anchor identity. */
export type ReportId = string & { readonly __brand: "ReportId" };

export function toReportId(value: string): ReportId {
  return value as ReportId;
}
