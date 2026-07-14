// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Version 슬라이스 도메인 예외.
 */
export class VersionDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VersionDomainException';
  }
}

export class InvalidVersionDocumentIdException extends VersionDomainException {
  constructor() {
    super('INVALID_VERSION_DOCUMENT_ID', 'Version documentId must not be empty.');
    this.name = 'ValidationError';
  }
}

export class InvalidVersionContentRefException extends VersionDomainException {
  constructor() {
    super('INVALID_VERSION_CONTENT_REF', 'Version contentRef must not be empty.');
    this.name = 'ValidationError';
  }
}

export class InvalidVersionNumberException extends VersionDomainException {
  constructor() {
    super('INVALID_VERSION_NUMBER', 'Version number must be a positive integer.');
    this.name = 'ValidationError';
  }
}

export class VersionNotFoundException extends VersionDomainException {
  constructor(documentId: string, n: number) {
    super('VERSION_NOT_FOUND', `Version not found: ${documentId}/${n}`);
    this.name = 'NotFoundError';
  }
}

export class VersionDocumentNotFoundException extends VersionDomainException {
  constructor(documentId: string) {
    super('VERSION_DOCUMENT_NOT_FOUND', `Cannot create version: document not found: ${documentId}`);
    this.name = 'NotFoundError';
  }
}
