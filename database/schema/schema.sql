-- ============================================================
--  ร้าน 100 บาท — Marketing AI Platform
--  MySQL Schema (DDL) — Reference design for Phase 1
--  Charset: utf8mb4 (รองรับภาษาไทย + emoji)
--  Multi-tenant: ทุกตารางธุรกิจอ้างอิง tenant_id
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
--  TENANCY & ACCESS
-- ------------------------------------------------------------
CREATE TABLE tenants (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150) NOT NULL,
  slug            VARCHAR(150) NOT NULL,
  status          ENUM('active','suspended','trial') NOT NULL DEFAULT 'trial',
  locale          VARCHAR(5)  NOT NULL DEFAULT 'th',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  branch_id       BIGINT UNSIGNED NULL,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(150) NULL,
  locale          VARCHAR(5)  NOT NULL DEFAULT 'th',
  status          ENUM('active','invited','disabled') NOT NULL DEFAULT 'active',
  last_login_at   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY idx_users_tenant (tenant_id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(50) NOT NULL,            -- owner | admin | editor | viewer
  description     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  user_id         BIGINT UNSIGNED NOT NULL,
  role_id         BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_userroles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_userroles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  ORGANIZATION (Branches)
-- ------------------------------------------------------------
CREATE TABLE branches (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  code            VARCHAR(50) NULL,
  address         VARCHAR(255) NULL,
  phone           VARCHAR(30) NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_branches_tenant (tenant_id),
  CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  AUTH
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  expires_at      DATETIME NOT NULL,
  revoked_at      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  expires_at      DATETIME NOT NULL,
  used_at         DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pwreset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  CATALOG
-- ------------------------------------------------------------
CREATE TABLE categories (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_categories_tenant (tenant_id),
  CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  category_id     BIGINT UNSIGNED NULL,
  sku             VARCHAR(64) NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  price           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_url       VARCHAR(500) NULL,
  status          ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_tenant (tenant_id),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  MARKETING
-- ------------------------------------------------------------
CREATE TABLE campaigns (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  branch_id       BIGINT UNSIGNED NULL,
  name            VARCHAR(200) NOT NULL,
  objective       VARCHAR(100) NULL,              -- awareness | sales | engagement
  channel         VARCHAR(50)  NULL,              -- facebook | line | tiktok | instagram
  status          ENUM('draft','scheduled','running','completed','archived') NOT NULL DEFAULT 'draft',
  start_date      DATE NULL,
  end_date        DATE NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaigns_tenant (tenant_id),
  CONSTRAINT fk_campaigns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaigns_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  campaign_id     BIGINT UNSIGNED NULL,
  title           VARCHAR(200) NOT NULL,
  discount_type   ENUM('percent','amount','bundle') NOT NULL DEFAULT 'percent',
  discount_value  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  start_date      DATE NULL,
  end_date        DATE NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promotions_tenant (tenant_id),
  CONSTRAINT fk_promotions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotions_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_items (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  campaign_id     BIGINT UNSIGNED NULL,
  type            ENUM('caption','post','ad','line_broadcast','blog') NOT NULL DEFAULT 'post',
  channel         VARCHAR(50) NULL,
  title           VARCHAR(200) NULL,
  body            MEDIUMTEXT NULL,
  locale          VARCHAR(5) NOT NULL DEFAULT 'th',
  status          ENUM('draft','approved','scheduled','published') NOT NULL DEFAULT 'draft',
  scheduled_at    DATETIME NULL,
  ai_request_id   BIGINT UNSIGNED NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_content_tenant (tenant_id),
  KEY idx_content_campaign (campaign_id),
  CONSTRAINT fk_content_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  AI
-- ------------------------------------------------------------
CREATE TABLE ai_templates (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NULL,           -- NULL = template กลางของระบบ
  name            VARCHAR(150) NOT NULL,
  category        VARCHAR(50) NULL,
  prompt          MEDIUMTEXT NOT NULL,
  locale          VARCHAR(5) NOT NULL DEFAULT 'th',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aitemplates_tenant (tenant_id),
  CONSTRAINT fk_aitemplates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_requests (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NULL,
  template_id     BIGINT UNSIGNED NULL,
  model           VARCHAR(60) NOT NULL,
  prompt          MEDIUMTEXT NOT NULL,
  response        MEDIUMTEXT NULL,
  prompt_tokens   INT UNSIGNED NOT NULL DEFAULT 0,
  completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('pending','success','error') NOT NULL DEFAULT 'pending',
  error_message   VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_airequests_tenant (tenant_id),
  CONSTRAINT fk_airequests_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_airequests_template FOREIGN KEY (template_id) REFERENCES ai_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_usage (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  period_month    CHAR(7) NOT NULL,               -- 'YYYY-MM'
  total_tokens    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_requests  INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_aiusage_tenant_period (tenant_id, period_month),
  CONSTRAINT fk_aiusage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  REALTIME (Notifications & Chat)
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NULL,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  body            TEXT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_tenant_user (tenant_id, user_id),
  CONSTRAINT fk_notif_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_threads (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(200) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_threads_tenant (tenant_id),
  CONSTRAINT fk_threads_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id       BIGINT UNSIGNED NOT NULL,
  role            ENUM('user','assistant','system') NOT NULL,
  content         MEDIUMTEXT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_thread (thread_id),
  CONSTRAINT fk_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  ANALYTICS
-- ------------------------------------------------------------
CREATE TABLE sales_records (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  branch_id       BIGINT UNSIGNED NULL,
  product_id      BIGINT UNSIGNED NULL,
  campaign_id     BIGINT UNSIGNED NULL,
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity        INT UNSIGNED NOT NULL DEFAULT 0,
  sold_at         DATETIME NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sales_tenant_date (tenant_id, sold_at),
  CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE metrics_daily (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  metric_date     DATE NOT NULL,
  total_sales     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_orders    INT UNSIGNED NOT NULL DEFAULT 0,
  ai_requests     INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metrics_tenant_date (tenant_id, metric_date),
  CONSTRAINT fk_metrics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  BILLING
-- ------------------------------------------------------------
CREATE TABLE plans (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(40) NOT NULL,           -- free | pro | business
  name            VARCHAR(100) NOT NULL,
  price_monthly   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ai_token_limit  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  user_limit      INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  plan_id         BIGINT UNSIGNED NOT NULL,
  status          ENUM('trialing','active','past_due','canceled') NOT NULL DEFAULT 'trialing',
  started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_subs_tenant (tenant_id),
  CONSTRAINT fk_subs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency        CHAR(3) NOT NULL DEFAULT 'THB',
  status          ENUM('open','paid','void') NOT NULL DEFAULT 'open',
  issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at         DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_invoices_tenant (tenant_id),
  CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  SYSTEM
-- ------------------------------------------------------------
CREATE TABLE settings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NULL,
  `key`           VARCHAR(100) NOT NULL,
  `value`         TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_tenant_key (tenant_id, `key`),
  CONSTRAINT fk_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NULL,
  action          VARCHAR(100) NOT NULL,
  entity          VARCHAR(100) NULL,
  entity_id       BIGINT UNSIGNED NULL,
  metadata        JSON NULL,
  ip_address      VARCHAR(45) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_tenant (tenant_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
