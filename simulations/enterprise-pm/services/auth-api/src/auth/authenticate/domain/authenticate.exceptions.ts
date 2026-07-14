// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export class AuthenticateDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthenticateDomainException';
  }
}

export class InvalidAuthenticateInputException extends AuthenticateDomainException {
  constructor(reason: string) {
    super('INVALID_AUTHENTICATE_INPUT', reason);
    this.name = 'ValidationError';
  }
}

/** 자격증명 불일치 — 401. mapDomainErrorToHttp 표준 이름. */
export class InvalidCredentialsException extends AuthenticateDomainException {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid credentials.');
    this.name = 'UnauthorizedError';
  }
}
