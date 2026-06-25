CREATE TABLE IF NOT EXISTS branch_storefront_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id INT NOT NULL,
  branch_code VARCHAR(50) NULL,
  activity_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  photo_urls JSON NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_storefront_activity_tenant_date (tenant_id, activity_date),
  KEY idx_storefront_activity_branch (tenant_id, branch_id, activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
