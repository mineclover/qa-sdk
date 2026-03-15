CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT    NOT NULL,
  level      TEXT    NOT NULL,
  svc_addr   INTEGER NOT NULL,
  perm_addr  INTEGER,
  evt_addr   INTEGER,
  action     TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  user_id    TEXT    NOT NULL
);

CREATE INDEX idx_logs_ts       ON logs (ts DESC);
CREATE INDEX idx_logs_level    ON logs (level);
CREATE INDEX idx_logs_svc_addr ON logs (svc_addr);
