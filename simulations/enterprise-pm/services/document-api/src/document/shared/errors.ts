// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

export class DocumentNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Document not found: ${id}`);
    this.name = "DocumentNotFoundError";
  }
}

export class CommentNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Comment not found: ${id}`);
    this.name = "CommentNotFoundError";
  }
}

export class VersionMismatchError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Version mismatch: expected ${expected}, got ${actual}`);
    this.name = "VersionMismatchError";
  }
}
