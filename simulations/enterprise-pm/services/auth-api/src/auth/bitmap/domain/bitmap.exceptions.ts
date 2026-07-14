// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export class BitmapDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BitmapDomainException';
  }
}

export class InvalidBitmapInputException extends BitmapDomainException {
  constructor(reason: string) {
    super('INVALID_BITMAP_INPUT', reason);
    this.name = 'ValidationError';
  }
}

export class UserNotFoundForBitmapException extends BitmapDomainException {
  constructor(userId: string) {
    super('USER_NOT_FOUND_FOR_BITMAP', `User not found for bitmap issue: ${userId}`);
    this.name = 'NotFoundError';
  }
}

export class BitmapIssueForbiddenException extends BitmapDomainException {
  constructor(reason: string) {
    super('BITMAP_ISSUE_FORBIDDEN', reason);
    this.name = 'ForbiddenError';
  }
}
