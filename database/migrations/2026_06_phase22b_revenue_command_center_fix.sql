-- Phase 22b: Revenue Command Center tables (fix reserved word year_month)

CREATE TABLE IF NOT EXISTS sales_targets (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id           BIGINT UNSIGNED NOT NULL,
  `year_month`        CHAR(7)         NOT NULL COMMENT 'YYYY-MM',
  branch_id           INT             NULL COMMENT 'NULL = company-wide',
  branch_code         VARCHAR(50)     NULL,
  target_revenue      DECIMAL(16, 2)  NOT NULL DEFAULT 0,
  target_transactions INT UNSIGNED    NULL,
  target_avg_ticket   DECIMAL(12, 2)  NULL,
  notes               TEXT            NULL,
  created_at          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_target (tenant_id, `year_month`, branch_id),
  INDEX idx_sales_target_tenant (tenant_id),
  INDEX idx_sales_target_month (`year_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branch_traffic_daily (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  branch_id     INT             NOT NULL,
  branch_code   VARCHAR(50)     NULL,
  traffic_date  DATE            NOT NULL,
  foot_traffic  INT UNSIGNED    NOT NULL DEFAULT 0,
  transactions  INT UNSIGNED    NULL,
  notes         VARCHAR(255)    NULL,
  source        ENUM('manual', 'import', 'camera') NOT NULL DEFAULT 'manual',
  created_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_branch_traffic (tenant_id, branch_id, traffic_date),
  INDEX idx_traffic_tenant_date (tenant_id, traffic_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branch_customer_mix_daily (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  branch_id      INT             NOT NULL,
  branch_code    VARCHAR(50)     NULL,
  mix_date       DATE            NOT NULL,
  customer_type  VARCHAR(50)     NOT NULL,
  count          INT UNSIGNED    NOT NULL DEFAULT 0,
  pct            DECIMAL(5, 2)   NULL,
  source         ENUM('manual', 'import', 'estimate') NOT NULL DEFAULT 'manual',
  created_at     DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_mix (tenant_id, branch_id, mix_date, customer_type),
  INDEX idx_mix_tenant_date (tenant_id, mix_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
