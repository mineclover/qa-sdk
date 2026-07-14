// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  InvalidVersionDocumentIdException,
  InvalidVersionNumberException,
} from './version.exceptions.js';

export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type AuthorId = string & { readonly __brand: 'AuthorId' };
export type VersionNumber = number & { readonly __brand: 'VersionNumber' };

export function toDocumentId(value: string): DocumentId {
  if (value.trim().length === 0) {
    throw new InvalidVersionDocumentIdException();
  }
  return value as DocumentId;
}

export function toAuthorId(value: string): AuthorId {
  return value as AuthorId;
}

export function toVersionNumber(value: number): VersionNumber {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidVersionNumberException();
  }
  return value as VersionNumber;
}
