// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/** spec-core 도메인 에러 기반 클래스 */
export class SpecError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SpecError';
  }
}

export class DuplicateRegistrationError extends SpecError {
  constructor(kind: string, id: string) {
    super('DUPLICATE_REGISTRATION', `${kind} "${id}" is already registered`);
    this.name = 'DuplicateRegistrationError';
  }
}

export class NotFoundError extends SpecError {
  constructor(kind: string, id: string) {
    super('NOT_FOUND', `${kind} "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends SpecError {
  constructor(
    message: string,
    readonly details: readonly ValidationErrorDetail[] = [],
  ) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export interface ValidationErrorDetail {
  layer: 0 | 1 | 2;
  axis?: string;
  rule: string;
  message: string;
}
