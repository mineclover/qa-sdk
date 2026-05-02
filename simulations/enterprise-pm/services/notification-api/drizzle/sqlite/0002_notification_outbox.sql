-- @def.boundary sim-notification-api
-- Phase 2 — notification + subscription 슬라이스 본 테이블 + 공유 outbox SQLite 추가.
-- 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
CREATE TABLE IF NOT EXISTS notif_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL,
  sent_at TEXT,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notif_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notif_notifications(status);

CREATE TABLE IF NOT EXISTS notif_subscriptions (
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_notif_sub_event ON notif_subscriptions(event_type);

CREATE TABLE IF NOT EXISTS notification_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox_events(status, occurred_at);
