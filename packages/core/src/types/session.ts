// ── QA Session ──────────────────────────────────────────

export interface QaSession {
  qa_session_id: string;
  scenario_id?: string;
  started_at: string;
  labels?: Record<string, string>;
}
