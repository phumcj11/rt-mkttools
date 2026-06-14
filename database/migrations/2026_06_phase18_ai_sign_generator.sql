-- Phase 18: AI Sign Generator domain

CREATE TABLE IF NOT EXISTS sign_requests (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  requester_id   BIGINT UNSIGNED NULL,
  reviewer_id    BIGINT UNSIGNED NULL,
  request_no     VARCHAR(40) NOT NULL,
  branch_name    VARCHAR(150) NOT NULL,
  requester_name VARCHAR(150) NOT NULL,
  sku            VARCHAR(80) NULL,
  product_name   VARCHAR(255) NOT NULL,
  price          DECIMAL(10,2) NULL,
  promotion      VARCHAR(255) NULL,
  sign_type      ENUM('price_tag','promotion','benefit_card','shelf_tag') NOT NULL,
  sign_size      ENUM('a5','a6','a7','shelf_tag') NOT NULL,
  notes          TEXT NULL,
  status         ENUM('submitted','ai_processing','pending_review','approved','rejected','need_more_info','exported') NOT NULL DEFAULT 'submitted',
  status_note    TEXT NULL,
  approved_at    DATETIME NULL,
  exported_at    DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sign_requests_tenant_status (tenant_id, status),
  INDEX idx_sign_requests_tenant_branch (tenant_id, branch_name),
  INDEX idx_sign_requests_requester (tenant_id, requester_id),
  UNIQUE KEY uq_sign_requests_no (tenant_id, request_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sign_request_assets (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  request_id    BIGINT UNSIGNED NOT NULL,
  kind          ENUM('product','current_sign','shelf','other') NOT NULL DEFAULT 'other',
  original_name VARCHAR(255) NULL,
  filename      VARCHAR(255) NOT NULL,
  url           VARCHAR(512) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_assets_request (request_id),
  INDEX idx_sign_assets_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sign_ai_results (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id              BIGINT UNSIGNED NOT NULL,
  request_id             BIGINT UNSIGNED NOT NULL,
  extracted_product_name VARCHAR(255) NULL,
  extracted_price        VARCHAR(80) NULL,
  extracted_promotion    VARCHAR(255) NULL,
  headline               VARCHAR(255) NULL,
  benefits               TEXT NULL,
  raw_text               TEXT NULL,
  model                  VARCHAR(100) NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_ai_results_request (request_id),
  INDEX idx_sign_ai_results_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sign_drafts (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  request_id      BIGINT UNSIGNED NOT NULL,
  version         INT UNSIGNED NOT NULL DEFAULT 1,
  template_id     VARCHAR(80) NOT NULL,
  preview_url     VARCHAR(512) NOT NULL,
  preview_path    VARCHAR(512) NOT NULL,
  editable_fields TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_drafts_request (request_id),
  INDEX idx_sign_drafts_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sign_reviews (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  request_id    BIGINT UNSIGNED NOT NULL,
  reviewer_id   BIGINT UNSIGNED NULL,
  decision      ENUM('approve','reject','need_more_info') NOT NULL,
  note          TEXT NULL,
  edited_fields TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_reviews_request (request_id),
  INDEX idx_sign_reviews_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sign_exports (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  request_id    BIGINT UNSIGNED NOT NULL,
  format        ENUM('png','pdf') NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  url           VARCHAR(512) NOT NULL,
  local_path    VARCHAR(512) NOT NULL,
  drive_file_id VARCHAR(255) NULL,
  drive_url     VARCHAR(512) NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'ready',
  error         TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_exports_request (request_id),
  INDEX idx_sign_exports_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Phase 18 AI Sign Generator migration completed.' AS status;

-- sign_templates
CREATE TABLE IF NOT EXISTS sign_templates (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(150) NOT NULL,
  sign_type  ENUM('price_tag','promotion','benefit_card','shelf_tag') NULL,
  sign_size  ENUM('a5','a6','a7','shelf_tag') NULL,
  filename   VARCHAR(255) NOT NULL,
  url        VARCHAR(512) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sign_templates_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
