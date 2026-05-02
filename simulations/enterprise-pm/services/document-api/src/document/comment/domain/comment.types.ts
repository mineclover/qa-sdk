// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { AuthorId, CommentId, DocumentId } from "./comment.ids.js";

export interface CommentProps {
  readonly id: CommentId;
  readonly documentId: DocumentId;
  readonly authorId: AuthorId;
  readonly parentCommentId: CommentId | null;
  readonly body: string;
  readonly createdAt: Date;
}

export interface CommentSnapshot {
  readonly id: string;
  readonly documentId: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly body: string;
  readonly createdAt: string;
}
