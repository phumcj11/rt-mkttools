-- Phase 21: Manus creative assets + Blotato publish jobs for AI Content Factory

CREATE TABLE IF NOT EXISTS content_assets (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id          BIGINT UNSIGNED NOT NULL,
  content_item_id    BIGINT UNSIGNED NULL,
  sku                VARCHAR(100) NULL,
  product_name       VARCHAR(255) NULL,
  source             VARCHAR(30) NOT NULL DEFAULT 'manus',
  status             VARCHAR(30) NOT NULL DEFAULT 'generating',
  image_url          VARCHAR(1000) NULL,
  source_image_url   VARCHAR(1000) NULL,
  prompt             MEDIUMTEXT NULL,
  manus_task_id      VARCHAR(255) NULL,
  manus_task_url     VARCHAR(1000) NULL,
  error_message      TEXT NULL,
  created_by         BIGINT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_content_assets_tenant (tenant_id),
  INDEX idx_content_assets_content (content_item_id),
  INDEX idx_content_assets_sku (sku),
  INDEX idx_content_assets_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_publish_jobs (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id             BIGINT UNSIGNED NOT NULL,
  content_item_id       BIGINT UNSIGNED NOT NULL,
  asset_id              BIGINT UNSIGNED NULL,
  provider              VARCHAR(30) NOT NULL DEFAULT 'blotato',
  platform              VARCHAR(50) NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'queued',
  blotato_submission_id VARCHAR(255) NULL,
  public_url            VARCHAR(1000) NULL,
  scheduled_at          DATETIME NULL,
  error_message         TEXT NULL,
  request               JSON NULL,
  response              JSON NULL,
  created_by            BIGINT UNSIGNED NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_publish_jobs_tenant (tenant_id),
  INDEX idx_publish_jobs_content (content_item_id),
  INDEX idx_publish_jobs_asset (asset_id),
  INDEX idx_publish_jobs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
