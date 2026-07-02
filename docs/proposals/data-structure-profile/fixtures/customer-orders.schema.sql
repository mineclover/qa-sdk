CREATE TABLE crm.customers (
  customer_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE crm.orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES crm.customers(customer_id),
  order_total NUMERIC NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE analytics.customer_order_features (
  customer_token TEXT PRIMARY KEY,
  order_count INTEGER NOT NULL,
  lifetime_value NUMERIC NOT NULL
);
