-- Phase 19: ERP Campaign cache + sign promotion traceability
-- sync ผ่าน POST /erp/sync/campaigns

CREATE TABLE IF NOT EXISTS erp_campaign_cache (
  campaign_id          INT UNSIGNED    NOT NULL,
  code                 VARCHAR(100)    NULL,
  name                 VARCHAR(500)    NOT NULL DEFAULT '',
  promotion_type       VARCHAR(100)    NULL,
  promotion_type_name  VARCHAR(200)    NULL,
  date_start           VARCHAR(20)     NULL,
  date_stop            VARCHAR(20)     NULL,
  retail_price         DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  promo_price          DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  discount_pct         DECIMAL(6, 2)   NOT NULL DEFAULT 0,
  is_active            TINYINT(1)      NOT NULL DEFAULT 1,
  product_count        INT UNSIGNED    NOT NULL DEFAULT 0,
  conditions           TEXT            NULL,
  products             JSON            NULL,
  free_items           JSON            NULL,
  synced_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (campaign_id),
  INDEX idx_erp_campaign_type (promotion_type),
  INDEX idx_erp_campaign_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sign_requests
  ADD COLUMN IF NOT EXISTS erp_campaign_id   INT UNSIGNED NULL AFTER exported_at,
  ADD COLUMN IF NOT EXISTS erp_campaign_name VARCHAR(255) NULL AFTER erp_campaign_id,
  ADD COLUMN IF NOT EXISTS erp_step_text     VARCHAR(255) NULL AFTER erp_campaign_name;
