// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Comment 슬라이스 도메인 예외.
 */
export class CommentDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommentDomainException";
  }
}

export class InvalidCommentIdException extends CommentDomainException {
  constructor() {
    super("INVALID_COMMENT_ID", "CommentId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidCommentBodyException extends CommentDomainException {
  constructor() {
    super("INVALID_COMMENT_BODY", "Comment body must not be empty.");
    this.name = "ValidationError";
  }
}

export class CommentNotFoundException extends CommentDomainException {
  constructor(id: string) {
    super("COMMENT_NOT_FOUND", `Comment not found: ${id}`);
    this.name = "NotFoundError";
  }
}

/** 참조한 document 가 존재하지 않는 경우 (cross-domain query 결과). */
export class CommentDocumentNotFoundException extends CommentDomainException {
  constructor(documentId: string) {
    super(
      "COMMENT_DOCUMENT_NOT_FOUND",
      `Cannot create comment: document not found: ${documentId}`,
    );
    this.name = "NotFoundError";
  }
}
