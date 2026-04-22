// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

export interface Document {
  id: string;
  projectId: string;
  title: string;
  currentVersion: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  documentId: string;
  versionNumber: number;
  /** 외부 storage 참조 키. */
  contentRef: string;
  authorId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  documentId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
}

export interface DocumentCreate {
  projectId: string;
  title: string;
  ownerId: string;
}

export interface DocumentVersionCreate {
  documentId: string;
  contentRef: string;
  authorId: string;
}

export interface CommentCreate {
  documentId: string;
  authorId: string;
  body: string;
  parentCommentId?: string;
}
