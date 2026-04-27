// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { CommentEntity } from "../../domain/index.js";
import type { CommentTransactionScope } from "./comment-transaction.port.js";

export abstract class CommentRepositoryPort {
  abstract save(entity: CommentEntity, scope: CommentTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<CommentEntity | null>;
  abstract listByDocument(documentId: string): Promise<CommentEntity[]>;
  abstract listReplies(parentCommentId: string): Promise<CommentEntity[]>;
  abstract delete(id: string, scope: CommentTransactionScope): Promise<void>;
}
