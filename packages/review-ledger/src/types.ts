// ── 입력 ──────────────────────────────────────────────

/** 리뷰 완료 기록 입력 */
export interface MarkReviewInput {
  /** 레포 루트 기준 상대경로 목록 */
  filePaths: string[];
  /** 리뷰어 이름 */
  reviewer: string;
  /** 리뷰에 사용된 AI 모델 (예: claude-opus-4-6) */
  aiModel?: string;
  /** 리뷰 완료 기준 커밋 SHA. 생략 시 HEAD */
  commit?: string;
  /** 리뷰 메모 */
  notes?: string;
}

// ── 저장 ──────────────────────────────────────────────

/** DB에 저장된 리뷰 엔트리 */
export interface ReviewEntry {
  id: number;
  filePath: string;
  reviewedCommit: string;
  reviewedAt: string;
  reviewer: string;
  aiModel: string | null;
  serviceScope: string;
  notes: string | null;
}

// ── 상태 조회 ─────────────────────────────────────────

/** 파일 리뷰 상태 3-state */
export type ReviewStatus = "reviewed" | "stale" | "unreviewed";

/** 파일별 리뷰 상태 */
export interface FileReviewStatus {
  filePath: string;
  status: ReviewStatus;
  serviceScope: string;
  /** 최신 리뷰 엔트리. unreviewed면 null */
  lastEntry: ReviewEntry | null;
  /** 해당 파일의 최신 커밋 SHA */
  latestFileCommit: string | null;
}

// ── 집계 ──────────────────────────────────────────────

/** 서비스 스코프별 리뷰 커버리지 */
export interface ServiceCoverage {
  serviceScope: string;
  total: number;
  reviewed: number;
  stale: number;
  unreviewed: number;
  /** reviewed / total * 100 */
  coveragePercent: number;
}

// ── 기록 결과 ─────────────────────────────────────────

export interface MarkResult {
  /** 기록된 파일 수 */
  marked: number;
  /** 이미 동일 커밋으로 기록된 파일 수 (건너뜀) */
  skipped: number;
  /** 기록 기준 커밋 SHA */
  commit: string;
}

// ── Feedback Request ───────────────────────────────────

/** AI 피드백 요청 상태 */
export type FeedbackRequestStatus = "open" | "resolved" | "cancelled";

/** 파일과 연결된 definition 문서 후보 */
export interface FeedbackRelatedDoc {
  docId: string;
  scope: string;
  aspect: string;
  depth: string;
  reason: "service-scope" | "file-hint";
  purpose?: string;
}

/** 번들에 포함된 파일 단위 증거 */
export interface EvidenceBundleItem {
  filePath: string;
  serviceScope: string;
  status: ReviewStatus;
  latestFileCommit: string | null;
  reviewedCommit: string | null;
  reviewedAt: string | null;
  reviewer: string | null;
  aiModel: string | null;
  notes: string | null;
  relatedDocs: FeedbackRelatedDoc[];
}

/** AI 피드백 요청에 첨부되는 증거 묶음 */
export interface EvidenceBundle {
  total: number;
  reviewed: number;
  stale: number;
  unreviewed: number;
  items: EvidenceBundleItem[];
}

/** 피드백 요청 생성 입력 */
export interface CreateFeedbackRequestInput {
  requestedBy: string;
  purpose: string;
  targetModel?: string;
  serviceScope?: string;
  notes?: string;
  filePaths?: string[];
  relatedDocsByFile?: Record<string, FeedbackRelatedDoc[]>;
}

/** 저장된 피드백 요청 */
export interface FeedbackRequest {
  id: string;
  createdAt: string;
  requestedBy: string;
  purpose: string;
  targetModel: string | null;
  serviceScope: string | null;
  status: FeedbackRequestStatus;
  notes: string | null;
  prompt: string;
  evidenceBundle: EvidenceBundle;
}
