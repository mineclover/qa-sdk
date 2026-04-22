-- @def.boundary sim-notification-api
-- Plan 11c — PG 초기 스키마. SIM_NOTIF_PG_DDL 복사본.
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.notif_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sim_notif_recipient ON sim.notif_notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_sim_notif_status ON sim.notif_notifications(status);

CREATE TABLE IF NOT EXISTS sim.notif_subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sim_sub_event ON sim.notif_subscriptions(event_type);
