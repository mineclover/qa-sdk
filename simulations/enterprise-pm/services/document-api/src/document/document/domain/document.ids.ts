// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { InvalidDocumentIdException } from "./document.exceptions.js";

/** PascalCase + branded 식별자. cross-aggregate 참조는 항상 ID by value. */
export type DocumentId = string & { readonly __brand: "DocumentId" };

/** Project 식별자 (cross-aggregate ref). */
export type ProjectId = string & { readonly __brand: "ProjectId" };

/** Owner(소유자) 식별자. */
export type OwnerId = string & { readonly __brand: "OwnerId" };

export function toDocumentId(value: string): DocumentId {
  if (value.trim().length === 0) {
    throw new InvalidDocumentIdException();
  }
  return value as DocumentId;
}

export function toProjectId(value: string): ProjectId {
  return value as ProjectId;
}

export function toOwnerId(value: string): OwnerId {
  return value as OwnerId;
}
