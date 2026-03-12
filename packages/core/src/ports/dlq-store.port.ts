export type DlqPhase = "reconstruction" | "verdict";

export interface DlqInsert {
  id: string;
  traceId: string;
  phase: DlqPhase;
  errorMessage: string;
}

export interface StoredDlqItem extends DlqInsert {
  attemptCount: number;
  lastAttemptedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** 후처리 실패 DLQ 저장소 계약 */
export interface DlqStore {
  insert(params: DlqInsert): Promise<void>;
  findPending(limit?: number): Promise<StoredDlqItem[]>;
  markAttempted(id: string): Promise<void>;
  markResolved(id: string): Promise<void>;
}
