// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { DOCUMENT_REPOSITORY } from "../document-db.module.js";
import type { DocumentRepository } from "../shared/port.js";
import type { Comment, CommentCreate } from "../shared/types.js";

@Injectable()
export class CommentService {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository) {}

  create(args: CommentCreate): Promise<Comment> {
    return this.repo.createComment(args);
  }
  find(id: string): Promise<Comment | null> {
    return this.repo.findComment(id);
  }
  listForDocument(documentId: string): Promise<Comment[]> {
    return this.repo.listCommentsForDocument(documentId);
  }
  listReplies(parentCommentId: string): Promise<Comment[]> {
    return this.repo.listReplies(parentCommentId);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteComment(id);
  }
}
