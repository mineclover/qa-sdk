// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export interface CommentDetailReadModel {
  readonly id: string;
  readonly documentId: string;
  readonly authorId: string;
  readonly parentCommentId: string | null;
  readonly body: string;
  readonly createdAt: string;
}

export abstract class CommentReadModelQuery {
  abstract findDetail(id: string): Promise<CommentDetailReadModel | null>;
  abstract listByDocument(documentId: string): Promise<CommentDetailReadModel[]>;
  abstract listReplies(parentCommentId: string): Promise<CommentDetailReadModel[]>;
}
