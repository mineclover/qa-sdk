// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import type {
  Document,
  DocumentCreate,
  DocumentVersion,
  DocumentVersionCreate,
  Comment,
  CommentCreate,
} from "./types.js";

export interface DocumentRepository {
  // Document
  createDocument(args: DocumentCreate): Promise<Document>;
  findDocument(id: string): Promise<Document | null>;
  listDocumentsByProject(projectId: string): Promise<Document[]>;
  updateDocument(id: string, patch: Partial<DocumentCreate>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // DocumentVersion (append-only + currentVersion 증가)
  createVersion(args: DocumentVersionCreate): Promise<DocumentVersion>;
  findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null>;
  listVersions(documentId: string): Promise<DocumentVersion[]>;

  // Comment (threaded)
  createComment(args: CommentCreate): Promise<Comment>;
  findComment(id: string): Promise<Comment | null>;
  listCommentsForDocument(documentId: string): Promise<Comment[]>;
  listReplies(parentCommentId: string): Promise<Comment[]>;
  deleteComment(id: string): Promise<void>;
}
