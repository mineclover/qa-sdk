import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import type {
  DefFeedbackRequestSummary,
  DefSyntheticIncomingLink,
} from "definition-catalog";

function getQaSdkDir(): string {
  const base = process.env.QA_SDK_HOME
    ?? process.env.HOME
    ?? process.env.USERPROFILE
    ?? homedir()
    ?? ".";
  return join(base, ".qa-sdk");
}

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

function openReviewLedger(): Database.Database | null {
  const dbPath = join(getQaSdkDir(), "review-ledger.sqlite");
  if (!existsSync(dbPath)) return null;
  try {
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

export function getSyntheticIncomingLinksForDoc(
  _cwd: string,
  docId: string,
  limit = 10,
): DefSyntheticIncomingLink[] {
  const db = openReviewLedger();
  if (!db) return [];

  try {
    return loadRequestsByDocId(db, docId, limit).map((request) => ({
      source: request.id,
      type: "feedback_request",
      synthetic: true as const,
      kind: "feedback_request" as const,
      title: request.purpose,
      createdAt: request.createdAt,
      targetModel: request.targetModel,
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function getFeedbackRequestSummariesForDoc(
  _cwd: string,
  docId: string,
  limit = 10,
): DefFeedbackRequestSummary[] {
  const db = openReviewLedger();
  if (!db) return [];

  try {
    return loadRequestsByDocId(db, docId, limit).map(toSummary);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function toSummary(request: {
  id: string;
  createdAt: string;
  purpose: string;
  targetModel: string | null;
  status: string;
  serviceScope: string | null;
}): DefFeedbackRequestSummary {
  return {
    id: request.id,
    createdAt: request.createdAt,
    purpose: request.purpose,
    targetModel: request.targetModel,
    status: request.status,
    serviceScope: request.serviceScope,
  };
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
