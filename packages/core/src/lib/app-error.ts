/**
 * 서비스 공용 AppError 기반 클래스.
 *
 * 각 서비스는 자체 ErrorCode 타입을 정의하되,
 * AppError 클래스는 여기서 import한다.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly extras: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}
