// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 서비스 공용 AppError 기반 클래스.
 *
 * 각 서비스는 자체 ErrorCode 타입을 정의하되,
 * AppError 클래스는 여기서 import한다.
 *
 * 에러 계층:
 *   AppError        — 서비스 에러 (code + statusCode + extras)
 *   ServiceClientError — HTTP 클라이언트 에러 (status + payload)
 *   라이브러리 에러  — WeightedIndexError, IndexMetaError, SpecError (각 계층 독립)
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly extras: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * HTTP 클라이언트 공용 에러.
 *
 * 서비스 클라이언트(DefinitionClient, MotionWorkspaceClient 등)가
 * HTTP 응답 에러를 표현할 때 사용한다.
 *
 * AppError와의 차이:
 *   AppError         → 서비스 내부에서 throw (code 필수)
 *   ServiceClientError → 외부 서비스 호출 실패 시 throw (payload로 원본 응답 전달)
 */
export class ServiceClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ServiceClientError';
  }
}
