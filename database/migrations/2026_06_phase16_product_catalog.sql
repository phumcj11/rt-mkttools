-- Phase 16: Product Catalog + Marketing Snapshot
-- ขยาย ERP product cache ให้รองรับสินค้าใหม่/สินค้าเปลี่ยน/active status
-- และเพิ่ม snapshot สำหรับโปรโมชั่นต่อ SKU

ALTER TABLE erp_product_cache
  ADD COLUMN IF NOT EXISTS first_seen_at DATETIME NULL AFTER abc_company,
  ADD COLUMN IF NOT EXISTS last_seen_at DATETIME NULL AFTER first_seen_at,
  ADD COLUMN IF NOT EXISTS last_changed_at DATETIME NULL AFTER last_seen_at,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER last_changed_at,
  ADD COLUMN IF NOT EXISTS change_hash CHAR(64) NOT NULL DEFAULT '' AFTER is_active;

CREATE INDEX IF NOT EXISTS idx_erp_product_brand ON erp_product_cache (brand);
CREATE INDEX IF NOT EXISTS idx_erp_product_first_seen ON erp_product_cache (first_seen_at);
CREATE INDEX IF NOT EXISTS idx_erp_product_last_seen ON erp_product_cache (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_erp_product_active ON erp_product_cache (is_active);

UPDATE erp_product_cache
SET first_seen_at = COALESCE(first_seen_at, synced_at),
    last_seen_at = COALESCE(last_seen_at, synced_at),
    last_changed_at = COALESCE(last_changed_at, synced_at),
    is_active = 1
WHERE first_seen_at IS NULL OR last_seen_at IS NULL OR last_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS product_sync_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  total_count INT UNSIGNED NOT NULL DEFAULT 0,
  new_count INT UNSIGNED NOT NULL DEFAULT 0,
  changed_count INT UNSIGNED NOT NULL DEFAULT 0,
  inactive_count INT UNSIGNED NOT NULL DEFAULT 0,
  promotion_count INT UNSIGNED NOT NULL DEFAULT 0,
  sales_count INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  error TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX idx_product_sync_runs_status (status),
  INDEX idx_product_sync_runs_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_promotion_snapshot (
  sku VARCHAR(64) NOT NULL,
  product_id INT UNSIGNED NOT NULL DEFAULT 0,
  active_promotion_count INT UNSIGNED NOT NULL DEFAULT 0,
  promotion_names TEXT NULL,
  promotion_types TEXT NULL,
  lowest_promo_price DECIMAL(12, 2) NULL,
  best_remaining_gp_pct DECIMAL(6, 2) NULL,
  promotions JSON NULL,
  synced_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (sku),
  INDEX idx_product_promo_product_id (product_id),
  INDEX idx_product_promo_active_count (active_promotion_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
