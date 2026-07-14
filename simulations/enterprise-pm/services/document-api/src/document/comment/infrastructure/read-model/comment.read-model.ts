// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  CommentReadModelQuery,
  type CommentDetailReadModel,
} from '../../application/queries/comment-read-model.query.js';
import type { CommentRepositoryPort } from '../../application/ports/comment-repository.port.js';

export class RepositoryCommentReadModel extends CommentReadModelQuery {
  constructor(private readonly repository: CommentRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<CommentDetailReadModel | null> {
    const e = await this.repository.findById(id);
    if (!e) return null;
    const s = e.toSnapshot();
    return {
      id: s.id,
      documentId: s.documentId,
      authorId: s.authorId,
      parentCommentId: s.parentCommentId,
      body: s.body,
      createdAt: s.createdAt,
    };
  }

  async listByDocument(documentId: string): Promise<CommentDetailReadModel[]> {
    const list = await this.repository.listByDocument(documentId);
    return list.map((e) => {
      const s = e.toSnapshot();
      return {
        id: s.id,
        documentId: s.documentId,
        authorId: s.authorId,
        parentCommentId: s.parentCommentId,
        body: s.body,
        createdAt: s.createdAt,
      };
    });
  }

  async listReplies(parentCommentId: string): Promise<CommentDetailReadModel[]> {
    const list = await this.repository.listReplies(parentCommentId);
    return list.map((e) => {
      const s = e.toSnapshot();
      return {
        id: s.id,
        documentId: s.documentId,
        authorId: s.authorId,
        parentCommentId: s.parentCommentId,
        body: s.body,
        createdAt: s.createdAt,
      };
    });
  }
}
