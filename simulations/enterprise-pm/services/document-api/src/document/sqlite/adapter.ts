// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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

export class SqliteDocumentRepository implements DocumentRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  // ── Document ────
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
    this.db.insert(documents).values(doc).run();
    return doc;
  }

  async findDocument(id: string): Promise<Document | null> {
    const rows = this.db.select().from(documents).where(eq(documents.id, id)).limit(1).all();
    return rows[0] ? (rows[0] as Document) : null;
  }

  async listDocumentsByProject(projectId: string): Promise<Document[]> {
    return this.db.select().from(documents).where(eq(documents.projectId, projectId)).all() as Document[];
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
    this.db.update(documents).set({
      projectId: next.projectId,
      title: next.title,
      ownerId: next.ownerId,
      updatedAt: next.updatedAt,
    }).where(eq(documents.id, id)).run();
    return next;
  }

  async deleteDocument(id: string): Promise<void> {
    this.db.delete(documents).where(eq(documents.id, id)).run();
  }

  // ── DocumentVersion ────
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
    this.db.transaction((tx) => {
      tx.insert(documentVersions).values(version).run();
      tx.update(documents).set({
        currentVersion: nextVersion,
        updatedAt: now,
      }).where(eq(documents.id, args.documentId)).run();
    });
    return version;
  }

  async findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    const rows = this.db.select().from(documentVersions).where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionNumber, versionNumber),
      ),
    ).limit(1).all();
    return rows[0] ? (rows[0] as DocumentVersion) : null;
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(asc(documentVersions.versionNumber))
      .all() as DocumentVersion[];
  }

  // ── Comment ────
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
    this.db.insert(comments).values(c).run();
    return c;
  }

  async findComment(id: string): Promise<Comment | null> {
    const rows = this.db.select().from(comments).where(eq(comments.id, id)).limit(1).all();
    return rows[0] ? toComment(rows[0]) : null;
  }

  async listCommentsForDocument(documentId: string): Promise<Comment[]> {
    return this.db.select().from(comments).where(eq(comments.documentId, documentId)).all().map(toComment);
  }

  async listReplies(parentCommentId: string): Promise<Comment[]> {
    return this.db.select().from(comments).where(eq(comments.parentCommentId, parentCommentId)).all().map(toComment);
  }

  async deleteComment(id: string): Promise<void> {
    this.db.delete(comments).where(eq(comments.id, id)).run();
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
