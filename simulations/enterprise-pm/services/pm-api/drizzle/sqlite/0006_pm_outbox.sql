-- @def.boundary sim-pm-api
-- Phase 3 — pm-api domain 의 모든 슬라이스가 공유하는 단일 outbox 테이블.
-- 기존 슬라이스별 outbox (0002~0005) 는 history 로 유지하되, 코드 참조 0.
-- 다른 sim-* 서비스 (approval/auth/document/notification) 와 동일한
-- service-shared outbox 패턴. 슬라이스 구분은 event_name 으로 한다.
-- 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
CREATE TABLE IF NOT EXISTS pm_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS pm_outbox_status_idx ON pm_outbox_events(status, occurred_at);
