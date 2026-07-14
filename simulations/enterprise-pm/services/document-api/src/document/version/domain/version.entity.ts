// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { toAuthorId, toDocumentId, toVersionNumber } from './version.ids.js';
import { InvalidVersionContentRefException } from './version.exceptions.js';
import type { VersionProps, VersionSnapshot } from './version.types.js';

/**
 * DocumentVersion Aggregate Root.
 *
 * - 단일 버전은 (documentId, versionNumber) 합성키로 식별 (append-only).
 * - private constructor + named factories.
 * - invariant: contentRef 비어 있으면 ValidationError.
 */
export class VersionEntity {
  private constructor(private readonly props: VersionProps) {}

  static create(input: {
    readonly documentId: string;
    readonly versionNumber: number;
    readonly contentRef: string;
    readonly authorId: string;
    readonly now?: Date;
  }): VersionEntity {
    if (input.contentRef.trim().length === 0) {
      throw new InvalidVersionContentRefException();
    }
    const now = input.now ?? new Date();
    return new VersionEntity({
      documentId: toDocumentId(input.documentId),
      versionNumber: toVersionNumber(input.versionNumber),
      contentRef: input.contentRef,
      authorId: toAuthorId(input.authorId),
      createdAt: now,
    });
  }

  static rehydrate(snapshot: VersionSnapshot): VersionEntity {
    return new VersionEntity({
      documentId: toDocumentId(snapshot.documentId),
      versionNumber: toVersionNumber(snapshot.versionNumber),
      contentRef: snapshot.contentRef,
      authorId: toAuthorId(snapshot.authorId),
      createdAt: new Date(snapshot.createdAt),
    });
  }

  toSnapshot(): VersionSnapshot {
    return {
      documentId: this.props.documentId,
      versionNumber: this.props.versionNumber,
      contentRef: this.props.contentRef,
      authorId: this.props.authorId,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  get documentId(): string {
    return this.props.documentId;
  }

  get versionNumber(): number {
    return this.props.versionNumber;
  }
}
