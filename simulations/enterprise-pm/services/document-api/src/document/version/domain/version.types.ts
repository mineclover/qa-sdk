// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { AuthorId, DocumentId, VersionNumber } from "./version.ids.js";

export interface VersionProps {
  readonly documentId: DocumentId;
  readonly versionNumber: VersionNumber;
  readonly contentRef: string;
  readonly authorId: AuthorId;
  readonly createdAt: Date;
}

export interface VersionSnapshot {
  readonly documentId: string;
  readonly versionNumber: number;
  readonly contentRef: string;
  readonly authorId: string;
  readonly createdAt: string;
}
