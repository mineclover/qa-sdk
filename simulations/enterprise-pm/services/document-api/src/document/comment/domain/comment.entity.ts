// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  toAuthorId,
  toCommentId,
  toDocumentId,
} from "./comment.ids.js";
import { InvalidCommentBodyException } from "./comment.exceptions.js";
import type { CommentProps, CommentSnapshot } from "./comment.types.js";

/**
 * Comment Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: body 비어 있으면 ValidationError
 */
export class CommentEntity {
  private constructor(private readonly props: CommentProps) {}

  static create(input: {
    readonly id: string;
    readonly documentId: string;
    readonly authorId: string;
    readonly body: string;
    readonly parentCommentId?: string | null;
    readonly now?: Date;
  }): CommentEntity {
    if (input.body.trim().length === 0) {
      throw new InvalidCommentBodyException();
    }
    const now = input.now ?? new Date();
    return new CommentEntity({
      id: toCommentId(input.id),
      documentId: toDocumentId(input.documentId),
      authorId: toAuthorId(input.authorId),
      parentCommentId:
        input.parentCommentId && input.parentCommentId.length > 0
          ? toCommentId(input.parentCommentId)
          : null,
      body: input.body,
      createdAt: now,
    });
  }

  static rehydrate(snapshot: CommentSnapshot): CommentEntity {
    return new CommentEntity({
      id: toCommentId(snapshot.id),
      documentId: toDocumentId(snapshot.documentId),
      authorId: toAuthorId(snapshot.authorId),
      parentCommentId:
        snapshot.parentCommentId && snapshot.parentCommentId.length > 0
          ? toCommentId(snapshot.parentCommentId)
          : null,
      body: snapshot.body,
      createdAt: new Date(snapshot.createdAt),
    });
  }

  toSnapshot(): CommentSnapshot {
    return {
      id: this.props.id,
      documentId: this.props.documentId,
      authorId: this.props.authorId,
      parentCommentId: this.props.parentCommentId,
      body: this.props.body,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get documentId(): string {
    return this.props.documentId;
  }

  get parentCommentId(): string | null {
    return this.props.parentCommentId;
  }
}
