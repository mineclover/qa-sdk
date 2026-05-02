// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free. Nest 의존 없음.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400 / VALIDATION_ERROR
 *   - ConflictError   → 409 / CONFLICT
 *   - NotFoundError   → 404 / NOT_FOUND
 */
export class DocumentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DocumentDomainException";
  }
}

/** Document ID 가 비어 있는 경우 (HTTP 400 매핑). */
export class InvalidDocumentIdException extends DocumentDomainException {
  constructor() {
    super("INVALID_DOCUMENT_ID", "DocumentId must not be empty.");
    this.name = "ValidationError";
  }
}

/** Document title 검증 실패 (HTTP 400). */
export class InvalidDocumentTitleException extends DocumentDomainException {
  constructor() {
    super("INVALID_DOCUMENT_TITLE", "Document title must not be empty.");
    this.name = "ValidationError";
  }
}

/** Document 가 존재하지 않을 때 (HTTP 404). */
export class DocumentNotFoundException extends DocumentDomainException {
  constructor(id: string) {
    super("DOCUMENT_NOT_FOUND", `Document not found: ${id}`);
    this.name = "NotFoundError";
  }
}
