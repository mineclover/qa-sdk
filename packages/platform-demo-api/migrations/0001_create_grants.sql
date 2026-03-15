CREATE TABLE IF NOT EXISTS grants (
  feature_id TEXT NOT NULL,
  role       TEXT NOT NULL,
  PRIMARY KEY (feature_id, role)
);

-- Seed default v2 grant data
INSERT INTO grants (feature_id, role) VALUES
  ('product_list', 'admin'),
  ('product_list', 'developer'),
  ('product_list', 'operator'),
  ('product_list', 'customer'),
  ('product_list', 'viewer'),
  ('product_list', 'readonly'),
  ('order_list', 'admin'),
  ('order_list', 'developer'),
  ('order_list', 'operator'),
  ('order_list', 'viewer'),
  ('payment_history', 'admin'),
  ('payment_history', 'developer'),
  ('payment_history', 'operator'),
  ('payment_cancel_req', 'admin'),
  ('payment_cancel_req', 'customer'),
  ('payment_cancel_approve', 'admin'),
  ('payment_cancel_approve', 'operator'),
  ('user_mgmt', 'admin'),
  ('config_change', 'admin');
