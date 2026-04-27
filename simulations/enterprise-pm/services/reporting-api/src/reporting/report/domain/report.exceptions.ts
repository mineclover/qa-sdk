// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - NotFoundError → 404 / NOT_FOUND
 *
 * Read-model 슬라이스이므로 NotFound 외 도메인 예외는 정의하지 않는다 —
 * 입력 검증 오류는 zod 가, 권한/충돌은 상위 (gateway) 가 책임.
 */
export class ReportDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReportDomainException";
  }
}

/** Report read model 이 존재하지 않는 경우 (HTTP 404 매핑). */
export class ReportNotFoundException extends ReportDomainException {
  constructor(public readonly id: string) {
    super("REPORT_NOT_FOUND", `Report not found: ${id}`);
    this.name = "NotFoundError";
  }
}
