// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { DocumentRepository } from "../shared/port.js";
import type {
  Document,
  DocumentCreate,
  DocumentVersion,
  DocumentVersionCreate,
  Comment,
  CommentCreate,
} from "../shared/types.js";
import { DocumentNotFoundError } from "../shared/errors.js";
import { documents, documentVersions, comments } from "./schema.js";

export class PgDocumentRepository implements DocumentRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  async createDocument(args: DocumentCreate): Promise<Document> {
    const now = new Date().toISOString();
    const doc: Document = {
      id: randomUUID(),
      projectId: args.projectId,
      title: args.title,
      currentVersion: 0,
      ownerId: args.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(documents).values(doc);
    return doc;
  }

  async findDocument(id: string): Promise<Document | null> {
    const rows = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return rows[0] ? (rows[0] as Document) : null;
  }

  async listDocumentsByProject(projectId: string): Promise<Document[]> {
    return (await this.db.select().from(documents).where(eq(documents.projectId, projectId))) as Document[];
  }

  async updateDocument(id: string, patch: Partial<DocumentCreate>): Promise<Document> {
    const cur = await this.findDocument(id);
    if (!cur) throw new DocumentNotFoundError(id);
    const now = new Date().toISOString();
    const next: Document = {
      ...cur,
      projectId: patch.projectId ?? cur.projectId,
      title: patch.title ?? cur.title,
      ownerId: patch.ownerId ?? cur.ownerId,
      updatedAt: now,
    };
    await this.db.update(documents).set({
      projectId: next.projectId,
      title: next.title,
      ownerId: next.ownerId,
      updatedAt: next.updatedAt,
    }).where(eq(documents.id, id));
    return next;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, id));
  }

  async createVersion(args: DocumentVersionCreate): Promise<DocumentVersion> {
    const doc = await this.findDocument(args.documentId);
    if (!doc) throw new DocumentNotFoundError(args.documentId);
    const nextVersion = doc.currentVersion + 1;
    const now = new Date().toISOString();
    const version: DocumentVersion = {
      documentId: args.documentId,
      versionNumber: nextVersion,
      contentRef: args.contentRef,
      authorId: args.authorId,
      createdAt: now,
    };
    await this.db.transaction(async (tx) => {
      await tx.insert(documentVersions).values(version);
      await tx.update(documents).set({
        currentVersion: nextVersion,
        updatedAt: now,
      }).where(eq(documents.id, args.documentId));
    });
    return version;
  }

  async findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    const rows = await this.db.select().from(documentVersions).where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionNumber, versionNumber),
      ),
    ).limit(1);
    return rows[0] ? (rows[0] as DocumentVersion) : null;
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    return (await this.db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(asc(documentVersions.versionNumber))) as DocumentVersion[];
  }

  async createComment(args: CommentCreate): Promise<Comment> {
    const now = new Date().toISOString();
    const c: Comment = {
      id: randomUUID(),
      documentId: args.documentId,
      authorId: args.authorId,
      parentCommentId: args.parentCommentId ?? null,
      body: args.body,
      createdAt: now,
    };
    await this.db.insert(comments).values(c);
    return c;
  }

  async findComment(id: string): Promise<Comment | null> {
    const rows = await this.db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return rows[0] ? toComment(rows[0]) : null;
  }

  async listCommentsForDocument(documentId: string): Promise<Comment[]> {
    const rows = await this.db.select().from(comments).where(eq(comments.documentId, documentId));
    return rows.map(toComment);
  }

  async listReplies(parentCommentId: string): Promise<Comment[]> {
    const rows = await this.db.select().from(comments).where(eq(comments.parentCommentId, parentCommentId));
    return rows.map(toComment);
  }

  async deleteComment(id: string): Promise<void> {
    await this.db.delete(comments).where(eq(comments.id, id));
  }
}

function toComment(row: typeof comments.$inferSelect): Comment {
  return {
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    parentCommentId: row.parentCommentId ?? null,
    body: row.body,
    createdAt: row.createdAt,
  };
}
