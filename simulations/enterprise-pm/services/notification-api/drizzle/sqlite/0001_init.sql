-- @def.boundary sim-notification-api
-- Plan 11c — SQLite 초기 스키마. SIM_NOTIF_SQLITE_DDL 복사본.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sub_event ON subscriptions(event_type);
