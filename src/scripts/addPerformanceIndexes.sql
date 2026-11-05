-- Safe to run more than once. Run in the Supabase SQL editor (use CONCURRENTLY one statement at a time
-- if you want zero locking; plain CREATE INDEX is fine for tables of this size).
CREATE INDEX IF NOT EXISTS orders_user_id_idx        ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_driver_status_idx  ON orders (driver_id, status);
CREATE INDEX IF NOT EXISTS orders_status_idx         ON orders (status);
CREATE INDEX IF NOT EXISTS orders_delivery_date_idx  ON orders (delivery_date);
CREATE INDEX IF NOT EXISTS orders_created_at_idx     ON orders ("createdAt");
CREATE INDEX IF NOT EXISTS orders_delivered_at_idx   ON orders (delivered_at);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx  ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items (product_id);
ANALYZE orders;
ANALYZE order_items;
