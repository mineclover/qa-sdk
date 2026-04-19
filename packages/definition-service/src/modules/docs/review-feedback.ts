// @def.doc definition-service

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import type {
  DefFeedbackRequestSummary,
  DefSyntheticIncomingLink,
} from "definition-catalog";

type StoredFeedbackRequest = {
  id: string;
  created_at: string;
  purpose: string;
  target_model: string | null;
  status: string;
  service_scope: string | null;
  evidence_bundle: string;
};

type StoredEvidenceBundle = {
  items: Array<{
    relatedDocs?: Array<{ docId: string }>;
  }>;
};

function getQaSdkDir(): string {
  const base = process.env.QA_SDK_HOME
    ?? process.env.HOME
    ?? process.env.USERPROFILE
    ?? homedir()
    ?? ".";
  return join(base, ".qa-sdk");
}

function openReviewLedger(): Database.Database | null {
  const dbPath = join(getQaSdkDir(), "review-ledger.sqlite");
  if (!existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true });
}

export function getFeedbackRequestSummariesForDoc(
  docId: string,
  limit = 10,
): DefFeedbackRequestSummary[] {
  const db = openReviewLedger();
  if (!db) return [];

  try {
    return loadRequestsByDocId(db, docId, limit).map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      purpose: request.purpose,
      targetModel: request.targetModel,
      status: request.status,
      serviceScope: request.serviceScope,
    }));
  } finally {
    db.close();
  }
}

export function getSyntheticIncomingLinksForDoc(
  docId: string,
  limit = 10,
): DefSyntheticIncomingLink[] {
  return getFeedbackRequestSummariesForDoc(docId, limit).map((request) => ({
    source: request.id,
    type: "feedback_request",
    synthetic: true,
    kind: "feedback_request",
    title: request.purpose,
    createdAt: request.createdAt,
    targetModel: request.targetModel,
  }));
}

function loadRequestsByDocId(
  db: Database.Database,
  docId: string,
  limit: number,
): Array<{
  id: string;
  createdAt: string;
  purpose: string;
  targetModel: string | null;
  status: string;
  serviceScope: string | null;
}> {
  const rows = db.prepare(`
    SELECT id, created_at, purpose, target_model, status, service_scope, evidence_bundle
    FROM feedback_requests
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as StoredFeedbackRequest[];

  return rows
    .filter((row) => {
      const bundle = JSON.parse(row.evidence_bundle) as StoredEvidenceBundle;
      return bundle.items.some((item) =>
        (item.relatedDocs ?? []).some((doc) => doc.docId === docId),
      );
    })
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      purpose: row.purpose,
      targetModel: row.target_model,
      status: row.status,
      serviceScope: row.service_scope,
    }));
}
