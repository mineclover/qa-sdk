// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { InvalidCommentIdException } from "./comment.exceptions.js";

export type CommentId = string & { readonly __brand: "CommentId" };
export type DocumentId = string & { readonly __brand: "DocumentId" };
export type AuthorId = string & { readonly __brand: "AuthorId" };

export function toCommentId(value: string): CommentId {
  if (value.trim().length === 0) {
    throw new InvalidCommentIdException();
  }
  return value as CommentId;
}

export function toDocumentId(value: string): DocumentId {
  return value as DocumentId;
}

export function toAuthorId(value: string): AuthorId {
  return value as AuthorId;
}
