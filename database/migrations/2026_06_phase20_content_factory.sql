-- Phase 20: AI Content Factory — 15 content types, SKU/campaign linkage

ALTER TABLE content_items
  MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL AFTER campaign_id,
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255) NULL AFTER sku,
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NULL AFTER campaign_name;

ALTER TABLE content_items
  ADD INDEX IF NOT EXISTS idx_content_sku (sku),
  ADD INDEX IF NOT EXISTS idx_content_status (status);
