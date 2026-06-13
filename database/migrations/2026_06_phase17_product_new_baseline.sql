-- Phase 17: Reset Product Catalog "new product" baseline
-- Existing SKUs that were already in cache before Product Catalog tracking should not
-- show as "เข้าใหม่วันนี้". Future unseen SKUs will get first_seen_at from syncProducts().

UPDATE erp_product_cache
SET first_seen_at = '2000-01-01 00:00:00',
    last_changed_at = COALESCE(last_changed_at, synced_at)
WHERE first_seen_at IS NOT NULL
  AND first_seen_at <= NOW();
