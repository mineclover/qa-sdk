// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** 좌표 주소 호환성 계약의 실패 코드 — Drive 원본 계획 Phase 1 */
export const CODEC_ERROR_CODES = [
  'UnknownCatalogSnapshot',
  'CatalogMismatch',
  'UnsupportedCodecVersion',
  'UnknownPrefix',
  'AddressOutOfRange',
  'StrideOverflow',
  'InvalidDimensionValue',
  'MigrationRequired',
  'CorruptEnvelope',
] as const;

export type CodecErrorCode = (typeof CODEC_ERROR_CODES)[number];

/** 정상 값처럼 보이는 잘못된 decode 대신 던지는 계약 오류 */
export class CodecContractError extends Error {
  readonly code: CodecErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: CodecErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(`[${code}] ${message}`);
    this.name = 'CodecContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

/** 번들이 둘로 나뉘어 instanceof가 실패해도 name·code로 판별한다 */
export function isCodecContractError(
  error: unknown,
  code?: CodecErrorCode,
): error is CodecContractError {
  if (!(error instanceof Error) || error.name !== 'CodecContractError') return false;
  const actual = (error as { code?: unknown }).code;
  if (!CODEC_ERROR_CODES.includes(actual as CodecErrorCode)) return false;
  return code === undefined || actual === code;
}
