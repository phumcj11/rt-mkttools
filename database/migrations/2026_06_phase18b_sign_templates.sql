-- sign_templates table (added after initial phase18 deploy)
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
