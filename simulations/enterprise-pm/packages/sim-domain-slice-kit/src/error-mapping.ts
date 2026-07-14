// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

/**
 * 도메인 에러 → HTTP 응답 매핑의 표준 페이로드.
 *
 * traceId 는 응답에 포함시켜 클라이언트가 보고서로 첨부할 수 있도록 한다.
 */
export interface DomainErrorPayload {
  code: string;
  message: string;
  traceId: string;
  details?: Record<string, unknown>;
}

/**
 * 알려진 도메인 예외 클래스명을 HTTP status / 코드로 매핑한 표.
 *
 * 도메인은 framework-free 예외 클래스를 던지고, 이 매핑이 표준 status 를 결정.
 * 알 수 없는 에러는 500 + INTERNAL_ERROR 로 처리 (fail-open 아님 — 명시적으로 5xx).
 */
const KNOWN_DOMAIN_ERRORS: Record<string, { status: number; code: string }> = {
  NotFoundError: { status: 404, code: 'NOT_FOUND' },
  ValidationError: { status: 400, code: 'VALIDATION_ERROR' },
  ConflictError: { status: 409, code: 'CONFLICT' },
  UnauthorizedError: { status: 401, code: 'UNAUTHORIZED' },
  ForbiddenError: { status: 403, code: 'FORBIDDEN' },
  PreconditionFailedError: { status: 412, code: 'PRECONDITION_FAILED' },
  UnprocessableEntityError: { status: 422, code: 'UNPROCESSABLE_ENTITY' },
  TooManyRequestsError: { status: 429, code: 'TOO_MANY_REQUESTS' },
  TimeoutError: { status: 504, code: 'TIMEOUT' },
};

interface DomainErrorLike {
  name?: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

function isDomainErrorLike(value: unknown): value is DomainErrorLike {
  return typeof value === 'object' && value !== null;
}

/**
 * 도메인 에러를 HTTP status + 표준 페이로드로 변환한다.
 *
 * - err.name 이 KNOWN_DOMAIN_ERRORS 에 존재하면 매핑 적용
 * - err.code 가 명시되어 있으면 우선 사용
 * - 그 외엔 500 / INTERNAL_ERROR
 */
export function mapDomainErrorToHttp(
  err: unknown,
  traceId: string,
): {
  status: number;
  payload: DomainErrorPayload;
} {
  if (!isDomainErrorLike(err)) {
    return {
      status: 500,
      payload: {
        code: 'INTERNAL_ERROR',
        message: typeof err === 'string' ? err : 'internal server error',
        traceId,
      },
    };
  }

  const name = err.name ?? '';
  const known = KNOWN_DOMAIN_ERRORS[name];
  const code = err.code ?? known?.code ?? 'INTERNAL_ERROR';
  const status = known?.status ?? 500;
  const message = err.message ?? code;

  const payload: DomainErrorPayload = {
    code,
    message,
    traceId,
  };
  if (err.details && Object.keys(err.details).length > 0) {
    payload.details = err.details;
  }
  return { status, payload };
}
